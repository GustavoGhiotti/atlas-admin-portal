import uvicorn
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path

from contextlib import asynccontextmanager

from routers import alteracoes_colaboradores, arquivos, auth, banco_imagens, chamados, cargas, controle_tarefas, desbloqueio, email_sendgrid, gestao_usuario, importacao_banco, numeros_infobip, portalacordo_config, portalacordo_monitoramento, rcs_infobip, sms_infobip, transferencias, usuarios_operacional, whatsapp, whatsapp_templates, regua_mis, processos, treinamentos
from routers import agenda, alteracoes_colaboradores, arquivos, auth, banco_imagens, chamados, cargas, controle_tarefas, desbloqueio, email_sendgrid, gestao_usuario, importacao_banco, sms_infobip, usuarios_operacional, whatsapp
from src.application.services.cargas_service import cargas_service
from src.application.services.gestao_usuario_sync_service import gestao_usuario_sync_service
from src.infrastructure.middleware.logging import LoggingMiddleware
from src.infrastructure.services.audit_logger import audit_logger
from src.infrastructure.services.logger_config import setup_logger
from src.shared.handlers import register_exception_handlers


logger = setup_logger("atlas")

@asynccontextmanager
async def lifespan(_: FastAPI):
    await cargas_service.start()
    await gestao_usuario_sync_service.start()
    try:
        yield
    finally:
        await cargas_service.stop()
        await gestao_usuario_sync_service.stop()
        # Esvazia a fila de auditoria (ate 5s) antes de encerrar, sem travar o restart.
        audit_logger.flush(timeout=5.0)


app = FastAPI(
    title="Atlas",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware, logger=logger)

register_exception_handlers(app)

frontend_dist_dir = Path("frontend/dist")
frontend_assets_dir = frontend_dist_dir / "assets"
frontend_index = frontend_dist_dir / "index.html"
frontend_public_dir = Path("frontend/public")
if frontend_assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_assets_dir)), name="frontend-assets")

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(desbloqueio.router)
api_router.include_router(arquivos.router)
api_router.include_router(transferencias.router)
api_router.include_router(banco_imagens.router)
api_router.include_router(sms_infobip.router)
api_router.include_router(rcs_infobip.router)
api_router.include_router(email_sendgrid.router)
api_router.include_router(whatsapp.router)
api_router.include_router(numeros_infobip.router)
api_router.include_router(alteracoes_colaboradores.router)
api_router.include_router(gestao_usuario.router)
api_router.include_router(cargas.router)
api_router.include_router(usuarios_operacional.router)
api_router.include_router(controle_tarefas.router)
api_router.include_router(importacao_banco.router)
api_router.include_router(chamados.router)
api_router.include_router(regua_mis.router)
api_router.include_router(whatsapp_templates.router)
api_router.include_router(agenda.router)
api_router.include_router(processos.router)
api_router.include_router(treinamentos.router)
api_router.include_router(portalacordo_monitoramento.router)
api_router.include_router(portalacordo_config.router)


@api_router.get("/status", tags=["status"])
def api_status() -> dict[str, str]:
    return {"status": "online", "aplicacao": "atlas"}


app.include_router(api_router)


def frontend_file_response(*candidates: Path) -> FileResponse:
    for candidate in candidates:
        if candidate.exists():
            return FileResponse(candidate)
    raise HTTPException(status_code=404, detail="Arquivo do frontend nao encontrado.")


@app.get("/")
def root_redirect():
    if frontend_index.exists():
        return FileResponse(frontend_index)
    raise HTTPException(status_code=404, detail="Build do frontend nao encontrado.")


@app.get("/favicon.png")
def favicon_png():
    return frontend_file_response(frontend_dist_dir / "favicon.png", frontend_public_dir / "favicon.png")


@app.get("/favicon.svg")
def favicon_svg():
    return frontend_file_response(frontend_dist_dir / "favicon.svg", frontend_public_dir / "favicon.svg")


@app.get("/modelo_admissoes_treinamentos.xlsx")
def modelo_admissoes_treinamentos():
    for candidate in (
        frontend_dist_dir / "modelo_admissoes_treinamentos.xlsx",
        frontend_public_dir / "modelo_admissoes_treinamentos.xlsx",
    ):
        if candidate.exists():
            return FileResponse(
                candidate,
                filename="modelo_admissoes_treinamentos.xlsx",
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
    raise HTTPException(status_code=404, detail="Modelo de admissões não encontrado.")


@app.get("/modelo_importacao_treinamentos.xlsx")
def modelo_importacao_treinamentos():
    for candidate in (
        frontend_dist_dir / "modelo_importacao_treinamentos.xlsx",
        frontend_public_dir / "modelo_importacao_treinamentos.xlsx",
    ):
        if candidate.exists():
            return FileResponse(
                candidate,
                filename="modelo_importacao_treinamentos.xlsx",
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
    raise HTTPException(status_code=404, detail="Modelo de treinamentos não encontrado.")


@app.get("/login")
def login_redirect():
    if frontend_index.exists():
        return FileResponse(frontend_index)
    raise HTTPException(status_code=404, detail="Build do frontend nao encontrado.")


@app.get("/logout")
def logout_redirect():
    return RedirectResponse(url="/login", status_code=302)


@app.get("/atualizarSenha")
def atualizar_senha_redirect():
    return RedirectResponse(url="/login", status_code=302)


@app.get("/portal")
@app.get("/portal/{full_path:path}")
def portal_redirect(full_path: str = ""):
    return RedirectResponse(url="/", status_code=302)


@app.api_route("/api/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
def api_not_found(full_path: str = ""):
    raise HTTPException(status_code=404, detail=f"Endpoint de API nao encontrado: /api/{full_path}")


@app.get("/{full_path:path}")
def react_app(full_path: str = ""):
    if frontend_index.exists():
        return FileResponse(frontend_index)
    raise HTTPException(status_code=404, detail="Build do frontend nao encontrado.")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="localhost",
        port=8000,
        reload=True,
        server_header=False,
    )
