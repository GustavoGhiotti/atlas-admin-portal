import asyncio
from datetime import datetime
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unicodedata
from src.infrastructure.repositories.agenda_repository import AgendaRepository
from src.infrastructure.services.email_service import EmailService
from src.infrastructure.services.env_load import get_env
from src.schemas.agenda import AgendaParticipanteRequest, AgendaPendenciaRequest, AgendaRequest
from src.shared.exception import AtlasException, NaoEncontradoException


class AgendaService:
    VALID_STATUS = {"AGENDADA", "REALIZADA", "CANCELADA", "REAGENDADA", "APAGADA"}
    VALID_STATUS_PENDENCIA = {"PENDENTE", "RESOLVIDA"}

    def __init__(self) -> None:
        self.repository = AgendaRepository()

    def listar(self) -> list[dict[str, object]]:
        return [self._map_item(item) for item in self.repository.listar()]

    def listar_carteiras(self) -> list[dict[str, object]]:
        return [self._map_carteira(item) for item in self.repository.listar_carteiras()]

    def criar(self, payload: AgendaRequest, login_responsavel: str | None = None) -> dict[str, object]:
        data = self._normalize_payload(payload)
        data["login_responsavel"] = self._normalize_login(login_responsavel)
        agenda_id = self.repository.criar(**data)
        if not agenda_id:
            raise AtlasException("Nao foi possivel criar o agendamento.", status_code=500)

        item = self.repository.buscar(agenda_id)
        if not item:
            raise NaoEncontradoException("Agendamento criado, mas nao localizado para retorno.")
        return self._map_item(item)

    def atualizar(
        self,
        agenda_id: int,
        payload: AgendaRequest,
        login_responsavel: str | None = None,
    ) -> dict[str, object]:
        data = self._normalize_payload(payload)
        data["login_responsavel"] = self._normalize_login(login_responsavel)
        if not self.repository.atualizar(agenda_id, **data):
            raise NaoEncontradoException("Agendamento nao encontrado.")

        item = self.repository.buscar(agenda_id)
        if not item:
            raise NaoEncontradoException("Agendamento nao encontrado apos atualizacao.")
        return self._map_item(item)

    def excluir(self, agenda_id: int, login_responsavel: str | None = None) -> None:
        if not self.repository.excluir(agenda_id, self._normalize_login(login_responsavel)):
            raise NaoEncontradoException("Agendamento nao encontrado.")

    def listar_pendencias_abertas_usuario(self, login_responsavel: str | None = None) -> list[dict[str, object]]:
        login = self._normalize_login(login_responsavel)
        if not login:
            return []
        return [self._map_pendencia_aberta(item) for item in self.repository.listar_pendencias_abertas_usuario(login)]

    def resolver_pendencia(
        self,
        agenda_id: int,
        pendencia_id: int,
        login_responsavel: str | None = None,
    ) -> dict[str, object]:
        if not self.repository.resolver_pendencia(agenda_id, pendencia_id, self._normalize_login(login_responsavel)):
            raise NaoEncontradoException("Pendencia nao encontrada.")

        item = self.repository.buscar(agenda_id)
        if not item:
            raise NaoEncontradoException("Agendamento nao encontrado apos resolucao da pendencia.")
        return self._map_item(item)

    async def enviar_ata_por_email(
        self,
        agenda_id: int,
        html: str,
        login_responsavel: str | None = None,
        anexos_extras: list[dict[str, object]] | None = None,
        pdf_ata: bytes | None = None,
        destinatarios_raw: str | None = None,
    ) -> dict[str, object]:
        item = self.repository.buscar(agenda_id)
        if not item:
            raise NaoEncontradoException("Agendamento nao encontrado.")

        agenda = self._map_item(item)
        carteira = str(agenda.get("carteira") or "visita").strip()
        data_reuniao = str(agenda.get("date") or "").strip()
        destinatarios = self._parse_destinatarios(destinatarios_raw) if destinatarios_raw else self._get_destinatarios_ata()
        destino_label = "destinatarios selecionados" if destinatarios_raw else "diretoria/gerencia"
        pdf = pdf_ata or self._gerar_pdf_ata(html, agenda)
        filename = f"ata-reuniao-{agenda_id}.pdf"
        attachments = [
            {
                "filename": filename,
                "content": pdf,
                "maintype": "application",
                "subtype": "pdf",
            },
            *(anexos_extras or []),
        ]

        await asyncio.to_thread(
            EmailService().send_html,
            to_email=destinatarios,
            subject=f"ATA da reuniao - {carteira}",
            html=self._montar_email_ata(carteira, data_reuniao),
            attachments=attachments,
        )
        envio_em = self.repository.registrar_envio_ata(agenda_id, self._normalize_login(login_responsavel))

        return {
            "mensagem": "ATA enviada com sucesso.",
            "destino": destino_label,
            "total_destinatarios": len(destinatarios),
            "enviado_em": envio_em,
            "enviado_em_formatado": self._format_datetime_br(envio_em),
        }

    def gerar_pdf_ata(self, agenda_id: int, html: str) -> bytes:
        item = self.repository.buscar(agenda_id)
        if not item:
            raise NaoEncontradoException("Agendamento nao encontrado.")

        agenda = self._map_item(item)
        return self._gerar_pdf_ata(html, agenda)

    def gerar_pdf_relatorio(self, html: str) -> bytes:
        return self._gerar_pdf_html(html)

    def _normalize_payload(self, payload: AgendaRequest) -> dict[str, object]:
        dia = payload.date.strip()
        horario_entrada = self._normalize_horario(payload.horario_entrada)
        horario_saida = self._normalize_horario(payload.horario_saida)
        carteira = payload.carteira.strip()
        local_visita = self._normalize_optional_text(payload.local_visita)
        motivo_visita = payload.motivo_visita.strip()
        status_visita = self._normalize_status(payload.status_visita)
        resumo_visita = self._normalize_optional_text(payload.resumo_visita)
        o_que_foi_feito = self._normalize_optional_text(payload.o_que_foi_feito)
        pendencias = self._normalize_pendencias(payload.pendencias)
        participantes = self._normalize_participantes(payload.participantes)
        observacoes = self._normalize_optional_text(payload.observacoes)

        if len(dia) != 10:
            raise AtlasException("Data invalida. Use o formato YYYY-MM-DD.")
        if len(horario_entrada) != 8 or len(horario_saida) != 8:
            raise AtlasException("Horario invalido. Use o formato HH:MM ou HH:MM:SS.")
        if not carteira:
            raise AtlasException("Carteira e obrigatoria.")
        if not motivo_visita:
            raise AtlasException("Motivo da visita e obrigatorio.")

        return {
            "dia": dia,
            "horario_entrada": horario_entrada,
            "horario_saida": horario_saida,
            "carteira": carteira,
            "local_visita": local_visita,
            "motivo_visita": motivo_visita,
            "status_visita": status_visita,
            "resumo_visita": resumo_visita,
            "o_que_foi_feito": o_que_foi_feito,
            "pendencias": pendencias,
            "participantes": participantes,
            "observacoes": observacoes,
        }

    def _normalize_horario(self, value: str) -> str:
        value = str(value or "").strip()
        if len(value) == 5:
            return f"{value}:00"
        return value

    def _normalize_status(self, value: str | None) -> str:
        status = str(value or "AGENDADA").strip().upper()
        if status not in self.VALID_STATUS:
            raise AtlasException("Status da visita invalido.")
        return status

    def _normalize_login(self, value: str | None) -> str | None:
        login = str(value or "").strip().upper()
        return login or None

    def _normalize_optional_text(self, value: str | None) -> str | None:
        text = str(value or "").strip()
        return text or None

    def _format_datetime_br(self, value: str | None) -> str:
        text = str(value or "").strip()
        if not text:
            return datetime.now().strftime("%d/%m/%Y %H:%M")
        try:
            return datetime.strptime(text[:19], "%Y-%m-%d %H:%M:%S").strftime("%d/%m/%Y %H:%M")
        except ValueError:
            return datetime.now().strftime("%d/%m/%Y %H:%M")

    def _get_destinatarios_ata(self) -> list[str]:
        raw = get_env("AGENDA_ATA_EMAIL_DESTINATARIOS", default="desenvolvimento@empresa.example") or ""
        destinatarios = self._parse_destinatarios(raw)
        if not destinatarios:
            raise AtlasException("Nenhum destinatario configurado para envio da ATA.")
        return destinatarios

    def _parse_destinatarios(self, raw: str | None) -> list[str]:
        emails: list[str] = []
        for item in re.split(r"[,;\s]+", str(raw or "")):
            email = item.strip().lower()
            if not email or email in emails:
                continue
            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                raise AtlasException(f"E-mail invalido para envio da ATA: {email}")
            emails.append(email)
        if len(emails) > 20:
            raise AtlasException("Informe no maximo 20 destinatarios para envio da ATA.")
        if not emails:
            raise AtlasException("Informe ao menos um destinatario para envio da ATA.")
        return emails

    def _gerar_pdf_ata(self, html: str, agenda: dict[str, object]) -> bytes:
        return self._gerar_pdf_html(html)

    def _gerar_pdf_html(self, html: str) -> bytes:
        browser_path = self._get_pdf_browser_path()
        if browser_path:
            return self._gerar_pdf_ata_com_browser(browser_path, html)

        raise AtlasException(
            "Nao foi encontrado Chrome ou Edge no servidor para gerar o PDF.",
            status_code=500,
        )

    def _get_pdf_browser_path(self) -> str | None:
        candidates = [
            shutil.which("chrome.exe"),
            shutil.which("msedge.exe"),
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        ]
        for candidate in candidates:
            if candidate and Path(candidate).exists():
                return candidate
        return None

    def _gerar_pdf_ata_com_browser(self, browser_path: str, html: str) -> bytes:
        with tempfile.TemporaryDirectory(prefix="atlas-ata-") as temp_dir:
            temp_path = Path(temp_dir)
            html_path = temp_path / "ata.html"
            pdf_path = temp_path / "ata.pdf"
            profile_path = temp_path / "profile"
            html_path.write_text(html, encoding="utf-8")

            result = subprocess.run(
                [
                    browser_path,
                    "--headless=new",
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    f"--user-data-dir={profile_path}",
                    "--run-all-compositor-stages-before-draw",
                    "--virtual-time-budget=1000",
                    "--no-pdf-header-footer",
                    "--print-to-pdf-no-header",
                    f"--print-to-pdf={pdf_path}",
                    html_path.as_uri(),
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=90,
            )
            if result.returncode != 0 or not pdf_path.exists():
                detail = (result.stderr or result.stdout or "browser nao gerou o PDF").strip()
                raise AtlasException(f"Falha ao gerar PDF da ATA: {detail}", status_code=500)
            return pdf_path.read_bytes()

    def _montar_email_ata(self, carteira: str, data_reuniao: str) -> str:
        data_formatada = data_reuniao
        if len(data_reuniao) == 10:
            ano, mes, dia = data_reuniao.split("-")
            data_formatada = f"{dia}/{mes}/{ano}"
        return f"""
        <p>Prezados,</p>

        <p>
            Segue em anexo a ata da reuniao referente a carteira <strong>{carteira}</strong>,
            realizada em <strong>{data_formatada}</strong>, conforme registro realizado no Atlas.
        </p>

        <p>
            O documento contempla os principais pontos discutidos, deliberacoes, participantes
            e eventuais encaminhamentos registrados durante a reuniao.
        </p>
        """


    def _normalize_pendencias(self, values: list[AgendaPendenciaRequest]) -> list[dict[str, str | None]]:
        pendencias: list[dict[str, str | None]] = []
        for item in values or []:
            descricao = self._normalize_optional_text(item.descricao)
            if not descricao:
                continue
            status_pendencia = str(item.status_pendencia or "PENDENTE").strip().upper()
            if status_pendencia not in self.VALID_STATUS_PENDENCIA:
                status_pendencia = "PENDENTE"
            pendencias.append(
                {
                    "id": item.id,
                    "descricao": descricao,
                    "responsavel": self._normalize_optional_text(item.responsavel),
                    "observacao": self._normalize_optional_text(item.observacao),
                    "status_pendencia": status_pendencia,
                    "login_resolucao": self._normalize_login(item.login_resolucao),
                    "data_resolucao": self._normalize_optional_text(item.data_resolucao),
                }
            )
        return pendencias

    def _normalize_participantes(self, values: list[AgendaParticipanteRequest]) -> list[dict[str, str | None]]:
        participantes: list[dict[str, str | None]] = []
        for item in values or []:
            nome = self._normalize_optional_text(item.nome)
            if not nome:
                continue
            tipo = str(item.tipo or "").strip().upper()
            if tipo not in {"INTERNO", "EXTERNO"}:
                raise AtlasException("Tipo de participante invalido.")
            participantes.append(
                {
                    "tipo": tipo,
                    "nome": nome,
                    "area_cargo": self._normalize_optional_text(item.area_cargo),
                    "observacao": self._normalize_optional_text(item.observacao),
                }
            )
        return participantes

    def _map_item(self, item: dict[str, object]) -> dict[str, object]:
        return {
            "id": int(item.get("id") or 0),
            "date": str(item.get("date") or ""),
            "horario_entrada": str(item.get("horario_entrada") or ""),
            "horario_saida": str(item.get("horario_saida") or ""),
            "carteira": str(item.get("carteira") or ""),
            "local_visita": str(item.get("local_visita") or "") or None,
            "motivo_visita": str(item.get("motivo_visita") or ""),
            "status_visita": str(item.get("status_visita") or "AGENDADA"),
            "resumo_visita": str(item.get("resumo_visita") or "") or None,
            "o_que_foi_feito": str(item.get("o_que_foi_feito") or "") or None,
            "pendencias": self._map_pendencias(item.get("pendencias")),
            "observacoes": str(item.get("observacoes") or "") or None,
            "participantes": self._map_participantes(item.get("participantes")),
            "login_criacao": str(item.get("login_criacao") or "") or None,
            "nome_criacao": str(item.get("nome_criacao") or "") or None,
            "login_atualizacao": str(item.get("login_atualizacao") or "") or None,
            "login_exclusao": str(item.get("login_exclusao") or "") or None,
            "login_envio_ata": str(item.get("login_envio_ata") or "") or None,
            "created_at": str(item.get("created_at") or ""),
            "updated_at": str(item.get("updated_at") or "") or None,
            "data_envio_ata": str(item.get("data_envio_ata") or "") or None,
        }

    def _map_carteira(self, item: dict[str, object]) -> dict[str, object]:
        return {
            "id_cedente": int(item.get("id_cedente") or 0),
            "nome_cedente": str(item.get("nome_cedente") or ""),
        }

    def _map_pendencias(self, value: object) -> list[dict[str, object]]:
        if not isinstance(value, list):
            return []
        pendencias: list[dict[str, object]] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            descricao = str(item.get("descricao") or "").strip()
            if not descricao:
                continue
            raw_id = item.get("id")
            pendencias.append(
                {
                    "id": int(raw_id) if raw_id else None,
                    "descricao": descricao,
                    "responsavel": str(item.get("responsavel") or "") or None,
                    "observacao": str(item.get("observacao") or "") or None,
                    "status_pendencia": str(item.get("status_pendencia") or "PENDENTE").upper(),
                    "login_resolucao": str(item.get("login_resolucao") or "") or None,
                    "data_resolucao": str(item.get("data_resolucao") or "") or None,
                }
            )
        return pendencias

    def _map_pendencia_aberta(self, item: dict[str, object]) -> dict[str, object]:
        return {
            "id": int(item.get("id") or 0),
            "agenda_id": int(item.get("agenda_id") or 0),
            "date": str(item.get("date") or ""),
            "horario_entrada": str(item.get("horario_entrada") or ""),
            "horario_saida": str(item.get("horario_saida") or ""),
            "carteira": str(item.get("carteira") or ""),
            "motivo_visita": str(item.get("motivo_visita") or ""),
            "descricao": str(item.get("descricao") or ""),
            "responsavel": str(item.get("responsavel") or "") or None,
            "observacao": str(item.get("observacao") or "") or None,
            "status_pendencia": str(item.get("status_pendencia") or "PENDENTE").upper(),
            "created_at": str(item.get("created_at") or ""),
        }

    def _map_participantes(self, value: object) -> list[dict[str, object]]:
        if not isinstance(value, list):
            return []
        participantes: list[dict[str, object]] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            nome = str(item.get("nome") or "").strip()
            if not nome:
                continue
            raw_id = item.get("id")
            participantes.append(
                {
                    "id": int(raw_id) if raw_id else None,
                    "tipo": str(item.get("tipo") or ""),
                    "nome": nome,
                    "area_cargo": str(item.get("area_cargo") or "") or None,
                    "observacao": str(item.get("observacao") or "") or None,
                }
            )
        return participantes



class _AtaPdfBuilder:
    PAGE_WIDTH = 595.28
    PAGE_HEIGHT = 841.89
    MARGIN = 42.0
    ORANGE = (0.94, 0.22, 0.07)
    NAVY = (0.04, 0.08, 0.15)
    MUTED = (0.35, 0.43, 0.55)
    BORDER = (0.82, 0.86, 0.90)
    TABLE_BG = (0.94, 0.96, 0.98)

    def __init__(self, agenda: dict[str, object]) -> None:
        self.agenda = agenda
        self.pages: list[list[str]] = []
        self.commands: list[str] = []
        self.y = self.PAGE_HEIGHT - self.MARGIN

    def build(self) -> bytes:
        self._new_page()
        self._header()
        self._section_identificacao()
        self._section_text("Pauta", self._text("motivo_visita"))
        self._section_participantes()
        self._section_text("Registro das discussoes", self._text("resumo_visita"))
        self._section_text("Deliberacoes e decisoes", self._text("o_que_foi_feito"))
        self._section_pendencias()
        self._section_text("Observacoes finais", self._text("observacoes"))
        self._footer_current_page()
        return self._render_pdf()

    def _header(self) -> None:
        self._set_fill(*self.ORANGE)
        self._rect(self.MARGIN, self.y - 5, 13, 6, fill=True)
        self._set_fill(*self.NAVY)
        self._text_at(self.MARGIN + 22, self.y, "GRUPO ACME", 7, "F2", char_space=3)
        self._text_at(self.PAGE_WIDTH - self.MARGIN - 82, self.y, "DOCUMENTO", 7, "F2")
        self.y -= 24
        self._text_at(self.MARGIN, self.y, "ATA DE REUNIAO", 18, "F2")
        self._text_at(
            self.PAGE_WIDTH - self.MARGIN - 82,
            self.y,
            f"ATA-{int(self.agenda.get('id') or 0):05d}",
            7,
            "F1",
        )
        self.y -= 26
        self._text_at(self.MARGIN, self.y, "Agenda de visitas - Atlas", 8, "F1", self.MUTED)
        self._text_at(
            self.PAGE_WIDTH - self.MARGIN - 130,
            self.y,
            f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            7,
            "F1",
            self.MUTED,
        )
        self.y -= 24
        self._line(self.MARGIN, self.y, self.PAGE_WIDTH - self.MARGIN, self.y, self.NAVY, 1.0)
        self.y -= 30

    def _section_identificacao(self) -> None:
        self._section_title("Identificacao da reuniao")
        col_width = (self.PAGE_WIDTH - (2 * self.MARGIN) - 28) / 2
        left = self.MARGIN
        right = self.MARGIN + col_width + 28
        start_y = self.y

        self._label_value(left, self.y, "Cliente / Carteira", self._text("carteira") or "-")
        self._label_value(right, self.y, "Data", self._format_date(self._text("date")))
        self.y -= 46
        self._label_value(left, self.y, "Horario", self._time_range())
        local = self._text("local_visita")
        if local:
            self._label_value(right, self.y, "Local / Formato", local)
        self.y -= 46
        responsavel = self._text("nome_criacao") or self._text("login_criacao")
        if responsavel:
            self._label_value(left, self.y, "Responsavel pelo registro", responsavel)
            self.y -= 44
        else:
            self.y = start_y - 92

    def _section_text(self, title: str, text: str) -> None:
        if not text:
            return
        self._section_title(title)
        self._paragraph(text)
        self.y -= 16

    def _section_participantes(self) -> None:
        participantes = self.agenda.get("participantes")
        if not isinstance(participantes, list) or not participantes:
            return

        internos = [item for item in participantes if isinstance(item, dict) and item.get("tipo") == "INTERNO"]
        externos = [item for item in participantes if isinstance(item, dict) and item.get("tipo") == "EXTERNO"]
        if not internos and not externos:
            return

        self._section_title("Participantes")
        col_width = (self.PAGE_WIDTH - (2 * self.MARGIN) - 30) / 2
        left_x = self.MARGIN
        right_x = self.MARGIN + col_width + 30
        start_y = self.y
        left_end = self._participant_column(left_x, start_y, col_width, "Representantes Acme", internos)
        right_end = self._participant_column(right_x, start_y, col_width, "Representantes externos", externos)
        self.y = min(left_end, right_end) - 18

    def _section_pendencias(self) -> None:
        pendencias = self.agenda.get("pendencias")
        if not isinstance(pendencias, list) or not pendencias:
            return

        self._section_title("Encaminhamentos e pendencias")
        table_x = self.MARGIN
        table_w = self.PAGE_WIDTH - (2 * self.MARGIN)
        widths = [table_w * 0.38, table_w * 0.24, table_w * 0.38]
        headers = ["Pendencia", "Responsavel", "Observacao"]
        self._table_row(table_x, widths, headers, bold=True, fill=True)

        for item in pendencias:
            if not isinstance(item, dict):
                continue
            row = [
                self._clean(item.get("descricao")),
                self._clean(item.get("responsavel")),
                self._clean(item.get("observacao")),
            ]
            self._table_row(table_x, widths, row, bold=False, fill=False)
        self.y -= 18

    def _participant_column(
        self,
        x: float,
        y: float,
        width: float,
        title: str,
        items: list[dict[str, object]],
    ) -> float:
        self._text_at(x, y, title.upper(), 8, "F2", self.MUTED, char_space=1.2)
        current_y = y - 24
        if not items:
            self._text_at(x, current_y, "-", 9, "F1", self.NAVY)
            return current_y - 14

        for item in items:
            current_y = self._ensure_at(current_y, 54)
            nome = self._clean(item.get("nome"))
            area = self._clean(item.get("area_cargo"))
            obs = self._clean(item.get("observacao"))
            label = f"{nome} ({area})" if area else nome
            self._text_at(x, current_y, "\u2022", 10, "F1", self.NAVY)
            self._text_at(x + 12, current_y, label, 10, "F2", self.NAVY)
            current_y -= 15
            if obs:
                for line in self._wrap(obs, width - 20, 9):
                    self._text_at(x + 20, current_y, line, 9, "F1", self.NAVY)
                    current_y -= 13
            current_y -= 4
        return current_y

    def _section_title(self, title: str) -> None:
        self._ensure_space(52)
        self._text_at(self.MARGIN, self.y, title.upper(), 8, "F2", self.ORANGE, char_space=3)
        self.y -= 12
        self._line(self.MARGIN, self.y, self.PAGE_WIDTH - self.MARGIN, self.y, self.BORDER, 0.6)
        self.y -= 20

    def _paragraph(self, text: str, size: int = 10) -> None:
        for line in self._wrap(text, self.PAGE_WIDTH - (2 * self.MARGIN), size):
            self._ensure_space(28)
            self._text_at(self.MARGIN, self.y, line, size, "F1", self.NAVY)
            self.y -= size + 6

    def _label_value(self, x: float, y: float, label: str, value: str) -> None:
        self._text_at(x, y, label.upper(), 7, "F2", self.MUTED, char_space=1.5)
        self._text_at(x, y - 18, value or "-", 9, "F2", self.NAVY)

    def _table_row(self, x: float, widths: list[float], values: list[str], bold: bool, fill: bool) -> None:
        size = 8 if bold else 8
        lines_by_cell = [self._wrap(value or "-", width - 16, size) for value, width in zip(values, widths, strict=True)]
        row_height = max(24, max(len(lines) for lines in lines_by_cell) * 12 + 14)
        self._ensure_space(row_height + 8)
        if fill:
            self._set_fill(*self.TABLE_BG)
            self._rect(x, self.y - row_height + 4, sum(widths), row_height, fill=True)
        self._line(x, self.y + 4, x + sum(widths), self.y + 4, self.BORDER, 0.5)
        self._line(x, self.y - row_height + 4, x + sum(widths), self.y - row_height + 4, self.BORDER, 0.5)

        cell_x = x
        for width, lines in zip(widths, lines_by_cell, strict=True):
            line_y = self.y - 10
            for line in lines:
                self._text_at(cell_x + 8, line_y, line, size, "F2" if bold else "F1", self.NAVY if not bold else self.MUTED)
                line_y -= 12
            cell_x += width
        self.y -= row_height

    def _new_page(self) -> None:
        if self.commands:
            self._footer_current_page()
            self.pages.append(self.commands)
        self.commands = []
        self.y = self.PAGE_HEIGHT - self.MARGIN

    def _footer_current_page(self) -> None:
        if not self.commands:
            return
        footer_y = 30
        self._line(self.MARGIN, footer_y + 18, self.PAGE_WIDTH - self.MARGIN, footer_y + 18, self.BORDER, 0.5)
        self._text_at(
            self.MARGIN + 150,
            footer_y,
            f"Documento gerado pelo Atlas em {datetime.now().strftime('%d/%m/%Y as %H:%M')}.",
            7,
            "F1",
            self.MUTED,
        )

    def _ensure_space(self, needed: float) -> None:
        if self.y - needed < 58:
            self._new_page()

    def _ensure_at(self, y: float, needed: float) -> float:
        if y - needed < 58:
            self._new_page()
            return self.y
        return y

    def _text(self, key: str) -> str:
        return self._clean(self.agenda.get(key))

    def _clean(self, value: object) -> str:
        text = str(value or "").strip()
        return " ".join(text.split())

    def _format_date(self, value: str) -> str:
        if len(value) == 10:
            ano, mes, dia = value.split("-")
            return f"{dia}/{mes}/{ano}"
        return value or "-"

    def _time_range(self) -> str:
        entrada = self._text("horario_entrada")[:5]
        saida = self._text("horario_saida")[:5]
        return f"{entrada} - {saida}" if saida else entrada

    def _wrap(self, text: str, width: float, size: int) -> list[str]:
        words = self._pdf_text(text).split()
        if not words:
            return ["-"]
        lines: list[str] = []
        current = ""
        max_chars = max(12, int(width / (size * 0.52)))
        for word in words:
            candidate = f"{current} {word}".strip()
            if len(candidate) <= max_chars:
                current = candidate
                continue
            if current:
                lines.append(current)
            current = word
        if current:
            lines.append(current)
        return lines

    def _pdf_text(self, text: str) -> str:
        normalized = unicodedata.normalize("NFKD", text)
        ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
        return ascii_text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def _text_at(
        self,
        x: float,
        y: float,
        text: str,
        size: int,
        font: str = "F1",
        color: tuple[float, float, float] | None = None,
        char_space: float = 0,
    ) -> None:
        color = color or self.NAVY
        safe = self._pdf_text(text)
        self.commands.append(
            f"BT {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg /{font} {size} Tf {char_space:.2f} Tc "
            f"1 0 0 1 {x:.2f} {y:.2f} Tm ({safe}) Tj ET"
        )

    def _line(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        color: tuple[float, float, float],
        width: float,
    ) -> None:
        self.commands.append(
            f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} RG {width:.2f} w "
            f"{x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S"
        )

    def _set_fill(self, r: float, g: float, b: float) -> None:
        self.commands.append(f"{r:.3f} {g:.3f} {b:.3f} rg")

    def _rect(self, x: float, y: float, width: float, height: float, fill: bool = False) -> None:
        self.commands.append(f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re {'f' if fill else 'S'}")

    def _render_pdf(self) -> bytes:
        if self.commands:
            self.pages.append(self.commands)
            self.commands = []

        objects: list[bytes] = []
        page_refs: list[int] = []
        catalog_id = 1
        pages_id = 2
        font_regular_id = 3
        font_bold_id = 4
        objects.extend(
            [
                b"<< /Type /Catalog /Pages 2 0 R >>",
                b"",
                b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
                b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
            ]
        )

        for page in self.pages:
            content = "\n".join(page).encode("latin-1", "ignore")
            content_id = len(objects) + 2
            page_id = len(objects) + 1
            page_refs.append(page_id)
            objects.append(
                (
                    f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {self.PAGE_WIDTH:.2f} {self.PAGE_HEIGHT:.2f}] "
                    f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> "
                    f"/Contents {content_id} 0 R >>"
                ).encode("latin-1")
            )
            objects.append(b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"\nendstream")

        kids = " ".join(f"{page_id} 0 R" for page_id in page_refs)
        objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_refs)} >>".encode("latin-1")

        pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(pdf))
            pdf.extend(f"{index} 0 obj\n".encode("ascii"))
            pdf.extend(obj)
            pdf.extend(b"\nendobj\n")
        xref = len(pdf)
        pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        pdf.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        pdf.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
                f"startxref\n{xref}\n%%EOF"
            ).encode("ascii")
        )
        return bytes(pdf)

