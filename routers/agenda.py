from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status

from src.application.services.agenda_service import AgendaService
from src.application.services.auth_service import AuthenticatedUser
from src.infrastructure.dependencies.access_groups import AGENDA_GROUPS
from src.infrastructure.dependencies.auth import get_current_user, require_any_group
from src.schemas.agenda import (
    AgendaAtaEmailRequest,
    AgendaCarteiraResponse,
    AgendaPendenciaAbertaResponse,
    AgendaRequest,
    AgendaResponse,
)
from src.shared.exception import AtlasException


router = APIRouter(
    prefix="/agenda",
    tags=["agenda"],
    dependencies=[Depends(require_any_group(*AGENDA_GROUPS))],
)


@router.get("/notas", response_model=list[AgendaResponse], status_code=status.HTTP_200_OK)
def listar_agendamentos(
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> list[AgendaResponse]:
    request.state.log_title = "Listagem de agendamentos"
    return [AgendaResponse(**item) for item in AgendaService().listar()]


@router.get("/carteiras", response_model=list[AgendaCarteiraResponse], status_code=status.HTTP_200_OK)
def listar_carteiras(
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> list[AgendaCarteiraResponse]:
    request.state.log_title = "Listagem de carteiras da agenda"
    return [AgendaCarteiraResponse(**item) for item in AgendaService().listar_carteiras()]


@router.get(
    "/pendencias-abertas",
    response_model=list[AgendaPendenciaAbertaResponse],
    status_code=status.HTTP_200_OK,
)
def listar_pendencias_abertas(
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> list[AgendaPendenciaAbertaResponse]:
    request.state.log_title = "Listagem de pendencias abertas da agenda"
    return [
        AgendaPendenciaAbertaResponse(**item)
        for item in AgendaService().listar_pendencias_abertas_usuario(current_user.nm_login)
    ]


@router.post("/notas", response_model=AgendaResponse, status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    body: AgendaRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AgendaResponse:
    request.state.log_title = "Criacao de agendamento"
    return AgendaResponse(**AgendaService().criar(body, current_user.nm_login))


@router.put("/notas/{agenda_id}", response_model=AgendaResponse, status_code=status.HTTP_200_OK)
def atualizar_agendamento(
    agenda_id: int,
    body: AgendaRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AgendaResponse:
    request.state.log_title = "Atualizacao de agendamento"
    return AgendaResponse(**AgendaService().atualizar(agenda_id, body, current_user.nm_login))


@router.delete("/notas/{agenda_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_agendamento(
    agenda_id: int,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Response:
    request.state.log_title = "Exclusao de agendamento"
    AgendaService().excluir(agenda_id, current_user.nm_login)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/notas/{agenda_id}/pendencias/{pendencia_id}/resolver",
    response_model=AgendaResponse,
    status_code=status.HTTP_200_OK,
)
def resolver_pendencia_agendamento(
    agenda_id: int,
    pendencia_id: int,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AgendaResponse:
    request.state.log_title = "Resolucao de pendencia de agendamento"
    return AgendaResponse(**AgendaService().resolver_pendencia(agenda_id, pendencia_id, current_user.nm_login))


@router.post("/notas/{agenda_id}/enviar-ata", status_code=status.HTTP_200_OK)
async def enviar_ata_agendamento(
    agenda_id: int,
    request: Request,
    html: str = Form(...),
    destinatarios: str | None = Form(default=None),
    pdf_ata: UploadFile | None = File(default=None),
    arquivos: list[UploadFile] | None = File(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, object]:
    request.state.log_title = "Envio de ATA de agendamento"
    anexos_extras = []
    pdf_ata_bytes = None
    if pdf_ata is not None:
        pdf_ata_bytes = await pdf_ata.read()
        await pdf_ata.close()
        if pdf_ata_bytes and len(pdf_ata_bytes) > 20 * 1024 * 1024:
            raise AtlasException("O PDF da ATA deve ter no maximo 20 MB.")

    for arquivo in arquivos or []:
        content = await arquivo.read()
        if not content:
            continue
        if len(content) > 10 * 1024 * 1024:
            raise AtlasException("Cada anexo complementar deve ter no maximo 10 MB.")
        content_type = arquivo.content_type or "application/octet-stream"
        maintype, _, subtype = content_type.partition("/")
        anexos_extras.append(
            {
                "filename": arquivo.filename or "anexo",
                "content": content,
                "maintype": maintype or "application",
                "subtype": subtype or "octet-stream",
            }
        )
        await arquivo.close()
    if len(anexos_extras) > 5:
        raise AtlasException("Envie no maximo 5 anexos complementares.")

    return await AgendaService().enviar_ata_por_email(
        agenda_id,
        html,
        current_user.nm_login,
        anexos_extras,
        pdf_ata_bytes or None,
        destinatarios,
    )


@router.post("/notas/{agenda_id}/ata-pdf", status_code=status.HTTP_200_OK)
def gerar_pdf_ata_agendamento(
    agenda_id: int,
    body: AgendaAtaEmailRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Response:
    request.state.log_title = "Geracao de PDF da ATA"
    pdf = AgendaService().gerar_pdf_ata(agenda_id, body.html)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ata-reuniao-{agenda_id}.pdf"'},
    )


@router.post("/relatorio-pdf", status_code=status.HTTP_200_OK)
def gerar_pdf_relatorio_agenda(
    body: AgendaAtaEmailRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Response:
    request.state.log_title = "Geracao de PDF do relatorio de visitas"
    pdf = AgendaService().gerar_pdf_relatorio(body.html)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="relatorio-visitas.pdf"'},
    )
