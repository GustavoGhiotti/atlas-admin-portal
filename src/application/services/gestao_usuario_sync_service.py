import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta

from src.infrastructure.repositories import GestaoUsuarioRepository
from src.infrastructure.repositories.gestao_usuario_repository import (
    STATUS_USUARIO_ATIVO,
    STATUS_USUARIO_MANUAL,
    STATUS_USUARIO_OVERRIDE_GRUPO,
    STATUS_USUARIO_PRIMEIRO_ACESSO,
)
from src.infrastructure.services.env_load import get_env
from src.infrastructure.services.logger_config import setup_logger


logger = setup_logger("atlas.usuarios-sync")
JANELA_OVERRIDE_GRUPOS = timedelta(days=2)
DIGITAL_GROUP = "DIGITAL"
COORDENACAO_OPERACIONAL_FUNCOES = {
    "COORDENADOR(A) DE OPERACOES PL",
    "COORDENADOR(A) DE OPERACOES JR",
    "ASSISTENTE DE COORDENACAO",
}

FUNCAO_PARA_GRUPO_FALLBACK = {
    "ADVOGADO(A)": "JURIDICO",
    "ASSISTENTE JURIDICO": "JURIDICO",
    "ANALISTA CONTABIL SR": "FINANCEIRO",
    "ANALISTA FINANCEIRO JR": "FINANCEIRO",
    "GERENTE ADM E FINANCEIRO": "FINANCEIRO",
    "ANALISTA DE RH JR": "RH",
    "ANALISTA DE RH PL": "RH",
    "ANALISTA DE RH SR": "RH",
    "ASSISTENTE DE RH": "RH",
    "APRENDIZ - RH": "RH",
    "ANALISTA DE REC E SELECAO": "RH",
    "GERENTE DE RH": "RH",
    "PSICOLOGO": "RH",
    "ANALISTA DE MARKETING JR": "MARKETING",
    "ANALISTA DE MARKETING PL": "MARKETING",
    "ASSISTENTE DE MARKETING": "MARKETING",
    "SUPERVISOR(A) DE MARKETING": "MARKETING",
    "ANALISTA DE MIS JR": "PLANEJAMENTO MIS DADOS",
    "ANALISTA DE MIS PL": "PLANEJAMENTO MIS DADOS",
    "ANALISTA DE PLANEJAMENTO I": "PLANEJAMENTO MIS DADOS",
    "ANALISTA DE PLANEJAMENTO JR": "PLANEJAMENTO MIS DADOS",
    "ANALISTA DE PLANEJAMENTO PL": "PLANEJAMENTO MIS DADOS",
    "ASSISTENTE DE PLANEJAMENTO": "PLANEJAMENTO MIS DADOS",
    "ASSISTENTE DE PLANEJAMENTO I": "PLANEJAMENTO MIS DADOS",
    "COORDENADOR(A) DE OPERACOES JR": "COORDENACAO OPERACIONAL",
    "COORDENADOR(A) DE OPERACOES PL": "COORDENACAO OPERACIONAL",
    "GERENTE DE OPERACOES JR": "GESTAO OPERACIONAL",
    "GERENTE DE OPERACOES JR I": "GESTAO OPERACIONAL",
    "GERENTE DE OPERACOES SR": "GESTAO OPERACIONAL",
    "SUPERVISOR(A) DE OPERACOES": "GESTAO OPERACIONAL",
    "SUPERVISOR(A) DE OPERACOES I": "GESTAO OPERACIONAL",
    "ASSISTENTE DE COORDENACAO": "COORDENACAO OPERACIONAL",
    "COORDENADOR(A) QUALIDADE": "QUALIDADE",
    "MONITOR DE TELEATENDIMENTO": "QUALIDADE",
    "ASSISTENTE DE DESENVOLVIMENTO": "ADMINISTRADORES DE SISTEMA",
    "ANALISTA SEG INFORMACAO JR": "SEGURANCA INFRAESTRUTURA",
    "ANALISTA SEG INFO PL": "SEGURANCA INFRAESTRUTURA",
    "ANALISTA DE INFRAESTRUTURA JR": "SEGURANCA INFRAESTRUTURA",
    "SUPERVISOR(A) DE SUPORTE TEC.": "SEGURANCA INFRAESTRUTURA",
    "ANALISTA DE TI JR": "SEGURANCA INFRAESTRUTURA",
    "ASSISTENTE DE TI": "SEGURANCA INFRAESTRUTURA",
    "APRENDIZ TI": "SEGURANCA INFRAESTRUTURA",
    "ANALISTA DE CONTROL DESK JR": "CONTROL DESK",
    "ANALISTA DE CONTROL DESK PL": "CONTROL DESK",
    "ASSISTENTE DE CONTROL DESK": "CONTROL DESK",
    "ASSIST DE SUPERV. CONTROL DESK": "CONTROL DESK",
    "ASSISTENTE ADMINISTRATIVO": "ADMINISTRATIVO",
    "ASSISTENTE ADMINISTRATIVO 2": "ADMINISTRATIVO",
    "AUXILIAR ADMINISTRATIVO": "ADMINISTRATIVO",
    "AUXILIAR ADMINISTRATIVO 1": "ADMINISTRATIVO",
    "DIRETOR(A)": "DIRETORIA",
    "SOCIO GERENTE": "DIRETORIA",
    "INSTRUTOR DE TREINAMENTO JR": "QUALIDADE",
    "ANALISTA DE COMPLIANCE": "ADMINISTRATIVO"
}

FUNCOES_SEM_ACESSO = {
    "AUX. DE MANUTENCAO PREDIAL",
    "OPERADOR(A) COBRADOR(A)",
    "APRENDIZ OPERADOR(A) COBRADOR",
    "NEGOCIADOR",
    "NEGOCIADOR |",
    "OMNICHANNEL",
    "APRENDIZ OMNICHANNEL",
    "BACK OFFICE 1 - 6 HRS",
    "BACK OFFICE 2",
    "ESTAGIARIO",
    "CONTROLADOR DE ACESSO",
    "AUXILIAR DE LIMPEZA",
    "COPEIRO(A)",
    "PORTEIRO",
    "LIDER DE SERVICOS DE LIMPEZA",
    "MOTORISTA",
    "TECNICO DE MANUTENCAO PREDIAL",
    "TECNICO DE MANUTENCAO PREDIAL1",
}

GRUPOS_POR_CENTRO_CUSTO = (
    (("JURIDICO",), "JURIDICO"),
    (("FINANCEIRO", "CONTABIL"), "FINANCEIRO"),
    (("RH", "RECRUTAMENTO", "SELECAO"), "RH"),
    (("MARKETING",), "MARKETING"),
    (("MIS", "PLANEJAMENTO", "DADOS"), "PLANEJAMENTO MIS DADOS"),
    (("CRM",), "CRM"),
    (("CONTROL DESK",), "CONTROL DESK"),
    (("QUALIDADE",), "QUALIDADE"),
    (("TREINAMENTO",), "QUALIDADE"),
    (("ADMINISTRATIVO",), "ADMINISTRATIVO"),
    (("OPERACOES", "COBRANCA", "COORDENACAO"), "GESTAO OPERACIONAL"),
    (("TI", "INFRAESTRUTURA", "SEGURANCA"), "SEGURANCA INFRAESTRUTURA"),
    (("DESENVOLVIMENTO",), "DESENVOLVIMENTO"),
)

REGRAS_FUNCAO_CENTRO_CUSTO = {
    "ANALISTA DE SISTEMAS JR": (
        {"ids": {"1114"}, "keywords": ("CRM",), "grupo": "CRM"},
        {"ids": {"1019"}, "keywords": ("MIS", "PLANEJAMENTO", "DADOS"), "grupo": "PLANEJAMENTO MIS DADOS"},
    ),
    "ANALISTA DE SISTEMAS PL": (
        {"ids": {"1114"}, "keywords": ("CRM",), "grupo": "CRM"},
        {"ids": {"1019"}, "keywords": ("MIS", "PLANEJAMENTO", "DADOS"), "grupo": "PLANEJAMENTO MIS DADOS"},
    ),
}


@dataclass(frozen=True)
class ColaboradorAtivo:
    nome: str
    cpf: str
    login: str
    nm_funcao: str
    desc_funcao: str
    id_centro_custo: str
    centro_custo: str
    centro_custo_2: str
    email: str


class GestaoUsuarioSyncService:
    def __init__(self) -> None:
        self._repository = GestaoUsuarioRepository()
        self._sync_lock = asyncio.Lock()
        self._loop_task: asyncio.Task | None = None
        self._started = False
        self._em_execucao = False
        self._ultimo_processamento: str | None = None
        self._ultimo_erro: str | None = None
        self._ultimo_resumo: dict[str, int] = {}

    async def start(self) -> None:
        if self._started:
            return
        self._started = True
        self._loop_task = asyncio.create_task(self._sync_loop())

    async def stop(self) -> None:
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        self._loop_task = None
        self._started = False

    async def sincronizar_agora(self) -> dict[str, int]:
        async with self._sync_lock:
            self._em_execucao = True
            try:
                resumo = await asyncio.to_thread(self._sincronizar)
                self._ultimo_processamento = datetime.now().isoformat()
                self._ultimo_erro = None
                self._ultimo_resumo = resumo
                return resumo
            except Exception as exc:
                self._ultimo_erro = str(exc)
                logger.exception("Falha na sincronizacao automatica de usuarios")
                raise
            finally:
                self._em_execucao = False

    def status(self) -> dict[str, object]:
        return {
            "em_execucao": self._em_execucao,
            "ultimo_processamento": self._ultimo_processamento,
            "ultimo_erro": self._ultimo_erro,
            "intervalo_minutos": self._sync_interval_minutes(),
            "ultimo_resumo": self._ultimo_resumo,
        }

    async def _sync_loop(self) -> None:
        while True:
            try:
                await self.sincronizar_agora()
            except Exception:
                logger.exception("Falha no ciclo automatico de sincronizacao de usuarios")
            await asyncio.sleep(self._sync_interval_seconds())

    def _sincronizar(self) -> dict[str, int]:
        lock_connection = self._repository.tentar_adquirir_lock_sincronizacao()
        if lock_connection is None:
            logger.info("Sincronizacao de usuarios ignorada porque outra instancia ja esta em execucao.")
            return {
                "colaboradores_lidos": 0,
                "usuarios_criados": 0,
                "usuarios_atualizados": 0,
                "usuarios_removidos": 0,
                "grupos_atualizados": 0,
                "usuarios_sem_login": 0,
            }

        try:
            # Regra de seguranca:
            # a sincronizacao usa TB_COLABORADORES_ATIVOS apenas como fonte de leitura.
            # nenhuma alteracao deve ser feita nessa tabela; o processo atua somente
            # sobre os usuarios do Atlas em TB_USUARIO_BCK e seus grupos no portal.
            usuarios_rows = self._repository.listar_usuarios_base()
            self._repository.criar_grupo_se_nao_existir(DIGITAL_GROUP)
            grupos_disponiveis = {str(row[1] or "").strip() for row in self._repository.listar_grupos() if row[1]}
            colaboradores = self._listar_colaboradores_validos()

            usuarios_por_cpf = {}
            usuarios_por_login = {}
            for row in usuarios_rows:
                payload = {
                    "id": int(row[0]),
                    "login": str(row[1] or "").upper(),
                    "cpf": str(row[3] or "").strip(),
                    "email": str(row[7] or "").strip(),
                    "status": int(row[8] or 0),
                    "dt_atualizacao": row[9],
                }
                if payload["cpf"]:
                    usuarios_por_cpf[payload["cpf"]] = payload
                if payload["login"]:
                    usuarios_por_login[payload["login"]] = payload

            resumo = {
                "colaboradores_lidos": len(colaboradores),
                "usuarios_criados": 0,
                "usuarios_atualizados": 0,
                "usuarios_removidos": 0,
                "grupos_atualizados": 0,
                "usuarios_sem_login": 0,
            }

            cpfs_ativos: set[str] = set()
            for colaborador in colaboradores:
                if not colaborador.login:
                    resumo["usuarios_sem_login"] += 1
                    continue

                cpfs_ativos.add(colaborador.cpf)
                usuario = usuarios_por_cpf.get(colaborador.cpf) or usuarios_por_login.get(colaborador.login)
                if usuario:
                    if int(usuario.get("status") or 0) == STATUS_USUARIO_MANUAL:
                        continue

                    email_final = colaborador.email or usuario["email"]
                    if self._override_grupos_ativo(usuario):
                        self._repository.atualizar_usuario_bck_preservando_override(
                            id_usuario=usuario["id"],
                            login=colaborador.login,
                            nome_colaborador=colaborador.nome,
                            cpf_colaborador=colaborador.cpf,
                            nm_funcao=colaborador.nm_funcao,
                            desc_funcao=colaborador.desc_funcao,
                            centro_custo=colaborador.centro_custo,
                            email_colaborador=email_final,
                        )
                    else:
                        self._repository.atualizar_usuario_bck(
                            id_usuario=usuario["id"],
                            login=colaborador.login,
                            nome_colaborador=colaborador.nome,
                            cpf_colaborador=colaborador.cpf,
                            nm_funcao=colaborador.nm_funcao,
                            desc_funcao=colaborador.desc_funcao,
                            centro_custo=colaborador.centro_custo,
                            email_colaborador=email_final,
                            tp_status=STATUS_USUARIO_ATIVO,
                        )
                    self._repository.atualizar_login_grupos_usuario(usuario["id"], colaborador.login)
                    resumo["usuarios_atualizados"] += 1
                    id_usuario = usuario["id"]
                else:
                    senha_padrao = self._gerar_senha_padrao(colaborador.nome)
                    self._repository.inserir_usuario_bck(
                        login=colaborador.login,
                        senha_colaborador=senha_padrao,
                        nome_colaborador=colaborador.nome,
                        cpf_colaborador=colaborador.cpf,
                        nm_funcao=colaborador.nm_funcao,
                        desc_funcao=colaborador.desc_funcao,
                        centro_custo=colaborador.centro_custo,
                        email_colaborador="",
                        tp_status=STATUS_USUARIO_PRIMEIRO_ACESSO,
                    )
                    usuario_criado = self._repository.buscar_usuario_criado_por_cpf(colaborador.cpf)
                    if not usuario_criado:
                        logger.warning(
                            "Usuario nao localizado apos criacao automatica. cpf=%s login=%s",
                            colaborador.cpf,
                            colaborador.login,
                        )
                        continue

                    id_usuario = int(usuario_criado[0][0])
                    usuario = {
                        "id": id_usuario,
                        "login": colaborador.login,
                        "cpf": colaborador.cpf,
                        "email": "",
                        "status": STATUS_USUARIO_PRIMEIRO_ACESSO,
                        "dt_atualizacao": None,
                    }
                    usuarios_por_cpf[colaborador.cpf] = usuario
                    usuarios_por_login[colaborador.login] = usuario
                    resumo["usuarios_criados"] += 1

                grupos_atuais = {str(row[0] or "") for row in self._repository.listar_grupos_usuario(str(id_usuario)) if row[0]}
                grupos_automaticos = self.determinarGruposAutomaticos(colaborador, grupos_disponiveis)

                if self._override_grupos_ativo(usuario):
                    continue

                # Regra operacional:
                # grupos ajustados manualmente por administradores devem prevalecer.
                # A sincronizacao automatica so complementa usuarios sem grupo algum.
                if not grupos_atuais:
                    grupos_finais = sorted(grupos_automaticos)
                    if grupos_finais:
                        self._repository.inserir_grupos_usuario_por_nome(str(id_usuario), grupos_finais)
                        resumo["grupos_atualizados"] += 1

            for row in usuarios_rows:
                id_usuario = int(row[0] or 0)
                login = str(row[1] or "").strip().upper()
                cpf = str(row[3] or "").strip()
                status_usuario = int(row[8] or 0)
                if status_usuario == STATUS_USUARIO_MANUAL:
                    continue
                if cpf and cpf not in cpfs_ativos:
                    self._repository.excluir_grupos_usuario(str(id_usuario))
                    if login:
                        self._repository.excluir_conexoes_usuario(login)
                    self._repository.excluir_usuario(id_usuario)
                    resumo["usuarios_removidos"] += 1

            logger.info("Sincronizacao de usuarios concluida: %s", resumo)
            return resumo
        finally:
            self._repository.liberar_lock_sincronizacao(lock_connection)

    def _listar_colaboradores_validos(self) -> list[ColaboradorAtivo]:
        rows = self._repository.listar_colaboradores_ativos_para_sincronizar()
        colaboradores: list[ColaboradorAtivo] = []
        for row in rows:
            cpf = self._normalizar_cpf(str(row[1] or ""))
            if not cpf:
                continue
            nm_funcao = self.normalizarTexto(row[3])
            desc_funcao = self.normalizarTexto(row[4])
            if self._funcao_sem_acesso(nm_funcao, desc_funcao):
                continue
            colaboradores.append(
                ColaboradorAtivo(
                    nome=str(row[0] or "").strip(),
                    cpf=cpf,
                    login=str(row[2] or "").strip().upper(),
                    nm_funcao=nm_funcao,
                    desc_funcao=desc_funcao,
                    id_centro_custo=self.normalizarIdCentroCusto(row[5]),
                    centro_custo=self.normalizarTexto(row[6]),
                    centro_custo_2=self.normalizarTexto(row[7]),
                    email=str(row[8] or "").strip(),
                )
            )
        return colaboradores

    def _funcao_sem_acesso(self, nm_funcao: str, desc_funcao: str) -> bool:
        return any(funcao in FUNCOES_SEM_ACESSO for funcao in (nm_funcao, desc_funcao) if funcao)

    def normalizarTexto(self, value: object) -> str:
        texto = "" if value is None else str(value)
        return " ".join(texto.strip().upper().split())

    def normalizarIdCentroCusto(self, value: object) -> str:
        return "".join(char for char in self.normalizarTexto(value) if char.isdigit())

    def contemQualquer(self, texto: str, termos: tuple[str, ...] | list[str] | set[str]) -> bool:
        return any(termo in texto for termo in termos)

    def montarContextoCentroCusto(self, colaborador: ColaboradorAtivo) -> dict[str, str]:
        centro_custo = self.normalizarTexto(colaborador.centro_custo)
        centro_custo_2 = self.normalizarTexto(colaborador.centro_custo_2)
        return {
            "idCentroCusto": self.normalizarIdCentroCusto(colaborador.id_centro_custo),
            "centroCusto": centro_custo,
            "centroCusto2": centro_custo_2,
            "textoCentroCusto": " ".join(filter(None, [centro_custo, centro_custo_2])),
        }

    def regraBateFuncaoCentroCusto(self, colaborador: ColaboradorAtivo, regra: dict[str, object]) -> bool:
        contexto = self.montarContextoCentroCusto(colaborador)
        ids_regra = set(regra.get("ids", set()))
        keywords_regra = tuple(regra.get("keywords", ()))

        if ids_regra and contexto["idCentroCusto"] in ids_regra:
            return True
        if keywords_regra and self.contemQualquer(contexto["textoCentroCusto"], keywords_regra):
            return True
        return False

    def determinarGrupoPorCentroCusto(self, colaborador: ColaboradorAtivo) -> str | None:
        contexto = self.montarContextoCentroCusto(colaborador)
        for keywords, grupo in GRUPOS_POR_CENTRO_CUSTO:
            if self.contemQualquer(contexto["textoCentroCusto"], keywords):
                return grupo
        return None

    def validarGrupo(self, grupo: str | None, grupos_validos: set[str]) -> str | None:
        if not grupo:
            return None
        return grupo if grupo in grupos_validos else None

    def _grupos_desenvolvimento(self, grupos_validos: set[str]) -> set[str]:
        candidatos = {"DESENVOLVIMENTO", "ADMINISTRADORES DE SISTEMA"}
        return {grupo for grupo in candidatos if grupo in grupos_validos}

    def determinarGruposAutomaticos(self, colaborador: ColaboradorAtivo, grupos_validos: set[str]) -> set[str]:
        nm_funcao = self.normalizarTexto(colaborador.nm_funcao)
        funcao = self.normalizarTexto(colaborador.desc_funcao)
        if not funcao or self._funcao_sem_acesso(nm_funcao, funcao):
            return set()

        if "DIGITAL" in nm_funcao or "DIGITAL" in funcao:
            grupo_validado = self.validarGrupo(DIGITAL_GROUP, grupos_validos)
            return {grupo_validado} if grupo_validado else set()

        if funcao in COORDENACAO_OPERACIONAL_FUNCOES:
            grupo_validado = self.validarGrupo("COORDENACAO OPERACIONAL", grupos_validos)
            return {grupo_validado} if grupo_validado else set()

        grupo_por_centro = self.determinarGrupoPorCentroCusto(colaborador)
        if grupo_por_centro == "DESENVOLVIMENTO":
            return self._grupos_desenvolvimento(grupos_validos)

        if funcao == "ASSISTENTE DE DESENVOLVIMENTO":
            return self._grupos_desenvolvimento(grupos_validos)

        regras_funcao = REGRAS_FUNCAO_CENTRO_CUSTO.get(funcao, ())
        for regra in regras_funcao:
            if self.regraBateFuncaoCentroCusto(colaborador, regra):
                grupo_validado = self.validarGrupo(str(regra["grupo"]), grupos_validos)
                return {grupo_validado} if grupo_validado else set()

        if grupo_por_centro:
            grupo_validado = self.validarGrupo(grupo_por_centro, grupos_validos)
            return {grupo_validado} if grupo_validado else set()

        grupo_fallback = FUNCAO_PARA_GRUPO_FALLBACK.get(funcao)
        grupo_validado = self.validarGrupo(grupo_fallback, grupos_validos)
        return {grupo_validado} if grupo_validado else set()

    def _override_grupos_ativo(self, usuario: dict[str, object]) -> bool:
        if int(usuario.get("status") or 0) != STATUS_USUARIO_OVERRIDE_GRUPO:
            return False

        dt_atualizacao = usuario.get("dt_atualizacao")
        if not isinstance(dt_atualizacao, datetime):
            return False

        return datetime.now() < dt_atualizacao + JANELA_OVERRIDE_GRUPOS

    def _normalizar_cpf(self, value: str) -> str:
        digits = "".join(char for char in value if char.isdigit())
        return digits.zfill(11) if digits else ""

    def _gerar_senha_padrao(self, nome: str) -> str:
        inicial = next((char.lower() for char in (nome or "").strip() if char.isalpha()), "u")
        return f"{inicial}1234@$."

    def _sync_interval_minutes(self) -> int:
        raw_value = get_env("USUARIOS_SYNC_MINUTES")
        try:
            return max(1, int(raw_value))
        except ValueError:
            return 60

    def _sync_interval_seconds(self) -> int:
        return self._sync_interval_minutes() * 60


gestao_usuario_sync_service = GestaoUsuarioSyncService()
