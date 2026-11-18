from dataclasses import dataclass
import json
from pathlib import Path

from src.infrastructure.repositories import AlteracoesColaboradoresRepository
from src.infrastructure.services.env_load import get_env
from src.shared.exception import AtlasException, NaoEncontradoException


@dataclass
class ColaboradorAlteracao:
    colaborador: str
    cpf: str
    funcao: str
    id_centro_custo: str
    centro_custo: str
    centro_custo_2: str


@dataclass
class ColaboradorCarteiraOperacional:
    colaborador: str
    cpf: str
    funcao: str
    id_centro_custo: str
    centro_custo: str
    centro_custo_2: str


class AlteracoesColaboradoresService:
    def __init__(self) -> None:
        self.repository = AlteracoesColaboradoresRepository()
        self._centros_temporarios_path = Path("data/centros_custo_temporarios.json")

    def buscar_colaborador(self, cpf: str) -> ColaboradorAlteracao:
        cpf_limpo = self._limpar_cpf(cpf)
        row = self.repository.buscar_colaborador_por_cpf(cpf_limpo)
        if not row:
            raise NaoEncontradoException("Colaborador nao encontrado.")

        return ColaboradorAlteracao(
            colaborador=(row[0] or "").strip(),
            cpf=(row[1] or "").strip(),
            funcao=(row[2] or "").strip(),
            id_centro_custo=(row[3] or "").strip(),
            centro_custo=(row[4] or "").strip(),
            centro_custo_2=(row[5] or "").strip(),
        )

    def atualizar_colaborador(
        self,
        cpf: str,
        funcao: str,
        id_centro_custo: str,
        centro_custo: str,
        centro_custo_2: str | None,
        user_atualizacao: str,
    ) -> str:
        atual = self.buscar_colaborador(cpf)
        if not funcao.strip() or not id_centro_custo.strip() or not centro_custo.strip():
            raise AtlasException("Funcao, ID Centro de Custo e Centro de Custo sao obrigatorios.")
        if not user_atualizacao.strip():
            raise AtlasException("Responsavel obrigatorio.")
        if id_centro_custo.strip() == "1011-2" and not (centro_custo_2 or "").strip():
            raise AtlasException("Carteira atual obrigatoria para o centro de custo 1011-2.")

        centro_custo_2_final = (centro_custo_2 or "").strip() or None
        self.repository.atualizar_colaborador(
            atual.cpf,
            funcao.strip(),
            id_centro_custo.strip(),
            centro_custo.strip(),
            centro_custo_2_final,
            user_atualizacao.strip(),
        )
        self.repository.registrar_log_alteracao(
            atual.cpf,
            atual.colaborador,
            atual.funcao,
            funcao.strip(),
            atual.id_centro_custo,
            id_centro_custo.strip(),
            atual.centro_custo,
            centro_custo.strip(),
            centro_custo_2_final,
            user_atualizacao.strip(),
        )
        return "Colaborador atualizado com sucesso."

    def listar_centros_custo(self) -> list[dict[str, str]]:
        rows = self.repository.listar_centros_custo()
        centros_base = [
            {
                "id_centro_custo": (row[0] or "").strip(),
                "centro_custo": (row[1] or "").strip(),
            }
            for row in rows
        ]
        centros_unicos: dict[str, dict[str, str]] = {
            item["id_centro_custo"]: item for item in centros_base if item["id_centro_custo"]
        }
        if self._cadastro_temporario_habilitado():
            extras = self._listar_centros_custo_temporarios()
            for item in extras:
                centros_unicos[item["id_centro_custo"]] = item
        else:
            self._remover_centros_custo_temporarios()
        return sorted(centros_unicos.values(), key=lambda item: item["id_centro_custo"])

    def listar_centros_custo_operacional(self) -> list[dict[str, str]]:
        rows = self.repository.listar_centros_custo_operacional()
        return [
            {
                "id_centro_custo": (row[0] or "").strip(),
                "centro_custo": (row[1] or "").strip(),
            }
            for row in rows
            if (row[0] or "").strip() and (row[1] or "").strip()
        ]

    def listar_funcoes(self) -> list[str]:
        rows = self.repository.listar_funcoes()
        return [(row[0] or "").strip() for row in rows if (row[0] or "").strip()]

    def listar_colaboradores_vega_operacional(self) -> list[ColaboradorCarteiraOperacional]:
        rows = self.repository.listar_colaboradores_vega_operacional()
        return [
            ColaboradorCarteiraOperacional(
                colaborador=(row[0] or "").strip(),
                cpf=(row[1] or "").strip(),
                funcao=(row[2] or "").strip(),
                id_centro_custo=(row[3] or "").strip(),
                centro_custo=(row[4] or "").strip(),
                centro_custo_2=(row[5] or "").strip(),
            )
            for row in rows
        ]

    def atualizar_centro_custo_2_operacional(self, cpf: str, centro_custo_2: str, responsavel: str) -> str:
        cpf_limpo = self._limpar_cpf(cpf)
        responsavel_limpo = str(responsavel or "").strip()
        centro_custo_2_limpo = str(centro_custo_2 or "").strip()

        if len(cpf_limpo) != 11:
            raise AtlasException("CPF invalido.")
        if not centro_custo_2_limpo:
            raise AtlasException("Novo centro de custo 2 obrigatorio.")
        if not responsavel_limpo:
            raise AtlasException("Responsavel obrigatorio.")

        colaborador = self.buscar_colaborador(cpf_limpo)
        if colaborador.id_centro_custo != "1011-2" or colaborador.centro_custo.strip().upper() != "VEGA":
            raise AtlasException("Colaborador fora da base operacional permitida.")

        self.repository.atualizar_centro_custo_2_operacional(cpf_limpo, centro_custo_2_limpo, responsavel_limpo)
        self.repository.registrar_log_alteracao(
            colaborador.cpf,
            colaborador.colaborador,
            colaborador.funcao,
            colaborador.funcao,
            colaborador.id_centro_custo,
            colaborador.id_centro_custo,
            colaborador.centro_custo,
            colaborador.centro_custo,
            centro_custo_2_limpo,
            responsavel_limpo,
        )
        return "Centro de custo 2 atualizado com sucesso."

    def obter_configuracao(self) -> dict[str, bool]:
        habilitado = self._cadastro_temporario_habilitado()
        if not habilitado:
            self._remover_centros_custo_temporarios()
        return {
            "cadastro_centro_custo_temporario_habilitado": habilitado,
        }

    def criar_centro_custo_temporario(self, id_centro_custo: str, centro_custo: str, responsavel: str) -> dict[str, str]:
        if not self._cadastro_temporario_habilitado():
            raise AtlasException("Cadastro temporario de centro de custo desabilitado.")

        id_limpo = str(id_centro_custo or "").strip()
        centro_limpo = str(centro_custo or "").strip()
        responsavel_limpo = str(responsavel or "").strip()
        if not id_limpo or not centro_limpo:
            raise AtlasException("ID Centro de Custo e Centro de Custo sao obrigatorios.")
        if not responsavel_limpo:
            raise AtlasException("Responsavel obrigatorio.")

        centros_existentes = {item["id_centro_custo"] for item in self.listar_centros_custo()}
        if id_limpo in centros_existentes:
            raise AtlasException("Ja existe um centro de custo com esse ID.")

        registros = self._ler_centros_custo_temporarios()
        registros.append(
            {
                "id_centro_custo": id_limpo,
                "centro_custo": centro_limpo,
                "responsavel": responsavel_limpo,
            }
        )
        self._salvar_centros_custo_temporarios(registros)
        return {
            "id_centro_custo": id_limpo,
            "centro_custo": centro_limpo,
            "mensagem": "Centro de custo temporario criado com sucesso.",
        }

    def obter_status_sincronia(self) -> int:
        row = self.repository.buscar_status_sincronia()
        return int(row[0]) if row and row[0] is not None else 0

    def atualizar_status_sincronia(self, status: int) -> dict[str, object]:
        if status not in (0, 1):
            raise AtlasException("Status invalido.")
        self.repository.atualizar_status_sincronia(status)
        if status == 0:
            self._remover_centros_custo_temporarios()
        self.repository.executar_proc_batimento()
        return {"status": "ok", "novo_status": status}

    def atualizar_em_lote(
        self,
        cpfs: list[str],
        funcao: str,
        id_centro_custo: str,
        centro_custo: str,
        centro_custo_2: str | None,
        responsavel: str,
    ) -> dict[str, object]:
        cpfs_limpos = [self._limpar_cpf(cpf) for cpf in cpfs]
        cpfs_validos = [cpf for cpf in cpfs_limpos if len(cpf) == 11]
        if not cpfs_validos:
            raise AtlasException("Nenhum CPF valido enviado.")
        if not funcao.strip() or not id_centro_custo.strip() or not centro_custo.strip():
            raise AtlasException("Funcao, ID Centro de Custo e Centro de Custo sao obrigatorios.")
        if not responsavel.strip():
            raise AtlasException("Responsavel obrigatorio.")

        processados: list[str] = []
        nao_encontrados: list[str] = []
        falhas: list[dict[str, str]] = []

        for cpf in cpfs_validos:
            try:
                self.atualizar_colaborador(
                    cpf=cpf,
                    funcao=funcao,
                    id_centro_custo=id_centro_custo,
                    centro_custo=centro_custo,
                    centro_custo_2=centro_custo_2,
                    user_atualizacao=responsavel,
                )
                processados.append(cpf)
            except NaoEncontradoException:
                nao_encontrados.append(cpf)
            except Exception as exc:
                falhas.append({"cpf": cpf, "erro": str(exc)})

        return {
            "sucesso": True,
            "total_recebidos": len(cpfs_validos),
            "processados": processados,
            "nao_encontrados": nao_encontrados,
            "falhas": falhas,
            "total_processados": len(processados),
        }

    def _limpar_cpf(self, cpf: str) -> str:
        return "".join(ch for ch in str(cpf or "") if ch.isdigit()).strip()

    def _cadastro_temporario_habilitado(self) -> bool:
        raw_value = (get_env("ALTERACOES_CC_TEMP_ENABLED", default="0") or "0").strip().lower()
        return raw_value in {"1", "true", "yes", "on"}

    def _listar_centros_custo_temporarios(self) -> list[dict[str, str]]:
        return [
            {
                "id_centro_custo": str(item.get("id_centro_custo") or "").strip(),
                "centro_custo": str(item.get("centro_custo") or "").strip(),
            }
            for item in self._ler_centros_custo_temporarios()
            if str(item.get("id_centro_custo") or "").strip() and str(item.get("centro_custo") or "").strip()
        ]

    def _ler_centros_custo_temporarios(self) -> list[dict[str, str]]:
        if not self._centros_temporarios_path.exists():
            return []
        try:
            conteudo = json.loads(self._centros_temporarios_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise AtlasException(f"Falha ao ler centros de custo temporarios: {exc}") from exc
        if not isinstance(conteudo, list):
            return []
        return [item for item in conteudo if isinstance(item, dict)]

    def _salvar_centros_custo_temporarios(self, registros: list[dict[str, str]]) -> None:
        self._centros_temporarios_path.parent.mkdir(parents=True, exist_ok=True)
        self._centros_temporarios_path.write_text(
            json.dumps(registros, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

    def _remover_centros_custo_temporarios(self) -> None:
        if self._centros_temporarios_path.exists():
            self._centros_temporarios_path.unlink()
