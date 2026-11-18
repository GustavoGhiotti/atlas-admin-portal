from src.application.services.auth_service import AuthenticatedUser
from src.infrastructure.external.ad_api import ActiveDirectoryApiClient
from src.infrastructure.repositories import DesbloqueioRepository
from src.infrastructure.services.logger_config import setup_logger
from src.schemas.desbloqueio import (
    DesbloqueioResponse,
    PesquisaUsuarioResponse,
    UsuarioPesquisaSchema,
)
from src.shared.exception import AtlasException, IntegracaoException, NaoEncontradoException


class DesbloqueioUsuarioService:
    def __init__(self) -> None:
        self.logger = setup_logger("atlas.desbloqueio")
        self.repository = DesbloqueioRepository()
        self.ad_api_client = ActiveDirectoryApiClient()

    def _safe_str(self, value: object | None) -> str:
        return "" if value is None else str(value)

    def pesquisar_usuario_por_cpf(
        self,
        cpf_usuario: str,
        current_user: AuthenticatedUser,
    ) -> PesquisaUsuarioResponse:
        resultado = self.repository.pesquisar_usuario_por_cpf(
            cpf_usuario,
            ""
            #self.buildPermissionFilter(current_user.desc_funcao, current_user.centro_custo),
        )
        if not resultado:
            raise NaoEncontradoException("Colaborador nao encontrado na base de dados.")

        usuario = UsuarioPesquisaSchema(
            nm_colaborador=self._safe_str(resultado[0][0]),
            nm_login_colaborador=self._safe_str(resultado[0][1]),
            nu_cpf_colaborador=self._safe_str(resultado[0][2]),
            funcao_colaborador=self._safe_str(resultado[0][3]),
            centro_custo_colaborador=self._safe_str(resultado[0][4]),
            status_usuario=self._safe_str(resultado[0][5]),
        )
        return PesquisaUsuarioResponse(
            status="sucesso",
            mensagem="Colaborador localizado com sucesso.",
            usuario=usuario,
        )

    def desbloquear_usuario_por_cpf(
        self,
        cpf_usuario: str,
        current_user: AuthenticatedUser,
    ) -> DesbloqueioResponse:
        colaborador = self.obterColaborador(cpf_usuario)

        user_dn = colaborador["user_dn"]
        group_dn = colaborador["group_dn"]
        status = colaborador["tp_status"]
        afastamento = colaborador["afastamento"]

        if afastamento == 1:
            raise AtlasException("Erro ao desbloquear usuario. Colaborador afastado.")

        if "CENTRO_CUSTO INVALIDO" in user_dn or "GRUPO INVALIDO" in group_dn:
            raise AtlasException("Erro ao desbloquear usuario. Colaborador fora do centro de custo.")
        if status == 0:
            raise AtlasException("Erro ao desbloquear usuario. Colaborador sem usuario.")
        if status == 2:
            raise AtlasException("Erro ao desbloquear usuario. Colaborador inativo.")

        nova_senha = f"{colaborador['nome'][:1].lower()}1234@$."
        resultado_api = self.ad_api_client.desbloquear_usuario(
            user_dn=user_dn,
            nm_login=colaborador["login"].lower(),
            nm_colaborador=colaborador["nome"],
            senha=nova_senha,
            login_solicitante=current_user.nm_login,
            host=current_user.host,
            cpf=cpf_usuario,
        )
        self.logger.info(
            "Desbloqueio via API concluido. cpf=%s login=%s resposta=%s",
            cpf_usuario,
            colaborador["login"],
            resultado_api,
        )

        self.registrarLogDesbloqueio(
            login_solicitante=current_user.nm_login,
            host=current_user.host,
            login_desbloqueado=colaborador["login"].lower(),
        )

        return DesbloqueioResponse(
            status="sucesso",
            mensagem=f"Usuario desbloqueado com sucesso. Nova senha: {nova_senha}",
            usuario={
                "nm_colaborador": colaborador["nome"],
                "nm_login": colaborador["login"].lower(),
                "funcao_colaborador": colaborador["funcao"],
                "status": "DESBLOQUEADO",
            },
        )

    def obterColaborador(self, cpf_usuario: str) -> dict:
        resultado = self.repository.buscar_colaborador_por_cpf(cpf_usuario)
        if not resultado:
            raise NaoEncontradoException("CPF nao localizado para desbloqueio.")

        row = resultado[0]
        return {
            "nome": row[0],
            "login": row[1],
            "funcao": row[2],
            "centro_custo": row[3],
            "user_dn": row[4],
            "group_dn": row[5],
            "tp_status": row[6],
            "afastamento": row[7],
        }

    def registrarLogDesbloqueio(self, login_solicitante: str, host: str | None, login_desbloqueado: str) -> None:
        host_value = host or ""
        self.repository.registrar_log_desbloqueio(login_solicitante, host_value, login_desbloqueado)

    def buildPermissionFilter(self, desc_funcao: str, centro_custo: str) -> str:
        if centro_custo == "FINANCEIRO" or desc_funcao == "GERENTE ADM E FINANCEIRO":
            return "AND CENTRO_CUSTO IN ('FINANCEIRO')"

        if centro_custo in {"DESENVOLVIMENTO", "SEGURANCA DA INFORMACAO"}:
            return ""

        if centro_custo == "TI" or desc_funcao == "GERENTE DE TI":
            return "AND CENTRO_CUSTO NOT IN ('SEGURANCA DA INFORMACAO')"

        if desc_funcao == "ASSISTENTE DE COORDENACAO" and centro_custo == "VEGA":
            return self.vegaFilter()

        if "COORDENADOR(A) DE OPERACOES" in desc_funcao and centro_custo == "VEGA":
            return self.vegaFilter()

        if desc_funcao == "ASSISTENTE DE COORDENACAO" and "COBRANCA" in centro_custo:
            return """
                AND CENTRO_CUSTO NOT IN (
                    'VEGA', 'TI', 'DESENVOLVIMENTO', 'SEGURANCA DA INFORMACAO',
                    'RH', 'FINANCEIRO', 'JURIDICO', 'MIS', 'CONTROL DESK', 'MARKETING', 'QUALIDADE'
                )
                AND DESC_FUNCAO NOT LIKE '%PLANEJAMENTO%'
            """

        if desc_funcao == "ASSISTENTE DE COORDENACAO" and "QUALIDADE" in centro_custo:
            return """
                AND CENTRO_CUSTO NOT IN (
                    'TI', 'DESENVOLVIMENTO', 'SEGURANCA DA INFORMACAO',
                    'RH', 'FINANCEIRO', 'JURIDICO', 'MIS', 'CONTROL DESK', 'MARKETING', 'QUALIDADE'
                )
                AND DESC_FUNCAO NOT LIKE '%PLANEJAMENTO%'
            """

        if desc_funcao == "SUPERVISOR QUALIDADE" and "QUALIDADE" in centro_custo:
            return """
                AND CENTRO_CUSTO NOT IN (
                    'TI', 'DESENVOLVIMENTO', 'SEGURANCA DA INFORMACAO',
                    'RH', 'FINANCEIRO', 'JURIDICO', 'MIS', 'CONTROL DESK', 'MARKETING'
                )
                AND DESC_FUNCAO NOT LIKE '%PLANEJAMENTO%'
            """

        if desc_funcao == "ASSISTENTE DE COORDENACAO" and "BANCOALFA FIXA" in centro_custo:
            return """
                AND CENTRO_CUSTO NOT IN (
                    'VEGA', 'TI', 'DESENVOLVIMENTO', 'SEGURANCA DA INFORMACAO',
                    'RH', 'FINANCEIRO', 'JURIDICO', 'MIS', 'CONTROL DESK'
                )
                AND DESC_FUNCAO NOT LIKE '%PLANEJAMENTO%'
            """

        if desc_funcao == "COORDENADOR(A) DE OPERACOES JR" and "COBRANCA" in centro_custo:
            return """
                AND CENTRO_CUSTO NOT IN (
                    'VEGA', 'TI', 'DESENVOLVIMENTO', 'SEGURANCA DA INFORMACAO',
                    'RH', 'FINANCEIRO', 'JURIDICO', 'MIS', 'CONTROL DESK'
                )
                AND DESC_FUNCAO NOT LIKE '%PLANEJAMENTO%'
            """

        if desc_funcao == "COORDENADOR(A) DE OPERACOES JR" and "QUALIDADE" in centro_custo:
            return """
                AND CENTRO_CUSTO NOT IN (
                    'VEGA', 'TI', 'DESENVOLVIMENTO', 'SEGURANCA DA INFORMACAO',
                    'RH', 'FINANCEIRO', 'JURIDICO', 'MIS', 'CONTROL DESK'
                )
                AND DESC_FUNCAO NOT LIKE '%PLANEJAMENTO%'
            """

        if desc_funcao == "AUTONOMO" and centro_custo == "ADMINISTRATIVO":
            return "AND CENTRO_CUSTO LIKE '%JURIDICO%'"

        if desc_funcao in {"ESPECIALISTA DE PLANEJAMENTO", "ESPECIALISTA EM PLANEJAMENTO"}:
            return "AND CENTRO_CUSTO IN ('CONTROL DESK','MIS')"

        if centro_custo == "RH":
            return "AND CENTRO_CUSTO IN ('RH')"

        if "GERENTE DE OPERACOES" in desc_funcao:
            return """
                AND DESC_FUNCAO IN (
                    'OPERADOR(A) COBRADOR(A)',
                    'NEGOCIADOR',
                    'ASSISTENTE ADMINISTRATIVO',
                    'ASSISTENTE DE COORDENACAO',
                    'COORDENADOR OPERACOES',
                    'COORDENADOR(A) DE OPERACOES JR',
                    'GERENTE DE OPERACOES SR',
                    'GERENTE DE OPERACOES',
                    'OMNICHANNEL'
                )
            """

        return ""

    def vegaFilter(self) -> str:
        return """
            AND DESC_FUNCAO IN (
                SELECT DISTINCT
                    A.DESC_FUNCAO
                FROM TB_TOTVS A WITH(NOLOCK)
                INNER JOIN TB_USUARIOS_ACTIVE_DIRECTORY B
                    ON A.DESC_FUNCAO = B.DESC_FUNCAO
                WHERE B.CENTRO_CUSTO = 'VEGA'
                    AND B.TP_STATUS = 1
                    AND B.DESC_FUNCAO NOT IN (
                        'ANALISTA DE CONTROL DESK JR',
                        'ANALISTA DE CONTROL DESK SR',
                        'ANALISTA DE TI PL',
                        'ASSISTENTE DE CONTROL DESK',
                        'GERENTE DE TI',
                        'GERENTE DE OPERACOES',
                        'GERENTE DE OPERACOES SR'
                    )
            )
        """

