import pyodbc

from src.infrastructure.databases.sql_server import get_sql_server_66


USER_TABLE = "TB_USUARIO_BCK"
STATUS_USUARIO_ATIVO = 1
STATUS_USUARIO_PRIMEIRO_ACESSO = 2
STATUS_USUARIO_OVERRIDE_GRUPO = 3
STATUS_USUARIO_MANUAL = 4


class GestaoUsuarioRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_BIGGER")
        self.cyber_db = get_sql_server_66("DB_CYBER_SEC")

    def buscar_usuario_por_login(self, login: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, NM_LOGIN, NU_CPF_COLABORADOR, EMAIL, TP_STATUS
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE NM_LOGIN = ?
            """,
            [login.upper()],
        )

    def buscar_usuario_por_id(self, id_usuario: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, NM_LOGIN, NU_CPF_COLABORADOR, NM_COLABORADOR, EMAIL, TP_STATUS
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE ID = ?
            """,
            [id_usuario],
        )

    def buscar_id_email_usuario_por_login(self, login: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, EMAIL
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE NM_LOGIN = ?
            """,
            [login.upper()],
        )

    def buscar_usuario_login_email_status(self, login: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, NM_LOGIN, EMAIL, TP_STATUS
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE NM_LOGIN = ?
            """,
            [login.upper()],
        )

    def buscar_grupo_por_id(self, id_grupo: str):
        return self.db.fetch_all(
            """
            SELECT ID, NM_GRUPO
            FROM TB_GRUPOS WITH(NOLOCK)
            WHERE ID = ?
            """,
            [id_grupo],
        )

    def buscar_usuario_por_email(self, email: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, NM_LOGIN, EMAIL
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE LOWER(LTRIM(RTRIM(ISNULL(EMAIL, '')))) = ?
            """,
            [email.strip().lower()],
        )

    def atualizar_email_usuario_por_login(self, login: str, email_usuario: str) -> None:
        self.db.execute(
            f"""
            UPDATE {USER_TABLE}
            SET EMAIL = ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE NM_LOGIN = ?
            """,
            [email_usuario, login.upper()],
        )

    def registrar_log_email_por_login(self, login: str, email_atual: str, email_usuario: str) -> None:
        self.db.execute(
            f"""
            INSERT INTO TB_LOG_ALTERACOES_USAURIO (
                NM_LOGIN_ALTERADO,
                DESC_ALTERACAO,
                NM_LOGIN_ALTERACAO
            )
            VALUES (?, ?, ?)
            """,
            [login.upper(), f"E-MAIL ALTERADO ({email_atual} >>> {email_usuario})", login.upper()],
        )

    def atualizar_senha(self, login: str, nova_senha: str) -> None:
        self.db.execute(
            f"""
            OPEN SYMMETRIC KEY CHAVE_BIGGER
            DECRYPTION BY CERTIFICATE CERT_BIGGER
            UPDATE {USER_TABLE}
            SET SENHA = EncryptByKey(Key_GUID('CHAVE_BIGGER'), CONVERT(VARBINARY(MAX), CONVERT(NVARCHAR(MAX), ?))),
                TP_STATUS = 1,
                DT_ATUALIZACAO = GETDATE()
            WHERE NM_LOGIN = ?
            """,
            [nova_senha, login.upper()],
        )

    def atualizar_email_e_senha_primeiro_acesso(self, login: str, email_usuario: str, nova_senha: str) -> None:
        self.db.execute(
            f"""
            OPEN SYMMETRIC KEY CHAVE_BIGGER
            DECRYPTION BY CERTIFICATE CERT_BIGGER
            UPDATE {USER_TABLE}
            SET EMAIL = ?,
                SENHA = EncryptByKey(Key_GUID('CHAVE_BIGGER'), CONVERT(VARBINARY(MAX), CONVERT(NVARCHAR(MAX), ?))),
                TP_STATUS = ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE NM_LOGIN = ?
            """,
            [email_usuario, nova_senha, STATUS_USUARIO_ATIVO, login.upper()],
        )

    def listar_grupos(self):
        return self.db.fetch_all(
            """
            SELECT
                ID,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(NM_GRUPO))) = 'DIGITAL' THEN 'DIGITAL'
                    ELSE NM_GRUPO
                END AS NM_GRUPO
            FROM TB_GRUPOS WITH(NOLOCK)
            ORDER BY NM_GRUPO
            """
        )

    def criar_grupo_se_nao_existir(self, nome_grupo: str) -> None:
        self.db.execute(
            """
            UPDATE TB_GRUPOS
            SET NM_GRUPO = ?
            WHERE UPPER(LTRIM(RTRIM(NM_GRUPO))) = UPPER(?)
              AND NM_GRUPO <> ?
            """,
            [nome_grupo, nome_grupo, nome_grupo],
        )
        self.db.execute(
            """
            INSERT INTO TB_GRUPOS (NM_GRUPO)
            SELECT ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM TB_GRUPOS WITH(NOLOCK)
                WHERE NM_GRUPO = ?
            )
            """,
            [nome_grupo, nome_grupo],
        )

    def buscar_usuario_existente_por_cpf(self, cpf_colaborador: str):
        return self.db.fetch_all(
            f"""
            SELECT LOWER(NM_LOGIN), NM_COLABORADOR, NM_FUNCAO, EMAIL
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE NU_CPF_COLABORADOR = ?
            """,
            [cpf_colaborador],
        )

    def inserir_usuario_por_active_directory(self, cpf_colaborador: str, senha_colaborador: str, email_colaborador: str) -> None:
        self.db.execute(
            f"""
            OPEN SYMMETRIC KEY CHAVE_BIGGER
            DECRYPTION BY CERTIFICATE CERT_BIGGER
            INSERT INTO {USER_TABLE} (
                NM_LOGIN,
                SENHA,
                NM_COLABORADOR,
                NU_CPF_COLABORADOR,
                NM_FUNCAO,
                DESC_FUNCAO,
                CENTRO_CUSTO,
                EMAIL,
                DT_CRIACAO,
                TP_STATUS
            )
            SELECT
                A.NM_LOGIN,
                EncryptByKey(Key_GUID('CHAVE_BIGGER'), CONVERT(VARBINARY(MAX), CONVERT(NVARCHAR(MAX), ?))),
                A.NM_COLABORADOR,
                A.NU_CPF_COLABORADOR,
                A.NM_FUNCAO,
                A.DESC_FUNCAO,
                A.CENTRO_CUSTO,
                ?,
                GETDATE(),
                2
            FROM DB_CYBER_SEC..TB_USUARIOS_ACTIVE_DIRECTORY AS A WITH(NOLOCK)
            WHERE A.NU_CPF_COLABORADOR = ?
              AND A.TP_STATUS = 1
              AND NOT EXISTS (
                  SELECT 1
                  FROM {USER_TABLE} AS B WITH(NOLOCK)
                  WHERE A.NM_LOGIN = B.NM_LOGIN
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM {USER_TABLE} AS B WITH(NOLOCK)
                  WHERE A.NU_CPF_COLABORADOR = B.NU_CPF_COLABORADOR
              )
            """,
            [senha_colaborador, email_colaborador, cpf_colaborador],
        )

    def inserir_usuario_bck(
        self,
        login: str,
        senha_colaborador: str,
        nome_colaborador: str,
        cpf_colaborador: str,
        nm_funcao: str,
        desc_funcao: str,
        centro_custo: str,
        email_colaborador: str,
        tp_status: int = 2,
    ) -> None:
        self.db.execute(
            f"""
            OPEN SYMMETRIC KEY CHAVE_BIGGER
            DECRYPTION BY CERTIFICATE CERT_BIGGER
            INSERT INTO {USER_TABLE} (
                NM_LOGIN,
                SENHA,
                NM_COLABORADOR,
                NU_CPF_COLABORADOR,
                NM_FUNCAO,
                DESC_FUNCAO,
                CENTRO_CUSTO,
                EMAIL,
                DT_CRIACAO,
                DT_ATUALIZACAO,
                TP_STATUS
            )
            SELECT
                ?,
                EncryptByKey(Key_GUID('CHAVE_BIGGER'), CONVERT(VARBINARY(MAX), CONVERT(NVARCHAR(MAX), ?))),
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                GETDATE(),
                GETDATE(),
                ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM {USER_TABLE} WITH(UPDLOCK, HOLDLOCK)
                WHERE NM_LOGIN = ?
                   OR NU_CPF_COLABORADOR = ?
            )
            """,
            [
                login.upper(),
                senha_colaborador,
                nome_colaborador,
                cpf_colaborador,
                nm_funcao,
                desc_funcao,
                centro_custo,
                email_colaborador,
                tp_status,
                login.upper(),
                cpf_colaborador,
            ],
        )

    def atualizar_usuario_bck(
        self,
        id_usuario: int,
        login: str,
        nome_colaborador: str,
        cpf_colaborador: str,
        nm_funcao: str,
        desc_funcao: str,
        centro_custo: str,
        email_colaborador: str,
        tp_status: int,
        ) -> None:
        self.db.execute(
            f"""
            UPDATE {USER_TABLE}
            SET NM_LOGIN = ?,
                NM_COLABORADOR = ?,
                NU_CPF_COLABORADOR = ?,
                NM_FUNCAO = ?,
                DESC_FUNCAO = ?,
                CENTRO_CUSTO = ?,
                EMAIL = ?,
                TP_STATUS = ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE ID = ?
            """,
            [
                login.upper(),
                nome_colaborador,
                cpf_colaborador,
                nm_funcao,
                desc_funcao,
                centro_custo,
                email_colaborador,
                tp_status,
                id_usuario,
            ],
        )

    def atualizar_usuario_bck_preservando_override(
        self,
        id_usuario: int,
        login: str,
        nome_colaborador: str,
        cpf_colaborador: str,
        nm_funcao: str,
        desc_funcao: str,
        centro_custo: str,
        email_colaborador: str,
    ) -> None:
        self.db.execute(
            f"""
            UPDATE {USER_TABLE}
            SET NM_LOGIN = ?,
                NM_COLABORADOR = ?,
                NU_CPF_COLABORADOR = ?,
                NM_FUNCAO = ?,
                DESC_FUNCAO = ?,
                CENTRO_CUSTO = ?,
                EMAIL = ?
            WHERE ID = ?
            """,
            [
                login.upper(),
                nome_colaborador,
                cpf_colaborador,
                nm_funcao,
                desc_funcao,
                centro_custo,
                email_colaborador,
                id_usuario,
            ],
        )
    
    def ativar_override_permissoes_usuario(self, id_usuario: str) -> None:
        self.db.execute(
            f"""
            UPDATE {USER_TABLE}
            SET TP_STATUS = ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE ID = ?
            """,
            [STATUS_USUARIO_OVERRIDE_GRUPO, id_usuario],
        )

    def listar_usuarios_base(self):
        return self.db.fetch_all(
            f"""
            SELECT
                ID,
                UPPER(NM_LOGIN),
                NM_COLABORADOR,
                NU_CPF_COLABORADOR,
                NM_FUNCAO,
                DESC_FUNCAO,
                CENTRO_CUSTO,
                EMAIL,
                TP_STATUS,
                DT_ATUALIZACAO
            FROM {USER_TABLE} WITH(NOLOCK)
            """
        )

    def listar_colaboradores_ativos_para_sincronizar(self):
        # Fonte somente leitura para batimento de usuarios.
        # Nao atualizar TB_COLABORADORES_ATIVOS por aqui.
        return self.cyber_db.fetch_all(
            """
            SELECT
                A.NM_COLABORADOR,
                A.NU_CPF_COLABORADOR,
                COALESCE(B.NM_LOGIN, '') AS NM_LOGIN,
                COALESCE(NULLIF(B.NM_FUNCAO, ''), A.DESC_FUNCAO, '') AS NM_FUNCAO,
                COALESCE(A.DESC_FUNCAO, '') AS DESC_FUNCAO,
                COALESCE(CAST(A.ID_CENTRO_CUSTO AS VARCHAR(50)), '') AS ID_CENTRO_CUSTO,
                COALESCE(A.CENTRO_CUSTO, '') AS CENTRO_CUSTO,
                COALESCE(A.CENTRO_CUSTO_2, '') AS CENTRO_CUSTO_2,
                CAST('' AS VARCHAR(255)) AS EMAIL
            FROM TB_COLABORADORES_ATIVOS AS A WITH(NOLOCK)
            LEFT JOIN TB_USUARIOS_ACTIVE_DIRECTORY AS B WITH(NOLOCK)
                ON A.NU_CPF_COLABORADOR = B.NU_CPF_COLABORADOR
               AND B.TP_STATUS = 1
            WHERE A.NU_CPF_COLABORADOR IS NOT NULL
              AND LTRIM(RTRIM(A.NU_CPF_COLABORADOR)) <> ''
            ORDER BY A.NM_COLABORADOR
            """
        )

    def tentar_adquirir_lock_sincronizacao(self) -> pyodbc.Connection | None:
        connection = self.db._connect()
        try:
            cursor = connection.cursor()
            cursor.execute(
                """
                DECLARE @resultado INT;
                EXEC @resultado = sp_getapplock
                    @Resource = 'ATLAS_SYNC_USUARIOS_BCK',
                    @LockMode = 'Exclusive',
                    @LockOwner = 'Session',
                    @LockTimeout = 0;
                SELECT @resultado;
                """
            )
            row = cursor.fetchone()
            resultado = int(row[0]) if row and row[0] is not None else -999
            if resultado < 0:
                connection.close()
                return None
            return connection
        except Exception:
            connection.close()
            raise

    def liberar_lock_sincronizacao(self, connection: pyodbc.Connection | None) -> None:
        if connection is None:
            return
        try:
            cursor = connection.cursor()
            cursor.execute(
                """
                EXEC sp_releaseapplock
                    @Resource = 'ATLAS_SYNC_USUARIOS_BCK',
                    @LockOwner = 'Session';
                """
            )
        finally:
            connection.close()

    def buscar_usuario_criado_por_cpf(self, cpf_colaborador: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, LOWER(NM_LOGIN), NM_COLABORADOR, NM_FUNCAO, EMAIL
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE NU_CPF_COLABORADOR = ?
            """,
            [cpf_colaborador],
        )

    def vincular_grupo_usuario(self, cpf_colaborador: str, id_grupo: str) -> None:
        self.db.execute(
            f"""
            INSERT INTO TB_GRUPOS_USUARIOS (
                ID_USUARIO,
                NM_LOGIN,
                ID_GRUPO,
                NM_GRUPO
            )
            SELECT
                A.ID,
                A.NM_LOGIN,
                B.ID,
                B.NM_GRUPO
            FROM {USER_TABLE} AS A WITH(NOLOCK)
            CROSS JOIN TB_GRUPOS AS B WITH(NOLOCK)
            WHERE A.NU_CPF_COLABORADOR = ?
              AND B.ID = ?
            """,
            [cpf_colaborador, id_grupo],
        )

    def listar_usuarios_permissoes(self):
        return self.db.fetch_all(
            f"""
            SELECT
                A.ID,
                A.NM_LOGIN,
                A.NM_COLABORADOR,
                A.NU_CPF_COLABORADOR,
                A.NM_FUNCAO,
                A.CENTRO_CUSTO,
                A.EMAIL,
                CASE
                    WHEN A.TP_STATUS = 0 THEN 'USUARIO DESATIVADO'
                    WHEN A.TP_STATUS = ? THEN 'ATIVO MANUAL'
                    ELSE 'ATIVO'
                END,
                B.ID_GRUPO,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(B.NM_GRUPO))) = 'DIGITAL' THEN 'DIGITAL'
                    ELSE B.NM_GRUPO
                END AS NM_GRUPO
            FROM {USER_TABLE} AS A WITH(NOLOCK)
            LEFT JOIN TB_GRUPOS_USUARIOS AS B WITH(NOLOCK)
                ON A.ID = B.ID_USUARIO
            ORDER BY A.NM_LOGIN, B.NM_GRUPO ASC
            """,
            [STATUS_USUARIO_MANUAL],
        )

    def buscar_email_usuario(self, id_usuario: str):
        return self.db.fetch_all(
            f"""
            SELECT EMAIL
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE ID = ?
            """,
            [id_usuario],
        )

    def buscar_login_email_status_por_cpf(self, cpf: str):
        return self.db.fetch_all(
            f"""
            SELECT ID, NM_LOGIN, NM_COLABORADOR, EMAIL, TP_STATUS
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE NU_CPF_COLABORADOR = ?
            """,
            [cpf],
        )

    def atualizar_email_usuario(self, id_usuario: str, email_usuario: str) -> None:
        self.db.execute(
            f"""
            UPDATE {USER_TABLE}
            SET EMAIL = ?
            WHERE ID = ?
            """,
            [email_usuario, id_usuario],
        )

    def registrar_log_email(self, id_usuario: str, email_atual: str, email_usuario: str, login_autenticado: str) -> None:
        self.db.execute(
            f"""
            INSERT INTO TB_LOG_ALTERACOES_USAURIO (
                NM_LOGIN_ALTERADO,
                DESC_ALTERACAO,
                NM_LOGIN_ALTERACAO
            )
            SELECT
                NM_LOGIN,
                ?,
                ?
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE ID = ?
            """,
            [f"E-MAIL ALTERADO ({email_atual} >>> {email_usuario})", login_autenticado, id_usuario],
        )

    def listar_grupos_usuario(self, id_usuario: str):
        return self.db.fetch_all(
            """
            SELECT
                CASE
                    WHEN UPPER(LTRIM(RTRIM(NM_GRUPO))) = 'DIGITAL' THEN 'DIGITAL'
                    ELSE NM_GRUPO
                END AS NM_GRUPO
            FROM TB_GRUPOS_USUARIOS WITH(NOLOCK)
            WHERE ID_USUARIO = ?
            """,
            [id_usuario],
        )

    def excluir_grupos_usuario(self, id_usuario: str) -> None:
        self.db.execute(
            """
            DELETE FROM TB_GRUPOS_USUARIOS
            WHERE ID_USUARIO = ?
            """,
            [id_usuario],
        )

    def inserir_grupos_usuario_por_nome(self, id_usuario: str, grupos_novos: list[str]) -> None:
        grupos_sql = ", ".join("?" for _ in grupos_novos)
        self.db.execute(
            f"""
            INSERT INTO TB_GRUPOS_USUARIOS (
                ID_USUARIO,
                NM_LOGIN,
                ID_GRUPO,
                NM_GRUPO
            )
            SELECT
                A.ID,
                A.NM_LOGIN,
                B.ID,
                B.NM_GRUPO
            FROM {USER_TABLE} AS A WITH(NOLOCK)
            CROSS JOIN TB_GRUPOS AS B WITH(NOLOCK)
            WHERE A.ID = ?
              AND UPPER(LTRIM(RTRIM(B.NM_GRUPO))) IN ({grupos_sql})
            """,
            [id_usuario, *[grupo.upper() for grupo in grupos_novos]],
        )

    def atualizar_login_grupos_usuario(self, id_usuario: int, login: str) -> None:
        self.db.execute(
            """
            UPDATE TB_GRUPOS_USUARIOS
            SET NM_LOGIN = ?
            WHERE ID_USUARIO = ?
            """,
            [login.upper(), id_usuario],
        )

    def excluir_conexoes_usuario(self, login: str) -> None:
        self.db.execute(
            """
            DELETE FROM TB_CONEXOES
            WHERE NM_LOGIN = ?
            """,
            [login.upper()],
        )

    def excluir_usuario(self, id_usuario: int) -> None:
        self.db.execute(
            f"""
            DELETE FROM {USER_TABLE}
            WHERE ID = ?
            """,
            [id_usuario],
        )

    def registrar_log_grupo(self, id_usuario: str, grupos_atuais_txt: str, grupos_novos_txt: str, login_autenticado: str) -> None:
        self.db.execute(
            f"""
            INSERT INTO TB_LOG_ALTERACOES_USAURIO (
                NM_LOGIN_ALTERADO,
                DESC_ALTERACAO,
                NM_LOGIN_ALTERACAO
            )
            SELECT
                NM_LOGIN,
                ?,
                ?
            FROM {USER_TABLE} WITH(NOLOCK)
            WHERE ID = ?
            """,
            [f"GRUPO ALTERADO ({grupos_atuais_txt} >>> {grupos_novos_txt})", login_autenticado, id_usuario],
        )
