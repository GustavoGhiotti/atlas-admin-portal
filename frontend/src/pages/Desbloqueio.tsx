import { FormEvent, useState } from "react";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { formatCpf } from "@/lib/format";
import { desbloquearUsuario, getApiError, pesquisarUsuario } from "@/services/atlasApi";

export default function Desbloqueio() {
  const [cpf, setCpf] = useState("");
  const [usuario, setUsuario] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const cpfValue = cpf.trim();
  const canSearch = cpfValue.length === 11;

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (!canSearch) {
      setUsuario(null);
      setFeedback({ type: "danger", message: "Informe um CPF válido com 11 dígitos." });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const data = await pesquisarUsuario(cpfValue);
      setUsuario(data.usuario);
      setFeedback({ type: "success", message: data.mensagem });
    } catch (error) {
      setUsuario(null);
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao pesquisar colaborador.") });
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    if (!usuario) return;
    setUnlocking(true);
    setFeedback(null);
    try {
      const data = await desbloquearUsuario(usuario.nu_cpf_colaborador);
      setFeedback({ type: "success", message: data.mensagem });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao desbloquear usuário.") });
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluída" errorTitle="Falha no desbloqueio" />
      <PageHeader
        eyebrow="Segurança"
        title="Desbloqueio de usuário"
        description="Localize usuários por CPF e restabeleça o acesso com rastreabilidade."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Consulta</p>
            <h2>Localize o colaborador</h2>
          </div>
        </div>
        <form className="inline-form" onSubmit={handleSearch}>
          <label className="field field--grow">
            <span>CPF do colaborador</span>
            <input
              inputMode="numeric"
              value={cpf}
              onChange={(event) => setCpf(event.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="00000000000"
            />
          </label>
          <button className="button" type="submit" disabled={loading || !canSearch}>
            {loading ? "Consultando..." : "Pesquisar"}
          </button>
        </form>
      </section>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Resultado</p>
            <h3>Valide os dados retornados</h3>
          </div>
          <button className="button button--secondary" type="button" disabled={!usuario || unlocking} onClick={handleUnlock}>
            {unlocking ? "Executando..." : "Desbloquear usuário"}
          </button>
        </div>
        {usuario ? (
          <div className="info-grid">
            <article className="info-card"><span>Colaborador</span><strong>{usuario.nm_colaborador}</strong></article>
            <article className="info-card"><span>Login</span><strong>{usuario.nm_login_colaborador}</strong></article>
            <article className="info-card"><span>CPF</span><strong>{formatCpf(usuario.nu_cpf_colaborador)}</strong></article>
            <article className="info-card"><span>Função</span><strong>{usuario.funcao_colaborador}</strong></article>
            <article className="info-card"><span>Centro de custo</span><strong>{usuario.centro_custo_colaborador}</strong></article>
            <article className="info-card"><span>Status</span><strong>{usuario.status_usuario}</strong></article>
          </div>
        ) : (
          <div className="empty-state">Informe um CPF para carregar os dados do colaborador.</div>
        )}
      </section>
    </div>
  );
}
