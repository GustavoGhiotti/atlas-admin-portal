import { FormEvent, useEffect, useState } from "react";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { alterarEmail, alterarSenha, getApiError } from "@/services/atlasApi";

function getInitials(name?: string | null) {
  if (!name) {
    return "US";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "US";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatCpf(cpf?: string | null) {
  const digits = (cpf || "").replace(/\D/g, "");

  if (digits.length !== 11) {
    return cpf || "-";
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export default function Perfil() {
  const { user, updateUser } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    setEmail(user?.email || "");
  }, [user?.email]);

  const initials = getInitials(user?.nm_colaborador);
  const formattedCpf = formatCpf(user?.nu_cpf_colaborador);
  const emailValue = user?.email || "-";
  const nextEmailValue = email.trim();
  const novaSenhaValue = novaSenha.trim();
  const confirmacaoValue = confirmacao.trim();
  const canSubmitEmail = Boolean(nextEmailValue);
  const canSubmitSenha = Boolean(novaSenhaValue && confirmacaoValue);

  async function handleSubmitSenha(event: FormEvent) {
    event.preventDefault();
    if (!canSubmitSenha) {
      setMessage("");
      setError("Preencha nova senha e confirmacao para continuar.");
      return;
    }
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const data = await alterarSenha(novaSenhaValue, confirmacaoValue);
      setMessage(data.mensagem);
      setNovaSenha("");
      setConfirmacao("");
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao alterar senha."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitEmail(event: FormEvent) {
    event.preventDefault();
    if (!canSubmitEmail) {
      setEmailMessage("");
      setEmailError("Informe um email valido para continuar.");
      return;
    }
    setEmailLoading(true);
    setEmailMessage("");
    setEmailError("");
    try {
      const data = await alterarEmail(nextEmailValue);
      updateUser({ email: data.email });
      setEmail(data.email);
      setEmailMessage(data.mensagem);
    } catch (requestError) {
      setEmailError(getApiError(requestError, "Falha ao atualizar email."));
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge successMessage={emailMessage} errorMessage={emailError} successTitle="Email atualizado" errorTitle="Falha ao atualizar email" />
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle="Senha atualizada" errorTitle="Falha ao atualizar senha" />
      <PageHeader
        eyebrow="Perfil e seguranca"
        title="Perfil do usuario"
        description="Gerencie identidade, contato e credenciais da conta em um fluxo unico."
      />

      <section className="surface-card perfil-card" id="perfil">
        <div className="perfil-card__header">
          <div className="perfil-card__identity">
            <div className="perfil-card__avatar" aria-hidden="true">
              <span>{initials}</span>
            </div>
            <div className="perfil-card__identity-copy">
              <p className="eyebrow">Conta corporativa</p>
              <h2>{user?.nm_colaborador || "Usuario"}</h2>
              <p className="perfil-card__role">{user?.nm_funcao || "-"}</p>
              <p className="perfil-card__cost-center">{user?.centro_custo || "-"}</p>
              <div className="perfil-card__meta">
                <span>{emailValue}</span>
                <span>{formattedCpf}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="perfil-card__section">
          <div className="perfil-card__section-heading">
            <p className="eyebrow">Resumo</p>
            <h3>Informacoes do usuario</h3>
          </div>

          <div className="perfil-overview-grid">
            <article className="perfil-overview-item">
              <span>Login</span>
              <strong>{user?.nm_login || "-"}</strong>
            </article>
            <article className="perfil-overview-item">
              <span>CPF</span>
              <strong>{formattedCpf}</strong>
            </article>
            <article className="perfil-overview-item">
              <span>Centro de custo</span>
              <strong>{user?.centro_custo || "-"}</strong>
            </article>
            <article className="perfil-overview-item">
              <span>Funcao</span>
              <strong>{user?.nm_funcao || "-"}</strong>
            </article>
            <article className="perfil-overview-item">
              <span>Email</span>
              <strong>{emailValue}</strong>
            </article>
          </div>
        </div>

        <div className="perfil-card__section">
          <div className="perfil-card__section-heading">
            <p className="eyebrow">Edicao</p>
            <h3>Ajustes da conta</h3>
          </div>

          <div className="perfil-action-list">
            <form className="perfil-action-section" onSubmit={handleSubmitEmail}>
              <div className="perfil-action-section__header">
                <div>
                  <h4>Atualizar email</h4>
                  <p>Atualize o email corporativo e preserve comunicacao e recuperacao de acesso.</p>
                </div>
              </div>

              <div className="perfil-action-section__body perfil-action-section__body--single">
                <label className="field">
                  <span>Email</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <button className="button" type="submit" disabled={emailLoading || !canSubmitEmail}>
                  {emailLoading ? "Salvando..." : "Atualizar email"}
                </button>
              </div>
            </form>

            <form className="perfil-action-section" onSubmit={handleSubmitSenha}>
              <div className="perfil-action-section__header">
                <div>
                  <h4>Atualizar senha</h4>
                  <p>Renove a senha da conta e reduza risco operacional de acesso.</p>
                </div>
              </div>

              <div className="perfil-action-section__body">
                <label className="field">
                  <span>Nova senha</span>
                  <input type="password" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} required />
                </label>
                <label className="field">
                  <span>Confirmacao</span>
                  <input type="password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} required />
                </label>
                <button className="button" type="submit" disabled={loading || !canSubmitSenha}>
                  {loading ? "Salvando..." : "Atualizar senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
