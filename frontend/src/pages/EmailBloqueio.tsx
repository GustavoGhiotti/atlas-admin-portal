import { FormEvent, useMemo, useState } from "react";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { bloquearEmailsSendgrid, getApiError } from "@/services/atlasApi";

type BloqueioResultado = {
  mensagem: string;
  status?: string;
  payload?: unknown;
  totalEmails: number;
};

function normalizarEmails(rawValue: string) {
  return Array.from(
    new Set(
      rawValue
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function extrairMensagemResposta(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    const payload = data as { mensagem?: string; detail?: string; status?: string };
    return payload.mensagem || payload.detail || payload.status || fallback;
  }

  return fallback;
}

export default function EmailBloqueio() {
  const [emailsInput, setEmailsInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<BloqueioResultado | null>(null);

  const emails = useMemo(() => normalizarEmails(emailsInput), [emailsInput]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!emails.length) {
      setError("Informe ao menos um e-mail para bloqueio.");
      setMessage("");
      setResultado(null);
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const data = await bloquearEmailsSendgrid(emails);
      const mensagem = extrairMensagemResposta(data, "Bloqueio enviado com sucesso.");

      setResultado({
        mensagem,
        status: typeof data === "object" && data ? (data as { status?: string }).status : undefined,
        payload: data,
        totalEmails: emails.length,
      });
      setMessage(mensagem);
    } catch (requestError) {
      setResultado(null);
      setError(getApiError(requestError, "Falha ao enviar bloqueio para a SendGrid."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle="Bloqueio enviado" errorTitle="Falha no bloqueio" />
      <PageHeader
        eyebrow="Operacao controlada / E-mail"
        title="Bloqueio de e-mails"
        description="Envie um e-mail unico ou uma lista para incluir na suppressions da SendGrid."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Envio</p>
            <h2>Informe os e-mails para bloqueio</h2>
          </div>
        </div>

        <form className="stack-md" onSubmit={handleSubmit}>
          <label className="field">
            <span>Lista de e-mails</span>
            <textarea
              name="emails"
              rows={10}
              placeholder={"usuario@empresa.com\ncliente@provedor.com\nou separe por virgula/; "}
              value={emailsInput}
              onChange={(event) => setEmailsInput(event.target.value)}
              required
            />
          </label>

          <div className="guide-card guide-card--standalone">
            <p>
              Aceita um e-mail por linha ou lista separada por espaco, virgula ou ponto e virgula. Duplicados sao removidos antes do envio.
            </p>
            <div className="info-grid">
              <article className="info-card">
                <span>E-mails prontos</span>
                <strong>{emails.length}</strong>
              </article>
              <article className="info-card">
                <span>Modo</span>
                <strong>{emails.length <= 1 ? "Unitario" : "Lote"}</strong>
              </article>
            </div>
          </div>

          <button className="button" type="submit" disabled={loading}>
            {loading ? "Enviando bloqueio..." : "Bloquear e-mails"}
          </button>
        </form>
      </section>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Retorno</p>
            <h2>Resultado da operacao</h2>
          </div>
        </div>

        {resultado ? (
          <div className="stack-md">
            <div className="info-grid">
              <article className="info-card">
                <span>Status</span>
                <strong>{resultado.status || "Processado"}</strong>
              </article>
              <article className="info-card">
                <span>Total enviado</span>
                <strong>{resultado.totalEmails}</strong>
              </article>
            </div>
            <div className="guide-card guide-card--standalone">
              <strong>Mensagem</strong>
              <p>{resultado.mensagem}</p>
            </div>
            <pre className="result-box">{JSON.stringify(resultado.payload, null, 2)}</pre>
          </div>
        ) : (
          <div className="empty-state">Envie a lista para visualizar a resposta retornada pelo endpoint de suppressions.</div>
        )}
      </section>
    </div>
  );
}
