from datetime import date, datetime
import io
import re
import unicodedata
from uuid import uuid4

from fastapi import UploadFile
from pydantic import ValidationError

from src.infrastructure.repositories.treinamentos_repository import TreinamentosRepository
from src.schemas.treinamentos import AdmissaoPayload, AgendaTreinamentoPayload, TreinamentoPayload
from src.shared.exception import AtlasException


class TreinamentosService:
    MESES = ("", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO")
    def __init__(self) -> None:
        self.repository = TreinamentosRepository()

    @staticmethod
    def _iso(value) -> str:
        return value.isoformat() if value else ""

    @staticmethod
    def _chave_operador(cpf, nome) -> str:
        digitos = re.sub(r"\D", "", str(cpf or ""))
        if len(digitos) >= 11:
            return digitos[-11:]
        nome_norm = str(nome or "").strip().upper()
        return f"NOME:{nome_norm}" if nome_norm else ""

    def _mapa_vezes_treinado(self) -> tuple[dict[str, int], dict[str, str]]:
        from collections import defaultdict
        nome_para_cpf: dict[str, str] = {}
        for nome, cpf in self.repository.mapa_nome_cpf():
            chave_nome = str(nome or "").strip().upper()
            if chave_nome and cpf and chave_nome not in nome_para_cpf:
                nome_para_cpf[chave_nome] = cpf
        contagem: dict[str, int] = defaultdict(int)
        for cpf, nome, quantidade in self.repository.contar_admissoes_presentes():
            contagem[self._chave_operador(cpf, nome)] += int(quantidade or 0)
        for nome, quantidade in self.repository.contar_treinamentos_por_colaborador():
            cpf = nome_para_cpf.get(str(nome or "").strip().upper())
            contagem[self._chave_operador(cpf, nome)] += int(quantidade or 0)
        contagem.pop("", None)
        return dict(contagem), nome_para_cpf

    def dashboard(
        self, inicio, fim, agenda_id=None, carteira=None, turno=None,
        registro_cargo=None, status_primeiro_dia=None, status_segundo_dia=None,
    ) -> dict:
        turnos = {
            "MANHÃ": {"previstos": 0, "presentes": 0},
            "TARDE": {"previstos": 0, "presentes": 0},
            "INTEGRAL": {"previstos": 0, "presentes": 0},
            "NÃO INFORMADO": {"previstos": 0, "presentes": 0},
        }
        status_primeiro = {nome: 0 for nome in ("PREVISTO", "PRESENTE", "FALTOU", "DESISTIU")}
        status_segundo = {nome: 0 for nome in ("PREVISTO", "PRESENTE", "FALTOU", "DESISTIU")}
        grupos: dict[tuple, dict] = {}
        agendas: dict[tuple, dict] = {}

        rows = self.repository.dashboard(
            inicio, fim, agenda_id, carteira, turno, registro_cargo,
            status_primeiro_dia, status_segundo_dia,
        )
        for row in rows:
            cargo = row[0] or "NÃO INFORMADO"
            nome_carteira = row[1] or "NÃO INFORMADA"
            admissao = self._iso(row[2])
            nome_turno = row[3] or "NÃO INFORMADO"
            primeiro = row[4] or "PREVISTO"
            segundo = row[5] or "PREVISTO"
            agenda = (int(row[6]), row[7], nome_carteira)
            quantidade = int(row[8] or 0)

            status_primeiro.setdefault(primeiro, 0)
            status_segundo.setdefault(segundo, 0)
            status_primeiro[primeiro] += quantidade
            status_segundo[segundo] += quantidade
            turnos.setdefault(nome_turno, {"previstos": 0, "presentes": 0})
            turnos[nome_turno]["previstos"] += quantidade
            if primeiro == "PRESENTE":
                turnos[nome_turno]["presentes"] += quantidade

            chave = (cargo, nome_carteira, admissao)
            grupo = grupos.setdefault(chave, {
                "tipo": cargo, "carteira": nome_carteira, "admissao": admissao,
                "previstos": 0, "presentes": 0, "faltas": 0,
                "desistencias": 0, "pendentes": 0, "ausencias": 0,
            })
            grupo["previstos"] += quantidade
            if primeiro == "PRESENTE": grupo["presentes"] += quantidade
            elif primeiro == "FALTOU": grupo["faltas"] += quantidade
            elif primeiro == "DESISTIU": grupo["desistencias"] += quantidade
            else: grupo["pendentes"] += quantidade

            resumo_agenda = agendas.setdefault(agenda, {
                "id": agenda[0], "titulo": agenda[1], "carteira": agenda[2], "previstos": 0,
                "primeiro_dia": {"presentes": 0, "faltas": 0, "desistencias": 0, "pendentes": 0},
                "segundo_dia": {"presentes": 0, "faltas": 0, "desistencias": 0, "pendentes": 0},
            })
            resumo_agenda["previstos"] += quantidade
            for status_dia, chave_dia in ((primeiro, "primeiro_dia"), (segundo, "segundo_dia")):
                chave_status = {"PRESENTE": "presentes", "FALTOU": "faltas", "DESISTIU": "desistencias"}.get(status_dia, "pendentes")
                resumo_agenda[chave_dia][chave_status] += quantidade

        for resumo_agenda in agendas.values():
            for chave_dia in ("primeiro_dia", "segundo_dia"):
                dia = resumo_agenda[chave_dia]
                concluidos_dia = dia["presentes"] + dia["faltas"] + dia["desistencias"]
                dia["comparecimento"] = round(dia["presentes"] / concluidos_dia * 100, 1) if concluidos_dia else 0

        linhas = list(grupos.values())
        for item in linhas:
            item["ausencias"] = item["faltas"] + item["desistencias"]
        total = sum(status_primeiro.values())
        presentes = status_primeiro.get("PRESENTE", 0)
        faltas = status_primeiro.get("FALTOU", 0)
        desistencias = status_primeiro.get("DESISTIU", 0)
        pendentes = status_primeiro.get("PREVISTO", 0)
        concluidos = presentes + faltas + desistencias
        presentes_segundo = status_segundo.get("PRESENTE", 0)
        faltas_segundo = status_segundo.get("FALTOU", 0)
        desistencias_segundo = status_segundo.get("DESISTIU", 0)
        pendentes_segundo = status_segundo.get("PREVISTO", 0)
        concluidos_segundo = presentes_segundo + faltas_segundo + desistencias_segundo
        totais = {
            "previstos": total,
            "presentes": presentes,
            "faltas": faltas,
            "desistencias": desistencias,
            "pendentes": pendentes,
            "ausencias": faltas + desistencias,
            "taxa_comparecimento": round((presentes / total * 100), 1) if total else 0,
            "taxa_apuracao": round((concluidos / total * 100), 1) if total else 0,
            "presentes_segundo_dia": presentes_segundo,
            "faltas_segundo_dia": faltas_segundo,
            "desistencias_segundo_dia": desistencias_segundo,
            "pendentes_segundo_dia": pendentes_segundo,
            "taxa_comparecimento_segundo_dia": round((presentes_segundo / total * 100), 1) if total else 0,
            "taxa_apuracao_segundo_dia": round((concluidos_segundo / total * 100), 1) if total else 0,
            "turnos": turnos,
            "status_primeiro_dia": status_primeiro,
            "status_segundo_dia": status_segundo,
        }
        return {
            "totais": totais,
            "linhas": linhas,
            "agendas": sorted(agendas.values(), key=lambda item: item["previstos"], reverse=True),
        }

    def exportar_dashboard(
        self, inicio, fim, agenda_id=None, carteira=None, turno=None,
        registro_cargo=None, status_primeiro_dia=None, status_segundo_dia=None,
    ) -> bytes:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter

        dados = self.dashboard(
            inicio, fim, agenda_id, carteira, turno, registro_cargo,
            status_primeiro_dia, status_segundo_dia,
        )
        totais = dados["totais"]
        carteiras: dict[str, dict] = {}
        for item in dados["agendas"]:
            resumo_carteira = carteiras.setdefault(item["carteira"], {
                "carteira": item["carteira"], "previstos": 0,
                "primeiro_dia": {"presentes": 0, "faltas": 0, "desistencias": 0, "pendentes": 0},
                "segundo_dia": {"presentes": 0, "faltas": 0, "desistencias": 0, "pendentes": 0},
            })
            resumo_carteira["previstos"] += item["previstos"]
            for dia in ("primeiro_dia", "segundo_dia"):
                for status_nome in ("presentes", "faltas", "desistencias", "pendentes"):
                    resumo_carteira[dia][status_nome] += item[dia][status_nome]
        carteiras_ordenadas = sorted(carteiras.values(), key=lambda item: (-item["previstos"], item["carteira"]))
        for item in carteiras_ordenadas:
            for dia in ("primeiro_dia", "segundo_dia"):
                item[dia]["comparecimento"] = item[dia]["presentes"] / item["previstos"] if item["previstos"] else 0

        workbook = Workbook()
        resumo = workbook.active
        resumo.title = "Resumo"
        carteiras_sheet = workbook.create_sheet("Carteiras")
        agendas_sheet = workbook.create_sheet("Reuniões")
        participantes_sheet = workbook.create_sheet("Participantes")

        navy = "111827"; navy_light = "1F2937"; orange = "FF5A1F"; white = "FFFFFF"
        muted = "9CA3AF"; border_color = "374151"; green = "10B981"; red = "EF4444"
        amber = "F59E0B"; blue = "38BDF8"; soft = "F3F4F6"
        thin = Side(style="thin", color=border_color)

        def title(sheet, text, subtitle, end_column=8):
            sheet.sheet_view.showGridLines = False
            sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=end_column); sheet["A1"] = text
            sheet["A1"].fill = PatternFill("solid", fgColor=navy)
            sheet["A1"].font = Font(color=white, bold=True, size=18)
            sheet["A1"].alignment = Alignment(vertical="center")
            sheet.row_dimensions[1].height = 36
            sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=end_column); sheet["A2"] = subtitle
            sheet["A2"].fill = PatternFill("solid", fgColor=navy)
            sheet["A2"].font = Font(color=muted, italic=True, size=10)
            sheet.row_dimensions[2].height = 24

        def header(sheet, row, columns):
            for index, value in enumerate(columns, 1):
                cell = sheet.cell(row, index, value)
                cell.fill = PatternFill("solid", fgColor=orange)
                cell.font = Font(color=white, bold=True, size=10)
                cell.alignment = Alignment(vertical="center", wrap_text=True)
                cell.border = Border(bottom=thin)
            sheet.row_dimensions[row].height = 26

        def table_body(sheet, start_row, end_row, numeric_columns=()):
            for row in range(start_row, end_row + 1):
                fill = PatternFill("solid", fgColor=white if row % 2 else soft)
                for cell in sheet[row]:
                    cell.fill = fill
                    cell.font = Font(color=navy, size=10)
                    cell.border = Border(bottom=Side(style="thin", color="E5E7EB"))
                    cell.alignment = Alignment(vertical="center", wrap_text=True)
                for column in numeric_columns:
                    sheet.cell(row, column).alignment = Alignment(horizontal="right", vertical="center")

        periodo = f"Período: {inicio.strftime('%d/%m/%Y') if inicio else 'início'} até {fim.strftime('%d/%m/%Y') if fim else 'hoje'}"
        title(resumo, "ATLAS · RELATÓRIO DE TREINAMENTOS POR CARTEIRA", periodo, 10)
        resumo["A4"] = "FILTROS APLICADOS"; resumo["A4"].font = Font(color=orange, bold=True, size=11)
        filtros = [
            ("Agenda", str(agenda_id) if agenda_id else "Todas"), ("Carteira", carteira or "Todas"),
            ("Turno", turno or "Todos"), ("Registro / cargo", registro_cargo or "Todos"),
            ("Status 1º dia", status_primeiro_dia or "Todos"), ("Status 2º dia", status_segundo_dia or "Todos"),
        ]
        for index, (nome, valor) in enumerate(filtros, 5):
            resumo.cell(index, 1, nome).font = Font(color=muted, bold=True, size=9)
            resumo.cell(index, 2, valor).font = Font(color=navy, bold=True, size=10)

        cards = [
            ("Total previsto", totais["previstos"], orange), ("Presentes · 1º dia", totais["presentes"], green),
            ("Pendentes · 1º dia", totais["pendentes"], blue),
            ("Presentes · 2º dia", totais["presentes_segundo_dia"], green),
            ("Pendentes · 2º dia", totais["pendentes_segundo_dia"], blue),
            ("Ausências · 1º dia", totais["ausencias"], red),
        ]
        for index, (label, value, color) in enumerate(cards):
            column = 1 + (index % 3) * 3; row = 13 + (index // 3) * 4
            resumo.merge_cells(start_row=row, start_column=column, end_row=row, end_column=column + 1)
            resumo.merge_cells(start_row=row + 1, start_column=column, end_row=row + 2, end_column=column + 1)
            label_cell = resumo.cell(row, column, label.upper()); value_cell = resumo.cell(row + 1, column, value)
            for rng_row in range(row, row + 3):
                for rng_col in range(column, column + 2):
                    resumo.cell(rng_row, rng_col).fill = PatternFill("solid", fgColor=navy_light)
                    resumo.cell(rng_row, rng_col).border = Border(left=thin, right=thin, top=thin, bottom=thin)
            label_cell.font = Font(color=color, bold=True, size=9)
            value_cell.font = Font(color=white, bold=True, size=22)
            value_cell.alignment = Alignment(vertical="center")

        resumo["A22"] = "COMPARECIMENTO · 1º DIA"; resumo["A22"].font = Font(color=muted, bold=True, size=9)
        resumo["A23"] = totais["taxa_comparecimento"] / 100
        resumo["A23"].number_format = "0.0%"; resumo["A23"].font = Font(color=green, bold=True, size=22)
        resumo["D22"] = "COMPARECIMENTO · 2º DIA"; resumo["D22"].font = Font(color=muted, bold=True, size=9)
        resumo["D23"] = totais["taxa_comparecimento_segundo_dia"] / 100
        resumo["D23"].number_format = "0.0%"; resumo["D23"].font = Font(color=green, bold=True, size=22)
        resumo["G22"] = "APURAÇÃO · 1º / 2º DIA"; resumo["G22"].font = Font(color=muted, bold=True, size=9)
        resumo["G23"] = f'{totais["taxa_apuracao"]:.1f}% / {totais["taxa_apuracao_segundo_dia"]:.1f}%'
        resumo["G23"].font = Font(color=blue, bold=True, size=16)

        header(resumo, 26, ["CARTEIRA", "PREVISTOS", "PRESENTES 1º", "FALTAS 1º", "PENDENTES 1º", "% 1º",
                            "PRESENTES 2º", "FALTAS 2º", "PENDENTES 2º", "% 2º"])
        for item in carteiras_ordenadas:
            resumo.append([item["carteira"], item["previstos"], item["primeiro_dia"]["presentes"],
                           item["primeiro_dia"]["faltas"], item["primeiro_dia"]["pendentes"], item["primeiro_dia"]["comparecimento"],
                           item["segundo_dia"]["presentes"], item["segundo_dia"]["faltas"],
                           item["segundo_dia"]["pendentes"], item["segundo_dia"]["comparecimento"]])
        if carteiras_ordenadas:
            table_body(resumo, 27, 26 + len(carteiras_ordenadas), tuple(range(2, 11)))
            for row in range(27, 27 + len(carteiras_ordenadas)):
                resumo.cell(row, 6).number_format = "0.0%"; resumo.cell(row, 10).number_format = "0.0%"
        resumo.freeze_panes = "A4"
        for column, width in {"A":30,"B":13,"C":16,"D":12,"E":15,"F":11,"G":16,"H":12,"I":15,"J":11}.items(): resumo.column_dimensions[column].width = width

        title(carteiras_sheet, "RESULTADO PRINCIPAL POR CARTEIRA", periodo, 14)
        header(carteiras_sheet, 4, ["CARTEIRA", "PREVISTOS", "PRESENTES 1º DIA", "FALTAS 1º DIA", "DESISTÊNCIAS 1º DIA",
                                            "PENDENTES 1º DIA", "% 1º DIA", "PRESENTES 2º DIA", "FALTAS 2º DIA",
                                            "DESISTÊNCIAS 2º DIA", "PENDENTES 2º DIA", "% 2º DIA", "AUSÊNCIAS 1º DIA", "AUSÊNCIAS 2º DIA"])
        for item in carteiras_ordenadas:
            primeiro, segundo = item["primeiro_dia"], item["segundo_dia"]
            carteiras_sheet.append([item["carteira"], item["previstos"], primeiro["presentes"], primeiro["faltas"],
                                     primeiro["desistencias"], primeiro["pendentes"], primeiro["comparecimento"],
                                     segundo["presentes"], segundo["faltas"], segundo["desistencias"], segundo["pendentes"],
                                     segundo["comparecimento"], primeiro["faltas"] + primeiro["desistencias"],
                                     segundo["faltas"] + segundo["desistencias"]])
        if carteiras_ordenadas:
            table_body(carteiras_sheet, 5, 4 + len(carteiras_ordenadas), tuple(range(2, 15)))
            for row in range(5, 5 + len(carteiras_ordenadas)):
                carteiras_sheet.cell(row, 7).number_format = "0.0%"; carteiras_sheet.cell(row, 12).number_format = "0.0%"
            carteiras_sheet.auto_filter.ref = f"A4:N{4 + len(carteiras_ordenadas)}"
        carteiras_sheet.freeze_panes = "A5"
        for index, width in enumerate((30,12,18,14,20,16,12,18,14,20,16,12,18,18),1): carteiras_sheet.column_dimensions[get_column_letter(index)].width = width

        title(agendas_sheet, "PRESENÇA POR CARTEIRA, REUNIÃO E DIA", periodo, 14)
        header(agendas_sheet, 4, ["ID", "REUNIÃO", "CARTEIRA", "PREVISTOS",
                                  "PRESENTES 1º DIA", "FALTAS 1º DIA", "DESISTÊNCIAS 1º DIA", "PENDENTES 1º DIA", "% 1º DIA",
                                  "PRESENTES 2º DIA", "FALTAS 2º DIA", "DESISTÊNCIAS 2º DIA", "PENDENTES 2º DIA", "% 2º DIA"])
        for item in dados["agendas"]:
            primeiro = item["primeiro_dia"]
            segundo = item["segundo_dia"]
            agendas_sheet.append([item["id"], item["titulo"], item["carteira"], item["previstos"],
                                   primeiro["presentes"], primeiro["faltas"], primeiro["desistencias"], primeiro["pendentes"], primeiro["comparecimento"] / 100,
                                   segundo["presentes"], segundo["faltas"], segundo["desistencias"], segundo["pendentes"], segundo["comparecimento"] / 100])
        if agendas_sheet.max_row >= 5:
            table_body(agendas_sheet, 5, agendas_sheet.max_row, tuple(range(1, 15)))
            for row in range(5, agendas_sheet.max_row + 1):
                agendas_sheet.cell(row, 9).number_format = "0.0%"
                agendas_sheet.cell(row, 14).number_format = "0.0%"
            agendas_sheet.auto_filter.ref = f"A4:N{agendas_sheet.max_row}"
        agendas_sheet.freeze_panes = "A5"
        for index, width in enumerate((10,38,28,12,18,14,20,16,12,18,14,20,16,12),1): agendas_sheet.column_dimensions[get_column_letter(index)].width = width

        title(participantes_sheet, "PARTICIPANTES · ACOMPANHAMENTO NOMINAL", periodo, 11)
        header(participantes_sheet, 4, ["REUNIÃO", "DATA REUNIÃO", "COLABORADOR", "CPF", "CARTEIRA",
                                         "REGISTRO / CARGO", "TURNO", "ADMISSÃO", "1º DIA", "2º DIA", "OBSERVAÇÕES"])
        detalhes_rows = self.repository.detalhar_dashboard(
            inicio, fim, agenda_id, carteira, turno, registro_cargo,
            status_primeiro_dia, status_segundo_dia,
        )
        for row in detalhes_rows:
            participantes_sheet.append(list(row))
        if participantes_sheet.max_row >= 5:
            table_body(participantes_sheet, 5, participantes_sheet.max_row)
            for row in range(5, participantes_sheet.max_row + 1):
                participantes_sheet.cell(row, 2).number_format = "dd/mm/yyyy"
                participantes_sheet.cell(row, 8).number_format = "dd/mm/yyyy"
            participantes_sheet.auto_filter.ref = f"A4:K{participantes_sheet.max_row}"
        participantes_sheet.freeze_panes = "A5"
        for index, width in enumerate((34,16,34,18,30,28,16,14,16,16,44),1): participantes_sheet.column_dimensions[get_column_letter(index)].width = width

        output = io.BytesIO()
        workbook.save(output)
        return output.getvalue()

    def listar_admissoes(self, busca, inicio, fim, agenda_id=None):
        contagem, _ = self._mapa_vezes_treinado()
        itens = [{"id": int(r[0]), "colaborador": r[1], "cpf": r[2], "admissao": self._iso(r[3]),
                  "mes_referencia": self.MESES[r[3].month] if r[3] else "NÃO INFORMADO", "turno": r[4], "registro_cargo": r[5],
                  "carteira": r[6], "status_primeiro_dia": r[7], "status_segundo_dia": r[8], "observacoes": r[9],
                  "agenda_id": int(r[10]) if r[10] is not None else None, "agenda_titulo": r[11] or "", "agenda_data": self._iso(r[12]),
                  "agenda_dia2_id": int(r[13]) if r[13] is not None else None, "agenda_titulo_dia2": r[14] or "", "agenda_data_dia2": self._iso(r[15]),
                  "vezes_treinado": contagem.get(self._chave_operador(r[2], r[1]), 0)}
                 for r in self.repository.listar_admissoes(busca, inicio, fim, agenda_id)]
        return {"total": len(itens), "itens": itens}

    def listar_agenda_opcoes_dia2(self, inicio=None, fim=None):
        itens = [{"id": int(r[0]), "titulo": r[1], "data_treinamento": self._iso(r[2]),
                  "horario_inicio": str(r[3])[:5], "produto_carteira": r[4], "tipo_treinamento": r[5],
                  "responsavel": r[6], "status_agenda": r[7], "codigo_ciclo": r[8],
                  "dia_encontro": int(r[9]), "observacoes": r[10] or ""}
                 for r in self.repository.listar_agenda_opcoes_dia2(inicio, fim)]
        return {"total": len(itens), "itens": itens}

    def listar_treinamentos(self, busca, inicio, fim, agenda_id=None):
        contagem, nome_para_cpf = self._mapa_vezes_treinado()
        itens = []
        for r in self.repository.listar_treinados_consolidado(busca, inicio, fim, agenda_id):
            origem = "admissao" if r[0] == "ADMISSAO" else "treinamento"
            cpf = r[3] or nome_para_cpf.get(str(r[2] or "").strip().upper()) or ""
            data_treinamento = r[5]
            itens.append({"id": int(r[1]), "origem": origem, "colaborador": r[2], "cpf": cpf,
                          "produto_carteira": r[4], "data_treinamento": self._iso(data_treinamento),
                          "tipo_treinamento": r[6], "responsavel": r[7] or "",
                          "mes_referencia": self.MESES[data_treinamento.month] if data_treinamento else "NÃO INFORMADO",
                          "agenda_id": int(r[8]), "agenda_titulo": r[9], "agenda_data": self._iso(r[10]),
                          "vezes_treinado": contagem.get(self._chave_operador(cpf, r[2]), 0)})
        return {"total": len(itens), "itens": itens}

    def historico_operador(self, cpf=None, nome=None):
        cpf = (str(cpf).strip() or None) if cpf else None
        nome = (str(nome).strip() or None) if nome else None
        nomes = self.repository.nomes_do_operador(cpf)
        if nome:
            nomes.add(nome)
        nomes_lista = sorted(nomes)
        admissoes_rows = self.repository.historico_admissoes(cpf, nomes_lista)
        treinamentos_rows = self.repository.historico_treinamentos(nomes_lista)
        admissoes = [{"id": int(r[0]), "colaborador": r[1], "cpf": r[2], "admissao": self._iso(r[3]),
                      "mes_referencia": self.MESES[r[3].month] if r[3] else "NÃO INFORMADO", "turno": r[4],
                      "registro_cargo": r[5], "carteira": r[6], "status_primeiro_dia": r[7],
                      "status_segundo_dia": r[8], "observacoes": r[9],
                      "agenda_id": int(r[10]) if r[10] is not None else None,
                      "agenda_titulo": r[11] or "", "agenda_data": self._iso(r[12]),
                      "agenda_titulo_dia2": r[13] or "", "agenda_data_dia2": self._iso(r[14]),
                      "agenda_dia2_id": int(r[15]) if r[15] is not None else None}
                     for r in admissoes_rows]
        treinamentos = [{"id": int(r[0]), "colaborador": r[1], "produto_carteira": r[2],
                         "data_treinamento": self._iso(r[3]), "tipo_treinamento": r[4], "responsavel": r[5],
                         "mes_referencia": self.MESES[r[3].month] if r[3] else "NÃO INFORMADO",
                         "agenda_id": int(r[6]), "agenda_titulo": r[7], "agenda_data": self._iso(r[8])}
                        for r in treinamentos_rows]
        vezes = sum((1 if r[7] == "PRESENTE" else 0) + (1 if r[8] == "PRESENTE" else 0) for r in admissoes_rows) + len(treinamentos_rows)
        cpf_final = cpf or next((r[2] for r in admissoes_rows if r[2]), "")
        nome_final = nome or (admissoes_rows[0][1] if admissoes_rows else (treinamentos_rows[0][1] if treinamentos_rows else ""))
        return {"cpf": cpf_final or "", "nome": nome_final or "", "vezes_treinado": vezes,
                "admissoes": admissoes, "treinamentos": treinamentos}

    STATUS_REAIS = {"PRESENTE", "FALTOU", "DESISTIU"}

    def _preparar_admissao(self, payload: AdmissaoPayload) -> AdmissaoPayload:
        marca_dia1 = payload.status_primeiro_dia in self.STATUS_REAIS
        marca_dia2 = payload.status_segundo_dia in self.STATUS_REAIS
        if (marca_dia1 or marca_dia2) and not payload.agenda_id:
            raise AtlasException("Vincule uma agenda para registrar presença, falta ou desistência.")

        agenda_id = self.repository.obter_agenda_principal(payload.agenda_id) if payload.agenda_id else None
        if (marca_dia1 or marca_dia2) and not agenda_id:
            raise AtlasException("Selecione uma reunião válida da agenda para registrar a presença.")

        dia2_id = payload.agenda_dia2_id
        if dia2_id:
            info = self.repository.obter_ciclo_agenda(dia2_id)
            if not info or int(info[1]) != 2:
                raise AtlasException("Selecione uma reunião válida de Dia 2.")
        if marca_dia2:
            if not dia2_id and agenda_id:
                ciclo = self.repository.obter_ciclo_agenda(agenda_id)
                dia2_id = self.repository.obter_agenda_dia2(ciclo[0]) if ciclo else None
            if not dia2_id:
                raise AtlasException("Não é possível registrar o 2º dia: selecione a reunião do Dia 2.")
        if not agenda_id:
            raise AtlasException("Vincule uma agenda para registrar a admissão.")
        return payload.model_copy(update={"agenda_id": agenda_id, "agenda_dia2_id": dia2_id})

    def salvar_admissao(self, payload: AdmissaoPayload, item_id: int | None = None):
        payload = self._preparar_admissao(payload)
        if item_id: self.repository.atualizar_admissao(item_id, payload); return {"id": item_id, "mensagem": "Admissão atualizada com sucesso."}
        return {"id": self.repository.criar_admissao(payload), "mensagem": "Admissão registrada com sucesso."}

    def salvar_admissoes_lote(self, payloads: list[AdmissaoPayload]):
        if not payloads:
            raise AtlasException("Inclua ao menos uma admissão.")
        if len(payloads) > 5000:
            raise AtlasException("O limite por importação é de 5.000 admissões.")
        preparados = []
        for indice, item in enumerate(payloads, start=1):
            try:
                preparados.append(self._preparar_admissao(item))
            except AtlasException as exc:
                raise AtlasException(f"Linha {indice} ({item.colaborador}): {exc.message}") from exc
        quantidade = self.repository.criar_admissoes_lote(preparados)
        return {"quantidade": quantidade, "mensagem": f"{quantidade} admissões incluídas com sucesso."}

    def analisar_planilha_admissoes(self, arquivo: UploadFile):
        nome = str(arquivo.filename or "").strip()
        if not nome.lower().endswith((".xlsx", ".xlsm")):
            raise AtlasException("Envie um arquivo no formato .xlsx ou .xlsm.")
        conteudo = arquivo.file.read()
        if not conteudo:
            raise AtlasException("O arquivo enviado está vazio.")
        from openpyxl import load_workbook
        workbook = load_workbook(io.BytesIO(conteudo), read_only=True, data_only=True)
        aliases = {
            "colaborador": "colaborador", "nome": "colaborador", "cpf": "cpf",
            "admissao": "admissao", "data_admissao": "admissao", "turno": "turno",
            "registro": "registro_cargo", "cargo": "registro_cargo", "registro_cargo": "registro_cargo",
            "carteira": "carteira", "1_dia": "status_primeiro_dia", "1o_dia": "status_primeiro_dia", "primeiro_dia": "status_primeiro_dia",
            "status_primeiro_dia": "status_primeiro_dia", "2_dia": "status_segundo_dia", "2o_dia": "status_segundo_dia",
            "segundo_dia": "status_segundo_dia", "status_segundo_dia": "status_segundo_dia",
            "observacoes": "observacoes", "observacao": "observacoes",
            "agenda": "agenda_id", "agenda_id": "agenda_id", "id_agenda": "agenda_id", "agendamento": "agenda_id",
        }
        obrigatorios = {"colaborador", "cpf"}
        worksheet = None
        rows = []
        headers = []
        melhor_pontuacao = -1
        for nome_aba in workbook.sheetnames:
            candidata = workbook[nome_aba]
            linhas_candidatas = list(candidata.iter_rows(values_only=True))
            if not linhas_candidatas:
                continue
            headers_candidatos = [aliases.get(self._normalizar_cabecalho(value)) for value in linhas_candidatas[0]]
            pontuacao = len({item for item in headers_candidatos if item} & obrigatorios)
            if pontuacao > melhor_pontuacao:
                worksheet, rows, headers, melhor_pontuacao = candidata, linhas_candidatas, headers_candidatos, pontuacao
        if worksheet is None or not rows:
            raise AtlasException("A planilha não possui dados.")
        encontrados = {item for item in headers if item}
        faltantes = sorted(obrigatorios - encontrados)
        if faltantes:
            raise AtlasException("Colunas obrigatórias ausentes: " + ", ".join(faltantes))
        itens = []
        for numero, row in enumerate(rows[1:5001], start=2):
            if not any(value is not None and str(value).strip() for value in row):
                continue
            bruto = {header: row[index] if index < len(row) else None for index, header in enumerate(headers) if header}
            bruto["admissao"] = self._normalizar_data_excel(bruto.get("admissao"))
            bruto["cpf"] = self._normalizar_cpf(bruto.get("cpf"))
            bruto["turno"] = str(bruto.get("turno") or "").strip().upper().replace("MANHA", "MANHÃ") or None
            bruto["status_primeiro_dia"] = self._normalizar_status_excel(bruto.get("status_primeiro_dia"))
            bruto["status_segundo_dia"] = self._normalizar_status_excel(bruto.get("status_segundo_dia"))
            agenda_informada = bruto.get("agenda_id")
            bruto["agenda_id"] = agenda_informada or ""
            erros: list[str] = []
            try:
                validado = AdmissaoPayload.model_validate({**bruto, "agenda_id": agenda_informada or 1})
                dados = validado.model_dump(mode="json")
                dados["agenda_id"] = str(agenda_informada or "")
            except ValidationError as exc:
                dados = {key: (value.isoformat() if isinstance(value, (date, datetime)) else str(value or "")) for key, value in bruto.items()}
                erros = [str(item["msg"]).replace("Value error, ", "") for item in exc.errors()]
            itens.append({"linha": numero, "dados": dados, "erros": erros, "valido": not erros})
        return {"arquivo": nome, "aba": worksheet.title, "total": len(itens),
                "validos": sum(1 for item in itens if item["valido"]),
                "invalidos": sum(1 for item in itens if not item["valido"]), "itens": itens}

    @staticmethod
    def _normalizar_cabecalho(value) -> str:
        texto = unicodedata.normalize("NFKD", str(value or ""))
        texto = "".join(char for char in texto if not unicodedata.combining(char)).lower().strip()
        return re.sub(r"[^a-z0-9]+", "_", texto).strip("_")

    @staticmethod
    def _normalizar_data_excel(value):
        if isinstance(value, datetime): return value.date().isoformat()
        if isinstance(value, date): return value.isoformat()
        texto = str(value or "").strip()
        for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try: return datetime.strptime(texto, formato).date().isoformat()
            except ValueError: pass
        return texto

    @staticmethod
    def _normalizar_cpf(value) -> str:
        if isinstance(value, (int, float)): value = f"{int(value):011d}"
        digitos = re.sub(r"\D", "", str(value or ""))
        return f"{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:11]}" if len(digitos) == 11 else str(value or "").strip()

    @staticmethod
    def _normalizar_status_excel(value) -> str:
        texto = str(value or "").strip().upper()
        if not texto: return "PREVISTO"
        if texto in {"NÃO COMPARECEU", "NAO COMPARECEU", "AUSENTE", "FALTA"}: return "FALTOU"
        if texto in {"DESISTÊNCIA", "DESISTENCIA"}: return "DESISTIU"
        return texto

    def salvar_treinamento(self, payload: TreinamentoPayload, item_id: int | None = None):
        if item_id: self.repository.atualizar_treinamento(item_id, payload); return {"id": item_id, "mensagem": "Treinamento atualizado com sucesso."}
        return {"id": self.repository.criar_treinamento(payload), "mensagem": "Treinamento registrado com sucesso."}

    def salvar_treinamentos_lote(self, payloads: list[TreinamentoPayload]):
        if not payloads: raise AtlasException("Inclua ao menos um treinamento.")
        if len(payloads) > 5000: raise AtlasException("O limite por importação é de 5.000 treinamentos.")
        quantidade = self.repository.criar_treinamentos_lote(payloads)
        return {"quantidade": quantidade, "mensagem": f"{quantidade} treinamentos incluídos com sucesso."}

    def analisar_planilha_treinamentos(self, arquivo: UploadFile):
        nome = str(arquivo.filename or "").strip()
        if not nome.lower().endswith((".xlsx", ".xlsm")): raise AtlasException("Envie um arquivo no formato .xlsx ou .xlsm.")
        conteudo = arquivo.file.read()
        if not conteudo: raise AtlasException("O arquivo enviado está vazio.")
        from openpyxl import load_workbook
        workbook = load_workbook(io.BytesIO(conteudo), read_only=True, data_only=True)
        aliases = {
            "colaborador": "colaborador", "nome": "colaborador", "produto": "produto_carteira",
            "carteira": "produto_carteira", "produto_carteira": "produto_carteira",
            "data": "data_treinamento", "data_treinamento": "data_treinamento",
            "situacao": "tipo_treinamento", "situacao_tipo": "tipo_treinamento",
            "tipo": "tipo_treinamento",
            "tipo_treinamento": "tipo_treinamento", "responsavel": "responsavel",
            "instrutor": "responsavel", "treinador": "responsavel",
            "agenda": "agenda_id", "agenda_id": "agenda_id", "id_agenda": "agenda_id", "agendamento": "agenda_id",
        }
        obrigatorios = {"agenda_id", "colaborador", "produto_carteira", "data_treinamento", "tipo_treinamento", "responsavel"}
        worksheet = None; rows = []; headers = []; melhor = -1
        for nome_aba in workbook.sheetnames:
            candidata = workbook[nome_aba]; candidatas = list(candidata.iter_rows(values_only=True))
            if not candidatas: continue
            cabecalhos = [aliases.get(self._normalizar_cabecalho(value)) for value in candidatas[0]]
            pontos = len({item for item in cabecalhos if item} & obrigatorios)
            if pontos > melhor: worksheet, rows, headers, melhor = candidata, candidatas, cabecalhos, pontos
        if worksheet is None: raise AtlasException("A planilha não possui dados.")
        faltantes = sorted(obrigatorios - {item for item in headers if item})
        if faltantes: raise AtlasException("Colunas obrigatórias ausentes: " + ", ".join(faltantes))
        itens = []
        for numero, row in enumerate(rows[1:5001], start=2):
            if not any(value is not None and str(value).strip() for value in row): continue
            bruto = {header: row[index] if index < len(row) else None for index, header in enumerate(headers) if header}
            bruto["data_treinamento"] = self._normalizar_data_excel(bruto.get("data_treinamento"))
            erros = []
            try:
                validado = TreinamentoPayload.model_validate(bruto); dados = validado.model_dump(mode="json")
            except ValidationError as exc:
                dados = {key: (value.isoformat() if isinstance(value, (date, datetime)) else str(value or "")) for key, value in bruto.items()}
                erros = [str(item["msg"]).replace("Value error, ", "") for item in exc.errors()]
            itens.append({"linha": numero, "dados": dados, "erros": erros, "valido": not erros})
        return {"arquivo": nome, "aba": worksheet.title, "total": len(itens),
                "validos": sum(1 for item in itens if item["valido"]),
                "invalidos": sum(1 for item in itens if not item["valido"]), "itens": itens}

    def listar_agenda(self, inicio: date, fim: date):
        grupos_por_agenda: dict[int, dict[str, list[str]]] = {}
        for agenda_id, carteira, colaborador in self.repository.listar_participantes_agenda(inicio, fim):
            grupos = grupos_por_agenda.setdefault(int(agenda_id), {})
            grupos.setdefault(carteira, []).append(colaborador)
        itens = [{"id": int(r[0]), "titulo": r[1], "data_treinamento": self._iso(r[2]),
                  "horario_inicio": str(r[3])[:5], "horario_fim": str(r[4])[:5],
                  "produto_carteira": r[5], "tipo_treinamento": r[6], "responsavel": r[7],
                  "participantes": r[8], "observacoes": r[9], "status_agenda": r[10],
                  "quantidade_admissoes": int(r[11]), "quantidade_treinamentos": int(r[12]),
                  "codigo_ciclo": r[13], "dia_encontro": int(r[14]),
                  "participantes_por_carteira": grupos_por_agenda.get(int(r[0]), {})}
                 for r in self.repository.listar_agenda(inicio, fim)]
        return {"total": len(itens), "itens": itens}

    def listar_agenda_opcoes(self, inicio=None, fim=None):
        itens = [{"id": int(r[0]), "titulo": r[1], "data_treinamento": self._iso(r[2]),
                  "horario_inicio": str(r[3])[:5], "produto_carteira": r[4],
                  "tipo_treinamento": r[5], "responsavel": r[6], "status_agenda": r[7],
                  "codigo_ciclo": r[8], "dia_encontro": int(r[9]), "possui_dia_2": bool(r[10]),
                  "observacoes": r[11] or ""}
                 for r in self.repository.listar_agenda_opcoes(inicio, fim)]
        return {"total": len(itens), "itens": itens}

    def listar_carteiras(self):
        itens = [{"id_cedente": int(r[0]), "carteira": r[1]} for r in self.repository.listar_carteiras()]
        return {"total": len(itens), "itens": itens}

    def listar_responsaveis_qualidade(self):
        from src.application.services.gestao_usuario_service import GestaoUsuarioService
        usuarios = GestaoUsuarioService().listar_usuarios_permissoes()
        itens = [
            {"id_usuario": usuario.id_usuario, "nome": usuario.nm_colaborador, "login": usuario.nm_login}
            for usuario in usuarios
            if usuario.status.strip().upper().startswith("ATIVO")
            and "QUALIDADE" in {grupo.strip().upper() for grupo in usuario.grupos.values()}
        ]
        itens.sort(key=lambda item: (item["nome"] or item["login"]).upper())
        return {"total": len(itens), "itens": itens}

    def criar_agenda(self, payload: AgendaTreinamentoPayload):
        if payload.horario_fim <= payload.horario_inicio:
            raise AtlasException("O horário final deve ser posterior ao inicial.")
        if payload.dia_encontro == 2:
            if not payload.agenda_vinculada_id:
                raise AtlasException("Selecione a agenda do Dia 1 que será vinculada.")
            ciclo = self.repository.obter_ciclo_agenda(payload.agenda_vinculada_id)
            if not ciclo:
                raise AtlasException("Agenda do Dia 1 não encontrada.")
            codigo_ciclo = str(ciclo[0])
            if self.repository.ciclo_possui_dia(codigo_ciclo, 2):
                raise AtlasException("Este ciclo já possui uma agenda do Dia 2.")
            item_id = self.repository.criar_agenda(payload, codigo_ciclo, 2)
            return {"id": item_id, "mensagem": "Dia 2 criado e vinculado ao ciclo."}

        if payload.criar_dia_2:
            if not payload.data_dia_2 or not payload.horario_inicio_dia_2 or not payload.horario_fim_dia_2:
                raise AtlasException("Informe manualmente data, início e fim do Dia 2.")
            if payload.horario_fim_dia_2 <= payload.horario_inicio_dia_2:
                raise AtlasException("No Dia 2, o horário final deve ser posterior ao inicial.")
        codigo_ciclo = str(uuid4())
        item_id = self.repository.criar_agenda(payload, codigo_ciclo, 1)
        ids = [item_id]
        if payload.criar_dia_2:
            segundo = payload.model_copy(update={
                "data_treinamento": payload.data_dia_2,
                "horario_inicio": payload.horario_inicio_dia_2,
                "horario_fim": payload.horario_fim_dia_2,
                "dia_encontro": 2,
                "criar_dia_2": False,
            })
            ids.append(self.repository.criar_agenda(segundo, codigo_ciclo, 2))
        return {"id": item_id, "ids": ids, "mensagem": "Ciclo de treinamento criado com sucesso."}

    def atualizar_agenda(self, item_id: int, payload: AgendaTreinamentoPayload):
        if payload.horario_fim <= payload.horario_inicio:
            raise ValueError("O horário final deve ser posterior ao inicial.")
        self.repository.atualizar_agenda(item_id, payload)
        return {"id": item_id, "mensagem": "Agendamento atualizado com sucesso."}

    def excluir_agenda(self, item_id: int):
        try:
            admissoes, treinamentos = self.repository.excluir_agenda(item_id)
        except ValueError as exc:
            raise AtlasException(str(exc), status_code=404) from exc
        return {"mensagem": "Agendamento e registros vinculados excluídos.",
                "admissoes_excluidas": admissoes, "treinamentos_excluidos": treinamentos}
