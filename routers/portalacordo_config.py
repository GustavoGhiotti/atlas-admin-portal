from fastapi import APIRouter, Depends, Query, Request, status

from src.application.services.auth_service import AuthenticatedUser
from src.application.services.portalacordo_config_service import PortalAcordoConfigService
from src.infrastructure.dependencies.access_groups import PORTALACORDO_CONFIG_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.portalacordo import (
    AliasPayload,
    CarteiraPayload,
    LandingPagePayload,
    MailingPayload,
    NumeroContatoPayload,
    SituacaoLandingPayload,
)


# Grupo mais restrito que o dos dashboards: aqui se altera a configuracao que o
# portal do Portal Acordo serve em producao.
router = APIRouter(
    prefix="/portalacordo/config",
    tags=["portalacordo-config"],
    dependencies=[Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS))],
)


def _origem(request: Request) -> str | None:
    return request.client.host if request.client else None


# ---------------------------------------------------------------------- leitura


@router.get("/carteiras")
def listar_carteiras():
    return {"itens": PortalAcordoConfigService().listar_carteiras()}


@router.get("/landing-pages")
def listar_landing_pages():
    return {"itens": PortalAcordoConfigService().listar_landing_pages()}


@router.get("/landing-pages/{slug}/faq")
def listar_faq(slug: str):
    return {"itens": PortalAcordoConfigService().listar_faq(slug)}


@router.get("/mailings")
def listar_mailings():
    return {"itens": PortalAcordoConfigService().listar_mailings()}


@router.get("/numeros-contato")
def listar_numeros():
    return {"itens": PortalAcordoConfigService().listar_numeros()}


@router.get("/aliases")
def listar_aliases():
    return {"itens": PortalAcordoConfigService().listar_aliases()}


@router.get("/imagens")
def listar_imagens():
    return {"itens": PortalAcordoConfigService().listar_imagens()}


@router.get("/auditoria")
def listar_auditoria(
    entidade: str | None = Query(default=None),
    limite: int = Query(default=100, ge=1, le=500),
):
    return {"itens": PortalAcordoConfigService().listar_auditoria(entidade, limite)}


# ---------------------------------------------------------------------- escrita


@router.post("/carteiras", status_code=status.HTTP_200_OK)
def salvar_carteira(
    payload: CarteiraPayload,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS)),
):
    request.state.log_title = f"Portal Acordo - salvar carteira {payload.codigo}"
    return PortalAcordoConfigService().salvar_carteira(payload, current_user.nm_login, _origem(request))


@router.post("/aliases", status_code=status.HTTP_200_OK)
def salvar_alias(
    payload: AliasPayload,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS)),
):
    request.state.log_title = f"Portal Acordo - salvar alias {payload.alias}"
    return PortalAcordoConfigService().salvar_alias(payload, current_user.nm_login, _origem(request))


@router.post("/mailings", status_code=status.HTTP_200_OK)
def salvar_mailing(
    payload: MailingPayload,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS)),
):
    request.state.log_title = f"Portal Acordo - salvar mailing {payload.carteira}"
    return PortalAcordoConfigService().salvar_mailing(payload, current_user.nm_login, _origem(request))


@router.post("/numeros-contato", status_code=status.HTTP_200_OK)
def salvar_numero(
    payload: NumeroContatoPayload,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS)),
):
    request.state.log_title = f"Portal Acordo - salvar numero {payload.numero}"
    return PortalAcordoConfigService().salvar_numero(payload, current_user.nm_login, _origem(request))


@router.post("/landing-pages", status_code=status.HTTP_200_OK)
def salvar_landing(
    payload: LandingPagePayload,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS)),
):
    request.state.log_title = f"Portal Acordo - salvar landing {payload.slug}"
    return PortalAcordoConfigService().salvar_landing(payload, current_user.nm_login, _origem(request))


@router.patch("/landing-pages/{slug}/situacao", status_code=status.HTTP_200_OK)
def alterar_situacao_landing(
    slug: str,
    payload: SituacaoLandingPayload,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS)),
):
    request.state.log_title = f"Portal Acordo - situacao da landing {slug}"
    return PortalAcordoConfigService().alterar_situacao_landing(
        slug, payload, current_user.nm_login, _origem(request)
    )


@router.delete("/landing-pages/{slug}", status_code=status.HTTP_200_OK)
def excluir_landing(
    slug: str,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_any_group(*PORTALACORDO_CONFIG_GROUPS)),
):
    request.state.log_title = f"Portal Acordo - excluir landing {slug}"
    return PortalAcordoConfigService().excluir_landing(
        slug, current_user.nm_login, _origem(request)
    )
