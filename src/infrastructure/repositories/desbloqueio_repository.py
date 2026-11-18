from src.infrastructure.databases.sql_server import get_sql_server_66


class DesbloqueioRepository:
    def __init__(self) -> None:
        self.cyber_sec_db = get_sql_server_66("DB_CYBER_SEC")
        self.api_db = get_sql_server_66("DB_API")

    def pesquisar_usuario_por_cpf(self, cpf_usuario: str, permission_filter: str):
        query = f"""
            SELECT
                NM_COLABORADOR,
                NM_LOGIN,
                NU_CPF_COLABORADOR,
                NM_FUNCAO,
                CENTRO_CUSTO,
                TP_STATUS = CASE
                    WHEN TP_STATUS = 0 THEN 'SEM USUARIO'
                    WHEN TP_STATUS = 1 THEN 'USUARIO ATIVO'
                    ELSE 'SEM REGISTRO'
                END
            FROM TB_USUARIOS_ACTIVE_DIRECTORY WITH(NOLOCK)
            WHERE NU_CPF_COLABORADOR = '{cpf_usuario}'
            {permission_filter}
        """
        return self.cyber_sec_db.fetch_all(query)

    def buscar_token_active_directory(self, ad_cert_password: str, ad_token: str):
        query = f"""
            OPEN SYMMETRIC KEY CERT_CRIPTOGRAFIA
            DECRYPTION BY CERTIFICATE CERT_API_MASTER WITH PASSWORD = '{ad_cert_password}'

            SELECT
                TOKEN_KEY = CAST(DECRYPTBYKEY(TOKEN_KEY) AS varchar(MAX)),
                USUARIO = CAST(DECRYPTBYKEY(USUARIO) AS varchar(MAX)),
                SENHA = CAST(DECRYPTBYKEY(SENHA) AS varchar(MAX))
            FROM TB_TOKEN_USUARIO WITH(NOLOCK)
            WHERE CAST(DECRYPTBYKEY(TOKEN_KEY) AS varchar(MAX)) = '{ad_token}'
        """
        return self.api_db.fetch_all(query)

    def buscar_colaborador_por_cpf(self, cpf_usuario: str):
        query = f"""
            SELECT TOP 1
                NM_COLABORADOR,
                NM_LOGIN,
                DESC_FUNCAO,
                CENTRO_CUSTO,
                USER_DN,
                GRUPO_DN,
                TP_STATUS,
                AFASTAMENTO
            FROM TB_USUARIOS_ACTIVE_DIRECTORY WITH(NOLOCK)
            WHERE NU_CPF_COLABORADOR = '{cpf_usuario}'
        """
        return self.cyber_sec_db.fetch_all(query)

    def registrar_log_desbloqueio(self, login_solicitante: str, host_value: str, login_desbloqueado: str) -> None:
        query = f"""
            INSERT INTO TB_LOG_DESBLOQUEIO_ACTIVE_DIRECTORY(
                NM_LOGIN_DESBLOQUEIO,
                HOST,
                NM_LOGIN_DESBLOQUEADO
            ) VALUES (
                '{login_solicitante}',
                '{host_value}',
                '{login_desbloqueado}'
            )
        """
        self.cyber_sec_db.execute(query)
