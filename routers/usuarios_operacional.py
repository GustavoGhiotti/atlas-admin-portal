from fastapi import APIRouter, Depends

from src.application.services.alteracoes_colaboradores_service import AlteracoesColaboradoresService
from src.infrastructure.dependencies.access_groups import USERS_CARTEIRA_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.alteracoes_colaboradores import AtualizarCentroCusto2OperacionalRequest


router = APIRouter(
    prefix="/usuarios-operacional",
    tags=["usuarios-operacional"],
    dependencies=[Depends(require_any_group(*USERS_CARTEIRA_GROUPS))],
)


@router.get("/vega")
def listar_colaboradores_vega():
    colaboradores = AlteracoesColaboradoresService().listar_colaboradores_vega_operacional()
    return [colaborador.__dict__ for colaborador in colaboradores]


@router.get("/vega/centros-custo")
def listar_centros_custo_operacional():
    return AlteracoesColaboradoresService().listar_centros_custo_operacional()


@router.put("/vega/{cpf}/centro-custo-2")
def atualizar_centro_custo_2(cpf: str, body: AtualizarCentroCusto2OperacionalRequest):
    mensagem = AlteracoesColaboradoresService().atualizar_centro_custo_2_operacional(
        cpf=cpf,
        centro_custo_2=body.centro_custo_2,
        responsavel=body.responsavel,
    )
    return {"mensagem": mensagem}
