import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import AlteracoesColaboradores from "./pages/AlteracoesColaboradores";
import ArquivosExportacao from "./pages/ArquivosExportacao";
import ArquivosImportacao from "./pages/ArquivosImportacao";
import ArquivosImportacaoBanco from "./pages/ArquivosImportacaoBanco";
import Transferencias from "./pages/Transferencias";
import BancoImagens from "./pages/BancoImagens";
import Chamados from "./pages/Chamados";
import ControleTarefas from "./pages/ControleTarefas";
import CriacaoUsuarios from "./pages/CriacaoUsuarios";
import CargasChegada from "./pages/CargasChegada";
import CargasDashboard from "./pages/CargasDashboard";
import Desbloqueio from "./pages/Desbloqueio";
import EmailBloqueio from "./pages/EmailBloqueio";
import EmailDashboard from "./pages/EmailDashboard";
import EmailEnvioTeste from "./pages/EmailEnvioTeste";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import PermissoesUsuarios from "./pages/PermissoesUsuarios";
import PrimeiroAcesso from "./pages/PrimeiroAcesso";
import RecuperarSenha from "./pages/RecuperarSenha";
import PortalAcordoConfig from "./pages/PortalAcordoConfig";
import PortalAcordoDashboard from "./pages/PortalAcordoDashboard";
import SmsDashboard from "./pages/SmsDashboard";
import SmsEnvioTeste from "./pages/SmsEnvioTeste";
import SmsLimitesEnvio from "./pages/SmsLimitesEnvio";
import UsuariosCarteiraVega from "./pages/UsuariosCarteiraVega";
import VerificarUsuario from "./pages/VerificarUsuario";
import WhatsappDashboard from "./pages/WhatsappDashboard";
import WhatsappNumerosInfobip from "./pages/WhatsappNumerosInfobip";
import WhatsappTemplates from "./pages/WhatsappTemplates";
import { ALLOWED_LOGINS, GROUPS } from "./lib/permissions";
import ReguaMIS from "./pages/ReguaMIS";
import { CalendarPage } from "./pages/Agenda";
import ProcessosBD from "./pages/Processos";
import Treinamentos from "./pages/Treinamentos";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/verificar-usuario" element={<VerificarUsuario />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Index />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Perfil />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/processos"
            element={
              <ProtectedRoute allowedGroups={GROUPS.controleTarefas}>
                <AppShell>
                  <ProcessosBD />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/primeiro-acesso"
            element={
              <ProtectedRoute>
                <AppShell>
                  <PrimeiroAcesso />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/permissoes"
            element={
              <ProtectedRoute allowedGroups={GROUPS.admin}>
                <AppShell>
                  <PermissoesUsuarios />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios/criacao-manual"
            element={
              <ProtectedRoute allowedGroups={GROUPS.admin}>
                <AppShell>
                  <CriacaoUsuarios />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/desbloqueio"
            element={
              <ProtectedRoute allowedGroups={GROUPS.desbloqueio}>
                <AppShell>
                  <Desbloqueio />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios/carteira-vega"
            element={
              <ProtectedRoute allowedGroups={GROUPS.usuariosCarteira}>
                <AppShell>
                  <UsuariosCarteiraVega />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/arquivos/importacao"
            element={
              <ProtectedRoute allowedGroups={GROUPS.arquivos}>
                <AppShell>
                  <ArquivosImportacao />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/arquivos/exportacao"
            element={
              <ProtectedRoute allowedGroups={GROUPS.arquivos}>
                <AppShell>
                  <ArquivosExportacao />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/arquivos/importacao-banco"
            element={
              <ProtectedRoute allowedGroups={GROUPS.arquivos}>
                <AppShell>
                  <ArquivosImportacaoBanco />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/arquivos/transferencia"
            element={
              <ProtectedRoute allowedGroups={GROUPS.arquivos}>
                <AppShell>
                  <Transferencias />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/banco-imagens"
            element={
              <ProtectedRoute allowedGroups={GROUPS.imagens}>
                <AppShell>
                  <BancoImagens />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chamados"
            element={
              <ProtectedRoute allowedGroups={GROUPS.chamados}>
                <AppShell>
                  <Chamados />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/agenda"
            element={
              <ProtectedRoute allowedGroups={GROUPS.agenda}>
                <AppShell>
                  <CalendarPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/controle-tarefas"
            element={
              <ProtectedRoute allowedGroups={GROUPS.controleTarefas}>
                <AppShell>
                  <ControleTarefas />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cargas"
            element={<Navigate to="/cargas/status" replace />}
          />
          <Route
            path="/cargas/status"
            element={
              <ProtectedRoute allowedGroups={GROUPS.cargas}>
                <AppShell>
                  <CargasDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cargas/chegada"
            element={
              <ProtectedRoute allowedGroups={GROUPS.cargas}>
                <AppShell>
                  <CargasChegada />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/alteracoes-colaboradores"
            element={
              <ProtectedRoute allowedGroups={GROUPS.alteracoes}>
                <AppShell>
                  <AlteracoesColaboradores />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="/treinamentos" element={<Navigate to="/treinamentos/dashboard" replace />} />
          <Route path="/treinamentos/controle" element={<Navigate to="/treinamentos/dashboard" replace />} />
          <Route
            path="/treinamentos/dashboard"
            element={<ProtectedRoute allowedGroups={GROUPS.treinamentos} allowedLogins={ALLOWED_LOGINS.treinamentos}><AppShell><Treinamentos view="dashboard" /></AppShell></ProtectedRoute>}
          />
          <Route
            path="/treinamentos/admissoes"
            element={<ProtectedRoute allowedGroups={GROUPS.treinamentos} allowedLogins={ALLOWED_LOGINS.treinamentos}><AppShell><Treinamentos view="admissoes" /></AppShell></ProtectedRoute>}
          />
          <Route
            path="/treinamentos/treinados"
            element={<ProtectedRoute allowedGroups={GROUPS.treinamentos} allowedLogins={ALLOWED_LOGINS.treinamentos}><AppShell><Treinamentos view="treinados" /></AppShell></ProtectedRoute>}
          />
          <Route
            path="/treinamentos/agenda"
            element={<ProtectedRoute allowedGroups={GROUPS.treinamentos} allowedLogins={ALLOWED_LOGINS.treinamentos}><AppShell><Treinamentos view="agenda" /></AppShell></ProtectedRoute>}
          />
          <Route
            path="/sms/infobip"
            element={
              <ProtectedRoute allowedGroups={GROUPS.smsDashboard}>
                <AppShell>
                  <SmsDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/portalacordo/monitoramento"
            element={
              <ProtectedRoute allowedGroups={GROUPS.portalAcordo}>
                <AppShell>
                  <PortalAcordoDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/portalacordo/configuracao"
            element={
              <ProtectedRoute allowedGroups={GROUPS.portalAcordoConfig}>
                <AppShell>
                  <PortalAcordoConfig />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rcs/infobip"
            element={
              <ProtectedRoute allowedGroups={GROUPS.rcsDashboard}>
                <AppShell><SmsDashboard tipo="RCS" /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rcs/infobip/envio-teste"
            element={
              <ProtectedRoute allowedGroups={GROUPS.rcs}>
                <AppShell><SmsEnvioTeste tipo="RCS" /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rcs/infobip/limites-envio"
            element={
              <ProtectedRoute allowedGroups={GROUPS.rcs} allowedLogins={["CBSILVA", "LGNETO"]}>
                <AppShell><SmsLimitesEnvio tipo="RCS" /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sms/infobip/envio-teste"
            element={
              <ProtectedRoute allowedGroups={GROUPS.sms}>
                <AppShell>
                  <SmsEnvioTeste />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sms/infobip/limites-envio"
            element={
              <ProtectedRoute
                allowedGroups={GROUPS.sms}
                allowedLogins={["CBSILVA", "LGNETO"]}
              >
                <AppShell>
                  <SmsLimitesEnvio />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email/sendgrid"
            element={
              <ProtectedRoute allowedGroups={GROUPS.emailDashboard}>
                <AppShell>
                  <EmailDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email/sendgrid/envio-teste"
            element={
              <ProtectedRoute allowedGroups={GROUPS.email}>
                <AppShell>
                  <EmailEnvioTeste />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email/sendgrid/bloqueio"
            element={
              <ProtectedRoute allowedGroups={GROUPS.emailBloqueio}>
                <AppShell>
                  <EmailBloqueio />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
          path="/whatsapp/templates"
          element={
            <ProtectedRoute allowedGroups={GROUPS.whatsappTemplates}>
              <AppShell>
                <WhatsappTemplates />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/regua-mis"
          element={
            <ProtectedRoute allowedGroups={GROUPS.reguaMIS}>
              <AppShell>
                <ReguaMIS />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp/infobip/numeros"
          element={
            <ProtectedRoute allowedGroups={GROUPS.whatsapp}>
              <AppShell>
                <WhatsappNumerosInfobip />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
            path="/whatsapp/:provider"
            element={
              <ProtectedRoute allowedGroups={GROUPS.whatsapp}>
                <AppShell>
                  <WhatsappDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
