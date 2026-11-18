from src.infrastructure.databases.sql_server import get_sql_server_66


class AuthRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_BIGGER")

    def buscar_usuario_por_login_senha(self, login: str):
        return self.db.fetch_all(
            """
            OPEN SYMMETRIC KEY CHAVE_BIGGER
            DECRYPTION BY CERTIFICATE CERT_BIGGER
            SELECT TOP 1
                NM_LOGIN,
                NM_COLABORADOR,
                NU_CPF_COLABORADOR,
                NM_FUNCAO,
                DESC_FUNCAO,
                CENTRO_CUSTO,
                EMAIL,
                DT_CRIACAO,
                TP_STATUS,
                CAST(DECRYPTBYKEY(SENHA) AS NVARCHAR(MAX)) AS SENHA_DESCRIPTOGRAFADA
            FROM TB_USUARIO_BCK WITH(NOLOCK)
            WHERE UPPER(NM_LOGIN) = ?
            AND TP_STATUS IN (1,2,3,4)
            """,
            [login],
        )

    def buscar_usuario_por_login(self, login: str):
        return self.db.fetch_all(
            """
            SELECT TOP 1
                NM_LOGIN,
                NM_COLABORADOR,
                NU_CPF_COLABORADOR,
                NM_FUNCAO,
                DESC_FUNCAO,
                CENTRO_CUSTO,
                EMAIL,
                DT_CRIACAO,
                TP_STATUS
            FROM TB_USUARIO_BCK WITH(NOLOCK)
            WHERE UPPER(NM_LOGIN) = ?
            AND TP_STATUS IN (1,2,3,4)
            """,
            [login],
        )

    def buscar_conexao_por_login(self, login: str):
        return self.db.fetch_all(
            """
            SELECT NM_LOGIN, HOST, DT_ACESSO
            FROM TB_CONEXOES WITH(NOLOCK)
            WHERE NM_LOGIN = ?
            ORDER BY DT_ACESSO DESC
            """,
            [login],
        )

    def inserir_conexao(self, login: str, host: str) -> None:
        self.db.execute(
            """
            INSERT INTO TB_CONEXOES (NM_LOGIN, HOST, DT_ACESSO)
            VALUES (?, ?, GETDATE())
            """,
            [login, host],
        )

    def deletar_conexao_por_login(self, login: str) -> None:
        self.db.execute("DELETE FROM TB_CONEXOES WHERE NM_LOGIN = ?", [login])

    def deletar_conexao_por_login_host(self, login: str, host: str) -> None:
        self.db.execute(
            """
            DELETE FROM TB_CONEXOES
            WHERE NM_LOGIN = ?
            AND HOST = ?
            """,
            [login, host],
        )

    def deletar_conexoes_expiradas_por_login(self, login: str, timeout_minutes: int) -> None:
        self.db.execute(
            """
            DELETE FROM TB_CONEXOES
            WHERE NM_LOGIN = ?
            AND (DT_ACESSO IS NULL OR DT_ACESSO < DATEADD(MINUTE, ?, GETDATE()))
            """,
            [login, -timeout_minutes],
        )

    def deletar_conexao_expirada(self, login: str, host: str, timeout_minutes: int) -> None:
        self.db.execute(
            """
            DELETE FROM TB_CONEXOES
            WHERE NM_LOGIN = ?
            AND HOST = ?
            AND (DT_ACESSO IS NULL OR DT_ACESSO < DATEADD(MINUTE, ?, GETDATE()))
            """,
            [login, host, -timeout_minutes],
        )

    def listar_grupos(self, login: str):
        return self.db.fetch_all(
            """
            SELECT
                CASE
                    WHEN UPPER(LTRIM(RTRIM(NM_GRUPO))) = 'DIGITAL' THEN 'DIGITAL'
                    ELSE NM_GRUPO
                END AS NM_GRUPO
            FROM TB_GRUPOS_USUARIOS WITH(NOLOCK)
            WHERE NM_LOGIN = ?
            """,
            [login],
        )

    def buscar_conexao_ativa(self, login: str, host: str):
        return self.db.fetch_all(
            """
            SELECT NM_LOGIN, HOST, DT_ACESSO
            FROM TB_CONEXOES WITH(NOLOCK)
            WHERE NM_LOGIN = ?
            AND HOST = ?
            """,
            [login, host],
        )

    def atualizar_dt_acesso(self, login: str, host: str) -> None:
        self.db.execute(
            """
            UPDATE TB_CONEXOES
            SET DT_ACESSO = GETDATE()
            WHERE NM_LOGIN = ?
            AND HOST = ?
            """,
            [login, host],
        )
