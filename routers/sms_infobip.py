from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from src.application.services.relatorio_infobip_service import RelatorioInfobipService
from src.infrastructure.dependencies.access_groups import (
    ANALYTICS_GROUPS,
    SMS_DASHBOARD_GROUPS,
    SMS_LIMITES_ALLOWED_LOGINS,
    SMS_LIMITES_GROUPS,
    SMS_LIMITES_VIEW_GROUPS,
)
from src.infrastructure.dependencies.auth import require_any_group, require_any_group_or_login


router = APIRouter(
    prefix="/sms/infobip",
    tags=["sms-infobip"],
)


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


def _default_inicio() -> date:
    return date.today()


def _default_fim() -> date:
    return date.today()


@router.get("/filtros")
def filtros(_: object = Depends(require_any_group(*SMS_DASHBOARD_GROUPS))):
    filtros = RelatorioInfobipService().listar_filtros()
    return {
        "cedentes": filtros.cedentes,
        "canais": filtros.canais,
        "usuarios": filtros.usuarios,
        "status": filtros.status,
    }


@router.get("/dashboard")
def dashboard(
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    cedente: str | None = Query(default=None),
    status: str | None = Query(default=None),
    canal: str | None = Query(default=None),
    usuario: str | None = Query(default=None),
    include_details: bool = Query(default=False),
    _: object = Depends(require_any_group(*SMS_DASHBOARD_GROUPS)),
):
    return RelatorioInfobipService().consultar_dashboard(
        inicio=inicio or _default_inicio(),
        fim=fim or _default_fim(),
        cedente=cedente,
        status=status,
        canal=canal,
        usuario=usuario,
        include_details=include_details,
    )


@router.post("/envio-teste")
def envio_teste(payload: EnvioTestePayload, _: object = Depends(require_any_group(*ANALYTICS_GROUPS))):
    return RelatorioInfobipService().inserir_envio_teste(payload)


@router.get("/limites-envio")
def listar_limites_envio(
    _: object = Depends(require_any_group_or_login(SMS_LIMITES_VIEW_GROUPS, SMS_LIMITES_ALLOWED_LOGINS)),
):
    return RelatorioInfobipService().listar_limites_envio()


@router.put("/limites-envio/semanal/{id_registro}")
def atualizar_limite_semanal(
    id_registro: int,
    payload: AtualizarLimiteEnvioPayload,
    _: object = Depends(require_any_group_or_login(SMS_LIMITES_GROUPS, SMS_LIMITES_ALLOWED_LOGINS)),
):
    return RelatorioInfobipService().atualizar_limite_semanal(id_registro=id_registro, volume_envio=payload.volume_envio)


@router.put("/limites-envio/mensal/{id_registro}")
def atualizar_limite_mensal(
    id_registro: int,
    payload: AtualizarLimiteEnvioPayload,
    _: object = Depends(require_any_group_or_login(SMS_LIMITES_GROUPS, SMS_LIMITES_ALLOWED_LOGINS)),
):
    return RelatorioInfobipService().atualizar_limite_mensal(id_registro=id_registro, volume_envio=payload.volume_envio)


@router.put("/limites-envio/total/semanal/{id_registro}")
def atualizar_limite_total_semanal(
    id_registro: int,
    payload: AtualizarLimiteTotalPayload,
    _: object = Depends(require_any_group_or_login(SMS_LIMITES_GROUPS, SMS_LIMITES_ALLOWED_LOGINS)),
):
    return RelatorioInfobipService().atualizar_limite_total_semanal(id_registro=id_registro, limite_total=payload.limite_total)


@router.put("/limites-envio/total/mensal/{id_registro}")
def atualizar_limite_total_mensal(
    id_registro: int,
    payload: AtualizarLimiteTotalPayload,
    _: object = Depends(require_any_group_or_login(SMS_LIMITES_GROUPS, SMS_LIMITES_ALLOWED_LOGINS)),
):
    return RelatorioInfobipService().atualizar_limite_total_mensal(id_registro=id_registro, limite_total=payload.limite_total)


@router.get("/envio-teste/controle/{id_cliente}")
def consultar_envio_teste(id_cliente: int, _: object = Depends(require_any_group(*ANALYTICS_GROUPS))):
    return RelatorioInfobipService().consultar_envio_teste_por_id_cliente(id_cliente)
