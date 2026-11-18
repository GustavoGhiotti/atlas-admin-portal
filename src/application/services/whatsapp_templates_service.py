from src.application.services.auth_service import AuthenticatedUser
from src.schemas.whatsapp_templates import AtualizarWhatsappTemplateRequest, CriarWhatsappTemplateRequest
from src.infrastructure.external.api_sistema_acme.client import ApiSistemaAcmeClient

class WhatsappTemplatesService:
    def __init__(self) -> None:
        self.client = ApiSistemaAcmeClient()

    def listar_templates(self, *, filtro: str | None = None) -> dict:
        return self.client.listar_templates(filtro=filtro)

    def detalhar_template(self, id_template: int) -> dict:
        return self.client.detalhar_template(id_template)

    def criar_template(self, payload: CriarWhatsappTemplateRequest, current_user: AuthenticatedUser) -> dict:
        dados = payload.model_dump(exclude_none=True)
        dados["criado_por"] = current_user.nm_login
        dados["origem_cadastro"] = "ATLAS"
        return self.client.criar_template(dados)

    def atualizar_template(
        self,
        id_template: int,
        payload: AtualizarWhatsappTemplateRequest,
        current_user: AuthenticatedUser,
    ) -> dict:
        dados = payload.model_dump(exclude_none=True)
        dados["criado_por"] = current_user.nm_login
        dados["origem_cadastro"] = "ATLAS"
        return self.client.atualizar_template(id_template, dados)

    def excluir_template(self, id_template: int, current_user: AuthenticatedUser) -> dict:
        return self.client.excluir_template(
            id_template,
            usuario_responsavel=current_user.nm_login,
        )

    def submeter_template_meta(
        self,
        id_template: int,
        usuario_responsavel: str | None,
        current_user: AuthenticatedUser,
    ) -> dict:
        responsavel = usuario_responsavel or current_user.nm_login
        return self.client.submeter_template_meta(
            id_template,
            usuario_responsavel=responsavel,
        )
    
    def atualizar_ativo_template(
        self,
        id_template: int,
        ativo: bool,
        current_user: AuthenticatedUser,
    ) -> dict:
        return self.client.atualizar_ativo_template(
            id_template,
            ativo=ativo,
            usuario_responsavel=current_user.nm_login,
        )
