import { FormEvent, useEffect, useState } from "react";

import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  excluirUsuarioPortal,
  getApiError,
  listarGruposPortal,
  listarUsuariosPermissoesPortal,
  registrarUsuarioPortal,
  type GrupoPortal,
  type UsuarioPermissaoPortal,
} from "@/services/atlasApi";

export default function CriacaoUsuarios() {
  const [grupos, setGrupos] = useState<GrupoPortal[]>([]);
  const [usuariosManuais, setUsuariosManuais] = useState<UsuarioPermissaoPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function refreshUsuariosManuais() {
    const usuariosData = await listarUsuariosPermissoesPortal();
    setUsuariosManuais(usuariosData.filter((usuario) => usuario.status === "ATIVO MANUAL"));
  }

  async function load() {
    setLoading(true);
    try {
      const [gruposData, usuariosData] = await Promise.all([listarGruposPortal(), listarUsuariosPermissoesPortal()]);
      setGrupos(gruposData);
      setUsuariosManuais(usuariosData.filter((usuario) => usuario.status === "ATIVO MANUAL"));
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar os dados administrativos.") });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setFeedback(null);

    try {
      const formData = new FormData(form);
      const data = await registrarUsuarioPortal({
        nm_login: String(formData.get("nm_login") || ""),
        nome_colaborador: String(formData.get("nome_colaborador") || ""),
        cpf_colaborador: String(formData.get("cpf_colaborador") || ""),
        email_colaborador: String(formData.get("email_colaborador") || ""),
        senha_colaborador: String(formData.get("senha_colaborador") || ""),
        confirmacao_senha: String(formData.get("confirmacao_senha") || ""),
        id_grupo: String(formData.get("id_grupo") || ""),
      });
      form.reset();
      setFeedback({ type: "success", message: data.mensagem });

      try {
        await refreshUsuariosManuais();
      } catch {
        setFeedback({
          type: "success",
          message: `${data.mensagem} A listagem será atualizada novamente na próxima consulta.`,
        });
      }
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao registrar usuário.") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: UsuarioPermissaoPortal) {
    const confirmed = window.confirm(`Deseja excluir o usuário manual "${user.nm_login}"?`);
    if (!confirmed) return;

    setDeletingId(user.id_usuario);
    setFeedback(null);
    try {
      const data = await excluirUsuarioPortal(user.id_usuario);
      setUsuariosManuais((current) => current.filter((item) => item.id_usuario !== user.id_usuario));
      setFeedback({ type: "success", message: data.mensagem });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao excluir o usuário manual.") });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Usuário manual" errorTitle="Falha no processo" />
      <PageHeader
        eyebrow="Administração"
        title="Criação manual de usuários"
        description="Cadastre usuários fora do processo automatizado e gerencie, nesta mesma tela, as exclusões necessárias."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>Registre um novo usuário manual</h2>
          </div>
        </div>

        {loading ? <div className="page-loader">Carregando dados...</div> : null}
        <form className="form-grid form-grid--two criacao-usuarios__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Login</span>
            <input name="nm_login" placeholder="usuario.portal" required />
          </label>

          <label className="field">
            <span>Nome do colaborador</span>
            <input name="nome_colaborador" placeholder="Nome completo" required />
          </label>

          <label className="field">
            <span>CPF</span>
            <input name="cpf_colaborador" placeholder="Somente números" maxLength={14} required />
          </label>

          <label className="field">
            <span>E-mail</span>
            <input name="email_colaborador" type="email" placeholder="usuario@empresa.com" required />
          </label>

          <label className="field">
            <span>Grupo inicial</span>
            <select name="id_grupo" defaultValue="" required>
              <option value="" disabled>
                Selecione o grupo
              </option>
              {grupos.map((grupo) => (
                <option key={grupo.id_grupo} value={grupo.id_grupo}>
                  {grupo.nm_grupo}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Senha</span>
            <input name="senha_colaborador" type="password" required />
          </label>

          <label className="field">
            <span>Confirmação da senha</span>
            <input name="confirmacao_senha" type="password" required />
          </label>

          <div className="criacao-usuarios__form-actions">
            <button className="button" type="submit" disabled={loading || submitting}>
              {submitting ? "Registrando..." : "Registrar usuário"}
            </button>
          </div>
        </form>
      </section>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Usuários manuais</p>
            <h2>Gerencie os usuários criados fora do processo automatizado</h2>
          </div>
        </div>

        {loading ? (
          <div className="page-loader">Carregando usuários manuais...</div>
        ) : (
          <DataTable
            className="criacao-usuarios-table"
            title="Usuários criados manualmente"
            exportFileName="usuarios-manuais.csv"
            data={usuariosManuais}
            emptyMessage="Nenhum usuário manual cadastrado até o momento."
            columns={[
              {
                id: "nome",
                title: "Nome",
                accessor: (row) => row.nm_colaborador,
                sortable: true,
                render: (row) => <div className="criacao-usuarios-table__text">{row.nm_colaborador}</div>,
              },
              {
                id: "login",
                title: "Login",
                accessor: (row) => row.nm_login,
                sortable: true,
                render: (row) => <div className="criacao-usuarios-table__text">{row.nm_login}</div>,
              },
              {
                id: "cpf",
                title: "CPF",
                accessor: (row) => row.nu_cpf_colaborador,
                sortable: true,
                render: (row) => (
                  <div className="criacao-usuarios-table__text criacao-usuarios-table__text--mono">{row.nu_cpf_colaborador}</div>
                ),
              },
              {
                id: "email",
                title: "E-mail",
                accessor: (row) => row.email || "-",
                sortable: true,
                render: (row) => <div className="criacao-usuarios-table__text">{row.email || "-"}</div>,
              },
              {
                id: "grupos",
                title: "Grupos",
                accessor: (row) => row.grupos.join(", "),
                render: (row) => <div className="criacao-usuarios-table__groups">{row.grupos.join(", ") || "-"}</div>,
              },
              {
                id: "acoes",
                title: "Ações",
                accessor: (row) => row.id_usuario,
                render: (row) => (
                  <div className="criacao-usuarios-table__actions">
                    <button
                      className="button button--danger"
                      type="button"
                      disabled={deletingId === row.id_usuario}
                      onClick={() => handleDelete(row)}
                    >
                      {deletingId === row.id_usuario ? "Excluindo..." : "Excluir usuário"}
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
