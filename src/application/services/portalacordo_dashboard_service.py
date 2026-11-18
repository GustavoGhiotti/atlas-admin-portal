from dataclasses import dataclass
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from time import perf_counter

from src.infrastructure.repositories import PortalAcordoMonitoramentoRepository
from src.infrastructure.repositories.portalacordo_monitoramento_repository import (
    ORIGENS,
    SEM_CARTEIRA,
)
from src.infrastructure.services.logger_config import setup_logger
from src.infrastructure.services.request_context import get_request_id
from src.shared.exception import AtlasException


# Ordem de negocio das etapas, com as categorias de TB_*_EVENTO_TIPO.CATEGORIA que
# compoem cada uma. Uma etapa agrega mais de uma categoria quando sao caminhos
# alternativos e nao passos em sequencia:
#   - "Chegada" junta landing e entrada, porque nem todo visitante entra por landing;
#   - "Acesso" junta cadastro e login, porque quem ja tem conta faz login em vez de
#     se cadastrar - trata-los como etapas seguidas quebraria o funil.
# Categorias que nao sao etapa de jornada (erro, navegacao, telefone_olos, app_botoes,
# diagnostico) ficam de fora e aparecem na distribuicao por categoria.
ETAPAS_JORNADA: dict[str, list[tuple[str, tuple[str, ...]]]] = {
    "portal": [
        ("Chegada", ("landing", "entrada")),
        ("Consulta de carteiras", ("consulta",)),
        ("Acesso", ("cadastro", "login")),
        ("Negociacao", ("negociacao",)),
        ("Parcelamento", ("parcelamento",)),
        ("Proposta", ("proposta",)),
        ("Formalizacao", ("formalizacao",)),
        ("Pagamento", ("pagamento",)),
    ],
    "app": [
        ("Simulacao", ("simulacao",)),
        ("Parcelamento", ("parcelamento",)),
        ("Acordo", ("acordo",)),
    ],
}


@dataclass
class FiltrosPortalAcordo:
    carteiras: list[str]
    categorias: list[str]
    canais: list[str]
    periodo_disponivel: dict[str, object]


class PortalAcordoDashboardService:
    _filtros_cache_lock = Lock()
    _filtros_cache: dict[str, tuple[float, FiltrosPortalAcordo]] = {}
    _dashboard_cache_lock = Lock()
    _dashboard_cache: dict[tuple[object, ...], tuple[float, dict[str, object]]] = {}
    _cache_ttl_seconds = 300.0
    # A chave do cache carrega cedente/categoria, que vem do cliente: sem teto rigido,
    # um laco de requisicoes com filtros distintos retem um payload por chave ate o TTL.
    _cache_max_entries = 64
    # _preencher_intervalo_diario materializa um item por dia do intervalo. Sem teto de
    # amplitude, inicio=0020-01-01 gera ~732 mil itens e dezenas de MB de JSON.
    _max_dias_periodo = 366
    _data_minima = date(2020, 1, 1)

    def __init__(self, repository=None, logger_name: str = "atlas.portalacordo") -> None:
        self.repository = repository or PortalAcordoMonitoramentoRepository()
        self.logger = setup_logger(logger_name)

    def _validar_origem(self, origem: str | None) -> str:
        normalizada = (origem or "portal").strip().lower()
        if normalizada not in ORIGENS:
            raise AtlasException(f"Origem invalida. Use uma de: {', '.join(sorted(ORIGENS))}.")
        return normalizada

    def _validar_periodo(self, inicio: date, fim: date) -> None:
        if inicio > fim:
            raise AtlasException("Data inicial nao pode ser maior que a data final.")
        if inicio < self._data_minima:
            raise AtlasException(f"Data inicial nao pode ser anterior a {self._data_minima.isoformat()}.")
        if fim > date.today():
            raise AtlasException("Data final nao pode ser futura.")
        if (fim - inicio).days + 1 > self._max_dias_periodo:
            raise AtlasException(f"Periodo maximo de consulta e de {self._max_dias_periodo} dias.")

    # ------------------------------------------------------------------ filtros

    def listar_filtros(self, origem: str | None = None) -> FiltrosPortalAcordo:
        origem = self._validar_origem(origem)
        cached = self._get_cached_filtros(origem)
        if cached:
            self.logger.info(
                "request_id=%s etapa=cache_hit operacao=listar_filtros origem=%s", get_request_id(), origem
            )
            return cached

        started_at = perf_counter()
        self.logger.info("request_id=%s etapa=inicio operacao=listar_filtros origem=%s", get_request_id(), origem)
        resultados = self._run_parallel_steps(
            [
                ("listar_carteiras", self.repository.listar_carteiras, (origem,)),
                ("listar_categorias", self.repository.listar_categorias, (origem,)),
                ("listar_canais", self.repository.listar_canais, (origem,)),
                ("buscar_periodo_disponivel", self.repository.buscar_periodo_disponivel, (origem,)),
            ],
            max_workers=4,
        )
        periodo_row = resultados["buscar_periodo_disponivel"]
        elapsed_ms = (perf_counter() - started_at) * 1000
        self.logger.info(
            "request_id=%s etapa=fim operacao=listar_filtros origem=%s duracao_ms=%.2f carteiras=%s categorias=%s",
            get_request_id(),
            origem,
            elapsed_ms,
            len(resultados["listar_carteiras"]),
            len(resultados["listar_categorias"]),
        )
        filtros = FiltrosPortalAcordo(
            carteiras=[str(row[0]) for row in resultados["listar_carteiras"] if row[0]],
            categorias=[str(row[0]) for row in resultados["listar_categorias"] if row[0]],
            canais=[str(row[0]) for row in resultados["listar_canais"] if row[0]],
            periodo_disponivel={
                "primeiro_evento": self._fmt(periodo_row[0]) if periodo_row and periodo_row[0] else None,
                "ultimo_evento": self._fmt(periodo_row[1]) if periodo_row and periodo_row[1] else None,
                "total_eventos": int(periodo_row[2] or 0) if periodo_row else 0,
            },
        )
        self._set_cached_filtros(origem, filtros)
        return filtros

    # ---------------------------------------------------------------- dashboard

    def consultar_dashboard(
        self,
        inicio: date,
        fim: date,
        origem: str | None = None,
        cedente: str | None = None,
        categoria: str | None = None,
    ) -> dict[str, object]:
        origem = self._validar_origem(origem)
        self._validar_periodo(inicio, fim)

        cache_key = (origem, inicio.isoformat(), fim.isoformat(), cedente or "", categoria or "")
        cached = self._get_cached_dashboard(cache_key)
        if cached:
            self.logger.info(
                "request_id=%s etapa=cache_hit operacao=consultar_dashboard origem=%s inicio=%s fim=%s",
                get_request_id(),
                origem,
                inicio.isoformat(),
                fim.isoformat(),
            )
            return cached

        started_at = perf_counter()
        self.logger.info(
            "request_id=%s etapa=inicio operacao=consultar_dashboard origem=%s inicio=%s fim=%s cedente=%s categoria=%s",
            get_request_id(),
            origem,
            inicio.isoformat(),
            fim.isoformat(),
            cedente or "-",
            categoria or "-",
        )

        args = (origem, inicio, fim, cedente, categoria)
        etapas = ETAPAS_JORNADA.get(origem, [])
        resultados = self._run_parallel_steps(
            [
                ("buscar_resumo", self.repository.buscar_resumo, args),
                ("listar_eventos_por_dia", self.repository.listar_eventos_por_dia, args),
                ("listar_por_categoria", self.repository.listar_por_categoria, args),
                ("listar_top_eventos", self.repository.listar_top_eventos, args),
                ("listar_por_carteira", self.repository.listar_por_carteira, args),
                ("listar_nao_catalogados", self.repository.listar_nao_catalogados, args),
                ("listar_cedentes_sem_grupo", self.repository.listar_cedentes_sem_grupo, args),
                ("listar_origens_trafego", self.repository.listar_origens_trafego, args),
                ("buscar_jornada", self.repository.buscar_jornada, (*args, etapas)),
            ],
            max_workers=6,
        )

        resumo_row = resultados["buscar_resumo"]
        total_eventos = int(resumo_row[0] or 0) if resumo_row else 0
        eventos_erro = int(resumo_row[5] or 0) if resumo_row else 0
        por_categoria = [
            {
                "categoria": str(row[0]),
                "total": int(row[1] or 0),
                "dispositivos": int(row[2] or 0),
                "cpfs_unicos": int(row[3] or 0),
            }
            for row in resultados["listar_por_categoria"]
        ]

        payload = {
            "origem": origem,
            "periodo": {"inicio": inicio.isoformat(), "fim": fim.isoformat()},
            "resumo": {
                "total_eventos": total_eventos,
                "cpfs_unicos": int(resumo_row[1] or 0) if resumo_row else 0,
                "dispositivos": int(resumo_row[2] or 0) if resumo_row else 0,
                "eventos_desconhecidos": int(resumo_row[3] or 0) if resumo_row else 0,
                "eventos_sem_catalogo": int(resumo_row[4] or 0) if resumo_row else 0,
                "eventos_erro": eventos_erro,
                "taxa_erro_pct": round((eventos_erro / total_eventos) * 100, 2) if total_eventos else 0.0,
                "dias_com_dados": int(resumo_row[6] or 0) if resumo_row else 0,
                "cedente_sem_alias": int(resumo_row[7] or 0) if resumo_row else 0,
                "cedente_sem_grupo": int(resumo_row[8] or 0) if resumo_row else 0,
                "cedente_ausente": int(resumo_row[9] or 0) if resumo_row else 0,
                "carteira_por_contexto": int(resumo_row[10] or 0) if resumo_row else 0,
            },
            "cedentes_sem_grupo": [
                {"cedente": str(row[0]), "total": int(row[1] or 0)}
                for row in resultados["listar_cedentes_sem_grupo"]
            ],
            "eventos_por_dia": self._preencher_intervalo_diario(inicio, fim, resultados["listar_eventos_por_dia"]),
            "por_categoria": por_categoria,
            "jornada": self._montar_jornada(etapas, resultados["buscar_jornada"]),
            "top_eventos": [
                {
                    "evento": str(row[0]),
                    "nome": str(row[1] or row[0]),
                    "categoria": str(row[2] or ""),
                    "total": int(row[3] or 0),
                }
                for row in resultados["listar_top_eventos"]
            ],
            "por_carteira": [
                {
                    "carteira": str(row[0]),
                    "total": int(row[1] or 0),
                    "cpfs_unicos": int(row[2] or 0),
                    "resolvida": bool(row[3]),
                    "tem_cedente": bool(row[4]),
                }
                for row in resultados["listar_por_carteira"]
            ],
            "nao_catalogados": [
                {
                    "evento_original": str(row[0] or "(sem eventoOriginal)"),
                    "total": int(row[1] or 0),
                    "primeiro": self._fmt(row[2]),
                    "ultimo": self._fmt(row[3]),
                }
                for row in resultados["listar_nao_catalogados"]
            ],
            "origens_trafego": [
                {
                    "canal": str(row[0]),
                    "total": int(row[1] or 0),
                    "dispositivos": int(row[2] or 0),
                }
                for row in resultados["listar_origens_trafego"]
            ],
        }
        payload["alertas"] = self._montar_alertas(payload)

        elapsed_ms = (perf_counter() - started_at) * 1000
        self.logger.info(
            "request_id=%s etapa=fim operacao=consultar_dashboard origem=%s duracao_ms=%.2f eventos=%s carteiras=%s alertas=%s",
            get_request_id(),
            origem,
            elapsed_ms,
            total_eventos,
            len(payload["por_carteira"]),
            len(payload["alertas"]),
        )

        self._set_cached_dashboard(cache_key, payload)
        return payload

    # ------------------------------------------------------------------ helpers

    def _montar_jornada(
        self,
        etapas: list[tuple[str, tuple[str, ...]]],
        row,
    ) -> list[dict[str, object]]:
        """A unidade e o dispositivo, nao o evento: uma pessoa dispara varios eventos na
        mesma etapa, e contar eventos faria uma etapa posterior parecer maior que a
        anterior. CPF so existe depois do acesso, entao nao serve de unidade unica.
        """
        if not row or not etapas:
            return []

        montadas: list[dict[str, object]] = []
        base = 0
        anterior = 0
        for indice, (rotulo, categorias) in enumerate(etapas):
            dispositivos = int(row[indice * 3] or 0)
            cpfs = int(row[indice * 3 + 1] or 0)
            eventos = int(row[indice * 3 + 2] or 0)
            if not base and dispositivos:
                base = dispositivos
            montadas.append(
                {
                    "etapa": rotulo,
                    "categorias": list(categorias),
                    "dispositivos": dispositivos,
                    "cpfs_unicos": cpfs,
                    "eventos": eventos,
                    "pct_da_primeira": round((dispositivos / base) * 100, 2) if base else 0.0,
                    "pct_da_anterior": round((dispositivos / anterior) * 100, 2) if anterior else None,
                }
            )
            anterior = dispositivos
        return montadas

    def _montar_alertas(self, payload: dict[str, object]) -> list[dict[str, str]]:
        alertas: list[dict[str, str]] = []
        resumo = payload["resumo"]

        if not resumo["total_eventos"]:
            alertas.append(
                {
                    "tipo": "vazio",
                    "mensagem": "Nenhum evento registrado no periodo selecionado para esta origem.",
                }
            )
            return alertas

        if resumo["eventos_desconhecidos"]:
            alertas.append(
                {
                    "tipo": "catalogo",
                    "mensagem": (
                        f"{resumo['eventos_desconhecidos']} evento(s) gravados como 'evento_desconhecido'. "
                        "Pode ser codigo novo em campo com catalogo desatualizado - ou falha de leitura do catalogo, "
                        "que produz o mesmo sintoma."
                    ),
                }
            )

        # Dois problemas distintos, com acoes distintas. O balde "(nao identificado)"
        # e o CEDENTE ausente: nao ha nome para cadastrar, entao pedir alias ali seria
        # instrucao impossivel. O acionavel e o CEDENTE que chegou preenchido e nao
        # casou com nenhum alias - esse tem nome, e da para cadastrar.
        # Falta alias E chega ao discador: o arquivo de mailing sai com o prefixo do
        # fallback embutido no codigo do Portal Acordo, nao com o configurado aqui.
        sem_alias = int(resumo["cedente_sem_alias"])
        if sem_alias:
            alertas.append(
                {
                    "tipo": "carteira",
                    "mensagem": (
                        f"{sem_alias} evento(s) de campanha chegam sem alias cadastrado. O dashboard "
                        "agrupa mesmo assim, mas o prefixo do arquivo entregue ao discador cai no "
                        "fallback embutido no Portal Acordo em vez do que esta configurado aqui."
                    ),
                }
            )

        # Nao casou por nada: nem alias, nem nome de carteira, nem nome de landing.
        sem_grupo = int(resumo["cedente_sem_grupo"])
        if sem_grupo:
            nomes = [str(item["cedente"]) for item in payload.get("cedentes_sem_grupo") or []]
            exemplos = ", ".join(nomes[:4]) if nomes else "-"
            restantes = f" e mais {len(nomes) - 4}" if len(nomes) > 4 else ""
            alertas.append(
                {
                    "tipo": "carteira",
                    "mensagem": (
                        f"{sem_grupo} evento(s) trazem um cedente que nao corresponde a nenhuma "
                        f"carteira, landing ou alias: {exemplos}{restantes}. Cadastre o alias para "
                        "que apareçam agrupados."
                    ),
                }
            )

        # Sem cedente no campo, o dashboard ainda tenta o contexto: a URL /clientes/{slug}
        # e o historico do dispositivo. O alerta reporta so o que sobrou depois disso -
        # o numero cru assustaria sem corresponder ao que a tela mostra.
        ausente = int(resumo["cedente_ausente"])
        recuperado = int(resumo.get("carteira_por_contexto") or 0)
        residuo = max(ausente - recuperado, 0)
        if residuo and resumo["total_eventos"]:
            pct = (residuo / resumo["total_eventos"]) * 100
            if pct >= 10:
                complemento = (
                    f" Outros {recuperado} foram atribuidos pela pagina de origem ou pelo"
                    " historico do dispositivo."
                    if recuperado
                    else ""
                )
                alertas.append(
                    {
                        "tipo": "cedente_ausente",
                        "mensagem": (
                            f"{pct:.0f}% dos eventos ficam em \"{SEM_CARTEIRA}\": acontecem antes de o "
                            "visitante escolher carteira (home, consulta, login), entao nao ha nome para "
                            f"gravar e alias nao resolve.{complemento}"
                        ),
                    }
                )

        return alertas

    def _preencher_intervalo_diario(self, inicio: date, fim: date, rows) -> list[dict[str, object]]:
        valores = {row[0]: (int(row[1] or 0), int(row[2] or 0)) for row in rows}
        periodo: list[dict[str, object]] = []
        cursor = inicio
        while cursor <= fim:
            total, cpfs = valores.get(cursor, (0, 0))
            periodo.append(
                {
                    "periodo": cursor.isoformat(),
                    "total_eventos": total,
                    "cpfs_unicos": cpfs,
                }
            )
            cursor += timedelta(days=1)
        return periodo

    def _fmt(self, value) -> str:
        if value is None:
            return ""
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

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
    def _get_cached_filtros(cls, origem: str) -> FiltrosPortalAcordo | None:
        now = perf_counter()
        with cls._filtros_cache_lock:
            cached = cls._filtros_cache.get(origem)
            if cached and now < cached[0]:
                return cached[1]
            if cached:
                cls._filtros_cache.pop(origem, None)
        return None

    @classmethod
    def _set_cached_filtros(cls, origem: str, filtros: FiltrosPortalAcordo) -> None:
        with cls._filtros_cache_lock:
            cls._filtros_cache[origem] = (perf_counter() + cls._cache_ttl_seconds, filtros)

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
            cls._dashboard_cache.pop(key, None)
            cls._dashboard_cache[key] = (perf_counter() + cls._cache_ttl_seconds, payload)
            now = perf_counter()
            for item_key in [k for k, (expires_at, _) in cls._dashboard_cache.items() if expires_at < now]:
                cls._dashboard_cache.pop(item_key, None)
            # Purgar so o que expirou nao segura nada: dentro do TTL nenhuma entrada
            # vence, e a chave carrega filtro do cliente. O teto tem de ser rigido.
            # O TTL e uniforme, entao a ordem de insercao do dict ja e a ordem de
            # expiracao - descartar do inicio remove sempre a mais antiga.
            while len(cls._dashboard_cache) > cls._cache_max_entries:
                cls._dashboard_cache.pop(next(iter(cls._dashboard_cache)), None)
