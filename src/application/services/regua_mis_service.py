from __future__ import annotations

from src.infrastructure.repositories.regua_carteira_repository import (
    ReguaCarteiraRepository,
)
from src.infrastructure.services.logger_config import setup_logger


class ReguaMISService:
    def __init__(self) -> None:
        self.repository = ReguaCarteiraRepository()
        self.logger = setup_logger("atlas.regua-mis")

    def listar(self) -> dict[str, object]:
        try:
            rows = self.repository.listar()

            carteiras = [
                self._mapear_carteira(row)
                for row in rows
                if row
            ]

            return {
                "status": "sucesso",
                "quantidade": len(carteiras),
                "carteiras": carteiras,
            }

        except Exception:
            self.logger.exception("Falha ao listar carteiras da Regua MIS.")

            return {
                "status": "erro",
                "quantidade": 0,
                "carteiras": [],
            }

    def atualizar(self, id_carteira: int, dias_abertura: int) -> dict[str, object]:
        try:
            self._validar_atualizacao(
                id_carteira=id_carteira,
                dias_abertura=dias_abertura,
            )

            self.repository.atualizar(
                dias_abertura=dias_abertura,
                id_carteira=id_carteira,
            )

            return {
                "status": "sucesso",
                "mensagem": "Carteira atualizada com sucesso.",
                "id_carteira": id_carteira,
                "dias_abertura": dias_abertura,
            }

        except ValueError as exc:
            return {
                "status": "erro",
                "mensagem": str(exc),
                "id_carteira": id_carteira,
                "dias_abertura": dias_abertura,
            }

        except Exception:
            self.logger.exception(
                "Falha ao atualizar Regua MIS. id_carteira=%s dias_abertura=%s",
                id_carteira,
                dias_abertura,
            )

            return {
                "status": "erro",
                "mensagem": "Nao foi possivel atualizar os dias de abertura.",
                "id_carteira": id_carteira,
                "dias_abertura": dias_abertura,
            }

    def _validar_atualizacao(self, id_carteira: int, dias_abertura: int) -> None:
        if id_carteira <= 0:
            raise ValueError("ID da carteira deve ser maior que zero.")

        if dias_abertura < 0:
            raise ValueError("Dias de abertura nao pode ser negativo.")

    def _mapear_carteira(self, row: tuple) -> dict[str, object]:
        return {
            "ID_CARTEIRA": int(row[0] or 0),
            "NOME_CARTEIRA": str(row[1] or "").strip(),
            "DIAS_ABERTURA": int(row[2] or 0),
        }
