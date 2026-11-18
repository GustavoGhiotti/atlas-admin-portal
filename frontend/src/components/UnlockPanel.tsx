import { FormEvent, useState } from "react";
import type { CSSProperties } from "react";

import { desbloquearUsuario, pesquisarUsuario } from "@/services/atlasApi";
import { useAuth } from "@/contexts/AuthContext";

type UnlockPanelProps = {
  onResult: (value: unknown) => void;
};

const initialForm = {
  cpf: "",
};

export default function UnlockPanel({ onResult }: UnlockPanelProps) {
  const [form, setForm] = useState(initialForm);
  const [resultado, setResultado] = useState("Preencha os dados e teste a API.");
  const { user } = useAuth();
  const cpfValue = form.cpf.trim();
  const canSubmit = cpfValue.length === 11;

  async function handlePesquisa(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      const data = { mensagem: "Informe um CPF valido com 11 digitos." };
      setResultado(JSON.stringify(data, null, 2));
      onResult(data);
      return;
    }
    try {
      const data = await pesquisarUsuario(cpfValue);
      const formatted = JSON.stringify(data, null, 2);
      setResultado(formatted);
      onResult(data);
    } catch (error: any) {
      const data = error.response?.data ?? { mensagem: error.message };
      setResultado(JSON.stringify(data, null, 2));
      onResult(data);
    }
  }

  async function handleDesbloqueio() {
    if (!canSubmit) {
      const data = { mensagem: "Informe um CPF valido com 11 digitos." };
      setResultado(JSON.stringify(data, null, 2));
      onResult(data);
      return;
    }
    try {
      const data = await desbloquearUsuario(cpfValue);
      const formatted = JSON.stringify(data, null, 2);
      setResultado(formatted);
      onResult(data);
    } catch (error: any) {
      const data = error.response?.data ?? { mensagem: error.message };
      setResultado(JSON.stringify(data, null, 2));
      onResult(data);
    }
  }

  return (
    <section style={styles.card}>
      <p style={styles.kicker}>Modulo</p>
      <h2 style={styles.title}>Desbloqueio de usuarios</h2>
      <p style={styles.subtitle}>
        Solicitante autenticado: <strong>{user?.nm_colaborador}</strong> ({user?.nm_login})
      </p>

      <form style={styles.form} onSubmit={handlePesquisa}>
        <label style={styles.label}>
          <span>CPF do usuario</span>
          <input
            style={styles.input}
            value={form.cpf}
            onChange={(event) => setForm((value) => ({ ...value, cpf: event.target.value.replace(/\D/g, "").slice(0, 11) }))}
            placeholder="Somente numeros"
            inputMode="numeric"
            required
          />
        </label>

        <div style={styles.actions}>
          <button style={styles.secondaryButton} type="submit" disabled={!canSubmit}>
            Pesquisar usuario
          </button>
          <button style={styles.primaryButton} type="button" onClick={handleDesbloqueio} disabled={!canSubmit}>
            Desbloquear usuario
          </button>
        </div>
      </form>

      <pre style={styles.output}>{resultado}</pre>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "#fffaf2",
    border: "1px solid #ddc9ab",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 40px rgba(60, 38, 17, 0.08)",
  },
  kicker: {
    margin: 0,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#ab4d28",
    fontWeight: 700,
  },
  title: {
    margin: "6px 0 16px",
    fontSize: 28,
  },
  subtitle: {
    margin: "0 0 16px",
    color: "#6f604f",
  },
  form: {
    display: "grid",
    gap: 12,
  },
  label: {
    display: "grid",
    gap: 6,
    fontWeight: 600,
  },
  input: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid #d7c8ab",
    background: "#fff",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: 0,
    borderRadius: 999,
    padding: "12px 18px",
    background: "#ab4d28",
    color: "#fff7f0",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d7c8ab",
    borderRadius: 999,
    padding: "12px 18px",
    background: "#efe5d5",
    color: "#231a10",
    fontWeight: 700,
    cursor: "pointer",
  },
  output: {
    margin: "18px 0 0",
    minHeight: 160,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: 16,
    borderRadius: 18,
    background: "#20170f",
    color: "#f5ebde",
    border: "1px solid #47301d",
  },
};
