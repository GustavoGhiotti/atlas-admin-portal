import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import atlasHeroImage from "@/assets/atlas.jpg";
import AuthFooter from "@/components/ui/AuthFooter";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { confirmarRecuperacaoSenha, consultarRecuperacaoSenha, getApiError, recuperarSenha } from "@/services/atlasApi";

export default function RecuperarSenha() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [cpfSolicitacao, setCpfSolicitacao] = useState("");
  const [token, setToken] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [usuarioLocalizado, setUsuarioLocalizado] = useState<{ nm_login: string; email: string } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [tokenEnviado, setTokenEnviado] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const cpfValue = cpfSolicitacao.trim();
  const tokenValue = token.trim();
  const novaSenhaValue = novaSenha.trim();
  const confirmacaoValue = confirmacao.trim();
  const canLookup = cpfValue.length === 11;
  const canRequestToken = Boolean(usuarioLocalizado && canLookup);
  const canConfirmRecovery = Boolean(canLookup && tokenValue && novaSenhaValue && confirmacaoValue);
  const stepInstruction = tokenEnviado
    ? "Preencha o token recebido por e-mail, defina a nova senha e conclua a redefinição da conta."
    : usuarioLocalizado
      ? "Confirme os dados localizados e envie o token para liberar a etapa de redefinição da senha."
      : "Informe o CPF para validar o e-mail cadastrado e iniciar a recuperação do acesso.";

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleRecoveryLookup(event: FormEvent) {
    event.preventDefault();
    if (!canLookup) {
      setUsuarioLocalizado(null);
      setTokenEnviado(false);
      setMessage("");
      setError("Informe um CPF válido com 11 dígitos.");
      return;
    }
    setLookupLoading(true);
    setError("");
    setMessage("");
    setTokenEnviado(false);
    try {
      const result = await consultarRecuperacaoSenha(cpfValue);
      setUsuarioLocalizado({ nm_login: result.nm_login, email: result.email });
      setMessage(result.mensagem);
    } catch (requestError) {
      setUsuarioLocalizado(null);
      setError(getApiError(requestError, "Falha ao localizar o CPF informado."));
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleRecoveryRequest(event: FormEvent) {
    event.preventDefault();
    if (!canRequestToken) {
      setMessage("");
      setError("Valide um CPF antes de solicitar o token.");
      return;
    }
    setRequestLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await recuperarSenha(cpfValue);
      setTokenEnviado(true);
      setMessage(`${result.mensagem} Token enviado para: ${result.email_destino}`);
    } catch (requestError) {
      setTokenEnviado(false);
      setError(getApiError(requestError, "Falha ao enviar token de recuperação."));
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleRecoveryConfirm(event: FormEvent) {
    event.preventDefault();
    if (!canConfirmRecovery) {
      setError("Preencha CPF, token, nova senha e confirmação para continuar.");
      return;
    }
    setConfirmLoading(true);
    setError("");
    try {
      const result = await confirmarRecuperacaoSenha({
        cpf: cpfValue,
        token: tokenValue,
        nova_senha: novaSenhaValue,
        confirmacao_nova_senha: confirmacaoValue,
      });
      navigate("/login", {
        replace: true,
        state: { successMessage: result.mensagem },
      });
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao redefinir senha com token."));
    } finally {
      setConfirmLoading(false);
    }
  }

  function handleBackToCpfStep() {
    setTokenEnviado(false);
    setUsuarioLocalizado(null);
    setToken("");
    setNovaSenha("");
    setConfirmacao("");
    setError("");
    setMessage("");
  }

  return (
    <main className="auth-shell">
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle="Recuperação em andamento" errorTitle="Falha na recuperação" />
      <section
        className="auth-panel auth-panel--hero auth-panel--hero-login"
        style={{ backgroundImage: `url(${atlasHeroImage})` }}
      >
        <div className="auth-hero">
          <div className="auth-hero__top">
            <Link className="button button--ghost" to="/login">
              Voltar
            </Link>
          </div>
          <div className="auth-hero__content" />
        </div>
      </section>

      <section className="auth-panel">
        <PageHeader
          eyebrow="Senha"
          title="Recuperar senha"
          description="Solicite o token pelo CPF, valide o código e redefina a senha da conta."
        />

        {!tokenEnviado ? (
          <>
            <form className="form-grid recovery-box" onSubmit={handleRecoveryLookup}>
              <label className="field">
                <span>CPF para verificação</span>
                <input
                  value={cpfSolicitacao}
                  onChange={(event) => setCpfSolicitacao(event.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="00000000000"
                  inputMode="numeric"
                  required
                />
              </label>
              <button className="button" type="submit" disabled={lookupLoading || !canLookup}>
                {lookupLoading ? "Verificando..." : "Verificar"}
              </button>
            </form>

            {usuarioLocalizado ? (
              <form className="form-grid recovery-box" onSubmit={handleRecoveryRequest}>
                <div className="result-box">
                  <strong>Login:</strong> {usuarioLocalizado.nm_login}
                  <br />
                  <strong>E-mail:</strong> {usuarioLocalizado.email}
                </div>
                <div className="auth-actions">
                  <button className="button" type="submit" disabled={requestLoading || !canRequestToken}>
                    {requestLoading ? "Enviando..." : "Enviar token por e-mail"}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        ) : null}

        {tokenEnviado ? (
          <form className="form-grid recovery-box" onSubmit={handleRecoveryConfirm}>
            <label className="field">
              <span>Token recebido por e-mail</span>
              <input value={token} onChange={(event) => setToken(event.target.value.trim())} placeholder="000000" required />
            </label>
            <label className="field">
              <span>Nova senha</span>
              <input type="password" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} required />
            </label>
            <label className="field">
              <span>Confirmação da nova senha</span>
              <input type="password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} required />
            </label>
            <div className="auth-actions auth-actions--split">
              <button className="button" type="submit" disabled={confirmLoading || !canConfirmRecovery}>
                {confirmLoading ? "Validando..." : "Redefinir senha"}
              </button>
              <button className="button button--secondary" type="button" onClick={handleBackToCpfStep}>
                Voltar para CPF
              </button>
            </div>
          </form>
        ) : null}

        <div className="recovery-box">
          <p className="auth-login-description muted">{stepInstruction}</p>
        </div>
      </section>
      <AuthFooter />
    </main>
  );
}
