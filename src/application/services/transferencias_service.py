"""Regra de negocio da tela de Transferencia (robo de organizacao de arquivos).

Le e grava TB_ARQUIVO_MAPA no DB_SFTP. O diferencial e ser DIRIGIDA POR METADADOS:
o formulario e o grid da tela sao montados a partir das colunas reais da tabela,
lidas do INFORMATION_SCHEMA. Quando o robo (incremental) ganha uma coluna nova, ela
aparece na tela sozinha - o tipo do campo e inferido do tipo SQL.

Este service faz tres coisas sobre os metadados:
  1. traduz cada coluna SQL em um descritor de UI (tipo de widget, obrigatorio, etc);
  2. normaliza os valores que chegam do formulario para o tipo do driver (bit -> 0/1,
     numero -> int, texto vazio -> NULL quando a coluna aceita nulo);
  3. filtra o que pode ser gravado (descarta identidade e colunas geridas pelo banco).
"""

from datetime import date, datetime

from src.infrastructure.repositories import TransferenciasRepository
from src.infrastructure.services.logger_config import setup_logger
from src.shared.exception import AtlasException


# Coluna que casa o mapa com o cedente. Recebe tratamento especial: em vez de um
# campo numerico solto, a tela mostra um combo com os cedentes de TB_CONEXAO_SFTP.
COLUNA_CEDENTE = "ID_CEDENTE"

TIPOS_INTEIROS = {"int", "bigint", "smallint", "tinyint"}
TIPOS_TEXTO = {"varchar", "nvarchar", "char", "nchar", "text", "ntext"}
TIPOS_DATA = {"date"}
TIPOS_DATAHORA = {"datetime", "datetime2", "smalldatetime", "datetimeoffset"}
TIPOS_DECIMAIS = {"decimal", "numeric", "float", "real", "money", "smallmoney"}


def _rotulo(coluna: str) -> str:
    """DESCRICAO -> "Descricao"; PADRAO_ARQUIVO -> "Padrao arquivo"."""
    return coluna.replace("_", " ").strip().capitalize()


def _default_automatico(default: str | None) -> bool:
    """Default que o banco preenche sozinho no tempo da linha (data/hora corrente)."""
    if not default:
        return False
    texto = default.upper()
    return "GETDATE" in texto or "SYSDATETIME" in texto or "SYSUTCDATETIME" in texto or "CURRENT_TIMESTAMP" in texto


def _default_bit(default: str | None) -> bool | None:
    """Le o default de uma coluna BIT ('((1))' -> True). Serve para o formulario
    ja abrir um registro novo com o mesmo padrao do banco (ATIVO on, etc)."""
    if not default:
        return None
    limpo = default.strip().strip("()").strip().lower()
    if limpo in ("1", "true"):
        return True
    if limpo in ("0", "false"):
        return False
    return None


class TransferenciasService:
    def __init__(self, repository: TransferenciasRepository | None = None) -> None:
        self.repository = repository or TransferenciasRepository()
        self.logger = setup_logger("atlas.transferencias")

    # ------------------------------------------------------------------ metadados

    def _descrever_coluna(self, row: tuple) -> dict:
        nome = str(row[0])
        data_type = str(row[1]).lower()
        max_length = int(row[2]) if row[2] is not None else None
        nullable = str(row[3]).upper() == "YES"
        default = row[4]
        is_identity = bool(row[5])

        somente_leitura = is_identity or _default_automatico(default)

        if nome.upper() == COLUNA_CEDENTE:
            tipo = "cedente"
        elif data_type == "bit":
            tipo = "toggle"
        elif data_type in TIPOS_INTEIROS:
            tipo = "numero"
        elif data_type in TIPOS_DECIMAIS:
            tipo = "decimal"
        elif data_type in TIPOS_DATA:
            tipo = "data"
        elif data_type in TIPOS_DATAHORA:
            tipo = "datahora"
        elif data_type in TIPOS_TEXTO:
            tipo = "textolongo" if (max_length is None or max_length < 0) else "texto"
        else:
            tipo = "texto"

        # Obrigatorio so quando o banco realmente exige um valor do usuario: NOT NULL,
        # sem default e nao gerido pelo banco. Assim ATIVO/SOMENTE_HOJE (NOT NULL com
        # default) nao travam o formulario.
        obrigatorio = (not nullable) and (default is None) and (not somente_leitura)

        return {
            "nome": nome,
            "label": _rotulo(nome),
            "tipo": tipo,
            "obrigatorio": obrigatorio,
            "somente_leitura": somente_leitura,
            "nullable": nullable,
            "max_length": None if (max_length is not None and max_length < 0) else max_length,
            "valor_padrao": _default_bit(default) if tipo == "toggle" else None,
        }

    def listar_metadados(self) -> dict:
        colunas = [self._descrever_coluna(row) for row in self.repository.listar_colunas_mapa()]
        cedentes = [
            {"id_cedente": int(row[0]), "nm_cedente": str(row[1])}
            for row in self.repository.listar_cedentes()
        ]
        return {"colunas": colunas, "cedentes": cedentes}

    # -------------------------------------------------------------------- leitura

    def listar_mapas(self) -> list[dict]:
        descritores = {d["nome"]: d for d in
                       [self._descrever_coluna(row) for row in self.repository.listar_colunas_mapa()]}
        itens: list[dict] = []
        for linha in self.repository.listar_mapas():
            item: dict = {}
            for chave, valor in linha.items():
                if chave == "__NM_CEDENTE":
                    item["nm_cedente"] = str(valor) if valor is not None else None
                    continue
                item[chave] = self._normalizar_saida(valor, descritores.get(chave))
            itens.append(item)
        return itens

    def _normalizar_saida(self, valor, descritor: dict | None):
        if valor is None:
            return None
        tipo = descritor["tipo"] if descritor else None
        if tipo == "toggle":
            return bool(valor)
        if isinstance(valor, (datetime, date)):
            return valor.isoformat()
        return valor

    # -------------------------------------------------------------------- escrita

    def salvar_mapa(self, dados: dict) -> None:
        colunas = [self._descrever_coluna(row) for row in self.repository.listar_colunas_mapa()]
        por_nome = {c["nome"]: c for c in colunas}

        # ID (identidade) define insert vs update, mas nunca e gravado.
        id_bruto = dados.get("ID", dados.get("id"))
        id_mapa = int(id_bruto) if id_bruto not in (None, "", 0, "0") else None

        graveis: dict = {}
        for nome, descritor in por_nome.items():
            if descritor["somente_leitura"]:
                continue  # ID, DT_CRIACAO e afins: o banco cuida
            if nome not in dados:
                continue  # coluna nao enviada: mantem valor atual (update) / default (insert)
            graveis[nome] = self._coagir_valor(dados[nome], descritor)

        # Obrigatorios so sao exigidos na criacao (no update o valor ja existe).
        if id_mapa is None:
            faltando = [
                c["label"] for c in colunas
                if c["obrigatorio"] and (c["nome"] not in graveis or graveis[c["nome"]] in (None, ""))
            ]
            if faltando:
                raise AtlasException("Preencha os campos obrigatorios: " + ", ".join(faltando) + ".")

        if not graveis:
            raise AtlasException("Nenhum campo para salvar.")

        try:
            self.repository.salvar_mapa(graveis, id_mapa)
        except AtlasException:
            raise
        except Exception as erro:  # erro de driver (FK, tipo, etc) -> mensagem legivel
            self.logger.exception("Falha ao salvar mapa de transferencia. id=%s", id_mapa)
            raise AtlasException(self._traduzir_erro_banco(erro)) from erro

    def _coagir_valor(self, valor, descritor: dict):
        tipo = descritor["tipo"]
        nullable = descritor["nullable"]

        if isinstance(valor, str):
            valor = valor.strip()
        if valor in (None, "") and tipo not in ("toggle",):
            return None if nullable else ("" if tipo in ("texto", "textolongo") else None)

        if tipo == "toggle":
            return 1 if valor in (True, 1, "1", "true", "True", "on") else 0
        if tipo in ("numero", "cedente"):
            try:
                return int(valor)
            except (TypeError, ValueError):
                raise AtlasException(f"O campo {descritor['label']} deve ser um numero inteiro.")
        if tipo == "decimal":
            try:
                return float(valor)
            except (TypeError, ValueError):
                raise AtlasException(f"O campo {descritor['label']} deve ser numerico.")
        # texto / data / datahora seguem como string (o driver converte a data)
        return valor

    def _traduzir_erro_banco(self, erro: Exception) -> str:
        texto = str(erro).upper()
        if "FK_MAPA_CEDENTE" in texto or "FOREIGN KEY" in texto or "REFERENCE" in texto:
            return "Cedente invalido: selecione um cedente cadastrado em TB_CONEXAO_SFTP."
        if "CANNOT INSERT THE VALUE NULL" in texto or "NULL VALUE" in texto:
            return "Um campo obrigatorio ficou vazio. Revise o formulario."
        return "Nao foi possivel salvar o registro. Verifique os dados e tente novamente."

    def alterar_ativo(self, id_mapa: int, ativo: bool) -> None:
        try:
            self.repository.alterar_ativo(id_mapa, ativo)
        except Exception as erro:
            self.logger.exception("Falha ao alterar ATIVO do mapa %s", id_mapa)
            raise AtlasException("Nao foi possivel alterar a situacao do registro.") from erro
