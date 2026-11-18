from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse

from src.application.services.auth_service import AuthenticatedUser
from src.application.services.chamados_service import ChamadosService
from src.infrastructure.dependencies.access_groups import ADMIN_GROUPS, USERS_GROUPS
from src.infrastructure.dependencies.auth import get_current_user, require_any_group
from src.schemas.chamados import (
    AtualizarDemandaAreaRequest,
    AtualizarDemandaPlataformaRequest,
    AtualizarDemandaTipoSolicitacaoRequest,
    AtualizarChamadoRequest,
    ChamadoResponse,
    DemandaAreaRequest,
    DemandaAreaResponse,
    DemandaPlataformaRequest,
    DemandaPlataformaResponse,
    DemandaTipoSolicitacaoRequest,
    DemandaTipoSolicitacaoResponse,
    ListaChamadosResponse,
    ListaDemandasAreasResponse,
    ListaDemandasPlataformasResponse,
    ListaDemandasTipoSolicitacaoResponse,
    ResumoChamadosResponse,
)


router = APIRouter(
    prefix="/chamados",
    tags=["chamados"],
    dependencies=[Depends(require_any_group(*USERS_GROUPS))],
)

catalog_admin = require_any_group(*ADMIN_GROUPS)


@router.get("", response_model=ListaChamadosResponse, status_code=status.HTTP_200_OK)
def listar_chamados(
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ListaChamadosResponse:
    request.state.log_title = "Listagem de chamados"
    payload = ChamadosService().listar_chamados(current_user)
    return ListaChamadosResponse(
        itens=[ChamadoResponse(**item) for item in payload["itens"]],
        resumo=ResumoChamadosResponse(**payload["resumo"]),
        modo_gestao=bool(payload["modo_gestao"]),
    )


@router.get("/areas", response_model=ListaDemandasAreasResponse, status_code=status.HTTP_200_OK)
def listar_areas_chamado(request: Request) -> ListaDemandasAreasResponse:
    request.state.log_title = "Listagem de areas de demandas"
    itens = [DemandaAreaResponse(**item) for item in ChamadosService().listar_areas()]
    return ListaDemandasAreasResponse(itens=itens, total=len(itens))


@router.get("/areas/{area_id}", response_model=DemandaAreaResponse, status_code=status.HTTP_200_OK)
def buscar_area_chamado(area_id: int, request: Request) -> DemandaAreaResponse:
    request.state.log_title = "Detalhe de area de demanda"
    return DemandaAreaResponse(**ChamadosService().buscar_area(area_id))


@router.post("/areas", response_model=DemandaAreaResponse, status_code=status.HTTP_201_CREATED)
def criar_area_chamado(
    body: DemandaAreaRequest,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> DemandaAreaResponse:
    request.state.log_title = "Criacao de area de demanda"
    return DemandaAreaResponse(**ChamadosService().criar_area(body))


@router.patch("/areas/{area_id}", response_model=DemandaAreaResponse, status_code=status.HTTP_200_OK)
def atualizar_area_chamado(
    area_id: int,
    body: AtualizarDemandaAreaRequest,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> DemandaAreaResponse:
    request.state.log_title = "Atualizacao de area de demanda"
    return DemandaAreaResponse(**ChamadosService().atualizar_area(area_id, body.model_dump(exclude_unset=True)))


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_area_chamado(
    area_id: int,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> Response:
    request.state.log_title = "Exclusao de area de demanda"
    ChamadosService().excluir_area(area_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/plataformas", response_model=ListaDemandasPlataformasResponse, status_code=status.HTTP_200_OK)
def listar_plataformas_chamado(request: Request) -> ListaDemandasPlataformasResponse:
    request.state.log_title = "Listagem de plataformas de demandas"
    itens = [DemandaPlataformaResponse(**item) for item in ChamadosService().listar_plataformas()]
    return ListaDemandasPlataformasResponse(itens=itens, total=len(itens))


@router.get("/plataformas/{plataforma_id}", response_model=DemandaPlataformaResponse, status_code=status.HTTP_200_OK)
def buscar_plataforma_chamado(plataforma_id: int, request: Request) -> DemandaPlataformaResponse:
    request.state.log_title = "Detalhe de plataforma de demanda"
    return DemandaPlataformaResponse(**ChamadosService().buscar_plataforma(plataforma_id))


@router.post("/plataformas", response_model=DemandaPlataformaResponse, status_code=status.HTTP_201_CREATED)
def criar_plataforma_chamado(
    body: DemandaPlataformaRequest,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> DemandaPlataformaResponse:
    request.state.log_title = "Criacao de plataforma de demanda"
    return DemandaPlataformaResponse(**ChamadosService().criar_plataforma(body))


@router.patch("/plataformas/{plataforma_id}", response_model=DemandaPlataformaResponse, status_code=status.HTTP_200_OK)
def atualizar_plataforma_chamado(
    plataforma_id: int,
    body: AtualizarDemandaPlataformaRequest,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> DemandaPlataformaResponse:
    request.state.log_title = "Atualizacao de plataforma de demanda"
    return DemandaPlataformaResponse(
        **ChamadosService().atualizar_plataforma(plataforma_id, body.model_dump(exclude_unset=True))
    )


@router.delete("/plataformas/{plataforma_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_plataforma_chamado(
    plataforma_id: int,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> Response:
    request.state.log_title = "Exclusao de plataforma de demanda"
    ChamadosService().excluir_plataforma(plataforma_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/tipos-solicitacao",
    response_model=ListaDemandasTipoSolicitacaoResponse,
    status_code=status.HTTP_200_OK,
)
def listar_tipos_solicitacao_chamado(request: Request) -> ListaDemandasTipoSolicitacaoResponse:
    request.state.log_title = "Listagem de tipos de solicitacao de demandas"
    itens = [DemandaTipoSolicitacaoResponse(**item) for item in ChamadosService().listar_tipos_solicitacao()]
    return ListaDemandasTipoSolicitacaoResponse(itens=itens, total=len(itens))


@router.get(
    "/tipos-solicitacao/{tipo_solicitacao_id}",
    response_model=DemandaTipoSolicitacaoResponse,
    status_code=status.HTTP_200_OK,
)
def buscar_tipo_solicitacao_chamado(tipo_solicitacao_id: int, request: Request) -> DemandaTipoSolicitacaoResponse:
    request.state.log_title = "Detalhe de tipo de solicitacao de demanda"
    return DemandaTipoSolicitacaoResponse(**ChamadosService().buscar_tipo_solicitacao(tipo_solicitacao_id))


@router.post(
    "/tipos-solicitacao",
    response_model=DemandaTipoSolicitacaoResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_tipo_solicitacao_chamado(
    body: DemandaTipoSolicitacaoRequest,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> DemandaTipoSolicitacaoResponse:
    request.state.log_title = "Criacao de tipo de solicitacao de demanda"
    return DemandaTipoSolicitacaoResponse(**ChamadosService().criar_tipo_solicitacao(body))


@router.patch(
    "/tipos-solicitacao/{tipo_solicitacao_id}",
    response_model=DemandaTipoSolicitacaoResponse,
    status_code=status.HTTP_200_OK,
)
def atualizar_tipo_solicitacao_chamado(
    tipo_solicitacao_id: int,
    body: AtualizarDemandaTipoSolicitacaoRequest,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> DemandaTipoSolicitacaoResponse:
    request.state.log_title = "Atualizacao de tipo de solicitacao de demanda"
    return DemandaTipoSolicitacaoResponse(
        **ChamadosService().atualizar_tipo_solicitacao(
            tipo_solicitacao_id,
            body.model_dump(exclude_unset=True),
        )
    )


@router.delete("/tipos-solicitacao/{tipo_solicitacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_tipo_solicitacao_chamado(
    tipo_solicitacao_id: int,
    request: Request,
    _: AuthenticatedUser = Depends(catalog_admin),
) -> Response:
    request.state.log_title = "Exclusao de tipo de solicitacao de demanda"
    ChamadosService().excluir_tipo_solicitacao(tipo_solicitacao_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("", response_model=ChamadoResponse, status_code=status.HTTP_201_CREATED)
async def criar_chamado(
    request: Request,
    titulo: str = Form(...),
    descricao: str = Form(...),
    tipo_solicitacao: str = Form(...),
    prioridade: str = Form("medium"),
    evidencia: list[UploadFile] | None = File(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChamadoResponse:
    request.state.log_title = "Criacao de chamado"
    evidence_payload = {"data": None, "mime": None, "name": None, "size": None}
    if evidencia:
        arquivos = [item for item in evidencia if item]
        if len(arquivos) == 1:
            arquivo = arquivos[0]
            content = await arquivo.read()
            evidence_payload = {
                "data": content,
                "mime": arquivo.content_type or "application/octet-stream",
                "name": arquivo.filename or "evidencia",
                "size": len(content),
            }
        elif len(arquivos) > 1:
            zip_buffer = BytesIO()
            with ZipFile(zip_buffer, "w", compression=ZIP_DEFLATED) as zip_file:
                for index, arquivo in enumerate(arquivos, start=1):
                    content = await arquivo.read()
                    file_name = (arquivo.filename or f"evidencia-{index}").strip() or f"evidencia-{index}"
                    zip_file.writestr(file_name, content)
            zip_content = zip_buffer.getvalue()
            evidence_payload = {
                "data": zip_content,
                "mime": "application/zip",
                "name": "evidencias-chamado.zip",
                "size": len(zip_content),
            }
    item = ChamadosService().criar_chamado(current_user, titulo, descricao, tipo_solicitacao, prioridade, evidence_payload)
    return ChamadoResponse(**item)


@router.patch("/{chamado_id}", response_model=ChamadoResponse, status_code=status.HTTP_200_OK)
def atualizar_chamado(
    chamado_id: int,
    body: AtualizarChamadoRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChamadoResponse:
    request.state.log_title = "Atualizacao de chamado"
    item = ChamadosService().atualizar_chamado(chamado_id, current_user, body.model_dump(exclude_unset=True))
    return ChamadoResponse(**item)


@router.delete("/{chamado_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_chamado(
    chamado_id: int,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Response:
    request.state.log_title = "Exclusao de chamado"
    ChamadosService().excluir_chamado(chamado_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{chamado_id}/evidencia", status_code=status.HTTP_200_OK)
def obter_evidencia(
    chamado_id: int,
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    request.state.log_title = "Download de evidencia de chamado"
    evidence = ChamadosService().buscar_evidencia(chamado_id, current_user)
    filename = str(evidence.get("evidencia_nome") or "evidencia")
    media_type = str(evidence.get("evidencia_mime") or "application/octet-stream")
    return StreamingResponse(
        BytesIO(bytes(evidence.get("evidencia") or b"")),
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
