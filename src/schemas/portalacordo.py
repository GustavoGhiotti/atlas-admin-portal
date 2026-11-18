"""Contratos de escrita da configuracao do Portal Acordo.

Cada regra aqui espelha um CHECK CONSTRAINT real do schema [cfg]. Como o Atlas
grava por SQL direto, sem passar pela API do Portal Acordo, esses validadores sao
o que separa o gestor de um erro de driver cru vindo do SQL Server.

Os padroes foram extraidos das constraints em producao:
    CK_CFG_LP_SLUG          SLUG        so [a-z0-9-], 2 a 60
    CK_CFG_CARTEIRA_CODIGO  CODIGO      so [A-Za-z0-9_ -], nao vazio
    CK_CFG_MAILING_PREFIXO  PREFIXO     so [A-Za-z0-9_], nao vazio
    CK_CFG_MAILING_CAMPANHA CAMPANHA    nulo ou [A-Za-z0-9_ -]
    CK_CFG_NUM_DIGITOS      NUMERO      so digitos, 10 a 15
    CK_CFG_LP_WHATSAPP      WHATSAPP    nulo ou so digitos, 10 a 15
    CK_CFG_LP_IMG_LOGO      IMAGEM      comeca em /images/ e nao contem ..
    CK_CFG_LP_LOGO_CLASS    LOGO_CLASS  sem " ' < > & CR LF TAB
    CK_CFG_NUM_CANAL        CANAL       WHATSAPP | TELEFONE
    CK_CFG_NUM_ESCOPO       ESCOPO      GLOBAL | CARTEIRA
    CK_CFG_NUM_COERENCIA    ESCOPO x ID_CARTEIRA
    CK_CFG_ALIAS_TIPO       TIPO_MATCH  EXATO | CONTEM
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


# O $ aqui e seguro: o Pydantic v2 valida com o motor de regex do Rust, onde $ casa
# apenas no fim do texto. (No modulo `re` do Python o $ tambem casaria ANTES de um \n
# final - por isso nao vale testar estes padroes com re.match e concluir dali.)
PADRAO_SLUG = r"^[a-z0-9-]{2,60}$"
PADRAO_CODIGO = r"^[A-Za-z0-9_ -]{1,60}$"
PADRAO_PREFIXO = r"^[A-Za-z0-9_]{1,60}$"
PADRAO_CAMPANHA = r"^[A-Za-z0-9_ -]{1,60}$"
PADRAO_NUMERO = r"^[0-9]{10,15}$"
PADRAO_IMAGEM = r"^/images/[A-Za-z0-9 ._/-]{1,240}$"
PADRAO_LOGO_CLASS = r"^[^\"'<>&\r\n\t]{0,120}$"

MAX_ITENS_FAQ = 20


def _vazio_para_nulo(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpo = valor.strip()
    return limpo or None


def _exigir_conteudo(valor: str, campo: str) -> str:
    """Os CHECK do banco usam LEN() > 0, e LEN() no SQL Server ignora espaco a direita:
    "   " tem LEN 0. Sem podar aqui, um campo so com espacos passa no Pydantic e estoura
    a constraint no meio do batch, virando 500 em vez de mensagem util."""
    limpo = valor.strip()
    if not limpo:
        raise ValueError(f"{campo} nao pode ser vazio nem conter apenas espacos.")
    return limpo


class CarteiraPayload(BaseModel):
    # id identifica a linha quando o gestor esta EDITANDO. Sem ele, alterar o campo-chave
    # na tela faria o upsert nao encontrar a linha e criar uma duplicata.
    id: int | None = Field(default=None, ge=1)
    codigo: str = Field(pattern=PADRAO_CODIGO)
    nome: str = Field(min_length=1, max_length=120)
    id_cedente: int | None = Field(default=None, ge=0)
    ativo: bool = True

    @field_validator("codigo")
    @classmethod
    def _codigo_com_conteudo(cls, valor: str) -> str:
        return _exigir_conteudo(valor, "Codigo")

    @field_validator("nome")
    @classmethod
    def _nome_com_conteudo(cls, valor: str) -> str:
        return _exigir_conteudo(valor, "Nome")


class AliasPayload(BaseModel):
    id: int | None = Field(default=None, ge=1)
    alias: str = Field(min_length=1, max_length=120)
    carteira: str = Field(pattern=PADRAO_CODIGO)
    tipo_match: Literal["EXATO", "CONTEM"] = "EXATO"
    prioridade: int = Field(default=100, ge=0, le=9999)
    ativo: bool = True

    @field_validator("alias")
    @classmethod
    def _alias_nao_vazio(cls, valor: str) -> str:
        return _exigir_conteudo(valor, "Alias")


class MailingPayload(BaseModel):
    id: int | None = Field(default=None, ge=1)
    carteira: str = Field(pattern=PADRAO_CODIGO)
    prefixo: str = Field(pattern=PADRAO_PREFIXO)
    campanha: str | None = Field(default=None, pattern=PADRAO_CAMPANHA)
    observacao: str | None = Field(default=None, max_length=300)
    ativo: bool = True

    @field_validator("campanha", "observacao", mode="before")
    @classmethod
    def _normaliza_opcionais(cls, valor):
        return _vazio_para_nulo(valor) if isinstance(valor, str) else valor


class NumeroContatoPayload(BaseModel):
    id: int | None = Field(default=None, ge=1)
    canal: Literal["WHATSAPP", "TELEFONE"] = "WHATSAPP"
    escopo: Literal["GLOBAL", "CARTEIRA"] = "GLOBAL"
    carteira: str | None = Field(default=None, pattern=PADRAO_CODIGO)
    numero: str = Field(pattern=PADRAO_NUMERO)
    rotulo: str | None = Field(default=None, max_length=120)
    prioridade: int = Field(default=100, ge=0, le=9999)
    ativo: bool = True

    @field_validator("carteira", "rotulo", mode="before")
    @classmethod
    def _normaliza_opcionais(cls, valor):
        return _vazio_para_nulo(valor) if isinstance(valor, str) else valor

    @model_validator(mode="after")
    def _coerencia_escopo(self):
        # Espelha CK_CFG_NUM_COERENCIA. Sem isso o INSERT falha no banco com erro
        # de constraint, que nao diz ao gestor qual campo esta errado.
        if self.escopo == "CARTEIRA" and not self.carteira:
            raise ValueError("Escopo CARTEIRA exige uma carteira.")
        if self.escopo == "GLOBAL" and self.carteira:
            raise ValueError("Escopo GLOBAL nao aceita carteira.")
        return self


class FaqItemPayload(BaseModel):
    pergunta: str = Field(min_length=1, max_length=300)
    resposta: str = Field(min_length=1, max_length=1000)
    ativo: bool = True

    @field_validator("pergunta")
    @classmethod
    def _pergunta_com_conteudo(cls, valor: str) -> str:
        return _exigir_conteudo(valor, "Pergunta")

    @field_validator("resposta")
    @classmethod
    def _resposta_com_conteudo(cls, valor: str) -> str:
        return _exigir_conteudo(valor, "Resposta")


class LandingPagePayload(BaseModel):
    id: int | None = Field(default=None, ge=1)
    slug: str = Field(pattern=PADRAO_SLUG)
    carteira: str | None = Field(default=None, pattern=PADRAO_CODIGO)
    nome_cliente: str = Field(min_length=1, max_length=120)
    numero_whatsapp: str | None = Field(default=None, pattern=PADRAO_NUMERO)
    imagem_logo: str = Field(pattern=PADRAO_IMAGEM)
    imagem_fundo: str = Field(default="/images/image 26.png", pattern=PADRAO_IMAGEM)
    logo_class: str | None = Field(default=None, pattern=PADRAO_LOGO_CLASS)
    logo_class_home: str | None = Field(default=None, pattern=PADRAO_LOGO_CLASS)
    titulo: str | None = Field(default=None, max_length=200)
    subtitulo: str | None = Field(default=None, max_length=300)
    ordem: int = Field(default=100, ge=0, le=9999)
    ativo: bool = True
    exibir_na_home: bool = True
    # None mantem o FAQ atual; [] apaga todas as perguntas. A tela so envia a chave
    # quando o gestor abriu a secao de FAQ, para que "nao mexi" nunca vire "esvaziei".
    faq: list[FaqItemPayload] | None = None

    @field_validator("carteira", "numero_whatsapp", "logo_class", "logo_class_home", "titulo", "subtitulo", mode="before")
    @classmethod
    def _normaliza_opcionais(cls, valor):
        return _vazio_para_nulo(valor) if isinstance(valor, str) else valor

    @field_validator("nome_cliente")
    @classmethod
    def _nome_com_conteudo(cls, valor: str) -> str:
        return _exigir_conteudo(valor, "Nome do cliente")

    @field_validator("imagem_logo", "imagem_fundo")
    @classmethod
    def _sem_travessia(cls, valor: str) -> str:
        # Espelha a segunda metade de CK_CFG_LP_IMG_LOGO / _IMG_FUNDO.
        if ".." in valor:
            raise ValueError("Caminho de imagem nao pode conter '..'.")
        return valor

    @field_validator("faq")
    @classmethod
    def _limite_faq(cls, valor: list[FaqItemPayload] | None) -> list[FaqItemPayload] | None:
        if valor is not None and len(valor) > MAX_ITENS_FAQ:
            raise ValueError(f"O FAQ aceita no maximo {MAX_ITENS_FAQ} perguntas.")
        return valor


class SituacaoLandingPayload(BaseModel):
    ativo: bool | None = None
    exibir_na_home: bool | None = None

    @model_validator(mode="after")
    def _ao_menos_um(self):
        if self.ativo is None and self.exibir_na_home is None:
            raise ValueError("Informe ativo, exibir_na_home ou ambos.")
        return self
