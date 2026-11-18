from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from src.application.services.relatorio_sendgrid_service import RelatorioSendGridService
from src.infrastructure.external.sendgrid.sendgrid_api import SendGrid
from src.infrastructure.dependencies.access_groups import ANALYTICS_GROUPS, EMAIL_DASHBOARD_GROUPS
from src.infrastructure.dependencies.auth import require_any_group


router = APIRouter(
    prefix="/email/sendgrid",
    tags=["email-sendgrid"],
)


class EnvioTesteEmailPayload(BaseModel):
    carteira: str = Field(min_length=1)
    grupo: str
    canal: str
    email_cliente: str
    email_empresa: str
    id_template: str
    variaveis_json: str | None = None


def _default_inicio() -> date:
    return date.today()


def _default_fim() -> date:
    return date.today()


@router.get("/filtros")
def filtros(_: object = Depends(require_any_group(*EMAIL_DASHBOARD_GROUPS))):
    filtros = RelatorioSendGridService().listar_filtros()
    return {
        "carteiras": filtros.carteiras,
        "grupos": filtros.grupos,
        "canais": filtros.canais,
        "status": filtros.status,
    }


@router.get("/dashboard")
def dashboard(
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    carteira: str | None = Query(default=None),
    grupo: str | None = Query(default=None),
    canal: str | None = Query(default=None),
    status: str | None = Query(default=None),
    include_details: bool = Query(default=False),
    _: object = Depends(require_any_group(*EMAIL_DASHBOARD_GROUPS)),
):
    return RelatorioSendGridService().consultar_dashboard(
        inicio=inicio or _default_inicio(),
        fim=fim or _default_fim(),
        carteira=carteira,
        grupo=grupo,
        canal=canal,
        status=status,
        include_details=include_details,
    )


@router.post("/envio-teste")
def envio_teste(payload: EnvioTesteEmailPayload, _: object = Depends(require_any_group(*ANALYTICS_GROUPS))):
    return RelatorioSendGridService().inserir_envio_teste(payload)


@router.get("/envio-teste/controle/{id_cliente}")
def consultar_envio_teste(id_cliente: int, _: object = Depends(require_any_group(*ANALYTICS_GROUPS))):
    return RelatorioSendGridService().consultar_envio_teste_por_id_cliente(id_cliente)


@router.post("/suppresion")
def bloqueio_email(emails:list[str], _: object = Depends(require_any_group(*ANALYTICS_GROUPS))):
    return SendGrid().suppresion(emails)
