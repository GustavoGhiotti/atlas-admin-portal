import json
from dataclasses import dataclass
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from time import perf_counter

from src.infrastructure.repositories import RelatorioInfobipRepository
from src.infrastructure.services.logger_config import setup_logger
from src.infrastructure.services.request_context import get_request_id
from src.shared.exception import AtlasException


@dataclass
class FiltrosInfobip:
    cedentes: list[dict[str, str | int]]
    canais: list[str]
    usuarios: list[str]
    status: list[str]


@dataclass
class EnvioTesteInput:
    id_cedente: int
    canal: str
    num_cliente: str
    mensagem_template: str
    variaveis_json: str | None = None


@dataclass
class LimiteCedenteInfobip:
    id: int
    id_cedente: int
    nome: str
    volume_envio: int


@dataclass
class LimiteTotalInfobip:
    id: int
    limite_total: int
    ativo: bool


@dataclass
class ResumoLimiteEnvioCedenteInfobip:
    id_cedente: int
    nome: str
    limite_semanal: int
    total_enviado_semana: int
    nao_utilizado: int
    limite_efetivo: int
    restante_semana: int
    limite_mensal: int
    total_enviado_mes: int
    restante_mes: int


class RelatorioInfobipService:
    _filtros_cache_lock = Lock()
    _filtros_cache: FiltrosInfobip | None = None
    _filtros_cache_expires_at = 0.0
    _dashboard_cache_lock = Lock()
    _dashboard_cache: dict[tuple[object, ...], tuple[float, dict[str, object]]] = {}
    _filtros_cache_ttl_seconds = 300.0

    def __init__(self, repository=None, logger_name: str = "atlas.sms-infobip") -> None:
        self.repository = repository or RelatorioInfobipRepository()
        self.logger = setup_logger(logger_name)

    def listar_filtros(self) -> FiltrosInfobip:
        cached = self._get_cached_filtros()
        if cached:
            self.logger.info("request_id=%s etapa=cache_hit operacao=listar_filtros", get_request_id())
            return cached

        started_at = perf_counter()
        self.logger.info("request_id=%s etapa=inicio operacao=listar_filtros", get_request_id())
        resultados = self._run_parallel_steps(
            [
                ("listar_cedentes", self.repository.listar_cedentes, ()),
                ("listar_canais", self.repository.listar_canais, ()),
                ("listar_usuarios", self.repository.listar_usuarios, ()),
                ("listar_status", self.repository.listar_status, ()),
            ],
            max_workers=4,
        )
        cedentes_rows = resultados["listar_cedentes"]
        canais_rows = resultados["listar_canais"]
        usuarios_rows = resultados["listar_usuarios"]
        status_rows = resultados["listar_status"]
        elapsed_ms = (perf_counter() - started_at) * 1000
        self.logger.info(
            "request_id=%s etapa=fim operacao=listar_filtros duracao_ms=%.2f cedentes=%s canais=%s usuarios=%s status=%s",
            get_request_id(),
            elapsed_ms,
            len(cedentes_rows),
            len(canais_rows),
            len(usuarios_rows),
            len(status_rows),
        )
        filtros = FiltrosInfobip(
            cedentes=[{"id": int(row[0]), "nome": str(row[1])} for row in cedentes_rows],
            canais=[str(row[0]) for row in canais_rows],
            usuarios=[str(row[0]) for row in usuarios_rows],
            status=[str(row[0]) for row in status_rows],
        )
        self._set_cached_filtros(filtros)
        return filtros

    def inserir_envio_teste(self, payload: EnvioTesteInput) -> dict[str, object]:
        cedente = self.repository.buscar_cedente_ativo(payload.id_cedente)
        if not cedente:
            raise AtlasException("Carteira invalida ou inativa.")

        canal = (payload.canal or "").strip().lower()
        if not canal:
            raise AtlasException("Canal obrigatorio.")

        numero = "".join(char for char in str(payload.num_cliente or "") if char.isdigit())
        if len(numero) < 10:
            raise AtlasException("Numero do cliente invalido.")

        mensagem = (payload.mensagem_template or "").strip()
        if not mensagem:
            raise AtlasException("Mensagem obrigatoria.")

        variaveis_json = (payload.variaveis_json or "{}").strip()
        try:
            variaveis_obj = json.loads(variaveis_json)
        except json.JSONDecodeError as exc:
            raise AtlasException("Variaveis JSON invalidas.") from exc

        variaveis_json_normalizado = json.dumps(variaveis_obj, ensure_ascii=False)
        id_cliente = self.repository.gerar_id_cliente_teste()

        inserted = self.repository.inserir_envio_teste(
            str(cedente[1]),
            canal,
            int(cedente[0]),
            id_cliente,
            numero,
            mensagem,
            variaveis_json_normalizado,
        )

        return {
            "id": int(inserted[0]),
            "cedente": str(inserted[1]),
            "id_cedente": int(inserted[2]),
            "id_cliente": id_cliente,
            "num_cliente": str(inserted[3]),
            "status": str(inserted[4]),
        }

    def listar_limites_envio(self) -> dict[str, list[dict[str, object]]]:
        limite_total_semanal = self.repository.buscar_limite_total_semanal()
        limite_total_mensal = self.repository.buscar_limite_total_mensal()
        semanal_rows = self.repository.listar_limites_semanais()
        mensal_rows = self.repository.listar_limites_mensais()
        resumo_rows = self.repository.listar_resumo_limites_envio()
        return {
            "limite_total_semanal": self._serialize_limite_total_row(limite_total_semanal),
            "limite_total_mensal": self._serialize_limite_total_row(limite_total_mensal),
            "semanal": [self._serialize_limite_row(row) for row in semanal_rows],
            "mensal": [self._serialize_limite_row(row) for row in mensal_rows],
            "resumo_cedente": [self._serialize_resumo_limites_row(row) for row in resumo_rows],
        }

    def atualizar_limite_semanal(self, id_registro: int, volume_envio: int) -> dict[str, object]:
        if int(id_registro) <= 0:
            raise AtlasException("ID do registro invalido.")
        if int(volume_envio) < 0:
            raise AtlasException("Volume de envio semanal invalido.")
        row = self.repository.atualizar_limite_semanal(int(id_registro), int(volume_envio))
        if not row:
            raise AtlasException("Cedente nao encontrado para atualizacao semanal.")
        return self._serialize_limite_row(row)

    def atualizar_limite_mensal(self, id_registro: int, volume_envio: int) -> dict[str, object]:
        if int(id_registro) <= 0:
            raise AtlasException("ID do registro invalido.")
        if int(volume_envio) < 0:
            raise AtlasException("Volume de envio mensal invalido.")
        row = self.repository.atualizar_limite_mensal(int(id_registro), int(volume_envio))
        if not row:
            raise AtlasException("Cedente nao encontrado para atualizacao mensal.")
        return self._serialize_limite_row(row)

    def atualizar_limite_total_semanal(self, id_registro: int, limite_total: int) -> dict[str, object]:
        if int(id_registro) <= 0:
            raise AtlasException("ID do limite total semanal invalido.")
        if int(limite_total) < 0:
            raise AtlasException("Limite total semanal invalido.")
        row = self.repository.atualizar_limite_total_semanal(int(id_registro), int(limite_total))
        if not row:
            raise AtlasException("Limite total semanal nao encontrado para atualizacao.")
        return self._serialize_limite_total_row(row)

    def atualizar_limite_total_mensal(self, id_registro: int, limite_total: int) -> dict[str, object]:
        if int(id_registro) <= 0:
            raise AtlasException("ID do limite total mensal invalido.")
        if int(limite_total) < 0:
            raise AtlasException("Limite total mensal invalido.")
        row = self.repository.atualizar_limite_total_mensal(int(id_registro), int(limite_total))
        if not row:
            raise AtlasException("Limite total mensal nao encontrado para atualizacao.")
        return self._serialize_limite_total_row(row)

    def consultar_envio_teste_por_id_cliente(self, id_cliente: int) -> dict[str, object]:
        if int(id_cliente) <= 0:
            raise AtlasException("Controle interno invalido para consulta.")

        row = self.repository.buscar_envio_teste_por_id_cliente(int(id_cliente))
        if not row:
            raise AtlasException("Nenhum envio encontrado para o controle informado.")

        return {
            "id": int(row[0]),
            "cedente": str(row[1] or ""),
            "id_cedente": int(row[2] or 0),
            "canal": str(row[3] or ""),
            "id_cliente": int(row[4] or 0),
            "num_cliente": str(row[5] or ""),
            "mensagem_template": str(row[6] or ""),
            "variaveis_json": str(row[7] or ""),
            "status": str(row[8] or ""),
            "status_desc": str(row[9] or ""),
            "dt_inclusao": self._fmt(row[10]) if row[10] else "",
            "dt_envio": self._fmt(row[11]) if row[11] else "",
            "dt_entrega": self._fmt(row[12]) if row[12] else "",
            "dt_atualizacao": self._fmt(row[13]) if row[13] else "",
        }

    def consultar_dashboard(
        self,
        inicio: date,
        fim: date,
        cedente: str | None = None,
        status: str | None = None,
        canal: str | None = None,
        usuario: str | None = None,
        include_details: bool = False,
    ) -> dict[str, object]:
        cache_key = (inicio.isoformat(), fim.isoformat(), cedente or "", status or "", canal or "", usuario or "", include_details)
        cached = self._get_cached_dashboard(cache_key)
        if cached:
            self.logger.info(
                "request_id=%s etapa=cache_hit operacao=consultar_dashboard inicio=%s fim=%s include_details=%s",
                get_request_id(),
                inicio.isoformat(),
                fim.isoformat(),
                include_details,
            )
            return cached
        started_at = perf_counter()
        self.logger.info(
            "request_id=%s etapa=inicio operacao=consultar_dashboard inicio=%s fim=%s cedente=%s status=%s canal=%s usuario=%s include_details=%s",
            get_request_id(),
            inicio.isoformat(),
            fim.isoformat(),
            cedente or "-",
            status or "-",
            canal or "-",
            usuario or "-",
            include_details,
        )
        dashboard_steps = [
            ("buscar_resumo_dashboard", self.repository.buscar_resumo_dashboard, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_envios_por_dia", self.repository.listar_envios_por_dia, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_envios_por_semana", self.repository.listar_envios_por_semana, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_envios_por_mes", self.repository.listar_envios_por_mes, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_custo_por_carteira", self.repository.listar_custo_por_carteira, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_custo_por_canal", self.repository.listar_custo_por_canal, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_custo_por_dia", self.repository.listar_custo_por_dia, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_taxa_entrega_por_carteira", self.repository.listar_taxa_entrega_por_carteira, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_desempenho_por_canal", self.repository.listar_desempenho_por_canal, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_status_dashboard", self.repository.listar_status_dashboard, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_erros_dashboard", self.repository.listar_erros_dashboard, (inicio, fim, cedente, status, canal, usuario)),
            ("listar_usuarios_dashboard", self.repository.listar_usuarios_dashboard, (inicio, fim, cedente, status, canal, usuario)),
        ]
        if include_details:
            dashboard_steps.append(
                ("listar_detalhes_dashboard", self.repository.listar_detalhes_dashboard, (inicio, fim, cedente, status, canal, usuario))
            )
        resultados = self._run_parallel_steps(dashboard_steps, max_workers=6)
        resumo = resultados["buscar_resumo_dashboard"]
        envios_dia = resultados["listar_envios_por_dia"]
        envios_semana = resultados["listar_envios_por_semana"]
        envios_mes = resultados["listar_envios_por_mes"]
        custo_carteira = resultados["listar_custo_por_carteira"]
        custo_canal = resultados["listar_custo_por_canal"]
        custo_dia = resultados["listar_custo_por_dia"]
        entrega_carteira = resultados["listar_taxa_entrega_por_carteira"]
        desempenho_canal = resultados["listar_desempenho_por_canal"]
        status_dist = resultados["listar_status_dashboard"]
        erros = resultados["listar_erros_dashboard"]
        usuarios = resultados["listar_usuarios_dashboard"]
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
        elapsed_ms = (perf_counter() - started_at) * 1000
        self.logger.info(
            "request_id=%s etapa=fim operacao=consultar_dashboard duracao_ms=%.2f detalhes=%s usuarios=%s erros=%s",
            get_request_id(),
            elapsed_ms,
            len(detalhes),
            len(usuarios),
            len(erros),
        )

        payload = {
            "resumo": {
                "total_envios": int(resumo[0] or 0),
                "total_partes_sms": int(resumo[1] or 0),
                "custo_total": float(resumo[2] or 0),
                "custo_medio_envio": float(resumo[3] or 0),
                "entregues": int(resumo[4] or 0),
                "erros": int(resumo[5] or 0),
                "taxa_entrega_pct": float(resumo[6] or 0),
                "taxa_erro_pct": float(resumo[7] or 0),
                "tempo_medio_entrega": float(resumo[8] or 0),
            },
            "envios_por_dia": [{"dia": self._fmt(row[0]), "total_envios": int(row[1] or 0)} for row in envios_dia],
            "envios_por_semana": [{"periodo": self._fmt(item["periodo"]), "total_envios": int(item["total_envios"])} for item in serie_semana],
            "envios_por_mes": [{"periodo": self._fmt(item["periodo"]), "total_envios": int(item["total_envios"])} for item in serie_mes],
            "custo_por_carteira": [{"cedente": str(row[0]), "custo_total": float(row[1] or 0)} for row in custo_carteira],
            "custo_por_canal": [{"canal": str(row[0]), "custo_total": float(row[1] or 0)} for row in custo_canal],
            "custo_por_dia": [{"dia": self._fmt(row[0]), "custo_total": float(row[1] or 0)} for row in custo_dia],
            "taxa_entrega_por_carteira": [{"cedente": str(row[0]), "taxa_entrega_pct": float(row[1] or 0)} for row in entrega_carteira],
            "desempenho_por_canal": [{"canal": str(row[0]), "total_envios": int(row[1] or 0), "taxa_entrega_pct": float(row[2] or 0)} for row in desempenho_canal],
            "status": [{"status": str(row[0]), "total": int(row[1] or 0)} for row in status_dist],
            "erros": [{"erro_infobip": str(row[0]), "status_desc": str(row[1]), "total": int(row[2] or 0)} for row in erros],
            "usuarios": [{"usuario": str(row[0]), "total_envios": int(row[1] or 0), "custo_total": float(row[2] or 0), "taxa_entrega_pct": float(row[3] or 0)} for row in usuarios],
            "detalhes": [
                {
                    "id": int(row[0] or 0),
                    "cedente": str(row[1] or ""),
                    "id_cedente": int(row[2] or 0),
                    "canal": str(row[3] or ""),
                    "id_cliente": int(row[4] or 0),
                    "num_cliente": str(row[5] or ""),
                    "mensagem_template": str(row[6] or ""),
                    "variaveis_json": str(row[7] or ""),
                    "status": str(row[8] or ""),
                    "status_desc": str(row[9] or ""),
                    "erro_infobip": str(row[10] or ""),
                    "dt_inclusao": self._fmt(row[11]) if row[11] else "",
                    "dt_envio": self._fmt(row[12]) if row[12] else "",
                    "dt_entrega": self._fmt(row[13]) if row[13] else "",
                    "dt_atualizacao": self._fmt(row[14]) if row[14] else "",
                    "sms_count": int(row[15] or 0),
                    "custo_total": float(row[16] or 0),
                    "usuario_envio": str(row[17] or ""),
                }
                for row in detalhes
            ],
        }
        self._set_cached_dashboard(cache_key, payload)
        return payload

    def _fmt(self, value) -> str:
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    def _serialize_limite_row(self, row) -> dict[str, object]:
        limite = LimiteCedenteInfobip(
            id=int(row[0] or 0),
            id_cedente=int(row[1] or 0),
            nome=str(row[2] or ""),
            volume_envio=int(row[3] or 0),
        )
        return {
            "id": limite.id,
            "id_cedente": limite.id_cedente,
            "nome": limite.nome,
            "volume_envio": limite.volume_envio,
        }

    def _serialize_limite_total_row(self, row) -> dict[str, object] | None:
        if not row:
            return None
        limite = LimiteTotalInfobip(
            id=int(row[0] or 0),
            limite_total=int(row[1] or 0),
            ativo=bool(row[2]),
        )
        return {
            "id": limite.id,
            "limite_total": limite.limite_total,
            "ativo": limite.ativo,
        }

    def _serialize_resumo_limites_row(self, row) -> dict[str, object]:
        resumo = ResumoLimiteEnvioCedenteInfobip(
            id_cedente=int(row[0] or 0),
            nome=str(row[1] or ""),
            limite_semanal=int(row[2] or 0),
            total_enviado_semana=int(row[3] or 0),
            nao_utilizado=int(row[4] or 0),
            limite_efetivo=int(row[5] or 0),
            restante_semana=int(row[6] or 0),
            limite_mensal=int(row[7] or 0),
            total_enviado_mes=int(row[8] or 0),
            restante_mes=int(row[9] or 0),
        )
        return {
            "id_cedente": resumo.id_cedente,
            "nome": resumo.nome,
            "limite_semanal": resumo.limite_semanal,
            "total_enviado_semana": resumo.total_enviado_semana,
            "nao_utilizado": resumo.nao_utilizado,
            "limite_efetivo": resumo.limite_efetivo,
            "restante_semana": resumo.restante_semana,
            "limite_mensal": resumo.limite_mensal,
            "total_enviado_mes": resumo.total_enviado_mes,
            "restante_mes": resumo.restante_mes,
        }

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
            future_map = {
                executor.submit(self._timed_step, step_name, fn, *args): step_name
                for step_name, fn, args in steps
            }
            for future in as_completed(future_map):
                step_name = future_map[future]
                results[step_name] = future.result()
        return results

    @classmethod
    def _get_cached_filtros(cls) -> FiltrosInfobip | None:
        now = perf_counter()
        with cls._filtros_cache_lock:
            if cls._filtros_cache and now < cls._filtros_cache_expires_at:
                return cls._filtros_cache
        return None

    @classmethod
    def _set_cached_filtros(cls, filtros: FiltrosInfobip) -> None:
        with cls._filtros_cache_lock:
            cls._filtros_cache = filtros
            cls._filtros_cache_expires_at = perf_counter() + cls._filtros_cache_ttl_seconds

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
            cls._dashboard_cache[key] = (perf_counter() + cls._filtros_cache_ttl_seconds, payload)
            if len(cls._dashboard_cache) > 32:
                expired_keys = [item_key for item_key, (expires_at, _) in cls._dashboard_cache.items() if expires_at < perf_counter()]
                for item_key in expired_keys:
                    cls._dashboard_cache.pop(item_key, None)
