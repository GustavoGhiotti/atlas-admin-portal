from datetime import datetime, timedelta, timezone

import jwt

from src.infrastructure.services.env_load import get_env
from src.shared.exception import AtlasException, ConfiguracaoException


class TokenService:
    def __init__(self) -> None:
        self.secret = get_env("JWT_SECRET_KEY", required=True)
        self.algorithm = "HS256"
        self.expiration_hours = 8

    def create(self, payload: dict) -> str:
        expires_at = self.now_utc() + timedelta(hours=self.expiration_hours)
        token_payload = {**payload, "exp": expires_at}
        return jwt.encode(token_payload, self.secret, algorithm=self.algorithm)

    def now_utc(self) -> datetime:
        return datetime.now(timezone.utc)

    def now(self) -> datetime:
        return datetime.now()

    def decode(self, token: str) -> dict:
        try:
            return jwt.decode(token, self.secret, algorithms=[self.algorithm])
        except jwt.ExpiredSignatureError as exc:
            raise AtlasException("Sessao expirada. Faca login novamente.", status_code=401) from exc
        except jwt.InvalidTokenError as exc:
            raise AtlasException("Token de autenticacao invalido.", status_code=401) from exc
