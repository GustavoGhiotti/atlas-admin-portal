import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { concluirPrimeiroAcesso, getApiError } from "@/services/atlasApi";

export default function PrimeiroAcesso() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const emailValue = email.trim();
  const novaSenhaValue = novaSenha.trim();
  const confirmacaoValue = confirmacao.trim();
  const canSubmit = Boolean(emailValue && novaSenhaValue && confirmacaoValue);

  if ((user?.email || "").trim()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setMessage("");
      setError("Preencha e-mail, nova senha e confirmação para continuar.");
      return;
    }
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const data = await concluirPrimeiroAcesso({
        email: emailValue,
        nova_senha: novaSenhaValue,
        confirmacao_nova_senha: confirmacaoValue,
      });
      updateUser({ email: data.email, status: 1 });
      setMessage(data.mensagem);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao concluir primeiro acesso."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle="Primeiro acesso concluído" errorTitle="Falha no primeiro acesso" />
      <PageHeader
        eyebrow="Primeiro acesso"
        title="Defina seu e-mail e nova senha"
        description="Cadastre e-mail e senha definitivos para liberar o uso seguro da conta."
      />

      <section className="surface-card">
        <div className="info-grid">
          <article className="info-card">
            <span>Usuário</span>
            <strong>{user?.nm_login}</strong>
          </article>
          <article className="info-card">
            <span>Colaborador</span>
            <strong>{user?.nm_colaborador}</strong>
          </article>
        </div>

        <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
          <label className="field field--full">
            <span>E-mail obrigatório</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            <span>Nova senha</span>
            <input type="password" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} required />
          </label>
          <label className="field">
            <span>Confirmação</span>
            <input type="password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} required />
          </label>
          <button className="button field--full" type="submit" disabled={loading || !canSubmit}>
            {loading ? "Salvando..." : "Concluir primeiro acesso"}
          </button>
        </form>
      </section>
    </div>
  );
}
