import { useEffect, useState } from "react";

import Modal from "@/components/modals/Modal";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  atualizarPermissoesUsuarioPortal,
  excluirUsuarioPortal,
  getApiError,
  listarGruposPortal,
  listarUsuariosPermissoesPortal,
  obterPermissoesEfetivasUsuarioPortal,
  type GrupoPortal,
  type UsuarioPermissoesEfetivasResponse,
  type UsuarioPermissaoPortal,
} from "@/services/atlasApi";

export default function PermissoesUsuarios() {
  const [grupos, setGrupos] = useState<GrupoPortal[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPermissaoPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UsuarioPermissaoPortal | null>(null);
  const [email, setEmail] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [previewUser, setPreviewUser] = useState<UsuarioPermissaoPortal | null>(null);
  const [permissionPreview, setPermissionPreview] = useState<UsuarioPermissoesEfetivasResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewUsuario = permissionPreview?.usuario || previewUser;
  const previewPermissoes = permissionPreview?.permissoes || [];
  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [gruposData, usuariosData] = await Promise.all([listarGruposPortal(), listarUsuariosPermissoesPortal()]);
      setGrupos(gruposData);
      setUsuarios(usuariosData);
      setFeedback(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar permissões.") });
    } finally {
      setLoading(false);
    }
  }

  function openUser(user: UsuarioPermissaoPortal) {
    setSelectedUser(user);
    setEmail(user.email || "");
    setSelectedGroups(user.grupos);
  }

  function toggleGroup(groupName: string) {
    setSelectedGroups((current) =>
      current.includes(groupName) ? current.filter((item) => item !== groupName) : [...current, groupName],
    );
  }

  async function handleSave() {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const data = await atualizarPermissoesUsuarioPortal(selectedUser.id_usuario, {
        email_usuario: email,
        permissoes_usuario: selectedGroups,
      });

      setUsuarios((current) =>
        current.map((item) =>
          item.id_usuario === selectedUser.id_usuario ? { ...item, email, grupos: [...selectedGroups] } : item,
        ),
      );
      setFeedback({ type: "success", message: data.mensagem });
      setSelectedUser(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao atualizar permissões.") });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteManualUser() {
    if (!selectedUser || selectedUser.status !== "ATIVO MANUAL") return;

    const confirmed = window.confirm(`Deseja excluir o usuário manual "${selectedUser.nm_login}"?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const data = await excluirUsuarioPortal(selectedUser.id_usuario);
      setUsuarios((current) => current.filter((item) => item.id_usuario !== selectedUser.id_usuario));
      setFeedback({ type: "success", message: data.mensagem });
      setSelectedUser(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao excluir usuário manual.") });
    } finally {
      setSaving(false);
    }
  }

  async function openPermissionPreview(user: UsuarioPermissaoPortal) {
    setPreviewUser(user);
    setPermissionPreview(null);
    setLoadingPreview(true);

    try {
      const data = await obterPermissoesEfetivasUsuarioPortal(user.id_usuario);
      setPermissionPreview(data);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar visão de permissões.") });
      setPreviewUser(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Permissões atualizadas" errorTitle="Falha nas permissões" />
      <PageHeader
        eyebrow="Administração"
        title="Permissões de usuários"
        description="Ajuste e-mail e grupos de acesso para manter a governança do portal."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Usuários</p>
            <h2>Gerencie perfis cadastrados</h2>
          </div>
        </div>

        {loading ? (
          <div className="page-loader">Carregando usuários...</div>
        ) : (
          <DataTable
            title="Monitore usuários e status"
            exportFileName="permissoes-usuarios.csv"
            data={usuarios}
            columns={[
              { id: "nome", title: "Nome", accessor: (row) => row.nm_colaborador, sortable: true },
              { id: "login", title: "Usuário", accessor: (row) => row.nm_login, sortable: true },
              {
                id: "status",
                title: "Status",
                accessor: (row) => row.status,
                render: (row) => <span className={`badge${row.status === "ATIVO" ? "" : " badge--warning"}`}>{row.status}</span>,
              },
              {
                id: "acoes",
                title: "Perfil",
                accessor: (row) => row.id_usuario,
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button button--secondary" type="button" onClick={() => openUser(row)}>
                      Editar
                    </button>
                    <button className="button button--ghost-neutral" type="button" onClick={() => openPermissionPreview(row)}>
                      Visualizar
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>

      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Perfil do usuário"
        description="Atualize e-mail e grupos liberados para manter o acesso aderente."
      >
        {selectedUser ? (
          <div className="stack-lg">
            <div className="info-grid">
              <article className="info-card">
                <span>Nome</span>
                <strong>{selectedUser.nm_colaborador}</strong>
              </article>
              <article className="info-card">
                <span>Login</span>
                <strong>{selectedUser.nm_login}</strong>
              </article>
              <article className="info-card">
                <span>CPF</span>
                <strong>{selectedUser.nu_cpf_colaborador}</strong>
              </article>
              <article className="info-card">
                <span>Função</span>
                <strong>{selectedUser.nm_funcao}</strong>
              </article>
              <article className="info-card">
                <span>Centro de custo</span>
                <strong>{selectedUser.centro_custo}</strong>
              </article>
              <article className="info-card">
                <span>Status</span>
                <strong>{selectedUser.status}</strong>
              </article>
            </div>

            <label className="field">
              <span>E-mail</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@empresa.com" />
            </label>

            <div className="field">
              <span>Grupos liberados</span>
              <div className="checkbox-grid">
                {grupos.map((grupo) => (
                  <label key={grupo.id_grupo} className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(grupo.nm_grupo)}
                      onChange={() => toggleGroup(grupo.nm_grupo)}
                    />
                    <span>{grupo.nm_grupo}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="toolbar">
              <button className="button button--ghost-neutral" type="button" onClick={() => setSelectedUser(null)}>
                Fechar
              </button>
              {selectedUser.status === "ATIVO MANUAL" ? (
                <button className="button button--danger" type="button" disabled={saving} onClick={handleDeleteManualUser}>
                  {saving ? "Excluindo..." : "Excluir usuário"}
                </button>
              ) : null}
              <button className="button" type="button" disabled={saving} onClick={handleSave}>
                {saving ? "Salvando..." : "Atualizar"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!previewUser}
        onClose={() => setPreviewUser(null)}
        title="Visao de permissoes"
        description="Confira os acessos efetivos sem entrar como o usuario."
      >
        {loadingPreview ? (
          <div className="page-loader">Carregando permissoes...</div>
        ) : previewUsuario ? (
          <div className="stack-lg">
            <div className="info-grid">
              <article className="info-card">
                <span>Usuario</span>
                <strong>{previewUsuario.nm_login}</strong>
              </article>
              <article className="info-card">
                <span>Nome</span>
                <strong>{previewUsuario.nm_colaborador}</strong>
              </article>
              <article className="info-card">
                <span>Grupos</span>
                <strong>{previewUsuario.grupos.join(", ") || "-"}</strong>
              </article>
            </div>

            <DataTable
              title="Permissoes efetivas"
              exportFileName="permissoes-efetivas.csv"
              data={previewPermissoes}
              emptyMessage="Nenhuma permissao retornada pela rota."
              columns={[
                { id: "recurso", title: "Recurso", accessor: (row) => row.recurso, sortable: true },
                { id: "descricao", title: "Descricao", accessor: (row) => row.descricao || "-" },
                {
                  id: "permitido",
                  title: "Acesso",
                  accessor: (row) => (row.permitido ? "Permitido" : "Negado"),
                  render: (row) => (
                    <span className={`badge${row.permitido ? "" : " badge--warning"}`}>
                      {row.permitido ? "Permitido" : "Negado"}
                    </span>
                  ),
                },
                { id: "origem", title: "Origem", accessor: (row) => row.origem.join(", ") || "-" },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
