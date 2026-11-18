import os

from dotenv import load_dotenv

from src.shared.exception import ConfiguracaoException


load_dotenv()


def get_env(name: str, default: str | None = None, required: bool = False) -> str | None:
    value = os.getenv(name, default)
    if required and not value:
        raise ConfiguracaoException(f"Variavel de ambiente obrigatoria nao definida: {name}")
    return value
