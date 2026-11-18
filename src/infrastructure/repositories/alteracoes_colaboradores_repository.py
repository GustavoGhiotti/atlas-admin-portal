from src.infrastructure.databases.sql_server import get_sql_server_66


class AlteracoesColaboradoresRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_CYBER_SEC")

    def buscar_colaborador_por_cpf(self, cpf: str):
        return self.db.fetch_one(
            """
            SELECT
                NM_COLABORADOR,
                NU_CPF_COLABORADOR,
                DESC_FUNCAO,
                CAST(ID_CENTRO_CUSTO AS VARCHAR(20)) AS ID_CENTRO_CUSTO,
                CENTRO_CUSTO,
                CENTRO_CUSTO_2
            FROM TB_COLABORADORES_ATIVOS WITH(NOLOCK)
            WHERE NU_CPF_COLABORADOR = ?
            """,
            [cpf],
        )

    def atualizar_colaborador(
        self,
        cpf: str,
        funcao: str,
        id_centro_custo: str,
        centro_custo: str,
        centro_custo_2: str | None,
        user_atualizacao: str,
    ) -> None:
        self.db.execute(
            """
            UPDATE TB_COLABORADORES_ATIVOS
            SET DESC_FUNCAO = ?,
                ID_CENTRO_CUSTO = ?,
                CENTRO_CUSTO = ?,
                CENTRO_CUSTO_2 = ?,
                USER_ATUALIZACAO = ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE NU_CPF_COLABORADOR = ?
            """,
            [
                funcao,
                id_centro_custo,
                centro_custo,
                centro_custo_2,
                user_atualizacao,
                cpf,
            ],
        )

    def registrar_log_alteracao(
        self,
        cpf: str,
        nome: str,
        funcao_antiga: str,
        funcao_nova: str,
        id_cc_antigo: str,
        id_cc_novo: str,
        cc_antigo: str,
        cc_novo: str,
        cc2_novo: str | None,
        responsavel: str,
    ) -> None:
        self.db.execute(
            """
            INSERT INTO TB_LOG_ALTERACOES_COLABORADORES (
                CPF,
                COLABORADOR,
                FUNCAO_ANTIGA,
                FUNCAO_NOVA,
                ID_CC_ANTIGO,
                ID_CC_NOVO,
                CENTRO_CUSTO_ANTIGO,
                CENTRO_CUSTO_NOVO,
                CENTRO_CUSTO_2,
                RESPONSAVEL,
                DT_ALTERACAO
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """,
            [
                cpf,
                nome,
                funcao_antiga,
                funcao_nova,
                id_cc_antigo,
                id_cc_novo,
                cc_antigo,
                cc_novo,
                cc2_novo,
                responsavel,
            ],
        )

    def listar_centros_custo(self):
        return self.db.fetch_all(
            """
            SELECT
                CAST(ID_CENTRO_CUSTO AS VARCHAR(20)) AS ID_CENTRO_CUSTO,
                CENTRO_CUSTO
            FROM TB_TOTVS WITH(NOLOCK)
            GROUP BY ID_CENTRO_CUSTO, CENTRO_CUSTO
            ORDER BY ID_CENTRO_CUSTO
            """
        )

    def listar_centros_custo_operacional(self):
        return self.db.fetch_all(
            """
            SELECT
                CAST(ID_CENTRO_CUSTO AS VARCHAR(20)) AS ID_CENTRO_CUSTO,
                CENTRO_CUSTO
            FROM TB_TOTVS WITH(NOLOCK)
            WHERE DESC_FUNCAO IN ('OPERADOR(A) COBRADOR(A)', 'NEGOCIADOR')
              AND ID_CENTRO_CUSTO IS NOT NULL
              AND CENTRO_CUSTO IS NOT NULL
              AND LTRIM(RTRIM(CENTRO_CUSTO)) <> ''
            GROUP BY ID_CENTRO_CUSTO, CENTRO_CUSTO
            ORDER BY ID_CENTRO_CUSTO
            """
        )

    def listar_funcoes(self):
        return self.db.fetch_all(
            """
            SELECT DISTINCT DESC_FUNCAO
            FROM TB_TOTVS WITH(NOLOCK)
            WHERE DESC_FUNCAO IS NOT NULL AND DESC_FUNCAO <> ''
            ORDER BY DESC_FUNCAO
            """
        )

    def listar_colaboradores_vega_operacional(self):
        return self.db.fetch_all(
            """
            SELECT
                NM_COLABORADOR,
                NU_CPF_COLABORADOR,
                DESC_FUNCAO,
                CAST(ID_CENTRO_CUSTO AS VARCHAR(20)) AS ID_CENTRO_CUSTO,
                CENTRO_CUSTO,
                CENTRO_CUSTO_2
            FROM TB_COLABORADORES_ATIVOS WITH(NOLOCK)
            WHERE CAST(ID_CENTRO_CUSTO AS VARCHAR(20)) = '1011-2'
              AND UPPER(LTRIM(RTRIM(CENTRO_CUSTO))) = 'VEGA'
            ORDER BY NM_COLABORADOR
            """
        )

    def atualizar_centro_custo_2_operacional(self, cpf: str, centro_custo_2: str, user_atualizacao: str) -> None:
        self.db.execute(
            """
            UPDATE TB_COLABORADORES_ATIVOS
            SET CENTRO_CUSTO_2 = ?,
                USER_ATUALIZACAO = ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE NU_CPF_COLABORADOR = ?
              AND CAST(ID_CENTRO_CUSTO AS VARCHAR(20)) = '1011-2'
              AND UPPER(LTRIM(RTRIM(CENTRO_CUSTO))) = 'VEGA'
            """,
            [centro_custo_2, user_atualizacao, cpf],
        )

    def buscar_status_sincronia(self):
        return self.db.fetch_one(
            """
            SELECT TOP 1 STATUS
            FROM TB_CONTROLE_SINCRONIA_COLABORADORES
            WHERE ID = 1
            """
        )

    def atualizar_status_sincronia(self, status: int) -> None:
        self.db.execute(
            """
            UPDATE TB_CONTROLE_SINCRONIA_COLABORADORES
            SET STATUS = ?
            WHERE ID = 1
            """,
            [status],
        )

    def executar_proc_batimento(self) -> None:
        self.db.execute("EXEC PROC_BATIMENTO_COLABORADORES")
