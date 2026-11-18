class AtlasException(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ConfiguracaoException(AtlasException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=500)


class IntegracaoException(AtlasException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=502)


class NaoEncontradoException(AtlasException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=404)
