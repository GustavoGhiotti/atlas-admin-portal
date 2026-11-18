from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from src.infrastructure.repositories.cargas_consulta_repository import CargasConsultaRepository
from src.infrastructure.repositories.cargas_recebimento_repository import CargasRecebimentoRepository
from src.infrastructure.services.logger_config import setup_logger


logger = setup_logger("atlas.cargas")


class CargasService:
    STATUS_MAP = {
        "NADA": "NADA",
        "AGUARDANDO": "AGUARDANDO",
        "ERRO": "ERRO",
        "EM ANDAMENTO": "EM ANDAMENTO",
        "PROCESSADO": "PROCESSADO",
    }

    def __init__(self) -> None:
        self._repository = CargasConsultaRepository()
        self._recebimento_repository = CargasRecebimentoRepository()
        self._refresh_lock = asyncio.Lock()
        self._started = False
        self._refresh_em_execucao = False
        self._ultimo_erro: str | None = None
        self._ultimo_refresh_por_data: dict[str, str] = {}
        self._cache_por_data: dict[str, list[dict[str, Any]]] = {}

    async def start(self) -> None:
        if self._started:
            return
        self._started = True

    async def stop(self) -> None:
        self._started = False

    async def listar_execucoes(
        self,
        tarefa: str | None = None,
        status: str | None = None,
        data_referencia: str | None = None,
    ) -> dict[str, Any]:
        data_consulta = data_referencia or self._today_iso()
        execucoes_base = self._cache_por_data.get(data_consulta, [])

        tarefa_norm = (tarefa or "").strip().lower()
        status_norm = (status or "").strip().upper()

        execucoes = execucoes_base
        if tarefa_norm:
            execucoes = [item for item in execucoes if tarefa_norm in str(item.get("origem", "")).lower()]
        if status_norm:
            execucoes = [item for item in execucoes if str(item.get("status", "")).upper() == status_norm]

        resumo: dict[str, int] = {label: 0 for label in self.STATUS_MAP.values()}
        for item in execucoes_base:
            status_item = str(item.get("status", "")).upper()
            if status_item in resumo:
                resumo[status_item] += 1

        return {
            "data_referencia": data_consulta,
            "atualizado_em": self._ultimo_refresh_por_data.get(data_consulta),
            "em_andamento": self._refresh_em_execucao,
            "ultimo_erro": self._ultimo_erro,
            "status_disponiveis": list(self.STATUS_MAP.values()),
            "resumo": resumo,
            "execucoes": execucoes,
        }

    async def refresh_today(self, force: bool = False, data_referencia: str | None = None) -> dict[str, Any]:
        async with self._refresh_lock:
            data_consulta = data_referencia or self._today_iso()
            ultimo_refresh = self._ultimo_refresh_por_data.get(data_consulta)
            if not force and ultimo_refresh:
                return await self.listar_execucoes(data_referencia=data_consulta)

            self._refresh_em_execucao = True
            try:
                execucoes = await asyncio.to_thread(self._consultar_banco, data_consulta)
                self._cache_por_data[data_consulta] = execucoes
                self._ultimo_refresh_por_data[data_consulta] = self._now_iso()
                self._ultimo_erro = None
                return await self.listar_execucoes(data_referencia=data_consulta)
            except Exception as exc:
                self._ultimo_erro = str(exc)
                logger.exception("Falha ao consultar cargas no servidor .65")
                raise
            finally:
                self._refresh_em_execucao = False

    async def listar_recebimentos(
        self,
        data_referencia: str | None = None,
        cedente: str | None = None,
    ) -> dict[str, Any]:
        data_consulta = data_referencia or self._today_iso()
        cedente_norm = (cedente or "").strip()
        rows = await asyncio.to_thread(self._recebimento_repository.listar_recebimentos, data_consulta, cedente_norm or None)
        cedentes = await asyncio.to_thread(self._recebimento_repository.listar_cedentes)

        recebimentos = [
            {
                "id": int(row[0] or 0),
                "id_cedente": int(row[1] or 0),
                "nm_cedente": str(row[2] or ""),
                "horario": row[3].strftime("%d/%m/%Y %H:%M:%S") if row[3] else "",
                "qtd_arquivos": int(row[4] or 0),
                "nm_arquivos": str(row[5] or ""),
                "tamanho": str(row[6] or ""),
            }
            for row in rows
        ]
        return {
            "data_referencia": data_consulta,
            "cedentes": [{"id": int(row[0] or 0), "nome": str(row[1] or "")} for row in cedentes],
            "resumo": {
                "total_recebimentos": len(recebimentos),
                "total_arquivos": sum(item["qtd_arquivos"] for item in recebimentos),
            },
            "recebimentos": recebimentos,
        }

    def _consultar_banco(self, data_referencia: str) -> list[dict[str, Any]]:
        rows = self._repository.listar_execucoes(data_referencia)
        return [
            {
                "id_carga": int(row[0] or 0),
                "origem": str(row[1] or ""),
                "remessa": str(row[2] or ""),
                "status": str(row[3] or "").upper(),
                "inicio": row[4].strftime("%d/%m/%Y %H:%M:%S") if row[4] else "",
                "fim": row[5].strftime("%d/%m/%Y %H:%M:%S") if row[5] else "",
                "arquivo": str(row[6] or ""),
            }
            for row in rows
        ]

    def _today_iso(self) -> str:
        return datetime.now().strftime("%Y-%m-%d")

    def _now_iso(self) -> str:
        return datetime.now().isoformat()

cargas_service = CargasService()
