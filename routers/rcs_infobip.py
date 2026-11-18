from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from src.application.services.relatorio_rcs_service import RelatorioRcsService
from src.infrastructure.dependencies.access_groups import (
    RCS_DASHBOARD_GROUPS,
    RCS_GROUPS,
    RCS_LIMITES_ALLOWED_LOGINS,
    RCS_LIMITES_GROUPS,
    RCS_LIMITES_VIEW_GROUPS,
)
from src.infrastructure.dependencies.auth import require_any_group, require_any_group_or_login


router = APIRouter(prefix="/rcs/infobip", tags=["rcs-infobip"])


class EnvioTestePayload(BaseModel):
    id_cedente: int = Field(gt=0)
    canal: str
    num_cliente: str
    mensagem_template: str
    variaveis_json: str | None = None


class AtualizarLimiteEnvioPayload(BaseModel):
    volume_envio: int = Field(ge=0)


class AtualizarLimiteTotalPayload(BaseModel):
    limite_total: int = Field(ge=0)


@router.get("/filtros")
def filtros(_: object = Depends(require_any_group(*RCS_DASHBOARD_GROUPS))):
    filtros_resultado = RelatorioRcsService().listar_filtros()
    return {
        "cedentes": filtros_resultado.cedentes,
        "canais": filtros_resultado.canais,
        "usuarios": filtros_resultado.usuarios,
        "status": filtros_resultado.status,
    }


@router.get("/dashboard")
def dashboard(
    inicio: date | None = Query(default=None), fim: date | None = Query(default=None),
    cedente: str | None = Query(default=None), status: str | None = Query(default=None),
    canal: str | None = Query(default=None), usuario: str | None = Query(default=None),
    include_details: bool = Query(default=False),
    _: object = Depends(require_any_group(*RCS_DASHBOARD_GROUPS)),
):
    hoje = date.today()
    return RelatorioRcsService().consultar_dashboard(
        inicio=inicio or hoje, fim=fim or hoje, cedente=cedente, status=status,
        canal=canal, usuario=usuario, include_details=include_details,
    )


@router.post("/envio-teste")
def envio_teste(payload: EnvioTestePayload, _: object = Depends(require_any_group(*RCS_GROUPS))):
    return RelatorioRcsService().inserir_envio_teste(payload)


@router.get("/envio-teste/controle/{id_cliente}")
def consultar_envio_teste(id_cliente: int, _: object = Depends(require_any_group(*RCS_GROUPS))):
    return RelatorioRcsService().consultar_envio_teste_por_id_cliente(id_cliente)


@router.get("/limites-envio")
def listar_limites_envio(_: object = Depends(require_any_group_or_login(RCS_LIMITES_VIEW_GROUPS, RCS_LIMITES_ALLOWED_LOGINS))):
    return RelatorioRcsService().listar_limites_envio()


@router.put("/limites-envio/semanal/{id_registro}")
def atualizar_limite_semanal(id_registro: int, payload: AtualizarLimiteEnvioPayload, _: object = Depends(require_any_group_or_login(RCS_LIMITES_GROUPS, RCS_LIMITES_ALLOWED_LOGINS))):
    return RelatorioRcsService().atualizar_limite_semanal(id_registro, payload.volume_envio)


@router.put("/limites-envio/mensal/{id_registro}")
def atualizar_limite_mensal(id_registro: int, payload: AtualizarLimiteEnvioPayload, _: object = Depends(require_any_group_or_login(RCS_LIMITES_GROUPS, RCS_LIMITES_ALLOWED_LOGINS))):
    return RelatorioRcsService().atualizar_limite_mensal(id_registro, payload.volume_envio)


@router.put("/limites-envio/total/semanal/{id_registro}")
def atualizar_limite_total_semanal(id_registro: int, payload: AtualizarLimiteTotalPayload, _: object = Depends(require_any_group_or_login(RCS_LIMITES_GROUPS, RCS_LIMITES_ALLOWED_LOGINS))):
    return RelatorioRcsService().atualizar_limite_total_semanal(id_registro, payload.limite_total)


@router.put("/limites-envio/total/mensal/{id_registro}")
def atualizar_limite_total_mensal(id_registro: int, payload: AtualizarLimiteTotalPayload, _: object = Depends(require_any_group_or_login(RCS_LIMITES_GROUPS, RCS_LIMITES_ALLOWED_LOGINS))):
    return RelatorioRcsService().atualizar_limite_total_mensal(id_registro, payload.limite_total)
