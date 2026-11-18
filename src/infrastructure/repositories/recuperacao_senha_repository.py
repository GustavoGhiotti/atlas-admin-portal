from src.infrastructure.databases.sql_server import get_sql_server_66


USER_TABLE = "TB_USUARIO_BCK"


class RecuperacaoSenhaRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_BIGGER")

    def buscar_usuario_por_cpf(self, cpf_colaborador: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, NM_LOGIN, NM_COLABORADOR, EMAIL, TP_STATUS
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE NU_CPF_COLABORADOR = '{cpf_colaborador}'
            """
        )

    def redefinir_senha_por_cpf(self, cpf_colaborador: str, senha: str) -> None:
        self.db.execute(
            f"""
            OPEN SYMMETRIC KEY CHAVE_BIGGER
            DECRYPTION BY CERTIFICATE CERT_BIGGER
            UPDATE {USER_TABLE}
            SET SENHA = EncryptByKey(Key_GUID('CHAVE_BIGGER'), CONVERT(VARBINARY(MAX), CONVERT(NVARCHAR(MAX), ?))),
                TP_STATUS = 1,
                DT_ATUALIZACAO = GETDATE()
            WHERE NU_CPF_COLABORADOR = ?
            """,
            [senha, cpf_colaborador],
        )
