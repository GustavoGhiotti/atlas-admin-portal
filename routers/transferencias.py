"""Tela de Transferencia - configuracao do robo de organizacao de arquivos.

Escreve em TB_ARQUIVO_MAPA (DB_SFTP). A tela e dirigida por metadados: o endpoint
/metadados descreve as colunas reais da tabela e a UI se monta a partir dai, entao
uma coluna nova no robo (ex.: NOTIFICACAO) aparece sem mexer aqui.

O corpo de POST /mapas e um dict aberto de proposito - as chaves sao nomes de
coluna que variam com o schema. O service valida cada chave contra a lista viva de
colunas antes de gravar.
"""

from fastapi import APIRouter, Body, Depends, Request, status

from src.application.services.auth_service import AuthenticatedUser
from src.application.services.transferencias_service import TransferenciasService
from src.infrastructure.dependencies.access_groups import FILES_GROUPS
from src.infrastructure.dependencies.auth import require_any_group


router = APIRouter(
    prefix="/transferencias",
    tags=["transferencias"],
    dependencies=[Depends(require_any_group(*FILES_GROUPS))],
)


# ---------------------------------------------------------------------- leitura


@router.get("/metadados", status_code=status.HTTP_200_OK)
def obter_metadados(request: Request):
    request.state.log_title = "Transferencia - metadados do mapa"
    return TransferenciasService().listar_metadados()


@router.get("/mapas", status_code=status.HTTP_200_OK)
def listar_mapas(request: Request):
    request.state.log_title = "Transferencia - listar mapas"
    return {"itens": TransferenciasService().listar_mapas()}


# ---------------------------------------------------------------------- escrita


@router.post("/mapas", status_code=status.HTTP_200_OK)
def salvar_mapa(
    request: Request,
    dados: dict = Body(...),
    current_user: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
):
    identificador = dados.get("ID", dados.get("id"))
    acao = "atualizar" if identificador else "criar"
    request.state.log_title = f"Transferencia - {acao} mapa"
    TransferenciasService().salvar_mapa(dados)
    return {"status": "sucesso", "mensagem": "Registro salvo com sucesso."}


@router.patch("/mapas/{id_mapa}/ativo", status_code=status.HTTP_200_OK)
def alterar_ativo(
    id_mapa: int,
    request: Request,
    payload: dict = Body(...),
    current_user: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
):
    ativo = bool(payload.get("ativo"))
    request.state.log_title = f"Transferencia - {'ativar' if ativo else 'desativar'} mapa {id_mapa}"
    TransferenciasService().alterar_ativo(id_mapa, ativo)
    return {"status": "sucesso", "mensagem": "Situacao atualizada com sucesso."}
