from fastapi import APIRouter, Depends, Query

from src.application.services.alteracoes_colaboradores_service import AlteracoesColaboradoresService
from src.infrastructure.dependencies.access_groups import CENTER_COST_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.alteracoes_colaboradores import (
    AtualizarColaboradorLoteRequest,
    AtualizarColaboradorRequest,
    CriarCentroCustoTemporarioRequest,
    StatusSincroniaRequest,
)


router = APIRouter(
    prefix="/alteracoes-colaboradores",
    tags=["alteracoes-colaboradores"],
    dependencies=[Depends(require_any_group(*CENTER_COST_GROUPS))],
)


@router.get("/colaborador/{cpf}")
def buscar_colaborador(cpf: str):
    colaborador = AlteracoesColaboradoresService().buscar_colaborador(cpf)
    return colaborador.__dict__


@router.put("/colaborador/{cpf}")
def atualizar_colaborador(cpf: str, body: AtualizarColaboradorRequest):
    mensagem = AlteracoesColaboradoresService().atualizar_colaborador(
        cpf=cpf,
        funcao=body.funcao,
        id_centro_custo=body.id_centro_custo,
        centro_custo=body.centro_custo,
        centro_custo_2=body.centro_custo_2,
        user_atualizacao=body.user_atualizacao,
    )
    return {"mensagem": mensagem}


@router.put("/colaborador/lote")
def atualizar_colaborador_lote(body: AtualizarColaboradorLoteRequest):
    return AlteracoesColaboradoresService().atualizar_em_lote(
        cpfs=body.cpfs,
        funcao=body.funcao,
        id_centro_custo=body.id_centro_custo,
        centro_custo=body.centro_custo,
        centro_custo_2=body.centro_custo_2,
        responsavel=body.responsavel,
    )


@router.get("/centros-custo")
def listar_centros_custo():
    return AlteracoesColaboradoresService().listar_centros_custo()


@router.get("/config")
def obter_configuracao():
    return AlteracoesColaboradoresService().obter_configuracao()


@router.post("/centros-custo/temporario")
def criar_centro_custo_temporario(body: CriarCentroCustoTemporarioRequest):
    return AlteracoesColaboradoresService().criar_centro_custo_temporario(
        id_centro_custo=body.id_centro_custo,
        centro_custo=body.centro_custo,
        responsavel=body.responsavel,
    )


@router.get("/centros-custo/funcoes")
def listar_funcoes():
    return AlteracoesColaboradoresService().listar_funcoes()


@router.get("/sincronia/status")
def obter_status_sincronia():
    return {"status": AlteracoesColaboradoresService().obter_status_sincronia()}


@router.put("/sincronia/status")
def atualizar_status_sincronia(body: StatusSincroniaRequest):
    return AlteracoesColaboradoresService().atualizar_status_sincronia(body.status)
