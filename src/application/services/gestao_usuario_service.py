from dataclasses import dataclass

from src.application.services.auth_service import AuthenticatedUser
from src.infrastructure.dependencies.access_groups import (
    PORTALACORDO_CONFIG_GROUPS,
    PORTALACORDO_GROUPS,
)
from src.infrastructure.repositories import GestaoUsuarioRepository
from src.infrastructure.repositories.gestao_usuario_repository import STATUS_USUARIO_MANUAL
from src.schemas.gestao_usuario import (
    UsuarioPermissaoEfetivaResponse,
    UsuarioPermissaoResponse,
    UsuarioPermissoesEfetivasResponse,
)
from src.shared.exception import AtlasException, NaoEncontradoException

DOMINIOS_EMAIL_CORPORATIVO = {
    "parceiro.example",
    "eutolimpo.com.br",
    "parceiro.example",
    "empresa.example",
    "empresa.example",
    "empresa.example",
    "biggert.com.br",
    "portalacordo.example",
    "w214tecnologia.com.br",
    "w373tecnologia.com.br"
}

PERMISSOES_PORTAL = [
    {
        "recurso": "Permissoes de usuarios",
        "descricao": "Gerenciar grupos de acesso e usuarios do portal.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO"],
    },
    {
        "recurso": "Criacao manual de usuarios",
        "descricao": "Cadastrar usuarios fora do processo automatico.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO"],
    },
    {
        "recurso": "Desbloqueio",
        "descricao": "Pesquisar usuarios por CPF e restabelecer acesso.",
        "grupos": [
            "ADMINISTRADORES DE SISTEMA",
            "DESENVOLVIMENTO",
            "DIGITAL",
            "GESTAO OPERACIONAL",
            "COORDENACAO OPERACIONAL",
            "SEGURANCA INFRAESTRUTURA",
            "MARKETING",
            "PLANEJAMENTO MIS DADOS",
            "RH",
            "ADMINISTRATIVO",
            "CONTROL DESK",
            "CRM",
            "DIRETORIA",
            "GERENCIA",
            "FINANCEIRO",
            "JURIDICO",
            "QUALIDADE",
        ],
    },
    {
        "recurso": "ChamaDev",
        "descricao": "Registrar demandas e acompanhar chamados.",
        "grupos": [
            "ADMINISTRADORES DE SISTEMA",
            "DESENVOLVIMENTO",
            "DIGITAL",
            "GESTAO OPERACIONAL",
            "COORDENACAO OPERACIONAL",
            "SEGURANCA INFRAESTRUTURA",
            "MARKETING",
            "PLANEJAMENTO MIS DADOS",
            "RH",
            "ADMINISTRATIVO",
            "CONTROL DESK",
            "CRM",
            "DIRETORIA",
            "GERENCIA",
            "FINANCEIRO",
            "JURIDICO",
            "QUALIDADE",
        ],
    },
    {
        "recurso": "Agenda",
        "descricao": "Organizar eventos, agendar tarefas e registrar acontecimentos.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIRETORIA", "GERENCIA", "COORDENACAO OPERACIONAL"],
    },
    {
        "recurso": "Controle de tarefas",
        "descricao": "Monitorar tasks do agendador e executar acoes remotas.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "PLANEJAMENTO MIS DADOS", "CRM"],
    },
    {
        "recurso": "Cargas",
        "descricao": "Monitorar execucoes e recebimentos de cargas.",
        "grupos": [
            "ADMINISTRADORES DE SISTEMA",
            "DESENVOLVIMENTO",
            "PLANEJAMENTO MIS DADOS",
            "GESTAO OPERACIONAL",
            "COORDENACAO OPERACIONAL",
            "CRM",
            "DIRETORIA",
            "GERENCIA",
        ],
    },
    {
        "recurso": "Arquivos",
        "descricao": "Acessar rotinas de importacao, exportacao e importacao SQL.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "CRM", "PLANEJAMENTO MIS DADOS"],
    },
    {
        "recurso": "Banco de imagens",
        "descricao": "Centralizar ativos visuais e organizar arquivos corporativos.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "MARKETING", "SEGURANCA INFRAESTRUTURA"],
    },
    {
        "recurso": "Treinamentos",
        "descricao": "Acessar dashboard, admissoes, treinados e agenda de treinamentos.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "QUALIDADE"],
        "logins": ["ACFIORENTINI", "PISFREITAS"],
    },
    {
        "recurso": "SMS",
        "descricao": "Acessar dashboards, testes e limites de envio SMS.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS"],
    },
    {
        "recurso": "E-mail SendGrid",
        "descricao": "Acessar dashboards, testes e bloqueios de e-mail.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS", "CONTROL DESK", "JURIDICO"],
    },
    {
        "recurso": "WhatsApp",
        "descricao": "Acessar dashboards e templates de WhatsApp.",
        "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS", "MARKETING"],
    },
    {
    "recurso": "Processos",
    "descricao": "Consultar processos ativos em execucao no banco de dados.",
    "grupos": ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "PLANEJAMENTO MIS DADOS",],
},
    # Os dois modulos do Portal Acordo referenciam as tuplas de access_groups em vez de
    # repetir os nomes: as demais entradas desta lista sao copias literais, e copia
    # diverge. Aqui, mudar o grupo no access_groups (que e quem de fato autoriza)
    # atualiza esta tela junto, sem chance de a vitrine mentir sobre o acesso real.
    {
        "recurso": "Portal Acordo - monitoramento",
        "descricao": "Acompanhar a jornada do cliente no portal e no app do Portal Acordo.",
        "grupos": list(PORTALACORDO_GROUPS),
    },
    {
        "recurso": "Portal Acordo - configuracao",
        "descricao": "Editar carteiras, landing pages, mailings, numeros e aliases do Portal Acordo.",
        "grupos": list(PORTALACORDO_CONFIG_GROUPS),
    },
]


@dataclass
class GrupoPortal:
    id_grupo: int
    nm_grupo: str


@dataclass
class UsuarioPortal:
    id_usuario: int
    nm_login: str
    nm_colaborador: str
    nu_cpf_colaborador: str
    nm_funcao: str
    centro_custo: str
    email: str | None
    status: str
    grupos: dict[int, str]


class GestaoUsuarioService:
    def __init__(self) -> None:
        self.repository = GestaoUsuarioRepository()

    def alterar_senha(self, login: str, nova_senha: str, confirmacao_nova_senha: str) -> str:
        if nova_senha != confirmacao_nova_senha:
            raise AtlasException("As senhas digitadas precisam ser iguais.")

        self._validate_password_strength(nova_senha)

        usuario = self.repository.buscar_usuario_por_login(login)
        if not usuario:
            raise NaoEncontradoException("Falha ao localizar usuario.")

        self.repository.atualizar_senha(login, nova_senha)
        return "Senha atualizada com sucesso."

    def alterar_email_proprio(self, login: str, email: str) -> str:
        email_limpo = self._normalizar_email(email)

        usuario = self.repository.buscar_id_email_usuario_por_login(login)
        if not usuario:
            raise NaoEncontradoException("Falha ao localizar usuario.")

        _, email_atual = usuario[0]
        email_atual = (email_atual or "").strip().lower()
        if email_limpo == email_atual:
            return "Email atualizado com sucesso."

        self._garantir_email_unico(email_limpo, login)
        self.repository.atualizar_email_usuario_por_login(login, email_limpo)
        self.repository.registrar_log_email_por_login(login, email_atual, email_limpo)
        return "Email atualizado com sucesso."

    def concluir_primeiro_acesso(self, login: str, email: str, nova_senha: str, confirmacao_nova_senha: str) -> str:
        email_limpo = self._normalizar_email(email)
        if nova_senha != confirmacao_nova_senha:
            raise AtlasException("As senhas digitadas precisam ser iguais.")

        usuario_rows = self.repository.buscar_usuario_login_email_status(login)
        if not usuario_rows:
            raise NaoEncontradoException("Falha ao localizar usuario.")

        email_atual = str(usuario_rows[0][2] or "").strip().lower()
        if email_atual:
            raise AtlasException("Primeiro acesso ja foi concluido para este usuario.")

        self._garantir_email_unico(email_limpo, login)
        self._validate_password_strength(nova_senha)
        self.repository.atualizar_email_e_senha_primeiro_acesso(login, email_limpo, nova_senha)
        return "Primeiro acesso concluido com sucesso."

    def listar_grupos(self) -> list[GrupoPortal]:
        rows = self.repository.listar_grupos()
        return [GrupoPortal(id_grupo=row[0], nm_grupo=row[1]) for row in rows]

    def registrar_usuario(
        self,
        login: str,
        nome_colaborador: str,
        cpf_colaborador: str,
        email_colaborador: str,
        senha_colaborador: str,
        confirmacao_senha: str,
        id_grupo: str,
    ) -> str:
        login_limpo = (login or "").strip().upper()
        if not login_limpo:
            raise AtlasException("Informe o login do usuário.")

        if senha_colaborador != confirmacao_senha:
            raise AtlasException("As senhas digitadas precisam ser iguais.")

        self._validate_password_strength(senha_colaborador)

        grupo = self.repository.buscar_grupo_por_id(id_grupo)
        if not grupo:
            raise AtlasException("Grupo inicial não localizado.")

        if self.repository.buscar_usuario_por_login(login_limpo):
            raise AtlasException("Já existe um usuário com esse login.")

        usuario_por_cpf = self.repository.buscar_login_email_status_por_cpf(cpf_colaborador)
        if usuario_por_cpf:
            raise AtlasException("Já existe um usuário vinculado a esse CPF.")

        email_limpo = self._normalizar_email(email_colaborador)
        self._garantir_email_unico(email_limpo)

        self.repository.inserir_usuario_bck(
            login=login_limpo,
            senha_colaborador=senha_colaborador,
            nome_colaborador=nome_colaborador.strip(),
            cpf_colaborador=cpf_colaborador,
            nm_funcao="USUARIO MANUAL",
            desc_funcao="USUARIO MANUAL",
            centro_custo="CADASTRO MANUAL",
            email_colaborador=email_limpo,
            tp_status=STATUS_USUARIO_MANUAL,
        )

        usuario_criado = self.repository.buscar_usuario_por_login(login_limpo)
        if not usuario_criado:
            raise AtlasException("Falha ao confirmar a criação do usuário manual.")

        self.repository.vincular_grupo_usuario(cpf_colaborador, id_grupo)
        return "Usuário manual criado com sucesso."

    def excluir_usuario_manual(self, id_usuario: str) -> str:
        usuario_rows = self.repository.buscar_usuario_por_id(id_usuario)
        if not usuario_rows:
            raise NaoEncontradoException("Usuário não localizado para exclusão.")

        usuario_id, login, _, _, _, status = usuario_rows[0]
        if status != STATUS_USUARIO_MANUAL:
            raise AtlasException("Somente usuários manuais podem ser excluídos por este fluxo.")

        self.repository.excluir_grupos_usuario(str(usuario_id))
        if login:
            self.repository.excluir_conexoes_usuario(str(login))
        self.repository.excluir_usuario(int(usuario_id))
        return "Usuário manual excluído com sucesso."

    def listar_usuarios_permissoes(self) -> list[UsuarioPortal]:
        rows = self.repository.listar_usuarios_permissoes()

        usuarios_por_login: dict[str, UsuarioPortal] = {}
        for row in rows:
            nm_login = row[1]
            if nm_login not in usuarios_por_login:
                usuarios_por_login[nm_login] = UsuarioPortal(
                    id_usuario=row[0],
                    nm_login=nm_login,
                    nm_colaborador=row[2],
                    nu_cpf_colaborador=row[3],
                    nm_funcao=row[4],
                    centro_custo=row[5],
                    email=row[6],
                    status=row[7],
                    grupos={},
                )
            if row[8] is not None and row[9] is not None:
                usuarios_por_login[nm_login].grupos[row[8]] = row[9]

        return list(usuarios_por_login.values())

    def obter_permissoes_efetivas(self, id_usuario: str) -> UsuarioPermissoesEfetivasResponse:
        usuarios = self.listar_usuarios_permissoes()
        usuario = next((item for item in usuarios if str(item.id_usuario) == str(id_usuario)), None)
        if not usuario:
            raise NaoEncontradoException("Usuario nao localizado.")

        grupos_usuario = set(usuario.grupos.values())
        permissoes = []
        for permissao in PERMISSOES_PORTAL:
            grupos_permitidos = set(permissao["grupos"])
            origem = sorted(grupos_usuario.intersection(grupos_permitidos))
            logins_permitidos = {login.upper() for login in permissao.get("logins", [])}
            if usuario.nm_login.strip().upper() in logins_permitidos:
                origem.append(f"USUÁRIO: {usuario.nm_login.strip().upper()}")
            permissoes.append(
                UsuarioPermissaoEfetivaResponse(
                    recurso=permissao["recurso"],
                    descricao=permissao["descricao"],
                    permitido=bool(origem),
                    origem=origem,
                )
            )

        return UsuarioPermissoesEfetivasResponse(
            usuario=UsuarioPermissaoResponse(
                id_usuario=usuario.id_usuario,
                nm_login=usuario.nm_login,
                nm_colaborador=usuario.nm_colaborador,
                nu_cpf_colaborador=usuario.nu_cpf_colaborador,
                nm_funcao=usuario.nm_funcao,
                centro_custo=usuario.centro_custo,
                email=usuario.email,
                status=usuario.status,
                grupos=sorted(usuario.grupos.values()),
            ),
            permissoes=permissoes,
        )

    def atualizar_acessos_colaborador(
        self,
        usuario_autenticado: AuthenticatedUser,
        id_usuario: str,
        email_usuario: str,
        permissoes_usuario: list[str],
    ) -> str:
        email_atual_rows = self.repository.buscar_email_usuario(id_usuario)
        if not email_atual_rows:
            raise NaoEncontradoException("Usuario nao localizado para atualizacao.")

        email_atual = email_atual_rows[0][0] or ""
        grupos_rows = self.repository.listar_grupos_usuario(id_usuario)
        grupos_atuais = sorted([row[0] for row in grupos_rows if row[0]])
        grupos_novos = sorted(permissoes_usuario)

        if email_usuario != email_atual:
            email_limpo = self._normalizar_email(email_usuario)
            self._garantir_email_unico(email_limpo, id_usuario=id_usuario)
            self.repository.atualizar_email_usuario(id_usuario, email_limpo)
            self.repository.registrar_log_email(id_usuario, email_atual, email_limpo, usuario_autenticado.nm_login)

        if grupos_atuais != grupos_novos:
            self.repository.excluir_grupos_usuario(id_usuario)

            if grupos_novos:
                self.repository.inserir_grupos_usuario_por_nome(id_usuario, grupos_novos)

            self.repository.ativar_override_permissoes_usuario(id_usuario)

            grupos_atuais_txt = ", ".join(grupos_atuais)
            grupos_novos_txt = ", ".join(grupos_novos)
            self.repository.registrar_log_grupo(id_usuario, grupos_atuais_txt, grupos_novos_txt, usuario_autenticado.nm_login)

        return "Perfil atualizado com sucesso."

    def _validate_password_strength(self, password: str) -> None:
        if len(password) < 7:
            raise AtlasException("A senha digitada nao cumpre com os requisitos minimos.")

        digit_count = sum(char.isdigit() for char in password)
        special_count = sum(not char.isalnum() for char in password)
        if digit_count < 2 or special_count < 1 or (digit_count + special_count) < 2:
            raise AtlasException("A senha digitada nao cumpre com os requisitos minimos.")

    def _normalizar_email(self, email: str) -> str:
        email_limpo = (email or "").strip().lower()
        if not email_limpo or "@" not in email_limpo:
            raise AtlasException("Informe um email valido.")
        dominio = email_limpo.split("@", 1)[1].strip()
        if dominio not in DOMINIOS_EMAIL_CORPORATIVO:
            raise AtlasException("Informe um email corporativo da empresa.")
        return email_limpo

    def _garantir_email_unico(self, email: str, login: str | None = None, id_usuario: str | None = None) -> None:
        usuarios = self.repository.buscar_usuario_por_email(email)
        for usuario in usuarios:
            usuario_id = str(usuario[0] or "").strip()
            usuario_login = str(usuario[1] or "").strip().upper()
            if login and usuario_login == login.upper():
                continue
            if id_usuario and usuario_id == str(id_usuario):
                continue
            raise AtlasException("Este email ja esta vinculado a outro usuario.")


