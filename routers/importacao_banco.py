from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status

from src.application.services.auth_service import AuthenticatedUser
from src.application.services.importacao_banco_service import ImportacaoBancoService
from src.infrastructure.dependencies.access_groups import FILES_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.importacao_banco import (
    AnaliseImportacaoBancoResponse,
    ConfiguracaoImportacaoBancoResponse,
    ImportacaoBancoResponse,
    InspecaoImportacaoBancoResponse,
    ListaBancosServidorResponse,
    ListaTabelasBancoResponse,
)


router = APIRouter(
    prefix="/importacao-banco",
    tags=["importacao-banco"],
    dependencies=[Depends(require_any_group(*FILES_GROUPS))],
)


@router.get("/config", response_model=ConfiguracaoImportacaoBancoResponse, status_code=status.HTTP_200_OK)
def listar_configuracao(request: Request) -> ConfiguracaoImportacaoBancoResponse:
    request.state.log_title = "Configuracao de importacao para banco"
    return ConfiguracaoImportacaoBancoResponse.model_validate(ImportacaoBancoService().listar_destinos())


@router.get("/bancos", response_model=ListaBancosServidorResponse, status_code=status.HTTP_200_OK)
def listar_bancos(
    request: Request,
    servidor: str = Query(...),
) -> ListaBancosServidorResponse:
    request.state.log_title = "Listagem de bancos SQL"
    return ListaBancosServidorResponse.model_validate(ImportacaoBancoService().listar_bancos(servidor=servidor))


@router.get("/tabelas", response_model=ListaTabelasBancoResponse, status_code=status.HTTP_200_OK)
def listar_tabelas(
    request: Request,
    servidor: str = Query(...),
    banco: str = Query(...),
) -> ListaTabelasBancoResponse:
    request.state.log_title = "Listagem de tabelas SQL"
    return ListaTabelasBancoResponse.model_validate(ImportacaoBancoService().listar_tabelas(servidor=servidor, banco=banco))


@router.post("/inspecionar", response_model=InspecaoImportacaoBancoResponse, status_code=status.HTTP_200_OK)
def inspecionar_documento(
    request: Request,
    arquivo: UploadFile = File(...),
) -> InspecaoImportacaoBancoResponse:
    request.state.log_title = "Inspecao de documento SQL"
    return InspecaoImportacaoBancoResponse.model_validate(ImportacaoBancoService().inspecionar_documento(arquivo=arquivo))


@router.post("/analisar", response_model=AnaliseImportacaoBancoResponse, status_code=status.HTTP_200_OK)
def analisar_documento(
    request: Request,
    arquivo: UploadFile = File(...),
    servidor: str = Form(...),
    banco: str = Form(...),
    schema_nome: str = Form(...),
    tabela_nome: str = Form(...),
    aba_nome: str | None = Form(default=None),
) -> AnaliseImportacaoBancoResponse:
    request.state.log_title = "Analise de importacao SQL"
    return AnaliseImportacaoBancoResponse.model_validate(
        ImportacaoBancoService().analisar_documento(
            arquivo=arquivo,
            servidor=servidor,
            banco=banco,
            schema_nome=schema_nome,
            tabela_nome=tabela_nome,
            aba_nome=aba_nome,
        )
    )


@router.post("/analisar-bulk", response_model=AnaliseImportacaoBancoResponse, status_code=status.HTTP_200_OK)
def analisar_documento_bulk(
    request: Request,
    arquivo: UploadFile = File(...),
    servidor: str = Form(...),
    banco: str = Form(...),
    aba_nome: str | None = Form(default=None),
) -> AnaliseImportacaoBancoResponse:
    request.state.log_title = "Analise de importacao SQL bulk"
    return AnaliseImportacaoBancoResponse.model_validate(
        ImportacaoBancoService().analisar_documento_bulk(
            arquivo=arquivo,
            servidor=servidor,
            banco=banco,
            aba_nome=aba_nome,
        )
    )


@router.post("/importar", response_model=ImportacaoBancoResponse, status_code=status.HTTP_201_CREATED)
def importar_documento(
    request: Request,
    arquivo: UploadFile = File(...),
    servidor: str = Form(...),
    banco: str = Form(...),
    schema_nome: str = Form(...),
    tabela_nome: str = Form(...),
    aba_nome: str | None = Form(default=None),
    current_user: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
) -> ImportacaoBancoResponse:
    request.state.log_title = "Importacao SQL"
    host_origem = request.client.host if request.client else current_user.host
    return ImportacaoBancoResponse.model_validate(
        ImportacaoBancoService().importar_documento(
            arquivo=arquivo,
            servidor=servidor,
            banco=banco,
            schema_nome=schema_nome,
            tabela_nome=tabela_nome,
            aba_nome=aba_nome,
            current_user=current_user,
            host_origem=host_origem,
        )
    )


@router.post("/importar-bulk", response_model=ImportacaoBancoResponse, status_code=status.HTTP_201_CREATED)
def importar_documento_bulk(
    request: Request,
    arquivo: UploadFile = File(...),
    servidor: str = Form(...),
    banco: str = Form(...),
    aba_nome: str | None = Form(default=None),
    current_user: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
) -> ImportacaoBancoResponse:
    request.state.log_title = "Importacao SQL bulk"
    host_origem = request.client.host if request.client else current_user.host
    return ImportacaoBancoResponse.model_validate(
        ImportacaoBancoService().importar_documento_bulk(
            arquivo=arquivo,
            servidor=servidor,
            banco=banco,
            aba_nome=aba_nome,
            current_user=current_user,
            host_origem=host_origem,
        )
    )
