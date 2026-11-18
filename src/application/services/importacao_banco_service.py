from __future__ import annotations

import csv
import io
import os
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from pathlib import PureWindowsPath
from typing import Any

from fastapi import UploadFile

from src.application.services.auth_service import AuthenticatedUser
from src.domain.entities.evento_importacao_banco import EventoImportacaoBanco
from src.infrastructure.databases.sql_server import SqlServerConnection
from src.infrastructure.repositories.importacao_banco_auditoria_repository import ImportacaoBancoAuditoriaRepository
from src.infrastructure.repositories.importacao_banco_repository import ImportacaoBancoRepository
from src.infrastructure.services.env_load import get_env
from src.infrastructure.services.logger_config import setup_logger
from src.shared.exception import AtlasException, NaoEncontradoException


STRING_TYPES = {
    "char",
    "nchar",
    "varchar",
    "nvarchar",
    "text",
    "ntext",
    "xml",
    "uniqueidentifier",
}
INTEGER_TYPES = {"tinyint", "smallint", "int", "bigint"}
DECIMAL_TYPES = {"decimal", "numeric", "money", "smallmoney"}
FLOAT_TYPES = {"float", "real"}
BOOLEAN_TYPES = {"bit"}
DATE_TYPES = {"date"}
DATETIME_TYPES = {"datetime", "datetime2", "smalldatetime", "datetimeoffset"}
TIME_TYPES = {"time"}
UNSUPPORTED_TYPES = {"binary", "varbinary", "image", "timestamp", "rowversion", "sql_variant", "hierarchyid", "geography", "geometry"}
HOSTS_SQL_OCULTOS = {"10.0.0.65"}


@dataclass
class ArquivoColuna:
    indice: int
    nome: str
    nome_normalizado: str


@dataclass
class LinhaArquivo:
    numero_origem: int
    valores: dict[str, Any]


@dataclass
class ArquivoAnalisado:
    nome_arquivo: str
    tipo_arquivo: str
    delimitador: str | None
    abas_disponiveis: list[str]
    aba_selecionada: str | None
    colunas: list[ArquivoColuna]
    linhas: list[LinhaArquivo]


@dataclass
class ColunaTabela:
    ordinal: int
    nome: str
    tipo: str
    aceita_nulo: bool
    identidade: bool
    calculada: bool
    possui_default: bool
    tamanho_maximo: int | None
    precisao: int | None
    escala: int | None

    @property
    def obrigatoria(self) -> bool:
        return not self.aceita_nulo and not self.identidade and not self.calculada and not self.possui_default

    @property
    def importavel(self) -> bool:
        return not self.identidade and not self.calculada


@dataclass
class ColunaDestinoBulk:
    nome_origem: str
    nome_destino: str


class ImportacaoBancoService:
    def __init__(self) -> None:
        self._sample_limit = 20
        self._chunk_size = 500
        self.auditoria_repository = ImportacaoBancoAuditoriaRepository()
        self.logger = setup_logger("atlas.importacao-banco.auditoria")

    def listar_destinos(self) -> dict[str, object]:
        servidores = [
            {
                "chave": item["chave"],
                "host": item["host"],
                "label": item["host"],
            }
            for item in self._listar_servidores()
        ]
        return {
            "status": "sucesso",
            "servidores": servidores,
            "bancos": [],
            "formatos_permitidos": [".xlsx", ".csv", ".txt"],
        }

    def listar_bancos(self, servidor: str) -> dict[str, object]:
        repository = self._build_server_repository(servidor)
        rows = repository.listar_bancos()
        bancos = [
            {
                "nome": str(row[0] or "").strip(),
                "label": str(row[0] or "").strip(),
            }
            for row in rows
            if str(row[0] or "").strip()
        ]
        return {
            "status": "sucesso",
            "quantidade": len(bancos),
            "bancos": bancos,
        }

    def inspecionar_documento(self, arquivo: UploadFile) -> dict[str, object]:
        nome_arquivo = str(arquivo.filename or "").strip()
        extensao = os.path.splitext(nome_arquivo)[1].lower()
        if extensao not in {".xlsx", ".csv", ".txt"}:
            raise AtlasException("Formato inválido. Use somente arquivos .xlsx, .csv ou .txt.")

        conteudo = arquivo.file.read()
        if not conteudo:
            raise AtlasException("Arquivo vazio.")

        if extensao == ".xlsx":
            return self._inspecionar_xlsx(nome_arquivo, conteudo)

        arquivo_analisado = self._parse_delimited_text(nome_arquivo, conteudo, extensao)
        return {
            "status": "sucesso",
            "modo_importacao": "tabela_existente",
            "schema_destino": schema_nome,
            "tabela_destino": tabela_nome,
            "nome_arquivo": arquivo_analisado.nome_arquivo,
            "tipo_arquivo": arquivo_analisado.tipo_arquivo,
            "delimitador": arquivo_analisado.delimitador,
            "abas_disponiveis": arquivo_analisado.abas_disponiveis,
            "aba_padrao": arquivo_analisado.aba_selecionada,
            "total_colunas": len(arquivo_analisado.colunas),
            "total_linhas": len(arquivo_analisado.linhas),
        }

    def listar_tabelas(self, servidor: str, banco: str) -> dict[str, object]:
        repository = self._build_repository(servidor, banco)
        rows = repository.listar_tabelas()
        tabelas = [
            {
                "schema": str(row[0] or "").strip(),
                "tabela": str(row[1] or "").strip(),
            }
            for row in rows
            if str(row[0] or "").strip() and str(row[1] or "").strip()
        ]
        return {
            "status": "sucesso",
            "quantidade": len(tabelas),
            "tabelas": tabelas,
        }

    def analisar_documento(
        self,
        arquivo: UploadFile,
        servidor: str,
        banco: str,
        schema_nome: str,
        tabela_nome: str,
        aba_nome: str | None = None,
    ) -> dict[str, object]:
        repository = self._build_repository(servidor, banco)
        arquivo_analisado = self._analisar_arquivo(arquivo, aba_nome=aba_nome)
        colunas_tabela = self._buscar_colunas_tabela(repository, schema_nome, tabela_nome)
        resultado = self._comparar_estrutura(arquivo_analisado, colunas_tabela)

        return {
            "status": "sucesso",
            "nome_arquivo": arquivo_analisado.nome_arquivo,
            "tipo_arquivo": arquivo_analisado.tipo_arquivo,
            "delimitador": arquivo_analisado.delimitador,
            "abas_disponiveis": arquivo_analisado.abas_disponiveis,
            "aba_selecionada": arquivo_analisado.aba_selecionada,
            "total_linhas": len(arquivo_analisado.linhas),
            "colunas_arquivo": [
                {
                    "indice": coluna.indice,
                    "nome": coluna.nome,
                }
                for coluna in arquivo_analisado.colunas
            ],
            "colunas_tabela": [
                {
                    "nome": coluna.nome,
                    "tipo": coluna.tipo,
                    "obrigatoria": coluna.obrigatoria,
                    "aceita_nulo": coluna.aceita_nulo,
                    "importavel": coluna.importavel,
                }
                for coluna in colunas_tabela
            ],
            "colunas_correspondentes": resultado["colunas_correspondentes"],
            "colunas_extras_arquivo": resultado["colunas_extras_arquivo"],
            "colunas_faltantes_tabela": resultado["colunas_faltantes_tabela"],
            "colunas_nao_suportadas": resultado["colunas_nao_suportadas"],
            "pode_importar": resultado["pode_importar"],
            "mensagem": resultado["mensagem"],
            "amostra": [
                {
                    coluna.nome: self._stringify_preview_value(linha.valores.get(coluna.nome))
                    for coluna in arquivo_analisado.colunas
                }
                for linha in arquivo_analisado.linhas[: self._sample_limit]
            ],
        }

    def analisar_documento_bulk(
        self,
        arquivo: UploadFile,
        servidor: str,
        banco: str,
        aba_nome: str | None = None,
    ) -> dict[str, object]:
        repository = self._build_repository(servidor, banco)
        arquivo_analisado = self._analisar_arquivo(arquivo, aba_nome=aba_nome)
        schema_destino = "dbo"
        tabela_destino = self._gerar_nome_tabela_bulk(arquivo_analisado.nome_arquivo)
        colunas_destino = self._montar_colunas_destino_bulk(arquivo_analisado)
        tabela_existe = repository.tabela_existe(schema_destino, tabela_destino)
        pode_importar = bool(arquivo_analisado.linhas) and not tabela_existe

        if tabela_existe:
            mensagem = f"A tabela {schema_destino}.{tabela_destino} ja existe no banco selecionado. Renomeie o arquivo ou remova a tabela antes de importar."
        elif not arquivo_analisado.linhas:
            mensagem = "Arquivo sem linhas de dados para importar."
        else:
            mensagem = f"Estrutura valida. Sera criada a tabela {schema_destino}.{tabela_destino} com base nas colunas do arquivo."

        return {
            "status": "sucesso",
            "modo_importacao": "bulk",
            "schema_destino": schema_destino,
            "tabela_destino": tabela_destino,
            "nome_arquivo": arquivo_analisado.nome_arquivo,
            "tipo_arquivo": arquivo_analisado.tipo_arquivo,
            "delimitador": arquivo_analisado.delimitador,
            "abas_disponiveis": arquivo_analisado.abas_disponiveis,
            "aba_selecionada": arquivo_analisado.aba_selecionada,
            "total_linhas": len(arquivo_analisado.linhas),
            "colunas_arquivo": [
                {
                    "indice": coluna.indice,
                    "nome": coluna.nome,
                }
                for coluna in arquivo_analisado.colunas
            ],
            "colunas_tabela": [
                {
                    "nome": coluna.nome_destino,
                    "tipo": "nvarchar(max)",
                    "obrigatoria": False,
                    "aceita_nulo": True,
                    "importavel": True,
                }
                for coluna in colunas_destino
            ],
            "colunas_correspondentes": [
                {"origem": coluna.nome_origem, "destino": coluna.nome_destino}
                for coluna in colunas_destino
            ],
            "colunas_extras_arquivo": [],
            "colunas_faltantes_tabela": [],
            "colunas_nao_suportadas": [],
            "pode_importar": pode_importar,
            "mensagem": mensagem,
            "amostra": [
                {
                    coluna.nome: self._stringify_preview_value(linha.valores.get(coluna.nome))
                    for coluna in arquivo_analisado.colunas
                }
                for linha in arquivo_analisado.linhas[: self._sample_limit]
            ],
        }

    def importar_documento(
        self,
        arquivo: UploadFile,
        servidor: str,
        banco: str,
        schema_nome: str,
        tabela_nome: str,
        aba_nome: str | None = None,
        current_user: AuthenticatedUser | None = None,
        host_origem: str = "",
    ) -> dict[str, object]:
        repository = self._build_repository(servidor, banco)
        host_sql = self._resolver_host(servidor)
        arquivo_analisado = self._analisar_arquivo(arquivo, aba_nome=aba_nome)
        colunas_tabela = self._buscar_colunas_tabela(repository, schema_nome, tabela_nome)
        resultado = self._comparar_estrutura(arquivo_analisado, colunas_tabela)

        if not resultado["pode_importar"]:
            raise AtlasException(str(resultado["mensagem"]))

        inseriveis = [
            coluna_tabela
            for coluna_tabela in sorted(colunas_tabela, key=lambda item: item.ordinal)
            if coluna_tabela.importavel and coluna_tabela.nome in resultado["mapa_destino_origem"]
        ]
        if not inseriveis:
            raise AtlasException("Não há colunas válidas para importação nessa tabela.")

        rows_to_insert: list[tuple[Any, ...]] = []
        for linha in arquivo_analisado.linhas:
            valores_linha: list[Any] = []
            for coluna_tabela in inseriveis:
                nome_origem = resultado["mapa_destino_origem"][coluna_tabela.nome]
                valor = linha.valores.get(nome_origem)
                valores_linha.append(self._coerce_value(valor, coluna_tabela, linha.numero_origem))
            rows_to_insert.append(tuple(valores_linha))

        for start in range(0, len(rows_to_insert), self._chunk_size):
            repository.inserir_linhas(
                schema_name=schema_nome,
                table_name=tabela_nome,
                columns=[coluna.nome for coluna in inseriveis],
                rows=rows_to_insert[start : start + self._chunk_size],
            )

        if current_user:
            evento = self._montar_evento_importacao(
                current_user=current_user,
                host_origem=host_origem,
                host_sql=host_sql,
                banco=banco,
                schema_nome=schema_nome,
                tabela_nome=tabela_nome,
                arquivo_analisado=arquivo_analisado,
                colunas_importadas=[coluna.nome for coluna in inseriveis],
                total_linhas_importadas=len(rows_to_insert),
            )
            self._registrar_evento_importacao(evento)

        return {
            "status": "sucesso",
            "modo_importacao": "tabela_existente",
            "schema_destino": schema_nome,
            "tabela_destino": tabela_nome,
            "mensagem": f"{len(rows_to_insert)} linha(s) importada(s) com sucesso para {schema_nome}.{tabela_nome}.",
            "total_linhas_importadas": len(rows_to_insert),
            "nome_arquivo": arquivo_analisado.nome_arquivo,
            "aba_selecionada": arquivo_analisado.aba_selecionada,
        }

    def importar_documento_bulk(
        self,
        arquivo: UploadFile,
        servidor: str,
        banco: str,
        aba_nome: str | None = None,
        current_user: AuthenticatedUser | None = None,
        host_origem: str = "",
    ) -> dict[str, object]:
        repository = self._build_repository(servidor, banco)
        host_sql = self._resolver_host(servidor)
        arquivo_analisado = self._analisar_arquivo(arquivo, aba_nome=aba_nome)
        schema_destino = "dbo"
        tabela_destino = self._gerar_nome_tabela_bulk(arquivo_analisado.nome_arquivo)
        colunas_destino = self._montar_colunas_destino_bulk(arquivo_analisado)

        if repository.tabela_existe(schema_destino, tabela_destino):
            raise AtlasException(
                f"A tabela {schema_destino}.{tabela_destino} ja existe no banco selecionado. Renomeie o arquivo ou remova a tabela antes de importar."
            )
        if not arquivo_analisado.linhas:
            raise AtlasException("Arquivo sem linhas de dados para importar.")

        repository.criar_tabela_bulk(
            schema_name=schema_destino,
            table_name=tabela_destino,
            columns=[coluna.nome_destino for coluna in colunas_destino],
        )

        rows_to_insert = [
            tuple(self._stringify_import_value(linha.valores.get(coluna.nome_origem)) for coluna in colunas_destino)
            for linha in arquivo_analisado.linhas
        ]

        for start in range(0, len(rows_to_insert), self._chunk_size):
            repository.inserir_linhas(
                schema_name=schema_destino,
                table_name=tabela_destino,
                columns=[coluna.nome_destino for coluna in colunas_destino],
                rows=rows_to_insert[start : start + self._chunk_size],
            )

        if current_user:
            evento = self._montar_evento_importacao(
                current_user=current_user,
                host_origem=host_origem,
                host_sql=host_sql,
                banco=banco,
                schema_nome=schema_destino,
                tabela_nome=tabela_destino,
                arquivo_analisado=arquivo_analisado,
                colunas_importadas=[coluna.nome_destino for coluna in colunas_destino],
                total_linhas_importadas=len(rows_to_insert),
                tp_evento="IMPORTACAO_SQL_BULK",
            )
            self._registrar_evento_importacao(evento)

        return {
            "status": "sucesso",
            "modo_importacao": "bulk",
            "schema_destino": schema_destino,
            "tabela_destino": tabela_destino,
            "mensagem": f"{len(rows_to_insert)} linha(s) importada(s) com sucesso para {schema_destino}.{tabela_destino}.",
            "total_linhas_importadas": len(rows_to_insert),
            "nome_arquivo": arquivo_analisado.nome_arquivo,
            "aba_selecionada": arquivo_analisado.aba_selecionada,
        }

    def _montar_evento_importacao(
        self,
        current_user: AuthenticatedUser,
        host_origem: str,
        host_sql: str,
        banco: str,
        schema_nome: str,
        tabela_nome: str,
        arquivo_analisado: ArquivoAnalisado,
        colunas_importadas: list[str],
        total_linhas_importadas: int,
        tp_evento: str = "IMPORTACAO_SQL",
    ) -> EventoImportacaoBanco:
        return EventoImportacaoBanco(
            tp_evento=tp_evento,
            nm_login=current_user.nm_login,
            nm_colaborador=current_user.nm_colaborador,
            nu_cpf_colaborador=current_user.nu_cpf_colaborador,
            nm_funcao=current_user.nm_funcao,
            centro_custo=current_user.centro_custo,
            email=current_user.email,
            host_origem=host_origem or current_user.host,
            nm_servidor_sql=host_sql,
            nm_banco=banco,
            nm_schema=schema_nome,
            nm_tabela=tabela_nome,
            nm_arquivo=PureWindowsPath(arquivo_analisado.nome_arquivo).name,
            tp_arquivo=arquivo_analisado.tipo_arquivo,
            nm_aba=arquivo_analisado.aba_selecionada,
            delimitador=arquivo_analisado.delimitador,
            total_linhas_arquivo=len(arquivo_analisado.linhas),
            total_linhas_importadas=total_linhas_importadas,
            colunas_importadas=", ".join(colunas_importadas) if colunas_importadas else None,
        )

    def _gerar_nome_tabela_bulk(self, nome_arquivo: str) -> str:
        base = PureWindowsPath(nome_arquivo).stem.strip()
        base = re.sub(r"[\x00-\x1f]+", "", base)
        base = base.replace(".", "_")
        base = re.sub(r"\s+", "_", base).strip(" _")
        if not base:
            base = "arquivo_importado"
        return base[:128].rstrip(" _")

    def _montar_colunas_destino_bulk(self, arquivo_analisado: ArquivoAnalisado) -> list[ColunaDestinoBulk]:
        colunas_destino: list[ColunaDestinoBulk] = []
        nomes_usados: set[str] = set()

        for indice, coluna in enumerate(arquivo_analisado.colunas, start=1):
            nome_destino = self._gerar_nome_coluna_bulk(coluna.nome, indice)
            nome_base = nome_destino
            sequencia = 2
            while nome_destino.lower() in nomes_usados:
                sufixo = f"_{sequencia}"
                nome_destino = f"{nome_base[: 128 - len(sufixo)]}{sufixo}"
                sequencia += 1

            nomes_usados.add(nome_destino.lower())
            colunas_destino.append(ColunaDestinoBulk(nome_origem=coluna.nome, nome_destino=nome_destino))

        return colunas_destino

    def _gerar_nome_coluna_bulk(self, nome_coluna: str, indice: int) -> str:
        nome_limpo = re.sub(r"[\x00-\x1f]+", "", str(nome_coluna or "")).strip()
        nome_limpo = re.sub(r"\s+", "_", nome_limpo)
        nome_limpo = nome_limpo.replace(".", "_")
        nome_limpo = nome_limpo.strip(" _")
        if not nome_limpo:
            nome_limpo = f"COLUNA_{indice}"
        if nome_limpo[0].isdigit():
            nome_limpo = f"COL_{nome_limpo}"
        return nome_limpo[:128].rstrip(" _")

    def _registrar_evento_importacao(self, evento: EventoImportacaoBanco) -> None:
        try:
            self.auditoria_repository.registrar_evento(evento)
        except Exception:  # pragma: no cover - falha de infraestrutura nao deve interromper operacao principal
            self.logger.exception(
                "Falha ao registrar auditoria da importacao SQL. login=%s destino=%s.%s.%s arquivo=%s",
                evento.nm_login,
                evento.nm_banco,
                evento.nm_schema,
                evento.nm_tabela,
                evento.nm_arquivo,
            )

    def _listar_servidores(self) -> list[dict[str, str]]:
        servidores: list[dict[str, str]] = []
        for nome in sorted(os.environ):
            if not nome.startswith("DB_HOST_"):
                continue
            chave = nome.removeprefix("DB_HOST_").strip()
            host = str(os.getenv(nome) or "").strip()
            if chave and host and host not in HOSTS_SQL_OCULTOS:
                servidores.append({"chave": chave, "host": host})
        return servidores

    def _build_repository(self, servidor: str, banco: str) -> ImportacaoBancoRepository:
        host = self._resolver_host(servidor)
        database = self._resolver_banco(banco)
        user = get_env("DB_USER", required=True)
        password = get_env("DB_PASSWORD", required=True)
        db = SqlServerConnection(host=host, database=database, user=user, password=password)
        return ImportacaoBancoRepository(db)

    def _build_server_repository(self, servidor: str) -> ImportacaoBancoRepository:
        host = self._resolver_host(servidor)
        user = get_env("DB_USER", required=True)
        password = get_env("DB_PASSWORD", required=True)
        db = SqlServerConnection(host=host, database="master", user=user, password=password)
        return ImportacaoBancoRepository(db)

    def _resolver_host(self, servidor: str) -> str:
        chave = str(servidor or "").strip()
        if not chave:
            raise AtlasException("Servidor SQL obrigatório.")
        host = get_env(f"DB_HOST_{chave}")
        if not host:
            raise AtlasException("Servidor SQL inválido.")
        return host

    def _resolver_banco(self, banco: str) -> str:
        valor = str(banco or "").strip()
        if not valor:
            raise AtlasException("Banco obrigatório.")
        if any(char in valor for char in {";", "\n", "\r", "\t"}):
            raise AtlasException("Banco inválido.")
        return valor

    def _buscar_colunas_tabela(self, repository: ImportacaoBancoRepository, schema_nome: str, tabela_nome: str) -> list[ColunaTabela]:
        schema_limpo = str(schema_nome or "").strip()
        tabela_limpa = str(tabela_nome or "").strip()
        if not schema_limpo or not tabela_limpa:
            raise AtlasException("Schema e tabela são obrigatórios.")

        rows = repository.listar_colunas(schema_limpo, tabela_limpa)
        if not rows:
            raise NaoEncontradoException("Tabela não encontrada no banco selecionado.")

        return [
            ColunaTabela(
                ordinal=int(row[0]),
                nome=str(row[1] or "").strip(),
                tipo=str(row[2] or "").strip().lower(),
                aceita_nulo=bool(row[3]),
                identidade=bool(row[4]),
                calculada=bool(row[5]),
                possui_default=bool(row[6]),
                tamanho_maximo=int(row[7]) if row[7] is not None else None,
                precisao=int(row[8]) if row[8] is not None else None,
                escala=int(row[9]) if row[9] is not None else None,
            )
            for row in rows
        ]

    def _analisar_arquivo(self, arquivo: UploadFile, aba_nome: str | None = None) -> ArquivoAnalisado:
        nome_arquivo = str(arquivo.filename or "").strip()
        extensao = os.path.splitext(nome_arquivo)[1].lower()
        if extensao not in {".xlsx", ".csv", ".txt"}:
            raise AtlasException("Formato inválido. Use somente arquivos .xlsx, .csv ou .txt.")

        conteudo = arquivo.file.read()
        if not conteudo:
            raise AtlasException("Arquivo vazio.")

        if extensao == ".xlsx":
            return self._parse_xlsx(nome_arquivo, conteudo, aba_nome=aba_nome)
        return self._parse_delimited_text(nome_arquivo, conteudo, extensao)

    def _parse_xlsx(self, nome_arquivo: str, conteudo: bytes, aba_nome: str | None = None) -> ArquivoAnalisado:
        try:
            from openpyxl import load_workbook
        except ImportError as exc:
            raise AtlasException("Leitura de arquivos XLSX indisponível. Instale a dependência openpyxl.") from exc

        workbook = load_workbook(filename=io.BytesIO(conteudo), read_only=True, data_only=True)
        abas_disponiveis = list(workbook.sheetnames)
        if not abas_disponiveis:
            raise AtlasException("Arquivo XLSX sem abas disponíveis.")

        aba_escolhida = (aba_nome or "").strip() or self._resolver_aba_xlsx_padrao(workbook)
        if aba_escolhida not in abas_disponiveis:
            raise AtlasException("Aba informada não encontrada no arquivo.")

        worksheet = workbook[aba_escolhida]
        linhas_cruas = self._extrair_linhas_xlsx(worksheet)

        colunas, linhas = self._build_rows_from_matrix(linhas_cruas)
        return ArquivoAnalisado(
            nome_arquivo=nome_arquivo,
            tipo_arquivo=".xlsx",
            delimitador=None,
            abas_disponiveis=abas_disponiveis,
            aba_selecionada=aba_escolhida,
            colunas=colunas,
            linhas=linhas,
        )

    def _inspecionar_xlsx(self, nome_arquivo: str, conteudo: bytes) -> dict[str, object]:
        try:
            from openpyxl import load_workbook
        except ImportError as exc:
            raise AtlasException("Leitura de arquivos XLSX indisponível. Instale a dependência openpyxl.") from exc

        workbook = load_workbook(filename=io.BytesIO(conteudo), read_only=True, data_only=True)
        abas_disponiveis = list(workbook.sheetnames)
        if not abas_disponiveis:
            raise AtlasException("Arquivo XLSX sem abas disponíveis.")

        aba_padrao = self._resolver_aba_xlsx_padrao(workbook)
        total_colunas = 0
        total_linhas = 0
        if aba_padrao in workbook.sheetnames:
            try:
                colunas, linhas = self._build_rows_from_matrix(self._extrair_linhas_xlsx(workbook[aba_padrao]))
                total_colunas = len(colunas)
                total_linhas = len(linhas)
            except AtlasException:
                total_colunas = 0
                total_linhas = 0

        return {
            "status": "sucesso",
            "nome_arquivo": nome_arquivo,
            "tipo_arquivo": ".xlsx",
            "delimitador": None,
            "abas_disponiveis": abas_disponiveis,
            "aba_padrao": aba_padrao,
            "total_colunas": total_colunas,
            "total_linhas": total_linhas,
        }

    def _parse_delimited_text(self, nome_arquivo: str, conteudo: bytes, extensao: str) -> ArquivoAnalisado:
        texto = self._decode_text_bytes(conteudo)
        delimiter = self._detectar_delimitador(texto)
        reader = csv.reader(io.StringIO(texto), delimiter=delimiter)
        linhas_cruas = [(indice, list(row)) for indice, row in enumerate(reader, start=1)]
        colunas, linhas = self._build_rows_from_matrix(linhas_cruas)
        return ArquivoAnalisado(
            nome_arquivo=nome_arquivo,
            tipo_arquivo=extensao,
            delimitador=self._pretty_delimiter(delimiter),
            abas_disponiveis=[],
            aba_selecionada=None,
            colunas=colunas,
            linhas=linhas,
        )

    def _resolver_aba_xlsx_padrao(self, workbook) -> str:
        abas_disponiveis = list(workbook.sheetnames)
        if not abas_disponiveis:
            raise AtlasException("Arquivo XLSX sem abas disponíveis.")

        for aba in abas_disponiveis:
            try:
                self._build_rows_from_matrix(self._extrair_linhas_xlsx(workbook[aba]))
                return aba
            except AtlasException:
                continue
        return abas_disponiveis[0]

    def _extrair_linhas_xlsx(self, worksheet) -> list[tuple[int, list[Any]]]:
        linhas_cruas: list[tuple[int, list[Any]]] = []
        for indice, row in enumerate(worksheet.iter_rows(values_only=True), start=1):
            linhas_cruas.append((indice, list(row)))
        return linhas_cruas

    def _decode_text_bytes(self, conteudo: bytes) -> str:
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
            try:
                return conteudo.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise AtlasException("Não foi possível ler o arquivo texto com as codificações suportadas.")

    def _detectar_delimitador(self, texto: str) -> str:
        sample = "\n".join(texto.splitlines()[:10]).strip()
        if not sample:
            raise AtlasException("Arquivo texto vazio.")

        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|")
            return str(dialect.delimiter)
        except csv.Error:
            counts = {delimitador: sample.count(delimitador) for delimitador in (";", ",", "\t", "|")}
            melhor = max(counts.items(), key=lambda item: item[1])
            if melhor[1] <= 0:
                raise AtlasException("Não foi possível identificar o delimitador do arquivo. Use ;, , TAB ou |.")
            return melhor[0]

    def _build_rows_from_matrix(self, linhas_cruas: list[tuple[int, list[Any]]]) -> tuple[list[ArquivoColuna], list[LinhaArquivo]]:
        header_index = -1
        header_values: list[Any] | None = None
        for indice, valores in linhas_cruas:
            valores_limpos = self._trim_trailing_empty(valores)
            if self._row_has_content(valores_limpos):
                header_index = indice
                header_values = valores_limpos
                break

        if header_values is None:
            raise AtlasException("Não foi encontrada linha de cabeçalho no arquivo.")

        colunas = self._build_header_columns(header_values)
        linhas: list[LinhaArquivo] = []
        quantidade_colunas = len(colunas)
        for indice, valores in linhas_cruas:
            if indice <= header_index:
                continue
            valores_limpos = self._trim_trailing_empty(valores)
            if not self._row_has_content(valores_limpos):
                continue
            if len(valores_limpos) > quantidade_colunas:
                raise AtlasException(f"Linha {indice} possui mais colunas do que o cabeçalho.")

            preenchidos = list(valores_limpos) + [None] * (quantidade_colunas - len(valores_limpos))
            linhas.append(
                LinhaArquivo(
                    numero_origem=indice,
                    valores={coluna.nome: preenchidos[coluna.indice] for coluna in colunas},
                )
            )

        return colunas, linhas

    def _build_header_columns(self, header_values: list[Any]) -> list[ArquivoColuna]:
        nomes_vistos: dict[str, str] = {}
        colunas: list[ArquivoColuna] = []
        for indice, valor in enumerate(header_values):
            nome = str(valor or "").strip()
            if not nome:
                raise AtlasException("Cabeçalho inválido. Todas as colunas do arquivo precisam ter nome.")
            nome_normalizado = self._normalize_name(nome)
            if not nome_normalizado:
                raise AtlasException(f"Nome de coluna inválido no cabeçalho: {nome}")
            if nome_normalizado in nomes_vistos:
                raise AtlasException(
                    f"Cabeçalho inválido. As colunas '{nomes_vistos[nome_normalizado]}' e '{nome}' ficaram iguais após a normalização."
                )
            nomes_vistos[nome_normalizado] = nome
            colunas.append(ArquivoColuna(indice=indice, nome=nome, nome_normalizado=nome_normalizado))

        if not colunas:
            raise AtlasException("O arquivo precisa ter pelo menos uma coluna.")
        return colunas

    def _comparar_estrutura(self, arquivo: ArquivoAnalisado, colunas_tabela: list[ColunaTabela]) -> dict[str, object]:
        arquivo_por_normalizado = {coluna.nome_normalizado: coluna.nome for coluna in arquivo.colunas}
        tabela_por_normalizado = {self._normalize_name(coluna.nome): coluna for coluna in colunas_tabela if coluna.importavel}

        colunas_correspondentes: list[dict[str, str]] = []
        mapa_destino_origem: dict[str, str] = {}
        colunas_extras_arquivo: list[str] = []
        colunas_nao_suportadas: list[str] = []

        for coluna_arquivo in arquivo.colunas:
            coluna_tabela = tabela_por_normalizado.get(coluna_arquivo.nome_normalizado)
            if not coluna_tabela:
                colunas_extras_arquivo.append(coluna_arquivo.nome)
                continue
            if coluna_tabela.tipo in UNSUPPORTED_TYPES:
                colunas_nao_suportadas.append(coluna_tabela.nome)
                continue
            colunas_correspondentes.append({"origem": coluna_arquivo.nome, "destino": coluna_tabela.nome})
            mapa_destino_origem[coluna_tabela.nome] = coluna_arquivo.nome

        colunas_faltantes_tabela = [
            coluna.nome
            for coluna in colunas_tabela
            if coluna.obrigatoria and self._normalize_name(coluna.nome) not in arquivo_por_normalizado
        ]

        mensagens: list[str] = []
        pode_importar = True

        if not arquivo.linhas:
            mensagens.append("Arquivo sem linhas de dados para importar.")
            pode_importar = False
        if colunas_extras_arquivo:
            mensagens.append("O arquivo possui coluna(s) que não existem na tabela selecionada.")
            pode_importar = False
        if colunas_faltantes_tabela:
            mensagens.append("A tabela possui coluna(s) obrigatória(s) ausentes no arquivo.")
            pode_importar = False
        if colunas_nao_suportadas:
            mensagens.append("A tabela possui coluna(s) com tipo não suportado para essa importação.")
            pode_importar = False

        if pode_importar:
            mensagens.append("Estrutura válida. O arquivo pode ser importado na tabela selecionada.")

        return {
            "pode_importar": pode_importar,
            "mensagem": " ".join(mensagens).strip(),
            "colunas_correspondentes": colunas_correspondentes,
            "colunas_extras_arquivo": colunas_extras_arquivo,
            "colunas_faltantes_tabela": colunas_faltantes_tabela,
            "colunas_nao_suportadas": sorted(set(colunas_nao_suportadas)),
            "mapa_destino_origem": mapa_destino_origem,
        }

    def _coerce_value(self, value: Any, coluna: ColunaTabela, row_number: int) -> Any:
        if self._is_empty_value(value):
            if coluna.obrigatoria:
                raise AtlasException(f"Linha {row_number}: a coluna '{coluna.nome}' é obrigatória e não pode ficar vazia.")
            return None

        try:
            if coluna.tipo in STRING_TYPES:
                return str(value).strip()
            if coluna.tipo in INTEGER_TYPES:
                return self._coerce_integer(value)
            if coluna.tipo in DECIMAL_TYPES:
                return self._coerce_decimal(value)
            if coluna.tipo in FLOAT_TYPES:
                return float(self._coerce_decimal(value))
            if coluna.tipo in BOOLEAN_TYPES:
                return self._coerce_boolean(value)
            if coluna.tipo in DATE_TYPES:
                return self._coerce_date(value)
            if coluna.tipo in DATETIME_TYPES:
                return self._coerce_datetime(value)
            if coluna.tipo in TIME_TYPES:
                return self._coerce_time(value)
        except AtlasException:
            raise
        except Exception as exc:
            raise AtlasException(
                f"Linha {row_number}: não foi possível converter o valor '{value}' para a coluna '{coluna.nome}' ({coluna.tipo})."
            ) from exc

        return value

    def _coerce_integer(self, value: Any) -> int:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        numero = self._coerce_decimal(value)
        return int(numero)

    def _coerce_decimal(self, value: Any) -> Decimal:
        if isinstance(value, Decimal):
            return value
        if isinstance(value, int):
            return Decimal(value)
        if isinstance(value, float):
            return Decimal(str(value))
        texto = str(value).strip()
        if not texto:
            return Decimal(0)

        if "," in texto and "." in texto:
            if texto.rfind(",") > texto.rfind("."):
                texto = texto.replace(".", "").replace(",", ".")
            else:
                texto = texto.replace(",", "")
        elif "," in texto and texto.count(",") == 1 and texto.count(".") == 0:
            texto = texto.replace(",", ".")

        try:
            return Decimal(texto)
        except InvalidOperation as exc:
            raise AtlasException(f"Valor numérico inválido: {value}") from exc

    def _coerce_boolean(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        texto = str(value).strip().lower()
        if texto in {"1", "true", "t", "sim", "s", "yes", "y"}:
            return True
        if texto in {"0", "false", "f", "nao", "n", "no"}:
            return False
        raise AtlasException(f"Valor booleano inválido: {value}")

    def _coerce_date(self, value: Any) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        texto = str(value).strip()
        formatos = ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d")
        for formato in formatos:
            try:
                return datetime.strptime(texto, formato).date()
            except ValueError:
                continue
        raise AtlasException(f"Data inválida: {value}")

    def _coerce_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return datetime.combine(value, time.min)
        texto = str(value).strip()
        formatos = (
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y %H:%M",
            "%d/%m/%Y",
            "%Y-%m-%d",
        )
        for formato in formatos:
            try:
                return datetime.strptime(texto, formato)
            except ValueError:
                continue
        raise AtlasException(f"Data e hora inválida: {value}")

    def _coerce_time(self, value: Any) -> time:
        if isinstance(value, time):
            return value
        if isinstance(value, datetime):
            return value.time()
        texto = str(value).strip()
        formatos = ("%H:%M:%S", "%H:%M")
        for formato in formatos:
            try:
                return datetime.strptime(texto, formato).time()
            except ValueError:
                continue
        raise AtlasException(f"Hora inválida: {value}")

    def _normalize_name(self, value: str) -> str:
        texto = unicodedata.normalize("NFKD", str(value or ""))
        texto = "".join(char for char in texto if not unicodedata.combining(char))
        texto = texto.lower().strip()
        texto = re.sub(r"[^a-z0-9]+", "_", texto)
        return texto.strip("_")

    def _trim_trailing_empty(self, values: list[Any]) -> list[Any]:
        trimmed = list(values)
        while trimmed and self._is_empty_value(trimmed[-1]):
            trimmed.pop()
        return trimmed

    def _row_has_content(self, values: list[Any]) -> bool:
        return any(not self._is_empty_value(value) for value in values)

    def _is_empty_value(self, value: Any) -> bool:
        if value is None:
            return True
        if isinstance(value, str):
            return not value.strip()
        return False

    def _stringify_preview_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(value, date):
            return value.strftime("%Y-%m-%d")
        if isinstance(value, time):
            return value.strftime("%H:%M:%S")
        return str(value)

    def _stringify_import_value(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(value, date):
            return value.strftime("%Y-%m-%d")
        if isinstance(value, time):
            return value.strftime("%H:%M:%S")
        texto = str(value)
        return texto if texto != "" else None

    def _pretty_delimiter(self, delimiter: str) -> str:
        if delimiter == "\t":
            return "TAB"
        if delimiter == ";":
            return ";"
        if delimiter == ",":
            return ","
        if delimiter == "|":
            return "|"
        return delimiter
