from fastapi import APIRouter, Depends, Query, Request, status
from src.application.services.auth_service import AuthenticatedUser
from src.application.services.whatsapp_templates_service import WhatsappTemplatesService
from src.infrastructure.dependencies.access_groups import WHATSAPP_TEMPLATES_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.whatsapp_templates import (
    AtualizarWhatsappTemplateRequest,
    CriarWhatsappTemplateRequest,
    SubmeterWhatsappTemplateRequest,
    AtualizarAtivoWhatsappTemplateRequest,
)


router = APIRouter(
    prefix="/whatsapp/templates",
    tags=["whatsapp-templates"],
    dependencies=[Depends(require_any_group(*WHATSAPP_TEMPLATES_GROUPS))],
)


@router.get("", status_code=status.HTTP_200_OK)
def listar_templates(
    request: Request,
    filtro: str = Query(default="ativos")
):
    request.state.log_title = "Listagem de templates WhatsApp"
    return WhatsappTemplatesService().listar_templates(filtro=filtro)


@router.get("/{id_template}", status_code=status.HTTP_200_OK)
def detalhar_template(request: Request, id_template: int):
    request.state.log_title = "Detalhe de template WhatsApp"
    return WhatsappTemplatesService().detalhar_template(id_template)


@router.post("", status_code=status.HTTP_201_CREATED)
def criar_template(
    request: Request,
    payload: CriarWhatsappTemplateRequest,
    current_user: AuthenticatedUser = Depends(require_any_group(*WHATSAPP_TEMPLATES_GROUPS)),
):
    request.state.log_title = "Criacao de template WhatsApp"
    return WhatsappTemplatesService().criar_template(payload, current_user)


@router.put("/{id_template}", status_code=status.HTTP_200_OK)
def atualizar_template(
    request: Request,
    id_template: int,
    payload: AtualizarWhatsappTemplateRequest,
    current_user: AuthenticatedUser = Depends(require_any_group(*WHATSAPP_TEMPLATES_GROUPS)),
):
    request.state.log_title = "Atualizacao de template WhatsApp"
    return WhatsappTemplatesService().atualizar_template(id_template, payload, current_user)


@router.delete("/{id_template}", status_code=status.HTTP_200_OK)
def excluir_template(
    request: Request,
    id_template: int,
    current_user: AuthenticatedUser = Depends(require_any_group(*WHATSAPP_TEMPLATES_GROUPS)),
):
    request.state.log_title = "Exclusao de template WhatsApp"
    return WhatsappTemplatesService().excluir_template(id_template, current_user)


@router.post("/{id_template}/submeter-meta", status_code=status.HTTP_200_OK)
def submeter_template_meta(
    request: Request,
    id_template: int,
    payload: SubmeterWhatsappTemplateRequest | None = None,
    current_user: AuthenticatedUser = Depends(require_any_group(*WHATSAPP_TEMPLATES_GROUPS)),
):
    request.state.log_title = "Submissao de template WhatsApp para Meta"
    return WhatsappTemplatesService().submeter_template_meta(
        id_template=id_template,
        usuario_responsavel=payload.usuario_responsavel if payload else None,
        current_user=current_user,
    )


@router.patch("/{id_template}/ativo", status_code=status.HTTP_200_OK)
def atualizar_ativo_template(
    request: Request,
    id_template: int,
    payload: AtualizarAtivoWhatsappTemplateRequest,
    current_user: AuthenticatedUser = Depends(require_any_group(*WHATSAPP_TEMPLATES_GROUPS)),
):
    request.state.log_title = "Atualizacao de disponibilidade de template WhatsApp"
    return WhatsappTemplatesService().atualizar_ativo_template(
        id_template=id_template,
        ativo=payload.ativo,
        current_user=current_user,
    )