from pydantic import BaseModel, Field

class WhatsappTemplateVariavel(BaseModel):
    indice: int = Field(gt=0)
    nome: str
    descricao: str | None = None
    exemplo: str | None = None


class WhatsappTemplateBotao(BaseModel):
    type: str
    text: str
    url: str | None = None
    phone_number: str | None = None
    example: list[str] | None = None


class CriarWhatsappTemplateRequest(BaseModel):
    nome_interno: str
    nome_template_meta: str
    idioma: str = "pt_BR"
    categoria_meta: str
    header_tipo: str | None = None
    header_texto: str | None = None
    body_texto: str
    footer_texto: str | None = None
    buttons_json: list[WhatsappTemplateBotao] | None = None
    componentes_json: dict | None = None
    variaveis_json: list[WhatsappTemplateVariavel] | None = None
    ativo: bool = True


class AtualizarWhatsappTemplateRequest(CriarWhatsappTemplateRequest):
    pass


class SubmeterWhatsappTemplateRequest(BaseModel):
    usuario_responsavel: str | None = None


class AtualizarAtivoWhatsappTemplateRequest(BaseModel):
    ativo: bool