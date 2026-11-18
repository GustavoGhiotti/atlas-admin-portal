from datetime import date

from fastapi import APIRouter, Depends, Query

from src.application.services.relatorio_whatsapp_service import RelatorioWhatsAppService
from src.infrastructure.dependencies.access_groups import ANALYTICS_GROUPS
from src.infrastructure.dependencies.auth import require_any_group


router = APIRouter(
    prefix="/whatsapp",
    tags=["whatsapp"],
    dependencies=[Depends(require_any_group(*ANALYTICS_GROUPS))],
)


def _default_inicio() -> date:
    return date.today()


def _default_fim() -> date:
    return date.today()


@router.get("/{provider}/dashboard")
def dashboard(
    provider: str,
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    cedente: str | None = Query(default=None),
    canal: str | None = Query(default=None),
    status_numero: str | None = Query(default=None),
    status_template: str | None = Query(default=None),
):
    return RelatorioWhatsAppService().consultar_dashboard(
        provider=provider,
        inicio=inicio or _default_inicio(),
        fim=fim or _default_fim(),
        cedente=cedente,
        canal=canal,
        status_numero=status_numero,
        status_template=status_template,
    )
