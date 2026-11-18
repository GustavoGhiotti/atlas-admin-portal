from datetime import date, datetime
import io
import re
import unicodedata

from fastapi import UploadFile
from pydantic import ValidationError

from src.infrastructure.repositories.monitorias_vega_repository import MonitoriasVegaRepository
from src.schemas.monitorias_vega import MonitoriaVegaPayload
from src.shared.exception import AtlasException


class MonitoriasVegaService:
    MESES = ("", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
             "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro")
    # Colunas (0-based) onde começa cada semana na aba "Controle das Monitorias":
    # cada semana ocupa a tríade Total / Conforme / Inconforme.
    SEMANA_COLUNAS = (1, 5, 9, 13, 17)

    def __init__(self) -> None:
        self.repository = MonitoriasVegaRepository()

    # ------------------------------------------------------------------ util
    @staticmethod
    def _pct(parte: int, total: int) -> float:
        if not total:
            return 0.0
        return round(parte / total * 100, 2)

    @staticmethod
    def _num(value) -> int:
        if value is None:
            return 0
        if isinstance(value, str):
            texto = value.strip().replace(".", "").replace(",", ".")
            if not texto:
                return 0
            try:
                return int(round(float(texto)))
            except ValueError:
                return 0
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _normalizar(value) -> str:
        texto = unicodedata.normalize("NFKD", str(value or ""))
        texto = "".join(char for char in texto if not unicodedata.combining(char)).lower()
        return re.sub(r"[^a-z0-9]+", " ", texto).strip()

    # -------------------------------------------------------------- dashboard
    def dashboard(self, ano: int, mes: int) -> dict:
        registros = self.repository.listar_ano(ano)
        # Consolidado mensal para o gráfico do ano inteiro.
        por_mes: dict[int, dict[str, int]] = {
            numero: {"total": 0, "conforme": 0, "inconforme": 0} for numero in range(1, 13)
        }
        # Detalhe por semana do mês selecionado.
        semanas: dict[int, dict[str, int]] = {
            numero: {"total": 0, "conforme": 0, "inconforme": 0} for numero in range(1, 6)
        }
        # Total por semana somando o ano inteiro ("Semanal de cada mês").
        por_semana_ano: dict[int, dict[str, int]] = {
            numero: {"total": 0, "conforme": 0, "inconforme": 0} for numero in range(1, 6)
        }
        for numero_mes, semana, total, conforme, inconforme in registros:
            numero_mes = int(numero_mes)
            semana = int(semana)
            if numero_mes in por_mes:
                por_mes[numero_mes]["total"] += int(total or 0)
                por_mes[numero_mes]["conforme"] += int(conforme or 0)
                por_mes[numero_mes]["inconforme"] += int(inconforme or 0)
            if semana in por_semana_ano:
                por_semana_ano[semana]["total"] += int(total or 0)
                por_semana_ano[semana]["conforme"] += int(conforme or 0)
                por_semana_ano[semana]["inconforme"] += int(inconforme or 0)
            if numero_mes == mes and semana in semanas:
                item = semanas[semana]
                item["total"] = int(total or 0)
                item["conforme"] = int(conforme or 0)
                item["inconforme"] = int(inconforme or 0)

        consolidado_mes = por_mes.get(mes, {"total": 0, "conforme": 0, "inconforme": 0})
        total_mes = consolidado_mes["total"]
        conforme_mes = consolidado_mes["conforme"]
        inconforme_mes = consolidado_mes["inconforme"]
        base = total_mes or (conforme_mes + inconforme_mes)

        # Consolidado do ano inteiro.
        total_ano = sum(v["total"] for v in por_mes.values())
        conforme_ano = sum(v["conforme"] for v in por_mes.values())
        inconforme_ano = sum(v["inconforme"] for v in por_mes.values())
        base_ano = total_ano or (conforme_ano + inconforme_ano)

        return {
            "ano": ano,
            "mes": mes,
            "mes_nome": self.MESES[mes] if 1 <= mes <= 12 else str(mes),
            "kpis": {
                "total": total_mes,
                "conforme": conforme_mes,
                "inconforme": inconforme_mes,
                "pct_conforme": self._pct(conforme_mes, base),
                "pct_inconforme": self._pct(inconforme_mes, base),
            },
            "semanas": [
                {
                    "semana": numero,
                    "total": dados["total"],
                    "conforme": dados["conforme"],
                    "inconforme": dados["inconforme"],
                    "pct_conforme": self._pct(dados["conforme"], dados["total"] or (dados["conforme"] + dados["inconforme"])),
                    "pct_inconforme": self._pct(dados["inconforme"], dados["total"] or (dados["conforme"] + dados["inconforme"])),
                }
                for numero, dados in sorted(semanas.items())
            ],
            "meses": [
                {
                    "mes": numero,
                    "mes_nome": self.MESES[numero],
                    "mes_abrev": self.MESES[numero][:3],
                    "total": dados["total"],
                    "conforme": dados["conforme"],
                    "inconforme": dados["inconforme"],
                    "pct_conforme": self._pct(dados["conforme"], dados["total"] or (dados["conforme"] + dados["inconforme"])),
                    "pct_inconforme": self._pct(dados["inconforme"], dados["total"] or (dados["conforme"] + dados["inconforme"])),
                }
                for numero, dados in sorted(por_mes.items())
            ],
            "resumo_semanal": [
                {
                    "semana": numero,
                    "total": dados["total"],
                    "conforme": dados["conforme"],
                    "inconforme": dados["inconforme"],
                    "pct_conforme": self._pct(dados["conforme"], dados["total"] or (dados["conforme"] + dados["inconforme"])),
                    "pct_inconforme": self._pct(dados["inconforme"], dados["total"] or (dados["conforme"] + dados["inconforme"])),
                }
                for numero, dados in sorted(por_semana_ano.items())
            ],
            "consolidado_ano": {
                "total": total_ano,
                "conforme": conforme_ano,
                "inconforme": inconforme_ano,
                "pct_conforme": self._pct(conforme_ano, base_ano),
                "pct_inconforme": self._pct(inconforme_ano, base_ano),
            },
        }

    # ------------------------------------------------------------ exportação
    def exportar(self, ano: int) -> bytes:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter

        # Grade [mes][semana] = {total, conforme, inconforme}
        grade: dict[int, dict[int, dict[str, int]]] = {
            m: {s: {"total": 0, "conforme": 0, "inconforme": 0} for s in range(1, 6)} for m in range(1, 13)
        }
        for numero_mes, semana, total, conforme, inconforme in self.repository.listar_ano(ano):
            if int(numero_mes) in grade and int(semana) in grade[int(numero_mes)]:
                grade[int(numero_mes)][int(semana)] = {
                    "total": int(total or 0), "conforme": int(conforme or 0), "inconforme": int(inconforme or 0),
                }

        azul = "425D90"; branco = "FFFFFFFF"; cinza = "D9D9D9"; escuro = "1A1B1F"
        borda = Side(style="thin", color="BFBFBF")
        moldura = Border(left=borda, right=borda, top=borda, bottom=borda)
        centro = Alignment(horizontal="center", vertical="center", wrap_text=True)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Controle das Monitorias"
        sheet.sheet_view.showGridLines = False

        semana_cols = (2, 6, 10, 14, 18)       # B, F, J, N, R
        separadores = (5, 9, 13, 17, 21)       # E, I, M, Q, U
        consolidado = 22                       # V..Y
        ultima_col = consolidado + 3           # Y

        def estilo_cabecalho(cell, texto):
            cell.value = texto
            cell.fill = PatternFill("solid", fgColor=azul)
            cell.font = Font(color=branco, bold=True, size=10)
            cell.alignment = centro
            cell.border = moldura

        # Linha 1 — grupos
        estilo_cabecalho(sheet.cell(1, 1), f"Monitorias VEGA\n{ano}")
        for indice, base in enumerate(semana_cols, start=1):
            sheet.merge_cells(start_row=1, start_column=base, end_row=1, end_column=base + 2)
            estilo_cabecalho(sheet.cell(1, base), f"Relatório de Monitorias VEGA\nSemana {indice:02d}")
        sheet.merge_cells(start_row=1, start_column=consolidado, end_row=1, end_column=ultima_col)
        estilo_cabecalho(sheet.cell(1, consolidado), "Relatório de Monitorias VEGA\nConsolidado")

        # Linha 2 — subcabeçalhos
        estilo_cabecalho(sheet.cell(2, 1), "Mês")
        for base in semana_cols:
            for offset, rotulo in enumerate(("Total", "Conforme", "Inconforme")):
                estilo_cabecalho(sheet.cell(2, base + offset), rotulo)
        for offset, rotulo in enumerate(("Total mensal", "Total Conformes", "Total Inconformes", "Média")):
            estilo_cabecalho(sheet.cell(2, consolidado + offset), rotulo)
        sheet.row_dimensions[1].height = 34
        sheet.row_dimensions[2].height = 30

        def escrever_numero(cell, valor, formato="#,##0"):
            cell.value = valor
            cell.number_format = formato
            cell.font = Font(color=escuro, size=10)
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = moldura

        # Linhas 3..14 — meses
        soma_semana = {s: {"total": 0, "conforme": 0, "inconforme": 0} for s in range(1, 6)}
        total_geral = conforme_geral = inconforme_geral = 0
        for indice, mes in enumerate(range(1, 13)):
            linha = 3 + indice
            celula_mes = sheet.cell(linha, 1)
            celula_mes.value = date(ano, mes, 1)
            celula_mes.number_format = "mmm/yyyy"
            celula_mes.font = Font(color=escuro, bold=True, size=10)
            celula_mes.alignment = Alignment(horizontal="center", vertical="center")
            celula_mes.border = moldura
            total_mes = conforme_mes = inconforme_mes = 0
            for base, semana in zip(semana_cols, range(1, 6)):
                dados = grade[mes][semana]
                escrever_numero(sheet.cell(linha, base), dados["total"])
                escrever_numero(sheet.cell(linha, base + 1), dados["conforme"])
                escrever_numero(sheet.cell(linha, base + 2), dados["inconforme"])
                total_mes += dados["total"]; conforme_mes += dados["conforme"]; inconforme_mes += dados["inconforme"]
                soma_semana[semana]["total"] += dados["total"]
                soma_semana[semana]["conforme"] += dados["conforme"]
                soma_semana[semana]["inconforme"] += dados["inconforme"]
            escrever_numero(sheet.cell(linha, consolidado), total_mes)
            escrever_numero(sheet.cell(linha, consolidado + 1), conforme_mes)
            escrever_numero(sheet.cell(linha, consolidado + 2), inconforme_mes)
            media = (inconforme_mes / conforme_mes) if conforme_mes else 0
            escrever_numero(sheet.cell(linha, consolidado + 3), media, "0.00%")
            total_geral += total_mes; conforme_geral += conforme_mes; inconforme_geral += inconforme_mes

        # Linha 15 — espaçador
        for coluna in range(1, ultima_col + 1):
            sheet.cell(15, coluna).fill = PatternFill("solid", fgColor=cinza)
        sheet.row_dimensions[15].height = 8

        # Linhas 16-17 — resumo "Semanal de cada mês"
        sheet.merge_cells(start_row=16, start_column=1, end_row=17, end_column=1)
        estilo_cabecalho(sheet.cell(16, 1), "Semanal de cada mês")
        for indice, base in enumerate(semana_cols, start=1):
            sheet.merge_cells(start_row=16, start_column=base, end_row=16, end_column=base + 2)
            estilo_cabecalho(sheet.cell(16, base), f"Total Semana {indice:02d}")
        for offset, rotulo in enumerate(("Mensal", "Conformes", "Inconformes", "Média")):
            estilo_cabecalho(sheet.cell(16, consolidado + offset), rotulo)
        for base, semana in zip(semana_cols, range(1, 6)):
            escrever_numero(sheet.cell(17, base), soma_semana[semana]["total"])
            escrever_numero(sheet.cell(17, base + 1), soma_semana[semana]["conforme"])
            escrever_numero(sheet.cell(17, base + 2), soma_semana[semana]["inconforme"])
        escrever_numero(sheet.cell(17, consolidado), total_geral)
        escrever_numero(sheet.cell(17, consolidado + 1), conforme_geral)
        escrever_numero(sheet.cell(17, consolidado + 2), inconforme_geral)
        escrever_numero(sheet.cell(17, consolidado + 3), (inconforme_geral / conforme_geral) if conforme_geral else 0, "0.00%")

        # Larguras
        sheet.column_dimensions["A"].width = 11
        for coluna in range(2, ultima_col + 1):
            sheet.column_dimensions[get_column_letter(coluna)].width = 1.6 if coluna in separadores else 10
        sheet.freeze_panes = "B3"

        from io import BytesIO
        buffer = BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()

    def anos(self) -> dict:
        anos = self.repository.anos()
        atual = date.today().year
        if atual not in anos:
            anos = sorted({*anos, atual}, reverse=True)
        return {"itens": anos}

    # ----------------------------------------------------------------- salvar
    def salvar_lote(self, payloads: list[MonitoriaVegaPayload]) -> dict:
        if not payloads:
            raise AtlasException("Inclua ao menos um registro de monitoria.")
        if len(payloads) > 1000:
            raise AtlasException("O limite por gravação é de 1.000 registros.")
        for payload in payloads:
            self.repository.upsert(payload)
        return {"quantidade": len(payloads), "mensagem": f"{len(payloads)} registro(s) gravado(s) com sucesso."}

    # -------------------------------------------------------------- importação
    def analisar_planilha(self, arquivo: UploadFile) -> dict:
        nome = str(arquivo.filename or "").strip()
        if not nome.lower().endswith((".xlsx", ".xlsm")):
            raise AtlasException("Envie um arquivo no formato .xlsx ou .xlsm.")
        conteudo = arquivo.file.read()
        if not conteudo:
            raise AtlasException("O arquivo enviado está vazio.")
        from openpyxl import load_workbook
        workbook = load_workbook(io.BytesIO(conteudo), read_only=True, data_only=True)

        worksheet = None
        for nome_aba in workbook.sheetnames:
            normalizado = self._normalizar(nome_aba)
            if "controle" in normalizado and "monitoria" in normalizado:
                worksheet = workbook[nome_aba]
                break
        if worksheet is None:
            # fallback: primeira aba que tenha datas na coluna A
            for nome_aba in workbook.sheetnames:
                candidata = workbook[nome_aba]
                if any(isinstance(linha[0], (datetime, date)) for linha in candidata.iter_rows(min_row=1, max_row=40, values_only=True) if linha):
                    worksheet = candidata
                    break
        if worksheet is None:
            raise AtlasException("Não foi encontrada a aba 'Controle das Monitorias' com os dados esperados.")

        itens: list[dict] = []
        for row in worksheet.iter_rows(values_only=True):
            if not row:
                continue
            referencia = row[0]
            if not isinstance(referencia, (datetime, date)):
                continue
            ano = referencia.year
            mes = referencia.month
            for indice, coluna in enumerate(self.SEMANA_COLUNAS, start=1):
                total = self._num(row[coluna]) if coluna < len(row) else 0
                conforme = self._num(row[coluna + 1]) if coluna + 1 < len(row) else 0
                inconforme = self._num(row[coluna + 2]) if coluna + 2 < len(row) else 0
                if total == 0 and conforme == 0 and inconforme == 0:
                    continue
                bruto = {"ano": ano, "mes": mes, "semana": indice, "total": total, "conforme": conforme, "inconforme": inconforme}
                erros: list[str] = []
                try:
                    dados = MonitoriaVegaPayload.model_validate(bruto).model_dump()
                except ValidationError as exc:
                    dados = bruto
                    erros = [str(item["msg"]).replace("Value error, ", "") for item in exc.errors()]
                dados["mes_nome"] = self.MESES[dados["mes"]] if 1 <= dados["mes"] <= 12 else str(dados["mes"])
                itens.append({"dados": dados, "erros": erros, "valido": not erros})
        if not itens:
            raise AtlasException("Nenhum dado de monitoria foi encontrado na planilha.")
        itens.sort(key=lambda item: (item["dados"]["ano"], item["dados"]["mes"], item["dados"]["semana"]))
        return {
            "arquivo": nome,
            "aba": worksheet.title,
            "total": len(itens),
            "validos": sum(1 for item in itens if item["valido"]),
            "invalidos": sum(1 for item in itens if not item["valido"]),
            "itens": itens,
        }
