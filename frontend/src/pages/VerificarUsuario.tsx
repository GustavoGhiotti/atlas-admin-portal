import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import atlasHeroImage from "@/assets/atlas.jpg";
import AuthFooter from "@/components/ui/AuthFooter";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { consultarUsuarioLogin, getApiError } from "@/services/atlasApi";

export default function VerificarUsuario() {
  const { isAuthenticated } = useAuth();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [usuarioLocalizado, setUsuarioLocalizado] = useState<{ nm_login: string; email?: string | null } | null>(null);
  const cpfValue = cpf.trim();
  const canSubmit = cpfValue.length === 11;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setUsuarioLocalizado(null);
      setMessage("");
      setError("Informe um CPF válido com 11 dígitos.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await consultarUsuarioLogin(cpfValue);
      setUsuarioLocalizado({ nm_login: result.nm_login, email: result.email });
      setMessage(result.mensagem);
    } catch (requestError) {
      setUsuarioLocalizado(null);
      setError(getApiError(requestError, "Falha ao localizar o usuário informado."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle="Usuário localizado" errorTitle="Falha na verificação" />
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
          eyebrow="Usuário"
          title="Verificar usuário"
          description="Informe o CPF para localizar o login cadastrado e confirmar os dados de acesso."
        />

        <form className="form-grid recovery-box" onSubmit={handleSubmit}>
          <label className="field">
            <span>CPF para verificação</span>
            <input
              value={cpf}
              onChange={(event) => setCpf(event.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="00000000000"
              inputMode="numeric"
              required
            />
          </label>
          <button className="button" type="submit" disabled={loading || !canSubmit}>
            {loading ? "Verificando..." : "Verificar usuário"}
          </button>
        </form>

        {usuarioLocalizado ? (
          <div className="recovery-box">
            <div className="result-box">
              <strong>Login:</strong> {usuarioLocalizado.nm_login}
              <br />
              <strong>E-mail:</strong> {usuarioLocalizado.email || "Não cadastrado"}
            </div>
          </div>
        ) : null}

        <div className="recovery-box">
          <p className="auth-login-description muted">
            {usuarioLocalizado
              ? "Se este for o primeiro acesso, use a senha padrão: primeira letra do nome + 1234@$."
              : "Use esta consulta quando não lembrar o usuário ou quando precisar confirmar os dados de acesso."}
          </p>
        </div>
      </section>
      <AuthFooter />
    </main>
  );
}
