from collections import Counter

from src.application.services.auth_service import AuthenticatedUser
from src.infrastructure.repositories.chamados_repository import ChamadosRepository
from src.schemas.chamados import (
    DemandaAreaRequest,
    DemandaPlataformaRequest,
    DemandaTipoSolicitacaoRequest,
)
from src.shared.exception import AtlasException, NaoEncontradoException


class ChamadosService:
    MANAGER_GROUPS = {"ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO"}
    STATUS_VALIDOS = {"open", "in_progress", "closed"}
    PRIORIDADES_VALIDAS = {"low", "medium", "high", "urgent"}
    TIPOS_SOLICITACAO_VALIDOS = {"transferencia_arquivo", "carga", "outro"}

    def __init__(self) -> None:
        self.repository = ChamadosRepository()

    def listar_areas(self) -> list[dict[str, object]]:
        return [self._map_area(item) for item in self.repository.listar_areas()]

    def buscar_area(self, area_id: int) -> dict[str, object]:
        item = self.repository.buscar_area(area_id)
        if not item:
            raise NaoEncontradoException("Area nao encontrada.")
        return self._map_area(item)

    def criar_area(self, payload: DemandaAreaRequest) -> dict[str, object]:
        tp_area = self._normalize_required_text(payload.tp_area, "Tipo da area")
        nm_area = self._normalize_required_text(payload.nm_area, "Nome da area")
        area_id = self.repository.criar_area(tp_area, nm_area)
        if not area_id:
            raise AtlasException("Nao foi possivel criar a area.", status_code=500)
        return self.buscar_area(area_id)

    def atualizar_area(self, area_id: int, payload: dict[str, object]) -> dict[str, object]:
        data = self._normalize_update_text_fields(
            payload,
            [
                ("tp_area", "Tipo da area"),
                ("nm_area", "Nome da area"),
            ],
        )
        if not self.repository.atualizar_area(
            area_id,
            tp_area=data.get("tp_area"),
            nm_area=data.get("nm_area"),
        ):
            raise NaoEncontradoException("Area nao encontrada.")
        return self.buscar_area(area_id)

    def excluir_area(self, area_id: int) -> None:
        if not self.repository.excluir_area(area_id):
            raise NaoEncontradoException("Area nao encontrada.")

    def listar_plataformas(self) -> list[dict[str, object]]:
        return [self._map_plataforma(item) for item in self.repository.listar_plataformas()]

    def buscar_plataforma(self, plataforma_id: int) -> dict[str, object]:
        item = self.repository.buscar_plataforma(plataforma_id)
        if not item:
            raise NaoEncontradoException("Plataforma nao encontrada.")
        return self._map_plataforma(item)

    def criar_plataforma(self, payload: DemandaPlataformaRequest) -> dict[str, object]:
        nm_plataforma = self._normalize_required_text(payload.nm_plataforma, "Nome da plataforma")
        plataforma_id = self.repository.criar_plataforma(nm_plataforma)
        if not plataforma_id:
            raise AtlasException("Nao foi possivel criar a plataforma.", status_code=500)
        return self.buscar_plataforma(plataforma_id)

    def atualizar_plataforma(self, plataforma_id: int, payload: dict[str, object]) -> dict[str, object]:
        data = self._normalize_update_text_fields(payload, [("nm_plataforma", "Nome da plataforma")])
        if not self.repository.atualizar_plataforma(plataforma_id, nm_plataforma=data.get("nm_plataforma")):
            raise NaoEncontradoException("Plataforma nao encontrada.")
        return self.buscar_plataforma(plataforma_id)

    def excluir_plataforma(self, plataforma_id: int) -> None:
        if not self.repository.excluir_plataforma(plataforma_id):
            raise NaoEncontradoException("Plataforma nao encontrada.")

    def listar_tipos_solicitacao(self) -> list[dict[str, object]]:
        return [self._map_tipo_solicitacao(item) for item in self.repository.listar_tipos_solicitacao()]

    def buscar_tipo_solicitacao(self, tipo_solicitacao_id: int) -> dict[str, object]:
        item = self.repository.buscar_tipo_solicitacao(tipo_solicitacao_id)
        if not item:
            raise NaoEncontradoException("Tipo de solicitacao nao encontrado.")
        return self._map_tipo_solicitacao(item)

    def criar_tipo_solicitacao(self, payload: DemandaTipoSolicitacaoRequest) -> dict[str, object]:
        nm_tipo_solicitacao = self._normalize_required_text(payload.nm_tipo_solicitacao, "Nome do tipo de solicitacao")
        tipo_solicitacao_id = self.repository.criar_tipo_solicitacao(nm_tipo_solicitacao)
        if not tipo_solicitacao_id:
            raise AtlasException("Nao foi possivel criar o tipo de solicitacao.", status_code=500)
        return self.buscar_tipo_solicitacao(tipo_solicitacao_id)

    def atualizar_tipo_solicitacao(self, tipo_solicitacao_id: int, payload: dict[str, object]) -> dict[str, object]:
        data = self._normalize_update_text_fields(
            payload,
            [("nm_tipo_solicitacao", "Nome do tipo de solicitacao")],
        )
        if not self.repository.atualizar_tipo_solicitacao(
            tipo_solicitacao_id,
            nm_tipo_solicitacao=data.get("nm_tipo_solicitacao"),
        ):
            raise NaoEncontradoException("Tipo de solicitacao nao encontrado.")
        return self.buscar_tipo_solicitacao(tipo_solicitacao_id)

    def excluir_tipo_solicitacao(self, tipo_solicitacao_id: int) -> None:
        if not self.repository.excluir_tipo_solicitacao(tipo_solicitacao_id):
            raise NaoEncontradoException("Tipo de solicitacao nao encontrado.")

    def listar_chamados(self, current_user: AuthenticatedUser) -> dict[str, object]:
        chamados = self.repository.listar_chamados(
            None if self._can_manage(current_user) else current_user.nu_cpf_colaborador
        )
        itens = [self._map_chamado(item) for item in chamados]
        resumo = Counter(item["status"] for item in itens)
        return {
            "itens": itens,
            "resumo": {
                "total": len(itens),
                "abertos": resumo.get("open", 0),
                "em_andamento": resumo.get("in_progress", 0),
                "fechados": resumo.get("closed", 0),
            },
            "modo_gestao": self._can_manage(current_user),
        }

    def criar_chamado(
        self,
        current_user: AuthenticatedUser,
        titulo: str,
        descricao: str,
        tipo_solicitacao: str,
        prioridade: str,
        evidencia: dict[str, object],
    ) -> dict[str, object]:
        titulo = titulo.strip()
        descricao = descricao.strip()
        tipo_solicitacao = tipo_solicitacao.strip().lower()
        prioridade = prioridade.strip().lower()
        if not titulo or not descricao:
            raise AtlasException("Titulo e descricao sao obrigatorios.")
        if tipo_solicitacao not in self.TIPOS_SOLICITACAO_VALIDOS:
            raise AtlasException("Tipo de solicitacao invalido.")
        if prioridade not in self.PRIORIDADES_VALIDAS:
            raise AtlasException("Prioridade invalida.")

        chamado_id = self.repository.criar_chamado(
            titulo,
            current_user.centro_custo or current_user.nm_funcao or "Nao informado",
            descricao,
            tipo_solicitacao,
            prioridade,
            current_user.nu_cpf_colaborador,
            current_user.nm_colaborador,
            evidencia,
        )
        if not chamado_id:
            raise AtlasException("Nao foi possivel criar o chamado.", status_code=500)
        chamado = self.repository.buscar_chamado(chamado_id)
        if not chamado:
            raise NaoEncontradoException("Chamado criado, mas nao localizado para retorno.")
        return self._map_chamado(chamado)

    def atualizar_chamado(self, chamado_id: int, current_user: AuthenticatedUser, payload: dict[str, object]) -> dict[str, object]:
        chamado = self.repository.buscar_chamado(chamado_id)
        if not chamado:
            raise NaoEncontradoException("Chamado nao encontrado.")
        self._ensure_access(current_user, chamado)

        status = payload.get("status")
        prioridade = payload.get("prioridade")
        descricao = payload.get("descricao")

        if not self._can_manage(current_user):
            self._ensure_requester_update_allowed(chamado, status=status, prioridade=prioridade, descricao=descricao)

        if status is not None:
            status = str(status).strip().lower()
            if status not in self.STATUS_VALIDOS:
                raise AtlasException("Status invalido.")
        if prioridade is not None:
            prioridade = str(prioridade).strip().lower()
            if prioridade not in self.PRIORIDADES_VALIDAS:
                raise AtlasException("Prioridade invalida.")
        if descricao is not None:
            descricao = str(descricao).strip()
            if not descricao:
                raise AtlasException("Descricao nao pode ficar vazia.")

        updated = self.repository.atualizar_chamado(
            chamado_id,
            status=status,
            prioridade=prioridade,
            descricao=descricao,
        )
        if not updated:
            raise AtlasException("Nenhum campo valido foi enviado para atualizacao.")

        item = self.repository.buscar_chamado(chamado_id)
        if not item:
            raise NaoEncontradoException("Chamado nao encontrado apos atualizacao.")
        return self._map_chamado(item)

    def buscar_evidencia(self, chamado_id: int, current_user: AuthenticatedUser) -> dict[str, object]:
        chamado = self.repository.buscar_chamado(chamado_id)
        if not chamado:
            raise NaoEncontradoException("Chamado nao encontrado.")
        self._ensure_access(current_user, chamado)
        evidencia = self.repository.buscar_evidencia(chamado_id)
        if not evidencia or not evidencia.get("evidencia"):
            raise NaoEncontradoException("Evidencia nao encontrada.")
        return evidencia

    def excluir_chamado(self, chamado_id: int, current_user: AuthenticatedUser) -> None:
        chamado = self.repository.buscar_chamado(chamado_id)
        if not chamado:
            raise NaoEncontradoException("Chamado nao encontrado.")
        self._ensure_access(current_user, chamado)
        if self._can_manage(current_user):
            raise AtlasException("Somente o solicitante pode excluir o chamado.", status_code=403)
        if str(chamado.get("status") or "").strip().lower() != "open":
            raise AtlasException("Somente chamados em aberto podem ser excluidos pelo solicitante.", status_code=403)
        self.repository.excluir_chamado(chamado_id)

    def _map_chamado(self, item: dict[str, object]) -> dict[str, object]:
        return {
            "id": int(item.get("id") or 0),
            "titulo": str(item.get("titulo") or ""),
            "descricao": str(item.get("descricao") or ""),
            "status": str(item.get("status") or "open"),
            "prioridade": str(item.get("prioridade") or "medium"),
            "criado_em": str(item.get("criado_em") or ""),
            "atualizado_em": str(item.get("atualizado_em") or ""),
            "cpf_solicitante": str(item.get("cpf_solicitante") or ""),
            "solicitante": str(item.get("solicitante") or ""),
            "setor_solicitante": str(item.get("setor_solicitante") or ""),
            "possui_evidencia": bool(item.get("possui_evidencia")),
            "evidencia_nome": str(item.get("evidencia_nome") or ""),
            "evidencia_mime": str(item.get("evidencia_mime") or ""),
            "evidencia_tamanho": int(item.get("evidencia_tamanho") or 0),
        }

    def _map_area(self, item: dict[str, object]) -> dict[str, object]:
        return {
            "id_area": int(item.get("id_area") or 0),
            "tp_area": str(item.get("tp_area") or ""),
            "nm_area": str(item.get("nm_area") or ""),
        }

    def _map_plataforma(self, item: dict[str, object]) -> dict[str, object]:
        return {
            "id_plataforma": int(item.get("id_plataforma") or 0),
            "nm_plataforma": str(item.get("nm_plataforma") or ""),
        }

    def _map_tipo_solicitacao(self, item: dict[str, object]) -> dict[str, object]:
        return {
            "id_tipo_solicitacao": int(item.get("id_tipo_solicitacao") or 0),
            "nm_tipo_solicitacao": str(item.get("nm_tipo_solicitacao") or ""),
        }

    def _normalize_required_text(self, value: str, label: str) -> str:
        text = str(value or "").strip()
        if not text:
            raise AtlasException(f"{label} e obrigatorio.")
        if len(text) > 255:
            raise AtlasException(f"{label} deve ter no maximo 255 caracteres.")
        return text

    def _normalize_update_text_fields(
        self,
        payload: dict[str, object],
        fields: list[tuple[str, str]],
    ) -> dict[str, str]:
        data: dict[str, str] = {}
        for key, label in fields:
            if key not in payload or payload.get(key) is None:
                continue
            data[key] = self._normalize_required_text(str(payload.get(key) or ""), label)
        if not data:
            raise AtlasException("Nenhum campo valido foi enviado para atualizacao.")
        return data

    def _ensure_access(self, current_user: AuthenticatedUser, chamado: dict[str, object]) -> None:
        if self._can_manage(current_user):
            return
        if self._normalize_cpf(current_user.nu_cpf_colaborador) == self._normalize_cpf(str(chamado.get("cpf_solicitante") or "")):
            return
        raise AtlasException("Voce nao possui acesso a este chamado.", status_code=403)

    def _can_manage(self, current_user: AuthenticatedUser) -> bool:
        return any(group in self.MANAGER_GROUPS for group in current_user.grupos)

    def _normalize_cpf(self, value: str) -> str:
        return "".join(char for char in str(value or "") if char.isdigit())

    def _ensure_requester_update_allowed(
        self,
        chamado: dict[str, object],
        *,
        status: object,
        prioridade: object,
        descricao: object,
    ) -> None:
        if status is not None or prioridade is not None:
            raise AtlasException("Somente o time de desenvolvimento pode atualizar status ou prioridade do chamado.", status_code=403)
        if descricao is None:
            raise AtlasException("Nenhum campo valido foi enviado para atualizacao.", status_code=400)
        # O solicitante pode reeditar o chamado enquanto ele estiver em aberto,
        # ou responder quando o dev estiver aguardando informacoes.
        if str(chamado.get("status") or "").strip().lower() == "open":
            return
        if not self._is_waiting_for_requester_info(str(chamado.get("descricao") or "")):
            raise AtlasException("Esse chamado nao esta aguardando informacoes do solicitante.", status_code=403)

    def _is_waiting_for_requester_info(self, descricao: str) -> bool:
        marker = "\n\n[CONTROLE_ATENDIMENTO]\n"
        if marker not in descricao:
            return False
        dev_block = descricao.split(marker, 1)[1].split("\n\n[HISTORICO_ATENDIMENTO]", 1)[0]
        for raw_line in dev_block.splitlines():
            line = raw_line.strip()
            if line.lower().startswith("status atendimento:"):
                status = line.split(":", 1)[1].strip().lower()
                return status == "aguardando_informacoes"
        return False
