from .whatsapp_repository import WhatsAppRepository
from .auth_repository import AuthRepository
from .gestao_usuario_repository import GestaoUsuarioRepository
from .recuperacao_senha_repository import RecuperacaoSenhaRepository
from .desbloqueio_repository import DesbloqueioRepository
from .relatorio_infobip_repository import RelatorioInfobipRepository
from .relatorio_rcs_repository import RelatorioRcsRepository
from .relatorio_sendgrid_repository import RelatorioSendGridRepository
from .alteracoes_colaboradores_repository import AlteracoesColaboradoresRepository
from .arquivos_auditoria_repository import ArquivosAuditoriaRepository
from .importacao_banco_auditoria_repository import ImportacaoBancoAuditoriaRepository
from .importacao_banco_repository import ImportacaoBancoRepository
from .agenda_repository import AgendaRepository
from .numeros_infobip_repository import NumerosInfobipRepository
from .portalacordo_monitoramento_repository import PortalAcordoMonitoramentoRepository
from .portalacordo_config_repository import PortalAcordoConfigRepository
from .transferencias_repository import TransferenciasRepository

__all__ = [
    "WhatsAppRepository",
    "AuthRepository",
    "GestaoUsuarioRepository",
    "RecuperacaoSenhaRepository",
    "DesbloqueioRepository",
    "RelatorioInfobipRepository",
    "RelatorioRcsRepository",
    "RelatorioSendGridRepository",
    "AlteracoesColaboradoresRepository",
    "ArquivosAuditoriaRepository",
    "ImportacaoBancoAuditoriaRepository",
    "ImportacaoBancoRepository",
    "AgendaRepository",
    "NumerosInfobipRepository",
    "PortalAcordoMonitoramentoRepository",
    "PortalAcordoConfigRepository",
    "TransferenciasRepository",
]
