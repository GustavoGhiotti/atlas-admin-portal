"""Acesso a configuracao do robo de transferencia de arquivos (DB_SFTP).

Tabelas (servidor .66):
    TB_ARQUIVO_MAPA  - 1 linha por arquivo controlado (a "tela de transferencia")
    TB_CONEXAO_SFTP  - credenciais por cedente (aqui so lemos ID_CEDENTE + NM_CEDENTE)

A tela e DIRIGIDA POR METADADOS de proposito. O robo e incremental: ganha colunas
novas com frequencia (ex.: NOTIFICACAO). Em vez de fixar a lista de colunas no
codigo, perguntamos ao proprio SQL Server quais colunas TB_ARQUIVO_MAPA tem hoje
(INFORMATION_SCHEMA) e montamos leitura e escrita a partir dela. Assim uma coluna
nova aparece na tela sem alterar codigo nenhum.

SEGURANCA: nome de coluna nao pode ser parametrizado (?), entao ele entra no texto
do SQL por f-string. A defesa contra injecao e que TODO nome usado na escrita e
antes validado contra a lista viva de colunas reais (nomes_colunas). Um nome que
nao existe na tabela simplesmente nao e gravado.
"""

from src.infrastructure.databases.sql_server import get_sql_server_66


TABELA_MAPA = "TB_ARQUIVO_MAPA"


class TransferenciasRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_SFTP")

    # ------------------------------------------------------------------ metadados

    def listar_colunas_mapa(self) -> list[tuple]:
        """Descreve cada coluna real de TB_ARQUIVO_MAPA (ordenada como na tabela).

        Colunas do retorno:
            COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE,
            COLUMN_DEFAULT, IS_IDENTITY, ORDINAL_POSITION
        """
        return self.db.fetch_all(
            """
            SELECT
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.CHARACTER_MAXIMUM_LENGTH,
                c.IS_NULLABLE,
                c.COLUMN_DEFAULT,
                COLUMNPROPERTY(OBJECT_ID('dbo.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY,
                c.ORDINAL_POSITION
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_SCHEMA = 'dbo' AND c.TABLE_NAME = ?
            ORDER BY c.ORDINAL_POSITION
            """,
            [TABELA_MAPA],
            query_name="transferencias.listar_colunas_mapa",
        )

    def nomes_colunas(self) -> list[str]:
        """Colunas reais, na ordem da tabela. Fonte de verdade da whitelist."""
        return [str(row[0]) for row in self.listar_colunas_mapa()]

    # -------------------------------------------------------------------- leitura

    def listar_cedentes(self) -> list[tuple]:
        return self.db.fetch_all(
            """
            SELECT ID_CEDENTE, NM_CEDENTE
            FROM TB_CONEXAO_SFTP WITH (NOLOCK)
            WHERE ATIVO = 1
            ORDER BY NM_CEDENTE
            """,
            query_name="transferencias.listar_cedentes",
        )

    def listar_mapas(self) -> list[dict]:
        """Todas as linhas do mapa, cada uma como dict por nome de coluna.

        Monta o SELECT a partir das colunas reais (nomes vindos do INFORMATION_SCHEMA,
        nao do cliente): SELECT * traria colunas novas, mas nao garante a ordem para
        casar com os nomes. Traz o nome do cedente por LEFT JOIN (chave __NM_CEDENTE).
        """
        colunas = self.nomes_colunas()
        if not colunas:
            return []
        lista_select = ", ".join(f"m.[{coluna}]" for coluna in colunas)
        query = f"""
            SELECT {lista_select}, c.NM_CEDENTE AS __NM_CEDENTE
            FROM TB_ARQUIVO_MAPA m WITH (NOLOCK)
            LEFT JOIN TB_CONEXAO_SFTP c WITH (NOLOCK) ON c.ID_CEDENTE = m.ID_CEDENTE
            ORDER BY m.ID DESC
        """
        campos = colunas + ["__NM_CEDENTE"]
        linhas = self.db.fetch_all(query, query_name="transferencias.listar_mapas")
        return [dict(zip(campos, linha)) for linha in linhas]

    # -------------------------------------------------------------------- escrita

    def salvar_mapa(self, graveis: dict, id_mapa: int | None) -> None:
        """INSERT (id_mapa None) ou UPDATE dinamico.

        `graveis` ja vem filtrado pelo service: apenas colunas reais e gravaveis,
        com os valores ja no tipo do driver (int p/ bit, etc). Ainda assim os
        nomes sao interpolados entre colchetes - so chegam aqui nomes de colunas
        reais.
        """
        if not graveis:
            raise ValueError("Nenhuma coluna gravavel foi informada.")

        if id_mapa is not None:
            atribuicoes = ", ".join(f"[{coluna}] = ?" for coluna in graveis)
            params = list(graveis.values()) + [id_mapa]
            self.db.execute(
                f"UPDATE TB_ARQUIVO_MAPA SET {atribuicoes} WHERE [ID] = ?",
                params,
                query_name="transferencias.atualizar_mapa",
            )
            return

        colunas = ", ".join(f"[{coluna}]" for coluna in graveis)
        marcadores = ", ".join("?" for _ in graveis)
        self.db.execute(
            f"INSERT INTO TB_ARQUIVO_MAPA ({colunas}) VALUES ({marcadores})",
            list(graveis.values()),
            query_name="transferencias.inserir_mapa",
        )

    def alterar_ativo(self, id_mapa: int, ativo: bool) -> None:
        self.db.execute(
            "UPDATE TB_ARQUIVO_MAPA SET ATIVO = ? WHERE ID = ?",
            [1 if ativo else 0, id_mapa],
            query_name="transferencias.alterar_ativo",
        )
