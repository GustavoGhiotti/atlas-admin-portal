import { useEffect, useMemo, useState } from "react";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  atualizarReguaMisCarteira,
  listarReguaMisCarteiras,
  type AtualizarReguaCarteiraResponse,
  type ReguaCarteiraApiResponse,
} from "@/services/atlasApi";

type ReguaCarteira = {
  idCarteira: string;
  nomeCarteira: string;
  diasAbertura: number;
};

type UpdateReguaCarteiraPayload = {
  idCarteira: string;
  diasAbertura: number;
};

const MIN_DIAS_ABERTURA = 0;

function toNumber(value: number | string | undefined, fallback: number) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeReguaCarteira(item: ReguaCarteiraApiResponse): ReguaCarteira {
  const idCarteira =
    item.ID_CARTEIRA ??
    item.ID_Carteira ??
    item.id_carteira ??
    item.idCarteira ??
    item.CARTEIRA;

  const nomeCarteira =
    item.NOME_CARTEIRA ??
    item.CARTEIRA ??
    item.nome_carteira ??
    item.nomeCarteira ??
    "Carteira sem nome";

  const diasAbertura =
    item.DIAS_ABERTURA ?? item.dias_abertura ?? item.diasAbertura;

  return {
    idCarteira: String(idCarteira ?? "").trim(),
    nomeCarteira: String(nomeCarteira).trim() || "Carteira sem nome",
    diasAbertura: toNumber(diasAbertura, 0),
  };
}

async function listarReguaCarteiras(): Promise<ReguaCarteira[]> {
  const data = await listarReguaMisCarteiras();

  if (data.status !== "sucesso") {
    throw new Error("Backend retornou erro ao buscar carteiras.");
  }

  return data.carteiras
    .map(normalizeReguaCarteira)
    .filter((carteira) => carteira.idCarteira.length > 0);
}

async function atualizarReguaCarteira({
  idCarteira,
  diasAbertura,
}: UpdateReguaCarteiraPayload): Promise<AtualizarReguaCarteiraResponse> {
  const data = await atualizarReguaMisCarteira(idCarteira, diasAbertura);

  if (data.status !== "sucesso") {
    throw new Error(data.mensagem || "Erro ao atualizar carteira.");
  }

  return data;
}

async function atualizarTodasReguaCarteiras(
  carteiras: UpdateReguaCarteiraPayload[],
) {
  await Promise.all(
    carteiras.map((carteira) => atualizarReguaCarteira(carteira)),
  );
}

export default function ReguaMIS() {
  const [carteiras, setCarteiras] = useState<ReguaCarteira[]>([]);
  const [carteirasOriginais, setCarteirasOriginais] = useState<
    ReguaCarteira[]
  >([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingCarteiraId, setSavingCarteiraId] = useState<string | null>(null);

  function isCarteiraChanged(carteira: ReguaCarteira) {
    const carteiraOriginal = carteirasOriginais.find(
      (item) => item.idCarteira === carteira.idCarteira,
    );

    return carteiraOriginal?.diasAbertura !== carteira.diasAbertura;
  }

  const hasChanges = useMemo(() => {
    return carteiras.some((carteira) => isCarteiraChanged(carteira));
  }, [carteiras, carteirasOriginais]);

  useEffect(() => {
    void carregarCarteiras();
  }, []);

  async function carregarCarteiras() {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const data = await listarReguaCarteiras();

      setCarteiras(data);
      setCarteirasOriginais(data);
    } catch {
      setError("Não foi possível carregar as carteiras.");
    } finally {
      setLoading(false);
    }
  }

  function handleDiasAberturaChange(idCarteira: string, diasAbertura: number) {
    const nextDiasAbertura = Math.min(
      Math.max(MIN_DIAS_ABERTURA, diasAbertura),
    );

    setCarteiras((currentCarteiras) =>
      currentCarteiras.map((carteira) =>
        carteira.idCarteira === idCarteira
          ? {
              ...carteira,
              diasAbertura: nextDiasAbertura,
            }
          : carteira,
      ),
    );
  }

  async function handleSaveCarteira(idCarteira: string) {
    const carteira = carteiras.find((item) => item.idCarteira === idCarteira);

    if (!carteira) {
      return;
    }

    try {
      setSavingCarteiraId(idCarteira);
      setMessage("");
      setError("");

      await atualizarReguaCarteira({
        idCarteira: carteira.idCarteira,
        diasAbertura: carteira.diasAbertura,
      });

      setCarteirasOriginais((currentCarteiras) =>
        currentCarteiras.map((item) =>
          item.idCarteira === carteira.idCarteira
            ? {
                ...item,
                diasAbertura: carteira.diasAbertura,
              }
            : item,
        ),
      );

      setMessage(`Carteira ${carteira.nomeCarteira} atualizada com sucesso.`);
    } catch {
      setError("Não foi possível salvar os dias de abertura.");
    } finally {
      setSavingCarteiraId(null);
    }
  }

  async function handleSaveAll() {
    const carteirasAlteradas = carteiras.filter((carteira) =>
      isCarteiraChanged(carteira),
    );

    if (carteirasAlteradas.length === 0) {
      return;
    }

    try {
      setSavingAll(true);
      setMessage("");
      setError("");

      await atualizarTodasReguaCarteiras(
        carteirasAlteradas.map((carteira) => ({
          idCarteira: carteira.idCarteira,
          diasAbertura: carteira.diasAbertura,
        })),
      );

      setCarteirasOriginais([...carteiras]);
      setMessage("Alterações salvas com sucesso.");
    } catch {
      setError("Não foi possível salvar todas as alterações.");
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge
        successMessage={message}
        errorMessage={error}
        successTitle="Operação concluída"
        errorTitle="Falha na Régua MIS"
      />

      <PageHeader
        eyebrow="Configurações operacionais"
        title="Régua MIS"
        description="Configure a quantidade de dias de abertura por carteira."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Carteiras</p>
            <h2>Dias de abertura</h2>
          </div>

          <button
            className="button"
            type="button"
            disabled={loading || savingAll || savingCarteiraId !== null || !hasChanges}
            onClick={handleSaveAll}
          >
            {savingAll ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>

        {loading ? (
          <p>Carregando carteiras...</p>
        ) : carteiras.length === 0 ? (
          <p>Nenhuma carteira encontrada.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Carteira</th>
                  <th>Dias de abertura</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {carteiras.map((carteira) => {
                  const isSaving = savingCarteiraId === carteira.idCarteira;
                  const changed = isCarteiraChanged(carteira);

                  return (
                    <tr key={carteira.idCarteira}>
                      <td>{carteira.nomeCarteira}</td>

                      <td>
                        <div className="field field--compact regua-mis-dias-field">
                          <label className="sr-only" htmlFor={`dias-abertura-${carteira.idCarteira}`}>
                            Dias de abertura para {carteira.nomeCarteira}
                          </label>

                          <input
                            id={`dias-abertura-${carteira.idCarteira}`}
                            type="number"
                            min={MIN_DIAS_ABERTURA}
                            value={carteira.diasAbertura}
                            disabled={isSaving || savingAll}
                            onChange={(event) =>
                              handleDiasAberturaChange(
                                carteira.idCarteira,
                                Number(event.target.value),
                              )
                            }
                          />
                        </div>
                      </td>

                      <td>{changed ? "Alterado" : "Sem alterações"}</td>

                      <td>
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={isSaving || savingAll || !changed}
                          onClick={() =>
                            handleSaveCarteira(carteira.idCarteira)
                          }
                        >
                          {isSaving ? "Salvando..." : "Salvar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
