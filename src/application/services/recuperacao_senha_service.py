import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from src.infrastructure.repositories import RecuperacaoSenhaRepository
from src.infrastructure.services.email_service import EmailService
from src.shared.exception import AtlasException, NaoEncontradoException


@dataclass
class PasswordResetRequestResponse:
    mensagem: str
    email_destino: str


@dataclass
class PasswordResetLookupResponse:
    mensagem: str
    nm_login: str
    email: str


@dataclass
class UserLookupResponse:
    mensagem: str
    nm_login: str
    email: str | None


class RecuperacaoSenhaService:
    def __init__(self) -> None:
        self.repository = RecuperacaoSenhaRepository()
        self.email_service = EmailService()
        self._tokens_path = Path("data/password_reset_tokens.json")
        self._token_ttl = timedelta(minutes=15)

    def solicitar_recuperacao_por_cpf(self, cpf_colaborador: str) -> PasswordResetRequestResponse:
        usuario = self._obter_usuario_recuperacao(cpf_colaborador)
        nm_login = usuario["nm_login"]
        nm_colaborador = usuario["nm_colaborador"]
        email = usuario["email"]

        token = self._gerar_token()
        self._salvar_token(
            cpf=cpf_colaborador,
            login=nm_login,
            email=email,
            token=token,
            expira_em=(datetime.utcnow() + self._token_ttl).isoformat(),
        )
        self.email_service.send_html(
            to_email=email,
            subject="Recuperacao de senha - Atlas",
            html=self._montar_email_recuperacao(nm_colaborador, token),
        )

        return PasswordResetRequestResponse(
            mensagem="Enviamos um token de recuperacao para o email cadastrado.",
            email_destino=email,
        )

    def consultar_recuperacao_por_cpf(self, cpf_colaborador: str) -> PasswordResetLookupResponse:
        usuario = self._obter_usuario_recuperacao(cpf_colaborador)
        return PasswordResetLookupResponse(
            mensagem="CPF localizado. Confirme os dados abaixo antes de enviar o token.",
            nm_login=usuario["nm_login"],
            email=usuario["email"],
        )

    def consultar_usuario_por_cpf(self, cpf_colaborador: str) -> UserLookupResponse:
        usuario = self._obter_usuario_consulta(cpf_colaborador)
        return UserLookupResponse(
            mensagem="CPF localizado. Confirme os dados abaixo para seguir com o acesso.",
            nm_login=usuario["nm_login"],
            email=usuario["email"] or None,
        )

    def redefinir_senha_com_token(
        self,
        cpf_colaborador: str,
        token: str,
        nova_senha: str,
        confirmacao_nova_senha: str,
    ) -> str:
        if nova_senha != confirmacao_nova_senha:
            raise AtlasException("As senhas digitadas precisam ser iguais.")
        self._validate_password_strength(nova_senha)

        registro = self._validar_token(cpf_colaborador, token)
        self.repository.redefinir_senha_por_cpf(cpf_colaborador, nova_senha)
        self._remover_token(cpf_colaborador)
        return f"Senha atualizada com sucesso para usuario: {registro['login']}."

    def _gerar_token(self) -> str:
        return "".join(secrets.choice("0123456789") for _ in range(6))

    def _obter_usuario_recuperacao(self, cpf_colaborador: str) -> dict[str, str]:
        usuario = self._obter_usuario_consulta(cpf_colaborador)
        email = str(usuario["email"] or "").strip().lower()
        if not email:
            raise AtlasException("Usuario sem email cadastrado. Procure um administrador para regularizar o acesso.")
        return {
            "nm_login": usuario["nm_login"],
            "nm_colaborador": usuario["nm_colaborador"],
            "email": email,
        }

    def _obter_usuario_consulta(self, cpf_colaborador: str) -> dict[str, str]:
        usuario = self.repository.buscar_usuario_por_cpf(cpf_colaborador)
        if not usuario:
            raise NaoEncontradoException("Falha ao localizar usuario.")

        nm_login = str(usuario[0][1] or "").strip()
        nm_colaborador = str(usuario[0][2] or "").strip().title()
        email = str(usuario[0][3] or "").strip().lower()

        return {
            "nm_login": nm_login,
            "nm_colaborador": nm_colaborador,
            "email": email,
        }

    def _montar_email_recuperacao(self, nome: str, token: str) -> str:
        return f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #111827;">
            <h2>Recuperacao de senha</h2>
            <p>Ola, {nome}.</p>
            <p>Use o token abaixo para redefinir sua senha no Atlas:</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">{token}</p>
            <p>Esse token expira em 15 minutos.</p>
          </body>
        </html>
        """

    def _validate_password_strength(self, password: str) -> None:
        if len(password) < 7:
            raise AtlasException("A senha digitada nao cumpre com os requisitos minimos.")

        digit_count = sum(char.isdigit() for char in password)
        special_count = sum(not char.isalnum() for char in password)
        if digit_count < 2 or special_count < 1 or (digit_count + special_count) < 2:
            raise AtlasException("A senha digitada nao cumpre com os requisitos minimos.")

    def _ler_tokens(self) -> dict[str, dict[str, str]]:
        if not self._tokens_path.exists():
            return {}
        try:
            conteudo = json.loads(self._tokens_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        return conteudo if isinstance(conteudo, dict) else {}

    def _salvar_tokens(self, tokens: dict[str, dict[str, str]]) -> None:
        self._tokens_path.parent.mkdir(parents=True, exist_ok=True)
        self._tokens_path.write_text(json.dumps(tokens, ensure_ascii=True, indent=2), encoding="utf-8")

    def _salvar_token(self, cpf: str, login: str, email: str, token: str, expira_em: str) -> None:
        tokens = self._ler_tokens()
        tokens[cpf] = {
            "login": login,
            "email": email,
            "token": token,
            "expira_em": expira_em,
        }
        self._salvar_tokens(tokens)

    def _validar_token(self, cpf: str, token: str) -> dict[str, str]:
        tokens = self._ler_tokens()
        registro = tokens.get(cpf)
        if not registro:
            raise AtlasException("Token de recuperacao invalido ou expirado.")

        expira_em = registro.get("expira_em", "")
        if not expira_em or datetime.utcnow() > datetime.fromisoformat(expira_em):
            self._remover_token(cpf)
            raise AtlasException("Token de recuperacao expirado.")

        if str(registro.get("token") or "").strip() != str(token or "").strip():
            raise AtlasException("Token de recuperacao invalido.")
        return registro

    def _remover_token(self, cpf: str) -> None:
        tokens = self._ler_tokens()
        if cpf in tokens:
            tokens.pop(cpf, None)
            self._salvar_tokens(tokens)
