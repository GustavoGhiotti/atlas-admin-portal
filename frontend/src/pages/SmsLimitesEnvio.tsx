import { useEffect, useMemo, useState } from "react";

import Modal from "@/components/modals/Modal";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/format";
import { hasAnyGroup } from "@/lib/permissions";
import {
  atualizarRcsLimiteMensal,
  atualizarRcsLimiteSemanal,
  atualizarRcsLimiteTotalMensal,
  atualizarRcsLimiteTotalSemanal,
  atualizarSmsLimiteMensal,
  atualizarSmsLimiteSemanal,
  atualizarSmsLimiteTotalMensal,
  atualizarSmsLimiteTotalSemanal,
  getApiError,
  listarRcsLimitesEnvio,
  listarSmsLimitesEnvio,
  type SmsLimiteCedente,
  type SmsLimiteTotal,
  type SmsResumoLimiteCedente,
} from "@/services/atlasApi";

type PeriodicidadeLimite = "semanal" | "mensal";

type EdicaoLimite = {
  tipo: "carteira" | "total";
  periodicidade: PeriodicidadeLimite;
  item: SmsLimiteCedente | SmsLimiteTotal;
};

export default function SmsLimitesEnvio({ tipo = "SMS" }: { tipo?: "SMS" | "RCS" }) {
  const { user } = useAuth();
  const [limiteTotalSemanal, setLimiteTotalSemanal] = useState<SmsLimiteTotal | null>(null);
  const [limiteTotalMensal, setLimiteTotalMensal] = useState<SmsLimiteTotal | null>(null);
  const [semanal, setSemanal] = useState<SmsLimiteCedente[]>([]);
  const [mensal, setMensal] = useState<SmsLimiteCedente[]>([]);
  const [resumoCedente, setResumoCedente] = useState<SmsResumoLimiteCedente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [edicao, setEdicao] = useState<EdicaoLimite | null>(null);
  const [volumeEnvio, setVolumeEnvio] = useState("");
  const canEditLimites = hasAnyGroup(user?.grupos ?? [], ["DESENVOLVIMENTO"]) || ["CBSILVA", "LGNETO"].includes((user?.nm_login || "").toUpperCase());

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await (tipo === "RCS" ? listarRcsLimitesEnvio() : listarSmsLimitesEnvio());
      setLimiteTotalSemanal(data.limite_total_semanal || null);
      setLimiteTotalMensal(data.limite_total_mensal || null);
      setSemanal(data.semanal || []);
      setMensal(data.mensal || []);
      setResumoCedente(data.resumo_cedente || []);
      setFeedback(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, `Falha ao carregar limites de envio ${tipo}.`) });
    } finally {
      setLoading(false);
    }
  }

  function abrirEdicao(periodicidade: PeriodicidadeLimite, item: SmsLimiteCedente) {
    setEdicao({ tipo: "carteira", periodicidade, item });
    setVolumeEnvio(String(item.volume_envio ?? 0));
  }

  function abrirEdicaoTotal(periodicidade: PeriodicidadeLimite, item: SmsLimiteTotal) {
    setEdicao({ tipo: "total", periodicidade, item });
    setVolumeEnvio(String(item.limite_total ?? 0));
  }

  async function salvarEdicao() {
    if (!edicao) return;
    const volumeAtualizado = Number(volumeEnvio.replace(/\D/g, ""));
    if (!Number.isInteger(volumeAtualizado) || volumeAtualizado < 0) {
      setFeedback({ type: "danger", message: "Informe um volume de envio inteiro maior ou igual a zero." });
      return;
    }

    setSaving(true);
    try {
      if (edicao.tipo === "total") {
        const atualizado =
          edicao.periodicidade === "semanal"
            ? await (tipo === "RCS" ? atualizarRcsLimiteTotalSemanal : atualizarSmsLimiteTotalSemanal)(edicao.item.id, volumeAtualizado)
            : await (tipo === "RCS" ? atualizarRcsLimiteTotalMensal : atualizarSmsLimiteTotalMensal)(edicao.item.id, volumeAtualizado);

        if (edicao.periodicidade === "semanal") {
          setLimiteTotalSemanal(atualizado);
        } else {
          setLimiteTotalMensal(atualizado);
        }

        setFeedback({
          type: "success",
          message: `Limite total ${edicao.periodicidade} atualizado com sucesso.`,
        });
      } else {
        const atualizado =
          edicao.periodicidade === "semanal"
            ? await (tipo === "RCS" ? atualizarRcsLimiteSemanal : atualizarSmsLimiteSemanal)(edicao.item.id, volumeAtualizado)
            : await (tipo === "RCS" ? atualizarRcsLimiteMensal : atualizarSmsLimiteMensal)(edicao.item.id, volumeAtualizado);

        if (edicao.periodicidade === "semanal") {
          setSemanal((current) =>
            current.map((item) => (item.id === atualizado.id ? { ...item, volume_envio: atualizado.volume_envio } : item)),
          );
        } else {
          setMensal((current) =>
            current.map((item) => (item.id === atualizado.id ? { ...item, volume_envio: atualizado.volume_envio } : item)),
          );
        }

        setFeedback({
          type: "success",
          message: `Volume ${edicao.periodicidade} atualizado para o cedente ${atualizado.nome}.`,
        });
      }
      setEdicao(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao atualizar volume de envio.") });
    } finally {
      setSaving(false);
    }
  }

  const totalEnviadoSemanal = useMemo(
    () => resumoCedente.reduce((total, item) => total + Number(item.total_enviado_semana || 0), 0),
    [resumoCedente],
  );
  const totalEnviadoMensal = useMemo(
    () => resumoCedente.reduce((total, item) => total + Number(item.total_enviado_mes || 0), 0),
    [resumoCedente],
  );
  const totalRestanteSemana = useMemo(
    () => Math.max(Number(limiteTotalSemanal?.limite_total || 0) - totalEnviadoSemanal, 0),
    [limiteTotalSemanal, totalEnviadoSemanal],
  );
  const totalRestanteMes = useMemo(
    () => Math.max(Number(limiteTotalMensal?.limite_total || 0) - totalEnviadoMensal, 0),
    [limiteTotalMensal, totalEnviadoMensal],
  );
  const resumoPorCedente = useMemo(() => {
    const normalizar = (valor: string) => String(valor || "").trim().toUpperCase();
    const mapa = new Map<string, SmsResumoLimiteCedente>();
    for (const item of resumoCedente) {
      mapa.set(normalizar(item.nome), item);
    }
    return mapa;
  }, [resumoCedente]);

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Limite atualizado" errorTitle="Falha no limite de envio" />
      <PageHeader
        eyebrow={`Operação controlada / ${tipo}`}
        title="Limites de envio por carteira"
        description="Defina o volume de envio semanal e mensal por cedente sem alterar a identificação da carteira."
      />

      <section className="kpi-grid">
        <article className="surface-card">
          <p className="eyebrow">Limite total semanal</p>
          <h2>{formatNumber(limiteTotalSemanal?.limite_total || 0)}</h2>
          <p>Limite total configurado na tabela semanal consolidada.</p>
          {canEditLimites && limiteTotalSemanal ? (
            <button className="button button--secondary" type="button" onClick={() => abrirEdicaoTotal("semanal", limiteTotalSemanal)}>
              Editar limite total
            </button>
          ) : null}
        </article>
        <article className="surface-card">
          <p className="eyebrow">Limite total mensal</p>
          <h2>{formatNumber(limiteTotalMensal?.limite_total || 0)}</h2>
          <p>Limite total configurado na tabela mensal consolidada.</p>
          {canEditLimites && limiteTotalMensal ? (
            <button className="button button--secondary" type="button" onClick={() => abrirEdicaoTotal("mensal", limiteTotalMensal)}>
              Editar limite total
            </button>
          ) : null}
        </article>
        <article className="surface-card">
          <p className="eyebrow">Enviados na semana</p>
          <h2>{formatNumber(totalEnviadoSemanal)}</h2>
          <p>Total efetivamente enviado no período semanal atual.</p>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Enviados no mês</p>
          <h2>{formatNumber(totalEnviadoMensal)}</h2>
          <p>Total efetivamente enviado no período mensal atual.</p>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Restante semana</p>
          <h2>{formatNumber(totalRestanteSemana)}</h2>
          <p>Saldo semanal calculado pelo limite total menos o total enviado.</p>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Restante no mês</p>
          <h2>{formatNumber(totalRestanteMes)}</h2>
          <p>Saldo mensal calculado pelo limite total menos o total enviado.</p>
        </article>
      </section>

      {loading ? (
        <div className="page-loader">Carregando limites de envio...</div>
      ) : (
        <>
          <DataTable
            title={`Semanal • Volume total: ${formatNumber(
              semanal.reduce((total, item) => total + Number(item.volume_envio || 0), 0),
            )}`}
            className={`sms-limites-table ${canEditLimites ? "sms-limites-table--with-action" : "sms-limites-table--readonly"}`}
            exportFileName="sms-limites-semanal.csv"
            searchPlaceholder="Buscar por id_cedente ou nome"
            initialSortColumn="nome"
            initialSortDirection="asc"
            data={semanal}
            columns={[
              { id: "idCedente", title: "ID Cedente", accessor: (row) => row.id_cedente, sortable: true, align: "right" },
              { id: "nome", title: "Nome", accessor: (row) => row.nome, sortable: true },
              {
                id: "enviadoSemana",
                title: "Enviado semana",
                accessor: (row) => resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.total_enviado_semana || 0,
                sortable: true,
                align: "right",
                render: (row) => formatNumber(resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.total_enviado_semana || 0),
              },
              {
                id: "volume",
                title: "Volume envio",
                accessor: (row) => row.volume_envio,
                sortable: true,
                align: "right",
                render: (row) => formatNumber(row.volume_envio),
              },
              {
                id: "restanteSemana",
                title: "Restante semana",
                accessor: (row) => resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.restante_semana || 0,
                sortable: true,
                align: "right",
                render: (row) => formatNumber(resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.restante_semana || 0),
              },
              ...(canEditLimites
                ? [
                    {
                      id: "acao",
                      title: "Acao",
                      accessor: (row: SmsLimiteCedente) => row.id_cedente,
                      render: (row: SmsLimiteCedente) => (
                        <button className="button button--secondary" type="button" onClick={() => abrirEdicao("semanal", row)}>
                          Editar volume
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          <DataTable
            title={`Mensal • Volume total: ${formatNumber(
              mensal.reduce((total, item) => total + Number(item.volume_envio || 0), 0),
            )}`}
            className={`sms-limites-table ${canEditLimites ? "sms-limites-table--with-action" : "sms-limites-table--readonly"}`}
            exportFileName="sms-limites-mensal.csv"
            searchPlaceholder="Buscar por id_cedente ou nome"
            initialSortColumn="nome"
            initialSortDirection="asc"
            data={mensal}
            columns={[
              { id: "idCedente", title: "ID Cedente", accessor: (row) => row.id_cedente, sortable: true, align: "right" },
              { id: "nome", title: "Nome", accessor: (row) => row.nome, sortable: true },
              {
                id: "enviadoMes",
                title: "Enviado no mês",
                accessor: (row) => resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.total_enviado_mes || 0,
                sortable: true,
                align: "right",
                render: (row) => formatNumber(resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.total_enviado_mes || 0),
              },
              {
                id: "volume",
                title: "Volume envio",
                accessor: (row) => row.volume_envio,
                sortable: true,
                align: "right",
                render: (row) => formatNumber(row.volume_envio),
              },
              {
                id: "restanteMes",
                title: "Restante no mês",
                accessor: (row) => resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.restante_mes || 0,
                sortable: true,
                align: "right",
                render: (row) => formatNumber(resumoPorCedente.get(String(row.nome).trim().toUpperCase())?.restante_mes || 0),
              },
              ...(canEditLimites
                ? [
                    {
                      id: "acao",
                      title: "Acao",
                      accessor: (row: SmsLimiteCedente) => row.id_cedente,
                      render: (row: SmsLimiteCedente) => (
                        <button className="button button--secondary" type="button" onClick={() => abrirEdicao("mensal", row)}>
                          Editar volume
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}

      <Modal
        open={!!edicao}
        onClose={() => setEdicao(null)}
        title="Editar volume de envio"
        description="ID cedente e nome sao informativos. Apenas o volume pode ser alterado."
      >
        {edicao ? (
          <div className="stack-lg">
            <label className="field">
              <span>Periodicidade</span>
              <input value={edicao.periodicidade} readOnly />
            </label>
            {edicao.tipo === "carteira" ? (
              <>
                <label className="field">
                  <span>ID cedente</span>
                  <input value={edicao.item.id_cedente} readOnly />
                </label>
                <label className="field">
                  <span>Nome</span>
                  <input value={edicao.item.nome} readOnly />
                </label>
              </>
            ) : (
              <label className="field">
                <span>ID registro</span>
                <input value={edicao.item.id} readOnly />
              </label>
            )}
            <label className="field">
              <span>{edicao.tipo === "total" ? "Limite total" : "Volume de envio"}</span>
              <input
                type="text"
                inputMode="numeric"
                value={volumeEnvio}
                onChange={(event) => setVolumeEnvio(event.target.value.replace(/\D/g, ""))}
                placeholder="Digite apenas números"
              />
            </label>
            <div className="toolbar">
              <button className="button button--ghost-neutral" type="button" onClick={() => setEdicao(null)}>
                Fechar
              </button>
              <button className="button" type="button" disabled={saving} onClick={() => void salvarEdicao()}>
                {saving ? "Salvando..." : "Salvar volume"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
