from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query

from src.application.services.portalacordo_dashboard_service import PortalAcordoDashboardService
from src.infrastructure.dependencies.access_groups import PORTALACORDO_GROUPS
from src.infrastructure.dependencies.auth import require_any_group


router = APIRouter(
    prefix="/portalacordo/monitoramento",
    tags=["portalacordo-monitoramento"],
    dependencies=[Depends(require_any_group(*PORTALACORDO_GROUPS))],
)


def _default_inicio() -> date:
    # Divergencia proposital dos demais dashboards, que abrem em hoje-hoje:
    # jornada de funil so faz sentido com janela.
    return date.today() - timedelta(days=29)


def _default_fim() -> date:
    return date.today()


@router.get("/filtros")
def filtros(origem: str = Query(default="portal")):
    resultado = PortalAcordoDashboardService().listar_filtros(origem)
    return {
        "carteiras": resultado.carteiras,
        "categorias": resultado.categorias,
        "canais": resultado.canais,
        "periodo_disponivel": resultado.periodo_disponivel,
    }


@router.get("/dashboard")
def dashboard(
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    origem: str = Query(default="portal"),
    cedente: str | None = Query(default=None),
    categoria: str | None = Query(default=None),
):
    return PortalAcordoDashboardService().consultar_dashboard(
        inicio=inicio or _default_inicio(),
        fim=fim or _default_fim(),
        origem=origem,
        cedente=cedente,
        categoria=categoria,
    )
