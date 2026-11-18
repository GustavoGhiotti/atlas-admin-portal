from dataclasses import dataclass

from src.infrastructure.repositories.numeros_infobip_repository import NumerosInfobipRepository
from src.shared.exception import AtlasException


@dataclass(frozen=True)
class CarteiraPermitidaInfobip:
    id_cedente: int
    carteira: str
    valor: str


class NumerosInfobipService:
    def __init__(self) -> None:
        self.repository = NumerosInfobipRepository()

    def listar_numeros(self) -> dict[str, object]:
        rows = self.repository.listar_numeros()
        return {
            "status": "ok",
            "quantidade": len(rows),
            "numeros": [self._serialize_numero(row) for row in rows],
        }

    def listar_carteiras_permitidas(self) -> dict[str, object]:
        carteiras = self._listar_carteiras()
        return {
            "status": "ok",
            "quantidade": len(carteiras),
            "carteiras": [carteira.__dict__ for carteira in carteiras],
        }

    def atualizar_numero(self, id_registro: int, ativo: int, carteiras_permitidas: list[str]) -> dict[str, object]:
        if int(id_registro) <= 0:
            raise AtlasException("ID do registro invalido.")
        if int(ativo) not in (0, 1):
            raise AtlasException("Ativo deve ser 0 ou 1.")

        atual = self.repository.buscar_numero(int(id_registro))
        if not atual:
            raise AtlasException("Numero Infobip nao encontrado para atualizacao.")

        valores_validos = {carteira.valor for carteira in self._listar_carteiras()}
        valores_atuais = {
            item.strip()
            for item in str(atual[22] or "").split(";")
            if item.strip()
        }
        valores_normalizados: list[str] = []
        for valor in carteiras_permitidas:
            normalizado = str(valor or "").strip()
            if not normalizado:
                continue
            if normalizado not in valores_validos and normalizado not in valores_atuais:
                raise AtlasException(f"Carteira permitida invalida: {normalizado}.")
            if normalizado not in valores_normalizados:
                valores_normalizados.append(normalizado)

        if not valores_normalizados:
            raise AtlasException("Selecione ao menos uma carteira permitida.")

        atualizado = self.repository.atualizar_numero(
            id_registro=int(id_registro),
            ativo=int(ativo),
            carteiras_permitidas=";".join(valores_normalizados),
        )

        return {
            "status": "ok",
            "mensagem": "Numero Infobip atualizado com sucesso.",
            "numero": self._serialize_numero(atualizado),
        }

    def _listar_carteiras(self) -> list[CarteiraPermitidaInfobip]:
        rows = self.repository.listar_carteiras_permitidas()
        geral = CarteiraPermitidaInfobip(id_cedente=0, carteira="GERAL", valor="0:GERAL")
        carteiras: list[CarteiraPermitidaInfobip] = [geral]
        vistos: set[str] = {geral.valor}
        for row in rows:
            id_cedente = int(row[0] or 0)
            carteira = str(row[1] or "").strip()
            if id_cedente < 0 or not carteira:
                continue
            valor = f"{id_cedente}:{carteira}"
            if valor in vistos:
                continue
            vistos.add(valor)
            carteiras.append(CarteiraPermitidaInfobip(id_cedente=id_cedente, carteira=carteira, valor=valor))
        return carteiras

    def _serialize_numero(self, row) -> dict[str, object]:
        carteiras = str(row[22] or "")
        return {
            "id": int(row[0] or 0),
            "numero": str(row[1] or ""),
            "status": str(row[2] or ""),
            "data_consulta": self._fmt(row[3]) if row[3] else "",
            "id_cedente": int(row[4]) if row[4] is not None else None,
            "cedente": str(row[5] or ""),
            "service_sid": str(row[6] or ""),
            "fluxo": str(row[7] or ""),
            "canal": str(row[8] or ""),
            "numero_valido": bool(row[9]) if row[9] is not None else None,
            "pais": str(row[10] or ""),
            "formato_nacional": str(row[11] or ""),
            "nome_exibicao": str(row[12] or ""),
            "emissor_raw": str(row[13] or ""),
            "status_registro": str(row[14] or ""),
            "status_remetente": str(row[15] or ""),
            "limite_mensagens": str(row[16] or ""),
            "limite_mensagens_24h": int(row[17] or 0),
            "qualidade_raw": str(row[18] or ""),
            "provedor": str(row[19] or ""),
            "waba": str(row[20] or ""),
            "ativo": int(row[21] or 0),
            "carteiras_permitidas": carteiras,
            "carteiras_permitidas_lista": [item.strip() for item in carteiras.split(";") if item.strip()],
        }

    def _fmt(self, value) -> str:
        return value.isoformat(sep=" ") if hasattr(value, "isoformat") else str(value)
