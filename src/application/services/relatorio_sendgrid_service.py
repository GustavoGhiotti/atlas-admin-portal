import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, timedelta
from threading import Lock
from time import perf_counter

from src.infrastructure.repositories import RelatorioSendGridRepository
from src.infrastructure.services.logger_config import setup_logger
from src.infrastructure.services.request_context import get_request_id
from src.shared.exception import AtlasException


@dataclass
class FiltrosSendGrid:
    carteiras: list[dict[str, str | int]]
    grupos: list[str]
    canais: list[str]
    status: list[str]


@dataclass
class EnvioTesteEmailInput:
    carteira: str
    grupo: str
    canal: str
    email_cliente: str
    email_empresa: str
    id_template: str
    variaveis_json: str | None = None


class RelatorioSendGridService:
    _filtros_cache_lock = Lock()
    _filtros_cache: FiltrosSendGrid | None = None
    _filtros_cache_expires_at = 0.0
    _dashboard_cache_lock = Lock()
    _dashboard_cache: dict[tuple[object, ...], tuple[float, dict[str, object]]] = {}
    _cache_ttl_seconds = 300.0

    def __init__(self) -> None:
        self.repository = RelatorioSendGridRepository()
        self.logger = setup_logger("atlas.email-sendgrid")

    def listar_filtros(self) -> FiltrosSendGrid:
        cached = self._get_cached_filtros()
        if cached:
            self.logger.info("request_id=%s etapa=cache_hit operacao=listar_filtros_email", get_request_id())
            return cached

        started_at = perf_counter()
        self.logger.info("request_id=%s etapa=inicio operacao=listar_filtros_email", get_request_id())
        resultados = self._run_parallel_steps(
            [
                ("listar_carteiras", self.repository.listar_carteiras, ()),
                ("listar_grupos", self.repository.listar_grupos, ()),
                ("listar_canais", self.repository.listar_canais, ()),
                ("listar_status", self.repository.listar_status, ()),
            ],
            max_workers=4,
        )
        elapsed_ms = (perf_counter() - started_at) * 1000
        carteiras_rows = resultados["listar_carteiras"]
        grupos_rows = resultados["listar_grupos"]
        canais_rows = resultados["listar_canais"]
        status_rows = resultados["listar_status"]
        self.logger.info(
            "request_id=%s etapa=fim operacao=listar_filtros_email duracao_ms=%.2f carteiras=%s grupos=%s canais=%s status=%s",
            get_request_id(),
            elapsed_ms,
            len(carteiras_rows),
            len(grupos_rows),
            len(canais_rows),
            len(status_rows),
        )
        filtros = FiltrosSendGrid(
            carteiras=[{"id": int(row[0]), "nome": str(row[1])} for row in carteiras_rows],
            grupos=[str(row[0]) for row in grupos_rows],
            canais=[str(row[0]) for row in canais_rows],
            status=[str(row[0]) for row in status_rows],
        )
        self._set_cached_filtros(filtros)
        return filtros

    def inserir_envio_teste(self, payload: EnvioTesteEmailInput) -> dict[str, object]:
        carteira_informada = (payload.carteira or "").strip()
        if not carteira_informada:
            raise AtlasException("Carteira obrigatoria.")

        if carteira_informada.isdigit():
            carteira = self.repository.buscar_carteira_por_id(int(carteira_informada))
        else:
            carteira = self.repository.buscar_carteira_por_nome(carteira_informada)
        if not carteira:
            raise AtlasException("Carteira invalida para envio teste.")

        grupo = (payload.grupo or "").strip().upper()
        if not grupo:
            raise AtlasException("Grupo obrigatorio.")

        canal = (payload.canal or "").strip().lower()
        if not canal:
            raise AtlasException("Canal obrigatorio.")

        email_cliente = (payload.email_cliente or "").strip().lower()
        email_empresa = (payload.email_empresa or "").strip().lower()
        if "@" not in email_cliente:
            raise AtlasException("Email do cliente invalido.")
        if "@" not in email_empresa:
            raise AtlasException("Email da empresa invalido.")

        id_template = (payload.id_template or "").strip()
        if not id_template:
            raise AtlasException("ID template obrigatorio.")

        variaveis_json = (payload.variaveis_json or "{}").strip()
        try:
            variaveis_obj = json.loads(variaveis_json)
        except json.JSONDecodeError as exc:
            raise AtlasException("Variaveis JSON invalidas.") from exc

        variaveis_json_normalizado = json.dumps(variaveis_obj, ensure_ascii=False)
        id_cliente = self.repository.gerar_id_cliente_teste()

        inserted = self.repository.inserir_envio_teste(
            id_cliente,
            int(carteira[0]),
            str(carteira[1]),
            grupo,
            canal,
            email_cliente,
            email_empresa,
            id_template,
            variaveis_json_normalizado,
        )

        return {
            "id": int(inserted[0]),
            "id_cliente": int(inserted[1]),
            "nm_carteira": str(inserted[2]),
            "id_cedente": int(inserted[3]),
            "status": str(inserted[4]),
        }

    def consultar_envio_teste_por_id_cliente(self, id_cliente: int) -> dict[str, object]:
        if int(id_cliente) <= 0:
            raise AtlasException("ID Cliente invalido para consulta.")

        row = self.repository.buscar_envio_teste_por_id_cliente(int(id_cliente))
        if not row:
            raise AtlasException("Nenhum envio encontrado para o ID Cliente informado.")

        return {
            "id": int(row[0] or 0),
            "id_cliente": int(row[1] or 0),
            "id_cedente": int(row[2] or 0),
            "nm_carteira": str(row[3] or ""),
            "grupo": str(row[4] or ""),
            "canal": str(row[5] or ""),
            "email_cliente": str(row[6] or ""),
            "email_empresa": str(row[7] or ""),
            "id_template": str(row[8] or ""),
            "variaveis_json": str(row[9] or ""),
            "status": str(row[10] or ""),
            "dt_inclusao": self._fmt(row[11]) if row[11] else "",
            "dt_envio": self._fmt(row[12]) if row[12] else "",
        }

    def consultar_dashboard(
        self,
        inicio: date,
        fim: date,
        carteira: str | None = None,
        grupo: str | None = None,
        canal: str | None = None,
        status: str | None = None,
        include_details: bool = False,
    ) -> dict[str, object]:
        cache_key = (inicio.isoformat(), fim.isoformat(), carteira or "", grupo or "", canal or "", status or "", include_details)
        cached = self._get_cached_dashboard(cache_key)
        if cached:
            self.logger.info(
                "request_id=%s etapa=cache_hit operacao=consultar_dashboard_email inicio=%s fim=%s include_details=%s",
                get_request_id(),
                inicio.isoformat(),
                fim.isoformat(),
                include_details,
            )
            return cached

        started_at = perf_counter()
        self.logger.info(
            "request_id=%s etapa=inicio operacao=consultar_dashboard_email inicio=%s fim=%s carteira=%s grupo=%s canal=%s status=%s include_details=%s",
            get_request_id(),
            inicio.isoformat(),
            fim.isoformat(),
            carteira or "-",
            grupo or "-",
            canal or "-",
            status or "-",
            include_details,
        )
        dashboard_steps = [
            ("buscar_resumo_dashboard", self.repository.buscar_resumo_dashboard, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_envios_por_dia", self.repository.listar_envios_por_dia, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_envios_por_semana", self.repository.listar_envios_por_semana, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_envios_por_mes", self.repository.listar_envios_por_mes, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_envios_por_carteira", self.repository.listar_envios_por_carteira, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_envios_por_grupo", self.repository.listar_envios_por_grupo, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_envios_por_canal", self.repository.listar_envios_por_canal, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_status_dashboard", self.repository.listar_status_dashboard, (inicio, fim, carteira, grupo, canal, status)),
            ("listar_templates_dashboard", self.repository.listar_templates_dashboard, (inicio, fim, carteira, grupo, canal, status)),
        ]
        if include_details:
            dashboard_steps.append(
                ("listar_detalhes_dashboard", self.repository.listar_detalhes_dashboard, (inicio, fim, carteira, grupo, canal, status))
            )
        resultados = self._run_parallel_steps(dashboard_steps, max_workers=6)
        resumo = resultados["buscar_resumo_dashboard"]
        envios_dia = resultados["listar_envios_por_dia"]
        envios_semana = resultados["listar_envios_por_semana"]
        envios_mes = resultados["listar_envios_por_mes"]
        envios_carteira = resultados["listar_envios_por_carteira"]
        envios_grupo = resultados["listar_envios_por_grupo"]
        envios_canal = resultados["listar_envios_por_canal"]
        status_dist = resultados["listar_status_dashboard"]
        templates = resultados["listar_templates_dashboard"]
        detalhes = resultados.get("listar_detalhes_dashboard", [])
        serie_semana = self._preencher_intervalo_diario(
            inicio - timedelta(days=inicio.weekday()),
            fim + timedelta(days=(6 - fim.weekday())),
            envios_semana,
        )
        inicio_mes = inicio.replace(day=1)
        if fim.month == 12:
            proximo_mes = fim.replace(year=fim.year + 1, month=1, day=1)
        else:
            proximo_mes = fim.replace(month=fim.month + 1, day=1)
        fim_mes = proximo_mes - timedelta(days=1)
        serie_mes = self._preencher_intervalo_diario(inicio_mes, fim_mes, envios_mes)
        payload = {
            "resumo": {
                "total_envios": int(resumo[0] or 0),
                "taxa_sucesso_pct": float(resumo[1] or 0),
                "taxa_erro_pct": float(resumo[2] or 0),
                "tempo_medio_envio": float(resumo[3] or 0),
            },
            "envios_por_dia": [{"dia": self._fmt(row[0]), "total_envios": int(row[1] or 0)} for row in envios_dia],
            "envios_por_semana": [{"periodo": self._fmt(item["periodo"]), "total_envios": int(item["total_envios"])} for item in serie_semana],
            "envios_por_mes": [{"periodo": self._fmt(item["periodo"]), "total_envios": int(item["total_envios"])} for item in serie_mes],
            "envios_por_carteira": [{"carteira": str(row[0] or ""), "total_envios": int(row[1] or 0)} for row in envios_carteira],
            "envios_por_grupo": [{"grupo": str(row[0] or ""), "total_envios": int(row[1] or 0)} for row in envios_grupo],
            "envios_por_canal": [{"canal": str(row[0] or ""), "total_envios": int(row[1] or 0)} for row in envios_canal],
            "status": [{"status": str(row[0] or ""), "total": int(row[1] or 0)} for row in status_dist],
            "templates": [{"id_template": str(row[0] or ""), "total_envios": int(row[1] or 0)} for row in templates],
            "detalhes": [
                {
                    "id": int(row[0] or 0),
                    "id_cliente": int(row[1] or 0),
                    "id_cedente": int(row[2] or 0),
                    "nm_carteira": str(row[3] or ""),
                    "grupo": str(row[4] or ""),
                    "canal": str(row[5] or ""),
                    "email_cliente": str(row[6] or ""),
                    "email_empresa": str(row[7] or ""),
                    "id_template": str(row[8] or ""),
                    "variaveis_json": str(row[9] or ""),
                    "status": str(row[10] or ""),
                    "dt_inclusao": self._fmt(row[11]) if row[11] else "",
                    "dt_envio": self._fmt(row[12]) if row[12] else "",
                }
                for row in detalhes
            ],
        }
        elapsed_ms = (perf_counter() - started_at) * 1000
        self.logger.info(
            "request_id=%s etapa=fim operacao=consultar_dashboard_email duracao_ms=%.2f detalhes=%s",
            get_request_id(),
            elapsed_ms,
            len(detalhes),
        )
        self._set_cached_dashboard(cache_key, payload)
        return payload

    def _fmt(self, value) -> str:
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    def _preencher_intervalo_diario(self, inicio: date, fim: date, rows) -> list[dict[str, object]]:
        valores = {row[0]: int(row[1] or 0) for row in rows}
        periodo: list[dict[str, object]] = []
        cursor = inicio
        while cursor <= fim:
            periodo.append({"periodo": cursor, "total_envios": valores.get(cursor, 0)})
            cursor += timedelta(days=1)
        return periodo

    def _timed_step(self, step_name: str, fn, *args):
        started_at = perf_counter()
        result = fn(*args)
        elapsed_ms = (perf_counter() - started_at) * 1000
        size = len(result) if hasattr(result, "__len__") else "-"
        self.logger.info(
            "request_id=%s etapa=%s duracao_ms=%.2f tamanho=%s",
            get_request_id(),
            step_name,
            elapsed_ms,
            size,
        )
        return result

    def _run_parallel_steps(self, steps: list[tuple[str, object, tuple]], max_workers: int) -> dict[str, object]:
        results: dict[str, object] = {}
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {executor.submit(self._timed_step, step_name, fn, *args): step_name for step_name, fn, args in steps}
            for future in as_completed(future_map):
                step_name = future_map[future]
                results[step_name] = future.result()
        return results

    @classmethod
    def _get_cached_filtros(cls) -> FiltrosSendGrid | None:
        now = perf_counter()
        with cls._filtros_cache_lock:
            if cls._filtros_cache and now < cls._filtros_cache_expires_at:
                return cls._filtros_cache
        return None

    @classmethod
    def _set_cached_filtros(cls, filtros: FiltrosSendGrid) -> None:
        with cls._filtros_cache_lock:
            cls._filtros_cache = filtros
            cls._filtros_cache_expires_at = perf_counter() + cls._cache_ttl_seconds

    @classmethod
    def _get_cached_dashboard(cls, key: tuple[object, ...]) -> dict[str, object] | None:
        now = perf_counter()
        with cls._dashboard_cache_lock:
            cached = cls._dashboard_cache.get(key)
            if cached and now < cached[0]:
                return cached[1]
            if cached:
                cls._dashboard_cache.pop(key, None)
        return None

    @classmethod
    def _set_cached_dashboard(cls, key: tuple[object, ...], payload: dict[str, object]) -> None:
        with cls._dashboard_cache_lock:
            cls._dashboard_cache[key] = (perf_counter() + cls._cache_ttl_seconds, payload)
            if len(cls._dashboard_cache) > 32:
                expired_keys = [item_key for item_key, (expires_at, _) in cls._dashboard_cache.items() if expires_at < perf_counter()]
                for item_key in expired_keys:
                    cls._dashboard_cache.pop(item_key, None)
