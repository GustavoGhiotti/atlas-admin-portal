from datetime import date
import io

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from src.application.services.monitorias_vega_service import MonitoriasVegaService
from src.application.services.treinamentos_service import TreinamentosService
from src.infrastructure.dependencies.access_groups import TREINAMENTOS_ALLOWED_LOGINS, TREINAMENTOS_GROUPS
from src.infrastructure.dependencies.auth import require_any_group_or_login
from src.schemas.monitorias_vega import MonitoriaVegaPayload
from src.schemas.treinamentos import AdmissaoPayload, AgendaTreinamentoPayload, TreinamentoPayload

router = APIRouter(prefix="/treinamentos", tags=["treinamentos"], dependencies=[Depends(require_any_group_or_login(TREINAMENTOS_GROUPS, TREINAMENTOS_ALLOWED_LOGINS))])

@router.get("/dashboard")
def dashboard(
    request: Request,
    inicio: date | None = None,
    fim: date | None = None,
    agenda_id: int | None = Query(None, gt=0),
    carteira: str | None = Query(None, max_length=100),
    turno: str | None = Query(None, max_length=20),
    registro_cargo: str | None = Query(None, max_length=120),
    status_primeiro_dia: str | None = Query(None, max_length=20),
    status_segundo_dia: str | None = Query(None, max_length=20),
):
    request.state.log_title = "Dashboard gerencial de entradas"
    return TreinamentosService().dashboard(
        inicio, fim, agenda_id, carteira, turno, registro_cargo,
        status_primeiro_dia, status_segundo_dia,
    )

@router.get("/dashboard/exportar")
def exportar_dashboard(
    request: Request,
    inicio: date | None = None,
    fim: date | None = None,
    agenda_id: int | None = Query(None, gt=0),
    carteira: str | None = Query(None, max_length=100),
    turno: str | None = Query(None, max_length=20),
    registro_cargo: str | None = Query(None, max_length=120),
    status_primeiro_dia: str | None = Query(None, max_length=20),
    status_segundo_dia: str | None = Query(None, max_length=20),
):
    request.state.log_title = "Exportação do dashboard de treinamentos"
    conteudo = TreinamentosService().exportar_dashboard(
        inicio, fim, agenda_id, carteira, turno, registro_cargo,
        status_primeiro_dia, status_segundo_dia,
    )
    nome = f"relatorio-treinamentos-{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        io.BytesIO(conteudo),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )

@router.get("/monitorias-vega/dashboard")
def dashboard_monitorias_vega(request: Request, ano: int = Query(..., ge=2000, le=2100), mes: int = Query(..., ge=1, le=12)):
    request.state.log_title = "Dashboard de monitorias VEGA"
    return MonitoriasVegaService().dashboard(ano, mes)

@router.get("/monitorias-vega/exportar")
def exportar_monitorias_vega(request: Request, ano: int = Query(..., ge=2000, le=2100)):
    request.state.log_title = "Exportação de monitorias VEGA"
    conteudo = MonitoriasVegaService().exportar(ano)
    nome = f"monitorias-vega-{ano}.xlsx"
    return StreamingResponse(
        io.BytesIO(conteudo),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )

@router.get("/monitorias-vega/anos")
def listar_anos_monitorias_vega(request: Request):
    request.state.log_title = "Anos disponíveis de monitorias VEGA"
    return MonitoriasVegaService().anos()

@router.post("/monitorias-vega/lote", status_code=status.HTTP_201_CREATED)
def salvar_monitorias_vega_lote(payload: list[MonitoriaVegaPayload]):
    return MonitoriasVegaService().salvar_lote(payload)

@router.post("/monitorias-vega/importacao/analisar")
def analisar_planilha_monitorias_vega(arquivo: UploadFile = File(...)):
    return MonitoriasVegaService().analisar_planilha(arquivo)

@router.get("/admissoes")
def listar_admissoes(request: Request, busca: str | None = Query(None, max_length=100), inicio: date | None = None, fim: date | None = None, agenda_id: int | None = Query(None, gt=0)):
    request.state.log_title = "Listagem de admissões"
    return TreinamentosService().listar_admissoes(busca, inicio, fim, agenda_id)

@router.post("/admissoes", status_code=status.HTTP_201_CREATED)
def criar_admissao(payload: AdmissaoPayload): return TreinamentosService().salvar_admissao(payload)

@router.post("/admissoes/lote", status_code=status.HTTP_201_CREATED)
def criar_admissoes_lote(payload: list[AdmissaoPayload]): return TreinamentosService().salvar_admissoes_lote(payload)

@router.post("/admissoes/importacao/analisar")
def analisar_importacao_admissoes(arquivo: UploadFile = File(...)): return TreinamentosService().analisar_planilha_admissoes(arquivo)

@router.put("/admissoes/{item_id}")
def atualizar_admissao(item_id: int, payload: AdmissaoPayload): return TreinamentosService().salvar_admissao(payload, item_id)

@router.delete("/admissoes/{item_id}")
def excluir_admissao(item_id: int): TreinamentosService().repository.excluir_admissao(item_id); return {"mensagem": "Admissão excluída."}

@router.get("/agenda")
def listar_agenda(request: Request, inicio: date, fim: date):
    request.state.log_title = "Agenda de treinamentos"
    return TreinamentosService().listar_agenda(inicio, fim)

@router.get("/agenda/opcoes")
def listar_agenda_opcoes(request: Request, inicio: date | None = None, fim: date | None = None):
    request.state.log_title = "Opções de agenda para vínculos"
    return TreinamentosService().listar_agenda_opcoes(inicio, fim)

@router.get("/agenda/opcoes-dia2")
def listar_agenda_opcoes_dia2(request: Request, inicio: date | None = None, fim: date | None = None):
    request.state.log_title = "Opções de agenda de Dia 2"
    return TreinamentosService().listar_agenda_opcoes_dia2(inicio, fim)

@router.get("/operador")
def historico_operador(request: Request, cpf: str | None = Query(None, max_length=14), nome: str | None = Query(None, max_length=180)):
    request.state.log_title = "Histórico consolidado do operador"
    return TreinamentosService().historico_operador(cpf, nome)

@router.get("/carteiras")
def listar_carteiras(request: Request):
    request.state.log_title = "Opções de carteira para treinamentos"
    return TreinamentosService().listar_carteiras()

@router.get("/responsaveis-qualidade")
def listar_responsaveis_qualidade(request: Request):
    request.state.log_title = "Responsáveis do grupo Qualidade"
    return TreinamentosService().listar_responsaveis_qualidade()

@router.post("/agenda", status_code=status.HTTP_201_CREATED)
def criar_agenda(payload: AgendaTreinamentoPayload): return TreinamentosService().criar_agenda(payload)

@router.put("/agenda/{item_id}")
def atualizar_agenda(item_id: int, payload: AgendaTreinamentoPayload): return TreinamentosService().atualizar_agenda(item_id, payload)

@router.delete("/agenda/{item_id}")
def excluir_agenda(item_id: int): return TreinamentosService().excluir_agenda(item_id)

@router.get("")
def listar_treinamentos(request: Request, busca: str | None = Query(None, max_length=100), inicio: date | None = None, fim: date | None = None, agenda_id: int | None = Query(None, gt=0)):
    request.state.log_title = "Listagem de treinamentos"
    return TreinamentosService().listar_treinamentos(busca, inicio, fim, agenda_id)

@router.post("", status_code=status.HTTP_201_CREATED)
def criar_treinamento(payload: TreinamentoPayload): return TreinamentosService().salvar_treinamento(payload)

@router.post("/lote", status_code=status.HTTP_201_CREATED)
def criar_treinamentos_lote(payload: list[TreinamentoPayload]): return TreinamentosService().salvar_treinamentos_lote(payload)

@router.post("/importacao/analisar")
def analisar_importacao_treinamentos(arquivo: UploadFile = File(...)): return TreinamentosService().analisar_planilha_treinamentos(arquivo)

@router.put("/{item_id}")
def atualizar_treinamento(item_id: int, payload: TreinamentoPayload): return TreinamentosService().salvar_treinamento(payload, item_id)

@router.delete("/{item_id}")
def excluir_treinamento(item_id: int): TreinamentosService().repository.excluir_treinamento(item_id); return {"mensagem": "Treinamento excluído."}
