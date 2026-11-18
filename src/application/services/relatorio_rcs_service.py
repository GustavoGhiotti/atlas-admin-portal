from threading import Lock

from src.application.services.relatorio_infobip_service import RelatorioInfobipService
from src.infrastructure.repositories.relatorio_rcs_repository import RelatorioRcsRepository


class RelatorioRcsService(RelatorioInfobipService):
    _filtros_cache_lock = Lock()
    _filtros_cache = None
    _filtros_cache_expires_at = 0.0
    _dashboard_cache_lock = Lock()
    _dashboard_cache = {}

    def __init__(self) -> None:
        super().__init__(RelatorioRcsRepository(), "atlas.rcs-infobip")
