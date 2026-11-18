"""Acesso ao schema [cfg] do Portal Acordo.

Toda escrita vai como um unico batch T-SQL: captura do estado anterior,
desativacao do concorrente do indice unico filtrado, gravacao e INSERT na
auditoria, tudo na MESMA transacao. Isso e mais forte do que a API do Pagou
Quitou faz hoje - la a auditoria roda fora da transacao e engole a propria
falha, entao a alteracao pode persistir sem trilha.

Nao ha BEGIN/COMMIT explicito: o pyodbc opera com autocommit desligado, entao o
batch ja e uma transacao e SqlServerConnection.execute commita no fim (o context
manager faz rollback se qualquer statement levantar). SET XACT_ABORT ON garante
que o SQL Server aborte o lote inteiro no primeiro erro em vez de seguir adiante.

Cada campo do payload e vinculado a uma variavel T-SQL UMA vez, no topo do
batch. Repetir o mesmo `?` ao longo do texto e o modo classico de essa familia
de codigo quebrar em silencio: basta um placeholder a mais ou a menos para os
valores deslizarem de coluna sem erro de sintaxe.
"""

from src.infrastructure.databases.sql_server import get_sql_server_66


# Valores aceitos por CK_CFG_AUD_ACAO. Derivados no banco, nunca vindos do cliente.
ACAO_CRIACAO = "CRIACAO"
ACAO_ALTERACAO = "ALTERACAO"
ACAO_DESATIVACAO = "DESATIVACAO"
ACAO_REATIVACAO = "REATIVACAO"
ACAO_EXCLUSAO = "EXCLUSAO"

CABECALHO = "SET XACT_ABORT ON;\nSET NOCOUNT ON;"

# DADOS_ANTES/DADOS_DEPOIS tem CHECK ISJSON. FOR JSON PATH devolve NULL quando nao
# ha linha - satisfaz o CHECK (a coluna e nullable) e representa "nao existia antes".
AUDITORIA = """
INSERT INTO [cfg].[TB_CFG_AUDITORIA]
    (ENTIDADE, ID_ENTIDADE, ACAO, DADOS_ANTES, DADOS_DEPOIS, ATOR, ORIGEM_IP)
VALUES (@entidade, @id, @acao, @antes, @depois, @ator, @ip);
"""


def _derivar_acao(tabela: str) -> str:
    """Compara o ATIVO em disco com o pedido. Roda depois de capturar @antes e
    antes de gravar, entao le o estado que ainda vale."""
    return f"""
SET @ativo_anterior = (SELECT ATIVO FROM {tabela} WHERE ID = @id);
SET @acao = CASE
    WHEN @id IS NULL                              THEN '{ACAO_CRIACAO}'
    WHEN @ativo_anterior = 1 AND @ativo = 0       THEN '{ACAO_DESATIVACAO}'
    WHEN @ativo_anterior = 0 AND @ativo = 1       THEN '{ACAO_REATIVACAO}'
    ELSE '{ACAO_ALTERACAO}' END;
"""


DECLARACOES_COMUNS = """
DECLARE @id int, @acao varchar(20), @ativo_anterior bit,
        @antes nvarchar(max), @depois nvarchar(max);
"""


class PortalAcordoConfigRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_PORTALACORDO")

    # ------------------------------------------------------------------ leitura

    def listar_carteiras(self):
        return self.db.fetch_all(
            """
            SELECT c.ID, c.CODIGO, c.NOME, c.ID_CEDENTE, c.ATIVO, c.DT_ATUALIZACAO,
                   (SELECT COUNT(1) FROM [cfg].[TB_CFG_LANDING_PAGE] l WITH (NOLOCK)
                     WHERE l.ID_CARTEIRA = c.ID)                      AS qtd_landing,
                   (SELECT COUNT(1) FROM [cfg].[TB_CFG_NUMERO_CONTATO] n WITH (NOLOCK)
                     WHERE n.ID_CARTEIRA = c.ID AND n.ATIVO = 1)      AS qtd_numero,
                   (SELECT COUNT(1) FROM [cfg].[TB_CFG_MAILING_CARTEIRA] m WITH (NOLOCK)
                     WHERE m.ID_CARTEIRA = c.ID AND m.ATIVO = 1)      AS qtd_mailing,
                   (SELECT COUNT(1) FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] a WITH (NOLOCK)
                     WHERE a.ID_CARTEIRA = c.ID AND a.ATIVO = 1)      AS qtd_alias
            FROM [cfg].[TB_CFG_CARTEIRA] c WITH (NOLOCK)
            ORDER BY c.NOME
            """,
            query_name="portalacordo_cfg.listar_carteiras",
        )

    def listar_landing_pages(self):
        # A view resolve o WhatsApp efetivo (landing -> carteira -> global) e a contagem
        # de FAQ ativa. EXIBIR_NA_HOME e os textos nao estao nela, entao vem por JOIN.
        return self.db.fetch_all(
            """
            SELECT v.ID_LANDING, v.SLUG, v.NOME_CLIENTE, v.LANDING_ATIVA, v.ORDEM,
                   v.IMAGEM_LOGO, v.IMAGEM_FUNDO, v.LOGO_CLASS, v.LANDING_ATUALIZADA_EM,
                   v.CARTEIRA_CODIGO, v.CARTEIRA_NOME, v.CARTEIRA_ATIVA,
                   v.MAILING_PREFIXO, v.WHATSAPP_EFETIVO, v.WHATSAPP_ORIGEM, v.QTD_FAQ_ATIVA,
                   lp.EXIBIR_NA_HOME, lp.LOGO_CLASS_HOME, lp.TITULO, lp.SUBTITULO, lp.NUMERO_WHATSAPP
            FROM [cfg].[VW_CFG_LANDING_PAGE] v
            JOIN [cfg].[TB_CFG_LANDING_PAGE] lp WITH (NOLOCK) ON lp.ID = v.ID_LANDING
            ORDER BY v.ORDEM, v.SLUG
            """,
            query_name="portalacordo_cfg.listar_landing_pages",
        )

    def listar_faq(self, slug: str):
        return self.db.fetch_all(
            """
            SELECT f.ID, f.ORDEM, f.PERGUNTA, f.RESPOSTA, f.ATIVO
            FROM [cfg].[TB_CFG_LANDING_FAQ] f WITH (NOLOCK)
            JOIN [cfg].[TB_CFG_LANDING_PAGE] l WITH (NOLOCK) ON l.ID = f.ID_LANDING
            WHERE l.SLUG = ?
            ORDER BY f.ORDEM
            """,
            [slug],
            query_name="portalacordo_cfg.listar_faq",
        )

    def listar_mailings(self):
        return self.db.fetch_all(
            """
            SELECT m.ID, c.CODIGO, c.NOME, m.PREFIXO, m.CAMPANHA, m.OBSERVACAO,
                   m.ATIVO, m.DT_ATUALIZACAO,
                   (SELECT COUNT(1) FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] a WITH (NOLOCK)
                     WHERE a.ID_CARTEIRA = c.ID AND a.ATIVO = 1) AS qtd_alias
            FROM [cfg].[TB_CFG_MAILING_CARTEIRA] m WITH (NOLOCK)
            JOIN [cfg].[TB_CFG_CARTEIRA] c WITH (NOLOCK) ON c.ID = m.ID_CARTEIRA
            ORDER BY c.NOME
            """,
            query_name="portalacordo_cfg.listar_mailings",
        )

    def listar_numeros(self):
        return self.db.fetch_all(
            """
            SELECT n.ID, n.CANAL, n.ESCOPO, c.CODIGO, c.NOME, n.NUMERO, n.ROTULO,
                   n.PRIORIDADE, n.ATIVO, n.DT_ATUALIZACAO
            FROM [cfg].[TB_CFG_NUMERO_CONTATO] n WITH (NOLOCK)
            LEFT JOIN [cfg].[TB_CFG_CARTEIRA] c WITH (NOLOCK) ON c.ID = n.ID_CARTEIRA
            ORDER BY n.ESCOPO, c.NOME, n.PRIORIDADE, n.ID
            """,
            query_name="portalacordo_cfg.listar_numeros",
        )

    def listar_aliases(self):
        return self.db.fetch_all(
            """
            SELECT a.ID, a.ALIAS, c.CODIGO, c.NOME, a.TIPO_MATCH, a.PRIORIDADE,
                   a.ATIVO, a.DT_ATUALIZACAO
            FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] a WITH (NOLOCK)
            JOIN [cfg].[TB_CFG_CARTEIRA] c WITH (NOLOCK) ON c.ID = a.ID_CARTEIRA
            ORDER BY c.NOME, a.PRIORIDADE, a.ALIAS
            """,
            query_name="portalacordo_cfg.listar_aliases",
        )

    def listar_imagens_em_uso(self):
        # Nao existe endpoint que liste os arquivos publicados em /images do portal.
        # Os caminhos ja gravados sao a unica fonte confiavel de opcoes validas.
        return self.db.fetch_all(
            """
            SELECT caminho, COUNT(*) AS usos FROM (
                SELECT IMAGEM_LOGO  AS caminho FROM [cfg].[TB_CFG_LANDING_PAGE] WITH (NOLOCK)
                UNION ALL
                SELECT IMAGEM_FUNDO AS caminho FROM [cfg].[TB_CFG_LANDING_PAGE] WITH (NOLOCK)
            ) t
            WHERE caminho IS NOT NULL
            GROUP BY caminho
            ORDER BY usos DESC, caminho
            """,
            query_name="portalacordo_cfg.listar_imagens_em_uso",
        )

    def listar_auditoria(self, entidade: str | None, limite: int):
        clausula = "WHERE ENTIDADE = ?" if entidade else ""
        params: list = [limite]
        if entidade:
            params.append(entidade)
        return self.db.fetch_all(
            f"""
            SELECT TOP (?) ID, ENTIDADE, ID_ENTIDADE, ACAO, DADOS_ANTES, DADOS_DEPOIS,
                   ATOR, ORIGEM_IP, DT_CRIACAO
            FROM [cfg].[TB_CFG_AUDITORIA] WITH (NOLOCK)
            {clausula}
            ORDER BY ID DESC
            """,
            params,
            query_name="portalacordo_cfg.listar_auditoria",
        )

    def buscar_carteira_por_codigo(self, codigo: str):
        return self.db.fetch_one(
            "SELECT ID, CODIGO, NOME, ATIVO FROM [cfg].[TB_CFG_CARTEIRA] WITH (NOLOCK) WHERE CODIGO = ?",
            [codigo],
            query_name="portalacordo_cfg.buscar_carteira_por_codigo",
        )

    def buscar_landing_por_slug(self, slug: str):
        return self.db.fetch_one(
            "SELECT ID, SLUG, ATIVO, EXIBIR_NA_HOME FROM [cfg].[TB_CFG_LANDING_PAGE] WITH (NOLOCK) WHERE SLUG = ?",
            [slug],
            query_name="portalacordo_cfg.buscar_landing_por_slug",
        )

    # ------------------------------------------------------------------ escrita

    def salvar_carteira(self, dados: dict, ator: str, ip: str | None) -> None:
        sql = f"""
{CABECALHO}
DECLARE @id_informado int = ?, @codigo varchar(60) = ?, @nome varchar(120) = ?,
        @id_cedente int = ?, @ativo bit = ?,
        @entidade varchar(60) = 'CARTEIRA', @ator varchar(120) = ?, @ip varchar(45) = ?;
{DECLARACOES_COMUNS}
IF @id_informado IS NOT NULL
    SELECT @id = ID FROM [cfg].[TB_CFG_CARTEIRA] WITH (UPDLOCK, HOLDLOCK) WHERE ID = @id_informado;
ELSE
    SELECT @id = ID FROM [cfg].[TB_CFG_CARTEIRA] WITH (UPDLOCK, HOLDLOCK) WHERE CODIGO = @codigo;
SET @antes = (SELECT ID, CODIGO, NOME, ID_CEDENTE, ATIVO FROM [cfg].[TB_CFG_CARTEIRA]
              WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{_derivar_acao("[cfg].[TB_CFG_CARTEIRA]")}
IF @id IS NULL
BEGIN
    INSERT INTO [cfg].[TB_CFG_CARTEIRA] (CODIGO, NOME, ID_CEDENTE, ATIVO)
    VALUES (@codigo, @nome, @id_cedente, @ativo);
    SET @id = SCOPE_IDENTITY();
END
ELSE
    -- CODIGO tambem entra: renomear pelo ID mantem as FKs, que apontam para ID.
    UPDATE [cfg].[TB_CFG_CARTEIRA]
       SET CODIGO = @codigo, NOME = @nome, ID_CEDENTE = @id_cedente, ATIVO = @ativo,
           DT_ATUALIZACAO = SYSDATETIME()
     WHERE ID = @id;

SET @depois = (SELECT ID, CODIGO, NOME, ID_CEDENTE, ATIVO FROM [cfg].[TB_CFG_CARTEIRA]
               WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{AUDITORIA}
"""
        self.db.execute(
            sql,
            [dados.get("id"), dados["codigo"], dados["nome"], dados["id_cedente"], dados["ativo"], ator, ip],
            query_name="portalacordo_cfg.salvar_carteira",
        )

    def salvar_alias(self, dados: dict, id_carteira: int, ator: str, ip: str | None) -> None:
        sql = f"""
{CABECALHO}
DECLARE @id_informado int = ?, @alias varchar(120) = ?, @id_carteira int = ?,
        @tipo varchar(10) = ?, @prioridade int = ?, @ativo bit = ?,
        @entidade varchar(60) = 'CARTEIRA_ALIAS', @ator varchar(120) = ?, @ip varchar(45) = ?;
{DECLARACOES_COMUNS}
IF @id_informado IS NOT NULL
    SELECT @id = ID FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID = @id_informado;
ELSE
    SELECT @id = ID FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] WITH (UPDLOCK, HOLDLOCK) WHERE ALIAS = @alias;
SET @antes = (SELECT ID, ID_CARTEIRA, ALIAS, TIPO_MATCH, PRIORIDADE, ATIVO
              FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{_derivar_acao("[cfg].[TB_CFG_CARTEIRA_ALIAS]")}
IF @id IS NULL
BEGIN
    INSERT INTO [cfg].[TB_CFG_CARTEIRA_ALIAS] (ID_CARTEIRA, ALIAS, TIPO_MATCH, PRIORIDADE, ATIVO)
    VALUES (@id_carteira, @alias, @tipo, @prioridade, @ativo);
    SET @id = SCOPE_IDENTITY();
END
ELSE
    UPDATE [cfg].[TB_CFG_CARTEIRA_ALIAS]
       SET ID_CARTEIRA = @id_carteira, ALIAS = @alias, TIPO_MATCH = @tipo,
           PRIORIDADE = @prioridade, ATIVO = @ativo, DT_ATUALIZACAO = SYSDATETIME()
     WHERE ID = @id;

SET @depois = (SELECT ID, ID_CARTEIRA, ALIAS, TIPO_MATCH, PRIORIDADE, ATIVO
               FROM [cfg].[TB_CFG_CARTEIRA_ALIAS] WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{AUDITORIA}
"""
        self.db.execute(
            sql,
            [
                dados.get("id"), dados["alias"], id_carteira, dados["tipo_match"],
                dados["prioridade"], dados["ativo"], ator, ip,
            ],
            query_name="portalacordo_cfg.salvar_alias",
        )

    def salvar_mailing(self, dados: dict, id_carteira: int, ator: str, ip: str | None) -> None:
        # UX_CFG_MAILING_CARTEIRA_ATIVA e unique em ID_CARTEIRA onde ATIVO = 1: so pode
        # existir um mailing ativo por carteira. O concorrente cai no mesmo batch, senao
        # a gravacao viola o indice.
        sql = f"""
{CABECALHO}
DECLARE @id_informado int = ?, @id_carteira int = ?, @prefixo varchar(60) = ?,
        @campanha varchar(60) = ?, @observacao varchar(300) = ?, @ativo bit = ?,
        @entidade varchar(60) = 'MAILING_CARTEIRA', @ator varchar(120) = ?, @ip varchar(45) = ?;
{DECLARACOES_COMUNS}
DECLARE @colaterais TABLE (ID int PRIMARY KEY, ANTES nvarchar(max));

IF @id_informado IS NOT NULL
    SELECT @id = ID FROM [cfg].[TB_CFG_MAILING_CARTEIRA] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID = @id_informado;
ELSE
    -- Historico inativo pode conviver com o ativo (o unique so vale para ATIVO = 1).
    -- Sem preferir o ativo, um SELECT sem criterio pegaria uma linha antiga qualquer.
    SELECT TOP (1) @id = ID FROM [cfg].[TB_CFG_MAILING_CARTEIRA] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID_CARTEIRA = @id_carteira
     ORDER BY ATIVO DESC, ID DESC;

SET @antes = (SELECT ID, ID_CARTEIRA, PREFIXO, CAMPANHA, OBSERVACAO, ATIVO
              FROM [cfg].[TB_CFG_MAILING_CARTEIRA] WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{_derivar_acao("[cfg].[TB_CFG_MAILING_CARTEIRA]")}
IF @ativo = 1
BEGIN
    INSERT INTO @colaterais (ID, ANTES)
    SELECT m.ID, (SELECT ID, ID_CARTEIRA, PREFIXO, CAMPANHA, OBSERVACAO, ATIVO
                  FROM [cfg].[TB_CFG_MAILING_CARTEIRA] x
                   WHERE x.ID = m.ID FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM [cfg].[TB_CFG_MAILING_CARTEIRA] m
    WHERE m.ID_CARTEIRA = @id_carteira AND m.ATIVO = 1 AND m.ID <> ISNULL(@id, -1);

    UPDATE [cfg].[TB_CFG_MAILING_CARTEIRA]
       SET ATIVO = 0, DT_ATUALIZACAO = SYSDATETIME()
     WHERE ID IN (SELECT ID FROM @colaterais);
END

IF @id IS NULL
BEGIN
    INSERT INTO [cfg].[TB_CFG_MAILING_CARTEIRA] (ID_CARTEIRA, PREFIXO, CAMPANHA, OBSERVACAO, ATIVO)
    VALUES (@id_carteira, @prefixo, @campanha, @observacao, @ativo);
    SET @id = SCOPE_IDENTITY();
END
ELSE
    UPDATE [cfg].[TB_CFG_MAILING_CARTEIRA]
       SET ID_CARTEIRA = @id_carteira, PREFIXO = @prefixo, CAMPANHA = @campanha,
           OBSERVACAO = @observacao, ATIVO = @ativo, DT_ATUALIZACAO = SYSDATETIME()
     WHERE ID = @id;

SET @depois = (SELECT ID, ID_CARTEIRA, PREFIXO, CAMPANHA, OBSERVACAO, ATIVO
               FROM [cfg].[TB_CFG_MAILING_CARTEIRA] WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{AUDITORIA}
INSERT INTO [cfg].[TB_CFG_AUDITORIA]
    (ENTIDADE, ID_ENTIDADE, ACAO, DADOS_ANTES, DADOS_DEPOIS, ATOR, ORIGEM_IP)
SELECT @entidade, c.ID, '{ACAO_DESATIVACAO}', c.ANTES,
       (SELECT ID, ID_CARTEIRA, PREFIXO, CAMPANHA, OBSERVACAO, ATIVO
        FROM [cfg].[TB_CFG_MAILING_CARTEIRA] x WHERE x.ID = c.ID FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
       @ator, @ip
FROM @colaterais c;
"""
        self.db.execute(
            sql,
            [
                dados.get("id"), id_carteira, dados["prefixo"], dados["campanha"],
                dados["observacao"], dados["ativo"], ator, ip,
            ],
            query_name="portalacordo_cfg.salvar_mailing",
        )

    def salvar_numero(self, dados: dict, id_carteira: int | None, ator: str, ip: str | None) -> None:
        # UX_CFG_NUM_GLOBAL_ATIVO e unique em CANAL onde ATIVO = 1 e ESCOPO = 'GLOBAL':
        # trocar o numero global do portal e uma operacao, nao duas. Para ESCOPO =
        # 'CARTEIRA' o indice NAO e unico - varios numeros ativos convivem e PRIORIDADE
        # decide a ordem -, entao ali nada e desativado.
        #
        # Quando o gestor esta editando, a linha e localizada pelo ID. Procurar pela
        # chave natural (canal+escopo+carteira+numero) faria a correcao de um digito
        # errado nao encontrar a linha, inserir uma nova e deixar a antiga ATIVA - com o
        # portal continuando a servir o numero errado.
        colunas = "ID, CANAL, ESCOPO, ID_CARTEIRA, NUMERO, ROTULO, PRIORIDADE, ATIVO"
        sql = f"""
{CABECALHO}
DECLARE @id_informado int = ?, @canal varchar(20) = ?, @escopo varchar(20) = ?,
        @id_carteira int = ?, @numero varchar(15) = ?, @rotulo varchar(120) = ?,
        @prioridade int = ?, @ativo bit = ?,
        @entidade varchar(60) = 'NUMERO_CONTATO', @ator varchar(120) = ?, @ip varchar(45) = ?;
{DECLARACOES_COMUNS}
DECLARE @colaterais TABLE (ID int PRIMARY KEY, ANTES nvarchar(max));

IF @id_informado IS NOT NULL
    SELECT @id = ID FROM [cfg].[TB_CFG_NUMERO_CONTATO] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID = @id_informado;
ELSE
    SELECT @id = ID FROM [cfg].[TB_CFG_NUMERO_CONTATO] WITH (UPDLOCK, HOLDLOCK)
     WHERE CANAL = @canal AND ESCOPO = @escopo AND NUMERO = @numero
       AND ISNULL(ID_CARTEIRA, -1) = ISNULL(@id_carteira, -1);

SET @antes = (SELECT {colunas} FROM [cfg].[TB_CFG_NUMERO_CONTATO]
              WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{_derivar_acao("[cfg].[TB_CFG_NUMERO_CONTATO]")}
IF @ativo = 1 AND @escopo = 'GLOBAL'
BEGIN
    -- Guarda o estado dos concorrentes ANTES de desliga-los: desativacao colateral
    -- tambem e alteracao em producao e precisa de linha propria na trilha, senao a
    -- auditoria nao registra qual numero saiu do ar.
    INSERT INTO @colaterais (ID, ANTES)
    SELECT n.ID, (SELECT {colunas} FROM [cfg].[TB_CFG_NUMERO_CONTATO] x
                   WHERE x.ID = n.ID FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM [cfg].[TB_CFG_NUMERO_CONTATO] n
    WHERE n.CANAL = @canal AND n.ESCOPO = 'GLOBAL' AND n.ATIVO = 1 AND n.ID <> ISNULL(@id, -1);

    UPDATE [cfg].[TB_CFG_NUMERO_CONTATO]
       SET ATIVO = 0, DT_ATUALIZACAO = SYSDATETIME()
     WHERE ID IN (SELECT ID FROM @colaterais);
END

IF @id IS NULL
BEGIN
    INSERT INTO [cfg].[TB_CFG_NUMERO_CONTATO]
        (CANAL, ESCOPO, ID_CARTEIRA, NUMERO, ROTULO, PRIORIDADE, ATIVO)
    VALUES (@canal, @escopo, @id_carteira, @numero, @rotulo, @prioridade, @ativo);
    SET @id = SCOPE_IDENTITY();
END
ELSE
    -- Atualiza tambem canal/escopo/carteira/numero: sao editaveis na tela.
    UPDATE [cfg].[TB_CFG_NUMERO_CONTATO]
       SET CANAL = @canal, ESCOPO = @escopo, ID_CARTEIRA = @id_carteira, NUMERO = @numero,
           ROTULO = @rotulo, PRIORIDADE = @prioridade, ATIVO = @ativo,
           DT_ATUALIZACAO = SYSDATETIME()
     WHERE ID = @id;

SET @depois = (SELECT {colunas} FROM [cfg].[TB_CFG_NUMERO_CONTATO]
               WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{AUDITORIA}
INSERT INTO [cfg].[TB_CFG_AUDITORIA]
    (ENTIDADE, ID_ENTIDADE, ACAO, DADOS_ANTES, DADOS_DEPOIS, ATOR, ORIGEM_IP)
SELECT @entidade, c.ID, '{ACAO_DESATIVACAO}', c.ANTES,
       (SELECT {colunas} FROM [cfg].[TB_CFG_NUMERO_CONTATO] x
         WHERE x.ID = c.ID FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
       @ator, @ip
FROM @colaterais c;
"""
        self.db.execute(
            sql,
            [
                dados.get("id"), dados["canal"], dados["escopo"], id_carteira, dados["numero"],
                dados["rotulo"], dados["prioridade"], dados["ativo"], ator, ip,
            ],
            query_name="portalacordo_cfg.salvar_numero",
        )

    def salvar_landing(
        self,
        dados: dict,
        id_carteira: int | None,
        faq: list[dict] | None,
        ator: str,
        ip: str | None,
    ) -> None:
        # O FAQ e substituido no mesmo batch da landing. Na API do Portal Acordo os dois
        # vao em transacoes separadas, e uma falha no segundo deixa a landing publicada
        # sem FAQ. ORDEM e reatribuida aqui porque UX_CFG_LANDING_FAQ_ORDEM e unique em
        # (ID_LANDING, ORDEM) e o indice enviado pelo cliente nao e confiavel.
        blocos_faq = ""
        params_faq: list = []
        if faq is not None:
            blocos_faq = "DELETE FROM [cfg].[TB_CFG_LANDING_FAQ] WHERE ID_LANDING = @id;\n"
            for posicao, item in enumerate(faq, start=1):
                blocos_faq += (
                    "INSERT INTO [cfg].[TB_CFG_LANDING_FAQ] (ID_LANDING, ORDEM, PERGUNTA, RESPOSTA, ATIVO)\n"
                    f"VALUES (@id, {posicao}, ?, ?, ?);\n"
                )
                params_faq.extend([item["pergunta"], item["resposta"], item["ativo"]])

        colunas = """ID, SLUG, ID_CARTEIRA, NOME_CLIENTE, NUMERO_WHATSAPP, IMAGEM_LOGO,
                     IMAGEM_FUNDO, LOGO_CLASS, LOGO_CLASS_HOME, TITULO, SUBTITULO,
                     ORDEM, ATIVO, EXIBIR_NA_HOME"""
        sql = f"""
{CABECALHO}
DECLARE @id_informado int = ?, @slug varchar(60) = ?, @id_carteira int = ?, @nome varchar(120) = ?,
        @whatsapp varchar(15) = ?, @img_logo varchar(255) = ?, @img_fundo varchar(255) = ?,
        @logo_class varchar(120) = ?, @logo_class_home varchar(120) = ?,
        @titulo varchar(200) = ?, @subtitulo varchar(300) = ?, @ordem int = ?,
        @ativo bit = ?, @exibir bit = ?,
        @entidade varchar(60) = 'LANDING_PAGE', @ator varchar(120) = ?, @ip varchar(45) = ?;
{DECLARACOES_COMUNS}
IF @id_informado IS NOT NULL
    SELECT @id = ID FROM [cfg].[TB_CFG_LANDING_PAGE] WITH (UPDLOCK, HOLDLOCK) WHERE ID = @id_informado;
ELSE
    SELECT @id = ID FROM [cfg].[TB_CFG_LANDING_PAGE] WITH (UPDLOCK, HOLDLOCK) WHERE SLUG = @slug;
SET @antes = (SELECT {colunas} FROM [cfg].[TB_CFG_LANDING_PAGE]
              WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{_derivar_acao("[cfg].[TB_CFG_LANDING_PAGE]")}
IF @id IS NULL
BEGIN
    INSERT INTO [cfg].[TB_CFG_LANDING_PAGE]
        (SLUG, ID_CARTEIRA, NOME_CLIENTE, NUMERO_WHATSAPP, IMAGEM_LOGO, IMAGEM_FUNDO,
         LOGO_CLASS, LOGO_CLASS_HOME, TITULO, SUBTITULO, ORDEM, ATIVO, EXIBIR_NA_HOME)
    VALUES (@slug, @id_carteira, @nome, @whatsapp, @img_logo, @img_fundo,
            @logo_class, @logo_class_home, @titulo, @subtitulo, @ordem, @ativo, @exibir);
    SET @id = SCOPE_IDENTITY();
END
ELSE
    UPDATE [cfg].[TB_CFG_LANDING_PAGE]
       SET ID_CARTEIRA = @id_carteira, NOME_CLIENTE = @nome, NUMERO_WHATSAPP = @whatsapp,
           IMAGEM_LOGO = @img_logo, IMAGEM_FUNDO = @img_fundo, LOGO_CLASS = @logo_class,
           LOGO_CLASS_HOME = @logo_class_home, TITULO = @titulo, SUBTITULO = @subtitulo,
           ORDEM = @ordem, ATIVO = @ativo, EXIBIR_NA_HOME = @exibir, DT_ATUALIZACAO = SYSDATETIME()
     WHERE ID = @id;

{blocos_faq}
SET @depois = (SELECT {colunas} FROM [cfg].[TB_CFG_LANDING_PAGE]
               WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{AUDITORIA}
"""
        self.db.execute(
            sql,
            [
                dados.get("id"), dados["slug"], id_carteira, dados["nome_cliente"], dados["numero_whatsapp"],
                dados["imagem_logo"], dados["imagem_fundo"], dados["logo_class"],
                dados["logo_class_home"], dados["titulo"], dados["subtitulo"], dados["ordem"],
                dados["ativo"], dados["exibir_na_home"], ator, ip,
                *params_faq,
            ],
            query_name="portalacordo_cfg.salvar_landing",
        )

    def auditoria_aceita_exclusao(self) -> bool:
        """CK_CFG_AUD_ACAO nasceu com quatro valores e nao inclui EXCLUSAO. Sem a
        migracao o INSERT da trilha viola o CHECK e, com XACT_ABORT, derruba o
        DELETE junto - nada e apagado, mas o gestor recebe erro de driver. Checar
        antes troca isso por uma instrucao do que rodar."""
        linha = self.db.fetch_one(
            """
            SELECT cc.definition
              FROM sys.check_constraints cc
             WHERE cc.parent_object_id = OBJECT_ID('[cfg].[TB_CFG_AUDITORIA]')
               AND cc.name = 'CK_CFG_AUD_ACAO'
            """,
            query_name="portalacordo_cfg.auditoria_aceita_exclusao",
        )
        # Constraint ausente = coluna sem dominio restrito, qualquer valor entra.
        return not linha or ACAO_EXCLUSAO in str(linha[0]).upper()

    def excluir_landing(self, slug: str, ator: str, ip: str | None) -> None:
        # FK_CFG_FAQ_LANDING e ON DELETE CASCADE: as perguntas somem junto e nao
        # sobra copia em lugar nenhum. Por isso @antes leva o FAQ embutido via
        # JSON_QUERY - depois deste batch a trilha e o unico registro que resta.
        sql = f"""
{CABECALHO}
DECLARE @slug varchar(60) = ?, @entidade varchar(60) = 'LANDING_PAGE',
        @ator varchar(120) = ?, @ip varchar(45) = ?;
{DECLARACOES_COMUNS}
SELECT @id = ID FROM [cfg].[TB_CFG_LANDING_PAGE] WITH (UPDLOCK, HOLDLOCK) WHERE SLUG = @slug;
IF @id IS NULL THROW 50404, 'Landing page nao encontrada.', 1;

SET @acao = '{ACAO_EXCLUSAO}';
SET @antes = (
    SELECT lp.ID, lp.SLUG, lp.ID_CARTEIRA, lp.NOME_CLIENTE, lp.NUMERO_WHATSAPP,
           lp.IMAGEM_LOGO, lp.IMAGEM_FUNDO, lp.LOGO_CLASS, lp.LOGO_CLASS_HOME,
           lp.TITULO, lp.SUBTITULO, lp.ORDEM, lp.ATIVO, lp.EXIBIR_NA_HOME,
           JSON_QUERY((
               SELECT f.ORDEM, f.PERGUNTA, f.RESPOSTA, f.ATIVO
                 FROM [cfg].[TB_CFG_LANDING_FAQ] f
                WHERE f.ID_LANDING = lp.ID
                ORDER BY f.ORDEM
                FOR JSON PATH
           )) AS FAQ
      FROM [cfg].[TB_CFG_LANDING_PAGE] lp
     WHERE lp.ID = @id
     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

DELETE FROM [cfg].[TB_CFG_LANDING_PAGE] WHERE ID = @id;
-- @depois fica NULL de proposito: depois da exclusao nao ha estado nenhum.
{AUDITORIA}
"""
        self.db.execute(
            sql,
            [slug, ator, ip],
            query_name="portalacordo_cfg.excluir_landing",
        )

    def alterar_situacao_landing(
        self,
        slug: str,
        ativo: bool | None,
        exibir_na_home: bool | None,
        ator: str,
        ip: str | None,
    ) -> None:
        sql = f"""
{CABECALHO}
DECLARE @slug varchar(60) = ?, @novo_ativo bit = ?, @novo_exibir bit = ?,
        @entidade varchar(60) = 'LANDING_PAGE', @ator varchar(120) = ?, @ip varchar(45) = ?;
{DECLARACOES_COMUNS}
SELECT @id = ID, @ativo_anterior = ATIVO
  FROM [cfg].[TB_CFG_LANDING_PAGE] WITH (UPDLOCK, HOLDLOCK) WHERE SLUG = @slug;
IF @id IS NULL THROW 50404, 'Landing page nao encontrada.', 1;

SET @antes = (SELECT ID, SLUG, ATIVO, EXIBIR_NA_HOME FROM [cfg].[TB_CFG_LANDING_PAGE]
              WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

UPDATE [cfg].[TB_CFG_LANDING_PAGE]
   SET ATIVO = COALESCE(@novo_ativo, ATIVO),
       EXIBIR_NA_HOME = COALESCE(@novo_exibir, EXIBIR_NA_HOME),
       DT_ATUALIZACAO = SYSDATETIME()
 WHERE ID = @id;

SET @acao = CASE
    WHEN @novo_ativo IS NULL                       THEN '{ACAO_ALTERACAO}'
    WHEN @ativo_anterior = 1 AND @novo_ativo = 0   THEN '{ACAO_DESATIVACAO}'
    WHEN @ativo_anterior = 0 AND @novo_ativo = 1   THEN '{ACAO_REATIVACAO}'
    ELSE '{ACAO_ALTERACAO}' END;

SET @depois = (SELECT ID, SLUG, ATIVO, EXIBIR_NA_HOME FROM [cfg].[TB_CFG_LANDING_PAGE]
               WHERE ID = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
{AUDITORIA}
"""
        self.db.execute(
            sql,
            [slug, ativo, exibir_na_home, ator, ip],
            query_name="portalacordo_cfg.alterar_situacao_landing",
        )
