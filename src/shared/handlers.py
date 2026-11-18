from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.infrastructure.services.logger_config import setup_logger
from src.shared.exception import AtlasException


logger = setup_logger("atlas.exceptions")
GENERIC_SUPPORT_MESSAGE = (
    "Ocorreu um erro interno ao processar a solicitacao. "
    "Entre em contato com o time de infraestrutura."
)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AtlasException)
    async def handle_atlas_exception(request: Request, exc: AtlasException) -> JSONResponse:
        if exc.status_code >= 500:
            logger.exception(
                "Erro de aplicacao tratado. metodo=%s path=%s status_code=%s detalhe=%s",
                request.method,
                request.url.path,
                exc.status_code,
                exc.message,
                exc_info=exc,
            )
            # Guarda o resumo do erro no state para o middleware gravar em ATLAS.ERRO
            request.state.erro_tipo = type(exc).__name__
            request.state.erro_resumo = exc.message
            message = GENERIC_SUPPORT_MESSAGE
        else:
            message = exc.message

        return JSONResponse(
            status_code=exc.status_code,
            content={"status": "erro", "mensagem": message},
        )

    @app.exception_handler(Exception)
    async def handle_generic_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Erro nao tratado. metodo=%s path=%s",
            request.method,
            request.url.path,
            exc_info=exc,
        )
        # Guarda o resumo do erro no state para o middleware gravar em ATLAS.ERRO
        request.state.erro_tipo = type(exc).__name__
        request.state.erro_resumo = str(exc)
        return JSONResponse(
            status_code=500,
            content={"status": "erro", "mensagem": GENERIC_SUPPORT_MESSAGE},
        )
