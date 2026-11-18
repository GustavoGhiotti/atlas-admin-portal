import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import atlasHeroImage from "@/assets/atlas.jpg";
import grupoAcmeLogo from "@/assets/grupo-acme-logo.png";
import AuthFooter from "@/components/ui/AuthFooter";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import { useAuth } from "@/contexts/AuthContext";
import { getApiError, loginPortal } from "@/services/atlasApi";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameValue = username.trim();
  const passwordValue = password.trim();
  const canSubmit = Boolean(usernameValue && passwordValue);

  useEffect(() => {
    const state = location.state as { successMessage?: string } | null;
    if (state?.successMessage) {
      setSuccessMessage(state.successMessage);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const redirectMessage = sessionStorage.getItem("auth_redirect_message");
    if (redirectMessage) {
      setError(redirectMessage);
      setSuccessMessage("");
      sessionStorage.removeItem("auth_redirect_message");
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Informe login e senha para continuar.");
      setSuccessMessage("");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const data = await loginPortal(usernameValue, passwordValue);
      login(data.token, data.usuario);
      navigate((data.usuario.email || "").trim() ? "/" : "/primeiro-acesso", { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError, "Erro ao autenticar."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <FeedbackToastBridge
        successMessage={successMessage}
        errorMessage={error}
        successTitle="Operação concluída"
        errorTitle="Falha no login"
      />
      <section
        className="auth-panel auth-panel--hero auth-panel--hero-login"
        style={{ backgroundImage: `url(${atlasHeroImage})` }}
      >
        <div className="auth-hero">
          <div className="auth-hero__top" />
        </div>
      </section>

      <section className="auth-panel auth-panel--centered">
        <div className="auth-panel__content">
          <div className="auth-login-brand">
            <img className="auth-login-brand__logo" src={grupoAcmeLogo} alt="Atlas" />
          </div>

          <div className="auth-login-form">
            <div className="auth-login-form__main">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Acesso</p>
                  <h2>Entrar no portal</h2>
                </div>
              </div>

              <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 8 }}>
                <label className="field">
                  <span className="field-label-with-help field-help-wrap">
                    Login
                    <HelpBadge text="Se não lembrar seu usuário ou se este for o primeiro acesso, use o botão Verificar usuário." />
                  </span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="usuário" required />
                </label>
                <label className="field">
                  <span className="field-label-with-help field-help-wrap">
                    Senha
                    <HelpBadge text="No primeiro acesso, use a senha padrão: primeira letra do nome + 1234@$." />
                  </span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="senha" required />
                </label>
                <div className="auth-actions">
                  <button className="button" type="submit" disabled={loading || !canSubmit}>
                    {loading ? "Entrando..." : "Entrar"}
                  </button>
                </div>
                <div className="auth-actions auth-actions--split">
                  <Link className="button button--secondary" to="/verificar-usuario">
                    Verificar usuário
                  </Link>
                  <Link className="button button--secondary" to="/recuperar-senha">
                    Esqueci a senha
                  </Link>
                </div>
              </form>
            </div>

            <p className="auth-login-description muted">
              Portal interno para gestão de acessos, operações, monitoramento e comunicação em um único ambiente.
            </p>
          </div>
        </div>
      </section>
      <AuthFooter />
    </main>
  );
}

type HelpBadgeProps = {
  text: string;
};

function HelpBadge({ text }: HelpBadgeProps) {
  return (
    <>
      <span className="field-help" aria-hidden="true">
        !
      </span>
      <span className="field-help-popover" role="tooltip">
        {text}
      </span>
    </>
  );
}
