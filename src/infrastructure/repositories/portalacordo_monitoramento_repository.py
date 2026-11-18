from datetime import date

from src.infrastructure.databases.sql_server import get_sql_server_66


# Os dois schemas de monitoramento sao espelhados: mesmas colunas, tabelas diferentes.
# O nome da tabela nunca vem do cliente - a origem e resolvida por este mapa.
ORIGENS = {
    "portal": {
        "eventos": "[portal].[TB_PORTAL_EVENTO_CLIENTE]",
        "tipos": "[portal].[TB_PORTAL_EVENTO_TIPO]",
        "resumo": "[portal].[TB_PORTAL_CLIENTE_RESUMO]",
    },
    "app": {
        "eventos": "[dbo].[TB_APP_EVENTO_CLIENTE]",
        "tipos": "[dbo].[TB_APP_EVENTO_TIPO]",
        "resumo": "[dbo].[TB_APP_CLIENTE_RESUMO]",
    },
}

# CEDENTE chega sujo dos eventos (nulo em boa parte, e com variacoes do mesmo nome).
# A carteira canonica sai de cfg.TB_CFG_CARTEIRA_ALIAS, na mesma ordem de prioridade
# que o backend do Portal Acordo usa para resolver o prefixo de mailing.
#
# Recebe o alias da linha porque a mesma resolucao roda duas vezes: sobre o evento que
# esta sendo lido e, dentro do mapa de dispositivo, sobre o historico dele.
def _apply_alias(ev: str) -> str:
    return f"""
    OUTER APPLY (
        SELECT TOP (1) car.CODIGO, car.NOME
        FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] a WITH (NOLOCK)
        JOIN [cfg].[TB_CFG_CARTEIRA] car WITH (NOLOCK) ON car.ID = a.ID_CARTEIRA
        WHERE a.ATIVO = 1
          AND {ev}.CEDENTE IS NOT NULL
          AND (
                (a.TIPO_MATCH = 'EXATO' AND UPPER(LTRIM(RTRIM({ev}.CEDENTE))) = UPPER(a.ALIAS))
             OR (a.TIPO_MATCH = 'CONTEM' AND UPPER({ev}.CEDENTE) LIKE '%' + UPPER(a.ALIAS) + '%')
          )
        -- Mesma ordem de resolucao do Portal Acordo (configuracao_service.py:
        -- resolver_prefixo_mailing): TODOS os EXATO antes de qualquer CONTEM, e a
        -- PRIORIDADE so desempata dentro de cada grupo. Ordenar apenas por PRIORIDADE
        -- faria um CONTEM generico ganhar de um EXATO especifico, e o dashboard passaria
        -- a agrupar o evento numa carteira diferente da que o discador usa no arquivo.
        ORDER BY CASE WHEN a.TIPO_MATCH = 'EXATO' THEN 0 ELSE 1 END, a.PRIORIDADE, a.ID
    ) c
    -- Fallback so do dashboard, quando nenhum alias casou.
    --
    -- Os cliques de carrossel e de landing mandam como CEDENTE o nome de exibicao:
    -- Clientes.tsx envia parceiro.nome (o NOME_CLIENTE da landing) e LandingModal.tsx
    -- envia nomeCliente. Esses nomes saem do proprio cfg, entao o banco ja sabe de quem
    -- sao - exigir que alguem cadastre um alias para reconhece-los seria trabalho manual
    -- para uma informacao que ja esta na tabela ao lado.
    --
    -- Nao diverge do discador: esses eventos vem sem ID_CEDENTE e nunca geram arquivo de
    -- mailing. O prefixo continua saindo apenas do alias, exatamente como em ligar.py.
    OUTER APPLY (
        SELECT TOP (1) car.CODIGO, car.NOME
        FROM [cfg].[TB_CFG_CARTEIRA] car WITH (NOLOCK)
        LEFT JOIN [cfg].[TB_CFG_LANDING_PAGE] lp WITH (NOLOCK) ON lp.ID_CARTEIRA = car.ID
        WHERE {ev}.CEDENTE IS NOT NULL
          AND (UPPER(LTRIM(RTRIM({ev}.CEDENTE))) = UPPER(car.NOME)
            OR UPPER(LTRIM(RTRIM({ev}.CEDENTE))) = UPPER(car.CODIGO)
            OR UPPER(LTRIM(RTRIM({ev}.CEDENTE))) = UPPER(lp.NOME_CLIENTE))
        ORDER BY car.ATIVO DESC, car.ID
    ) cfgnome
"""


# 70% dos eventos do portal chegam sem CEDENTE, e ate aqui todos caiam num balde unico.
# Nao e sujeira de dado: home, /negociacao, login e cadastro acontecem ANTES de o
# visitante escolher carteira - nao existe nome para gravar. So que, com o filtro de
# carteira aplicado, o funil perdia todo o topo: "Vega" mostrava uma unica etapa
# (landing) porque nenhuma das outras carrega CEDENTE.
#
# As duas resolucoes abaixo tiram a carteira do CONTEXTO, nao do campo. Ambas so valem
# quando CEDENTE esta vazio - com CEDENTE preenchido quem manda continua sendo ele,
# senao o caso "cedente sem alias" sumiria do alerta que pede o cadastro.

# 1) A URL da propria pagina. /clientes/{slug} identifica a carteira sem ambiguidade e o
#    slug ja esta em cfg.TB_CFG_LANDING_PAGE. '/clientes/' tem 10 caracteres; o '?'
#    concatenado garante que o PATINDEX sempre ache um terminador.
_CAMINHO = "SUBSTRING(e.ORIGEM, 11, 200)"
_SLUG_DA_ORIGEM = f"LOWER(LEFT({_CAMINHO}, PATINDEX('%[?/#]%', {_CAMINHO} + '?') - 1))"

SLUG_APPLY = f"""
    OUTER APPLY (
        SELECT TOP (1) car.CODIGO, car.NOME
        FROM [cfg].[TB_CFG_LANDING_PAGE] lp WITH (NOLOCK)
        JOIN [cfg].[TB_CFG_CARTEIRA] car WITH (NOLOCK) ON car.ID = lp.ID_CARTEIRA
        WHERE (e.CEDENTE IS NULL OR LTRIM(RTRIM(e.CEDENTE)) = '')
          AND e.ORIGEM LIKE '/clientes/%'
          AND LOWER(lp.SLUG) = {_SLUG_DA_ORIGEM}
        ORDER BY lp.ATIVO DESC, lp.ID
    ) slugcar
"""


# 2) O historico do dispositivo. Se o DEVICE_ID revelou UMA carteira em algum momento,
#    os eventos dele sem CEDENTE sao da mesma visita e pertencem a ela. Dispositivo que
#    tocou duas ou mais fica de fora (HAVING = 1): atribuir por maioria inventaria
#    numero. E JOIN com derivada, nao APPLY correlacionado - o mapa e calculado uma vez
#    por consulta em vez de uma vez por linha.
#
#    Sem recorte de periodo de proposito: o dispositivo pertence a carteira mesmo que
#    ele so tenha se identificado fora da janela consultada.
def _join_device(tabela_eventos: str) -> str:
    resolvida = "COALESCE(c.NOME, cfgnome.NOME, LTRIM(RTRIM(d.CEDENTE)))"
    return f"""
    LEFT JOIN (
        SELECT d.DEVICE_ID, MIN({resolvida}) AS NOME
        FROM {tabela_eventos} d WITH (NOLOCK)
        {_apply_alias("d")}
        WHERE d.DEVICE_ID IS NOT NULL
          AND d.CEDENTE IS NOT NULL AND LTRIM(RTRIM(d.CEDENTE)) <> ''
        GROUP BY d.DEVICE_ID
        HAVING COUNT(DISTINCT {resolvida}) = 1
    ) devcar
      ON devcar.DEVICE_ID = e.DEVICE_ID
     AND (e.CEDENTE IS NULL OR LTRIM(RTRIM(e.CEDENTE)) = '')
"""


# O que sobra depois das quatro tentativas e visitante que nunca escolheu carteira -
# topo de funil legitimo. O rotulo diz isso em vez de sugerir instrumentacao quebrada.
SEM_CARTEIRA = "(sem carteira)"
CARTEIRA_EXPR = (
    "COALESCE(c.NOME, cfgnome.NOME, NULLIF(LTRIM(RTRIM(e.CEDENTE)), ''), "
    f"slugcar.NOME, devcar.NOME, '{SEM_CARTEIRA}')"
)
CATEGORIA_EXPR = "COALESCE(t.CATEGORIA, '(nao catalogado)')"

# Distingue os estados da resolucao de carteira. Sao coisas diferentes com acoes
# diferentes: sem alias e acionavel (cadastrar o nome em cfg.TB_CFG_CARTEIRA_ALIAS),
# CEDENTE ausente nao e - nao ha nome para cadastrar.
CEDENTE_PRESENTE = "e.CEDENTE IS NOT NULL AND LTRIM(RTRIM(e.CEDENTE)) <> ''"
# Resolvida = o dashboard soube agrupar, pelo campo ou pelo contexto.
CARTEIRA_RESOLVIDA_EXPR = (
    "CASE WHEN c.CODIGO IS NOT NULL OR cfgnome.CODIGO IS NOT NULL "
    "OR slugcar.CODIGO IS NOT NULL OR devcar.NOME IS NOT NULL THEN 1 ELSE 0 END"
)
# Atribuido pelo contexto, nao pelo campo: mede quanto do balde antigo foi recuperado.
CARTEIRA_POR_CONTEXTO = (
    "CASE WHEN slugcar.CODIGO IS NOT NULL OR devcar.NOME IS NOT NULL THEN 1 ELSE 0 END"
)

# Dominio real de STATUS conferido nas duas tabelas. A classificacao de erro do backend
# do Portal Acordo cita valores ('timeout', 'nao_autorizado', 'sem_condicao') que nunca
# chegam a estas colunas - usa-los aqui daria uma taxa de erro que nao reage a nada.
STATUS_DE_FALHA = ("erro", "sem_carteira", "cpf_invalido", "telefone_invalido", "recusado")
STATUS_FALHA_SQL = ", ".join(f"'{item}'" for item in STATUS_DE_FALHA)


class PortalAcordoMonitoramentoRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_PORTALACORDO")

    def _tabelas(self, origem: str) -> dict[str, str]:
        return ORIGENS[origem]

    def _base(self, origem: str) -> str:
        tabelas = self._tabelas(origem)
        return f"""
            FROM {tabelas['eventos']} e WITH (NOLOCK)
            LEFT JOIN {tabelas['tipos']} t WITH (NOLOCK) ON t.CODIGO = e.EVENTO
            {_apply_alias("e")}
            {SLUG_APPLY}
            {_join_device(tabelas['eventos'])}
        """

    def _where(
        self,
        inicio: date,
        fim: date,
        cedente: str | None,
        categoria: str | None,
    ) -> tuple[str, list]:
        # Faixa sargavel em vez de CAST na coluna: usa IX_..._EVENTO_DATA / _CPF_DATA.
        clauses = ["e.DT_CRIACAO >= ?", "e.DT_CRIACAO < DATEADD(day, 1, ?)"]
        params: list = [inicio, fim]
        if cedente:
            clauses.append(f"{CARTEIRA_EXPR} = ?")
            params.append(cedente)
        if categoria:
            clauses.append(f"{CATEGORIA_EXPR} = ?")
            params.append(categoria)
        return "WHERE " + " AND ".join(clauses), params

    # ------------------------------------------------------------------ filtros

    def listar_carteiras(self, origem: str):
        return self.db.fetch_all(
            f"""
            SELECT DISTINCT {CARTEIRA_EXPR} AS carteira
            {self._base(origem)}
            ORDER BY carteira
            """,
            query_name="portalacordo.listar_carteiras",
        )

    def listar_categorias(self, origem: str):
        return self.db.fetch_all(
            f"""
            SELECT DISTINCT {CATEGORIA_EXPR} AS categoria
            {self._base(origem)}
            ORDER BY categoria
            """,
            query_name="portalacordo.listar_categorias",
        )

    def listar_canais(self, origem: str):
        tabelas = self._tabelas(origem)
        return self.db.fetch_all(
            f"""
            SELECT DISTINCT CANAL
            FROM {tabelas['eventos']} WITH (NOLOCK)
            WHERE CANAL IS NOT NULL AND LTRIM(RTRIM(CANAL)) <> ''
            ORDER BY CANAL
            """,
            query_name="portalacordo.listar_canais",
        )

    def buscar_periodo_disponivel(self, origem: str):
        tabelas = self._tabelas(origem)
        return self.db.fetch_one(
            f"""
            SELECT MIN(DT_CRIACAO), MAX(DT_CRIACAO), COUNT(*)
            FROM {tabelas['eventos']} WITH (NOLOCK)
            """,
            query_name="portalacordo.buscar_periodo_disponivel",
        )

    # ---------------------------------------------------------------- dashboard

    def buscar_resumo(self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None):
        where, params = self._where(inicio, fim, cedente, categoria)
        return self.db.fetch_one(
            f"""
            SELECT
                COUNT(*)                                                          AS total_eventos,
                COUNT(DISTINCT e.CPF_CNPJ)                                        AS cpfs_unicos,
                COUNT(DISTINCT e.DEVICE_ID)                                       AS dispositivos,
                SUM(CASE WHEN e.EVENTO = 'evento_desconhecido' THEN 1 ELSE 0 END) AS desconhecidos,
                SUM(CASE WHEN t.CODIGO IS NULL THEN 1 ELSE 0 END)                 AS sem_catalogo,
                SUM(CASE WHEN {CATEGORIA_EXPR} IN ('erro', 'diagnostico')
                          OR e.STATUS IN ({STATUS_FALHA_SQL})
                         THEN 1 ELSE 0 END)                                       AS eventos_erro,
                COUNT(DISTINCT CAST(e.DT_CRIACAO AS DATE))                        AS dias_com_dados,
                -- Chega ao discador (tem ID_CEDENTE) e nao tem alias: o prefixo do
                -- arquivo de mailing cai no dicionario embutido do Portal Acordo.
                -- E o unico caso em que faltar alias tem consequencia operacional.
                SUM(CASE WHEN {CEDENTE_PRESENTE} AND e.ID_CEDENTE IS NOT NULL AND c.CODIGO IS NULL
                         THEN 1 ELSE 0 END)                                       AS cedente_sem_alias,
                -- Nao casou nem por alias nem por nome no cfg: o dashboard nao sabe
                -- de quem e, e nao ha nada cadastrado que responda isso.
                SUM(CASE WHEN {CEDENTE_PRESENTE} AND c.CODIGO IS NULL AND cfgnome.CODIGO IS NULL
                         THEN 1 ELSE 0 END)                                       AS cedente_sem_grupo,
                SUM(CASE WHEN NOT ({CEDENTE_PRESENTE})
                         THEN 1 ELSE 0 END)                                       AS cedente_ausente,
                -- Do bloco acima, quantos o contexto (URL da landing ou historico do
                -- dispositivo) conseguiu atribuir. O que sobra e o topo do funil real.
                SUM({CARTEIRA_POR_CONTEXTO})                                      AS carteira_por_contexto
            {self._base(origem)}
            {where}
            """,
            params,
            query_name="portalacordo.buscar_resumo",
        )

    def listar_eventos_por_dia(self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None):
        where, params = self._where(inicio, fim, cedente, categoria)
        return self.db.fetch_all(
            f"""
            SELECT CAST(e.DT_CRIACAO AS DATE) AS dia,
                   COUNT(*)                   AS total_eventos,
                   COUNT(DISTINCT e.CPF_CNPJ) AS cpfs_unicos
            {self._base(origem)}
            {where}
            GROUP BY CAST(e.DT_CRIACAO AS DATE)
            ORDER BY dia
            """,
            params,
            query_name="portalacordo.listar_eventos_por_dia",
        )

    def listar_por_categoria(self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None):
        where, params = self._where(inicio, fim, cedente, categoria)
        return self.db.fetch_all(
            f"""
            SELECT {CATEGORIA_EXPR}            AS categoria,
                   COUNT(*)                    AS total,
                   COUNT(DISTINCT e.DEVICE_ID) AS dispositivos,
                   COUNT(DISTINCT e.CPF_CNPJ)  AS cpfs_unicos
            {self._base(origem)}
            {where}
            GROUP BY {CATEGORIA_EXPR}
            ORDER BY total DESC
            """,
            params,
            query_name="portalacordo.listar_por_categoria",
        )

    def buscar_jornada(
        self,
        origem: str,
        inicio: date,
        fim: date,
        cedente: str | None,
        categoria: str | None,
        etapas: list[tuple[str, tuple[str, ...]]],
    ):
        """Uma etapa pode agregar mais de uma categoria (cadastro e login sao caminhos
        alternativos de acesso, nao etapas em sequencia). Contar por etapa numa passada
        so evita somar em duplicidade o dispositivo que passou pelas duas.

        DEVICE_ID e a unidade: esta preenchido em 100% dos eventos e atravessa as etapas
        anonimas, onde CPF_CNPJ ainda e nulo. As categorias vem de ETAPAS_JORNADA no
        servico - nunca do cliente -, entao a interpolacao abaixo nao toca entrada externa.
        """
        where, params = self._where(inicio, fim, cedente, categoria)
        colunas = []
        for indice, (_, categorias) in enumerate(etapas):
            lista = ", ".join(f"'{item}'" for item in categorias)
            colunas.append(
                f"COUNT(DISTINCT CASE WHEN {CATEGORIA_EXPR} IN ({lista}) THEN e.DEVICE_ID END) AS etapa_{indice}"
            )
            colunas.append(
                f"COUNT(DISTINCT CASE WHEN {CATEGORIA_EXPR} IN ({lista}) THEN e.CPF_CNPJ END) AS cpf_{indice}"
            )
            colunas.append(
                f"SUM(CASE WHEN {CATEGORIA_EXPR} IN ({lista}) THEN 1 ELSE 0 END) AS eventos_{indice}"
            )
        return self.db.fetch_one(
            f"""
            SELECT {', '.join(colunas)}
            {self._base(origem)}
            {where}
            """,
            params,
            query_name="portalacordo.buscar_jornada",
        )

    def listar_top_eventos(self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None):
        where, params = self._where(inicio, fim, cedente, categoria)
        return self.db.fetch_all(
            f"""
            SELECT TOP (20)
                   e.EVENTO,
                   MAX(COALESCE(t.NOME, e.EVENTO)) AS nome,
                   MAX({CATEGORIA_EXPR})           AS categoria,
                   COUNT(*)                        AS total
            {self._base(origem)}
            {where}
            GROUP BY e.EVENTO
            ORDER BY total DESC
            """,
            params,
            query_name="portalacordo.listar_top_eventos",
        )

    def listar_por_carteira(self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None):
        where, params = self._where(inicio, fim, cedente, categoria)
        return self.db.fetch_all(
            f"""
            SELECT TOP (20)
                   {CARTEIRA_EXPR}                    AS carteira,
                   COUNT(*)                           AS total,
                   COUNT(DISTINCT e.CPF_CNPJ)         AS cpfs_unicos,
                   MAX({CARTEIRA_RESOLVIDA_EXPR})     AS resolvida,
                   MAX(CASE WHEN {CEDENTE_PRESENTE} THEN 1 ELSE 0 END) AS tem_cedente
            {self._base(origem)}
            {where}
            GROUP BY {CARTEIRA_EXPR}
            ORDER BY total DESC
            """,
            params,
            query_name="portalacordo.listar_por_carteira",
        )

    def listar_cedentes_sem_grupo(
        self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None
    ):
        """Os nomes que chegaram no campo e nao casaram com carteira, landing nem alias.

        Vem de consulta propria porque listar_por_carteira e TOP 20 por volume: estes
        casos sao poucos eventos por definicao e nunca apareciam la, deixando o alerta
        pedir 'cadastre o alias' sem dizer para qual nome.
        """
        where, params = self._where(inicio, fim, cedente, categoria)
        return self.db.fetch_all(
            f"""
            SELECT TOP (10) LTRIM(RTRIM(e.CEDENTE)) AS cedente, COUNT(*) AS total
            {self._base(origem)}
            {where}
              AND {CEDENTE_PRESENTE}
              AND c.CODIGO IS NULL AND cfgnome.CODIGO IS NULL
            GROUP BY LTRIM(RTRIM(e.CEDENTE))
            ORDER BY total DESC
            """,
            params,
            query_name="portalacordo.listar_cedentes_sem_grupo",
        )

    def listar_nao_catalogados(self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None):
        where, params = self._where(inicio, fim, cedente, categoria)
        return self.db.fetch_all(
            f"""
            SELECT TOP (30)
                   COALESCE(JSON_VALUE(e.METADATA_JSON, '$.eventoOriginal'), e.EVENTO) AS evento_original,
                   COUNT(*)              AS total,
                   MIN(e.DT_CRIACAO)     AS primeiro,
                   MAX(e.DT_CRIACAO)     AS ultimo
            {self._base(origem)}
            {where}
              AND (e.EVENTO = 'evento_desconhecido' OR t.CODIGO IS NULL)
            GROUP BY COALESCE(JSON_VALUE(e.METADATA_JSON, '$.eventoOriginal'), e.EVENTO)
            ORDER BY total DESC
            """,
            params,
            query_name="portalacordo.listar_nao_catalogados",
        )

    def listar_origens_trafego(
        self, origem: str, inicio: date, fim: date, cedente: str | None, categoria: str | None
    ):
        """De onde o visitante veio, pelo referrer que o proprio evento ja carrega.

        Substituiu a lista de versoes em campo: APP_VERSION chega nula em 100% dos
        eventos do portal (o build nao define VITE_APP_VERSION), entao aquele grafico
        era sempre uma barra unica de '(nao informada)'.

        Referrer existe em ~40% dos eventos. O resto nao e falha: link de SMS, endereco
        digitado e WhatsApp copiado chegam todos sem referrer - por isso '(acesso
        direto)' e categoria legitima, e nao um balde de erro.

        Agrupa em dois estagios de proposito. Classificar canal linha a linha custava
        4,2s porque a expressao do dominio e reavaliada em cada LIKE do CASE; agrupando
        por (dispositivo, dominio) antes, o CASE roda sobre ~1,3 mil grupos em vez de
        ~10 mil linhas, e a consulta cai para 1s. O COUNT(DISTINCT) continua exato
        porque o dispositivo sobrevive ate o agrupamento final.
        """
        where, params = self._where(inicio, fim, cedente, categoria)
        dominio = (
            "LOWER(LEFT(SUBSTRING(u.URL, CHARINDEX('//', u.URL) + 2, 200), "
            "CHARINDEX('/', SUBSTRING(u.URL, CHARINDEX('//', u.URL) + 2, 200) + '/') - 1))"
        )
        # Rotula so o que da para afirmar. O que nao casa aparece com o dominio cru:
        # rotulo errado engana mais do que dominio feio. A ordem importa -
        # com.google.android.gm e o app do Gmail, nao busca do Google.
        canal = """CASE
                WHEN d.DOMINIO IS NULL                      THEN '(acesso direto)'
                WHEN d.DOMINIO LIKE '%android.gm'
                  OR d.DOMINIO LIKE '%mail.%'
                  OR d.DOMINIO LIKE '%outlook.%'            THEN 'E-mail'
                WHEN d.DOMINIO LIKE 'google.%'
                  OR d.DOMINIO LIKE 'www.google.%'
                  OR d.DOMINIO LIKE '%googlequicksearchbox'
                  OR d.DOMINIO LIKE '%bing.com'
                  OR d.DOMINIO LIKE '%duckduckgo.com'       THEN 'Busca'
                WHEN d.DOMINIO LIKE '%instagram.com'
                  OR d.DOMINIO LIKE '%facebook.com'
                  OR d.DOMINIO LIKE '%linkedin.com'         THEN 'Redes sociais'
                WHEN d.DOMINIO LIKE '%portalacordo.example'   THEN 'Navegacao interna'
                WHEN d.DOMINIO LIKE 'localhost%'
                  OR d.DOMINIO LIKE '10.%'
                  OR d.DOMINIO LIKE '192.168.%'
                  OR d.DOMINIO LIKE '172.1%'
                  OR d.DOMINIO LIKE '172.2%'
                  OR d.DOMINIO LIKE '172.3%'                THEN 'Ambiente de teste'
                ELSE d.DOMINIO
            END"""
        return self.db.fetch_all(
            f"""
            SELECT TOP (12)
                   {canal}                     AS canal,
                   SUM(d.total)                AS total,
                   COUNT(DISTINCT d.DEVICE_ID) AS dispositivos
            FROM (
                SELECT u.DEVICE_ID, {dominio} AS DOMINIO, COUNT(*) AS total
                FROM (
                    SELECT e.DEVICE_ID,
                           NULLIF(JSON_VALUE(e.METADATA_JSON, '$.referrer'), '') AS URL
                    {self._base(origem)}
                    {where}
                ) u
                GROUP BY u.DEVICE_ID, {dominio}
            ) d
            GROUP BY {canal}
            ORDER BY total DESC
            """,
            params,
            query_name="portalacordo.listar_origens_trafego",
        )
