import axios from "axios";
import { FormEvent, useEffect, useRef, useState } from "react";

import Modal from "@/components/modals/Modal";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { formatNumber } from "@/lib/format";
import { useRevelarNaRolagem } from "@/lib/revelarNaRolagem";
import {
  excluirPortalAcordoLanding,
  getApiError,
  listarPortalAcordoAliases,
  listarPortalAcordoAuditoria,
  listarPortalAcordoCarteiras,
  listarPortalAcordoFaq,
  listarPortalAcordoImagens,
  listarPortalAcordoLandings,
  listarPortalAcordoMailings,
  listarPortalAcordoNumeros,
  salvarPortalAcordoAlias,
  salvarPortalAcordoCarteira,
  salvarPortalAcordoLanding,
  salvarPortalAcordoMailing,
  salvarPortalAcordoNumero,
  type PortalAcordoAlias,
  type PortalAcordoAuditoria,
  type PortalAcordoCarteira,
  type PortalAcordoImagem,
  type PortalAcordoFaq,
  type PortalAcordoLanding,
  type PortalAcordoMailing,
  type PortalAcordoNumero,
} from "@/services/atlasApi";

type Aba = "carteiras" | "landings" | "mailings" | "numeros" | "aliases" | "auditoria";

const ABAS: Array<{ id: Aba; label: string }> = [
  { id: "carteiras", label: "Carteiras" },
  { id: "landings", label: "Landing pages" },
  { id: "mailings", label: "Mailings" },
  { id: "numeros", label: "Números" },
  { id: "aliases", label: "Aliases" },
  { id: "auditoria", label: "Auditoria" },
];

type Dados = {
  carteiras: PortalAcordoCarteira[];
  landings: PortalAcordoLanding[];
  mailings: PortalAcordoMailing[];
  numeros: PortalAcordoNumero[];
  aliases: PortalAcordoAlias[];
  auditoria: PortalAcordoAuditoria[];
  imagens: PortalAcordoImagem[];
};

const VAZIO: Dados = {
  carteiras: [], landings: [], mailings: [], numeros: [], aliases: [], auditoria: [], imagens: [],
};

type Editor =
  | { tipo: "carteira"; item: PortalAcordoCarteira | null }
  | { tipo: "landing"; item: PortalAcordoLanding | null }
  | { tipo: "mailing"; item: PortalAcordoMailing | null }
  | { tipo: "numero"; item: PortalAcordoNumero | null }
  | { tipo: "alias"; item: PortalAcordoAlias | null }
  | { tipo: "auditoria"; item: PortalAcordoAuditoria }
  | null;

function sim(valor: boolean) {
  return valor ? "Sim" : "Não";
}

/** Datas chegam em ISO (26 caracteres) e estouram a largura da coluna. */
function dataHora(valor: string) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/** Formata o JSON da auditoria; se vier inválido, mostra o texto cru em vez de sumir. */
function formatarJson(texto: string | null) {
  if (!texto) return "—";
  try {
    return JSON.stringify(JSON.parse(texto), null, 2);
  } catch {
    return texto;
  }
}


/**
 * Mostra o logo escolhido antes de salvar. É o que impede o admin de gravar um
 * caminho que não resolve: hoje ele escolheria às cegas e só descobriria o erro
 * olhando o portal, até 5 minutos depois por causa do cache.
 */
function PreviaDoLogo({ caminho, imagens }: { caminho: string; imagens: PortalAcordoImagem[] }) {
  const limpo = (caminho || "").trim();
  if (!limpo) return <span className="panel__description">Escolha um arquivo da lista para ver a prévia.</span>;

  const conhecida = imagens.find((img) => img.caminho === limpo);

  if (!conhecida) {
    return (
      <span className="panel__description">
        Este caminho não está no banco de imagens nem em uso hoje. Se o arquivo não existir no portal, a landing fica
        sem logo. Envie a imagem pelo Banco de imagens, na pasta PortalAcordo, e escolha-a na lista.
      </span>
    );
  }

  if (!conhecida.url_preview) {
    return (
      <span className="panel__description">
        Imagem que vem do próprio site ({conhecida.usos} uso(s)), não do banco de imagens — por isso não dá para
        mostrar a prévia aqui. Trocar por uma imagem nova depende do Desenvolvimento.
      </span>
    );
  }

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <img
        src={conhecida.url_preview}
        alt={`Prévia de ${limpo}`}
        style={{ maxHeight: 44, maxWidth: 160, objectFit: "contain", background: "rgba(255,255,255,0.06)", padding: 4, borderRadius: 4 }}
      />
      <span className="panel__description">Banco de imagens — aparece no site sem depender de ninguém.</span>
    </span>
  );
}

export default function PortalAcordoConfig() {
  const [aba, setAba] = useState<Aba>("carteiras");
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [faqDaLanding, setFaqDaLanding] = useState<PortalAcordoFaq[] | null>(null);
  const [faqFalhou, setFaqFalhou] = useState(false);
  const [editarFaq, setEditarFaq] = useState(false);
  const [logoEscolhido, setLogoEscolhido] = useState("");
  // O WhatsApp da landing herda da carteira quando fica vazio. Guardar a carteira
  // escolhida deixa o placeholder mostrar qual numero vai valer, sem preencher o
  // campo - preencher gravaria uma copia, e a copia e o que faz a aba Numeros
  // parar de ter efeito sobre a landing.
  const [carteiraDaLanding, setCarteiraDaLanding] = useState("");
  // O campo carteira do modal de numero depende do escopo escolhido.
  const [escopoNumero, setEscopoNumero] = useState("GLOBAL");
  const abortRef = useRef<AbortController | null>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  // Trocar de aba troca o painel inteiro: o bloco novo precisa ser observado.
  useRevelarNaRolagem(conteudoRef, [aba, dados]);

  useEffect(() => {
    void carregar();
    return () => abortRef.current?.abort();
  }, []);

  async function carregar() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCarregando(true);
    setError("");
    try {
      const [carteiras, landings, mailings, numeros, aliases, auditoria, imagens] = await Promise.all([
        listarPortalAcordoCarteiras(controller.signal),
        listarPortalAcordoLandings(controller.signal),
        listarPortalAcordoMailings(controller.signal),
        listarPortalAcordoNumeros(controller.signal),
        listarPortalAcordoAliases(controller.signal),
        listarPortalAcordoAuditoria(undefined, controller.signal),
        listarPortalAcordoImagens(controller.signal),
      ]);
      setDados({ carteiras, landings, mailings, numeros, aliases, auditoria, imagens });
    } catch (erro) {
      if (axios.isCancel(erro)) return;
      setError(getApiError(erro, "Falha ao carregar a configuração do Portal Acordo."));
    } finally {
      setCarregando(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function abrirLanding(item: PortalAcordoLanding | null) {
    setEditarFaq(false);
    setFaqDaLanding(null);
    setFaqFalhou(false);
    setLogoEscolhido(item?.imagem_logo ?? "");
    setCarteiraDaLanding(item?.carteira ?? "");
    setEditor({ tipo: "landing", item });
    if (!item) {
      setFaqDaLanding([]);
      return;
    }
    try {
      setFaqDaLanding(await listarPortalAcordoFaq(item.slug));
    } catch {
      // Tratar falha de leitura como "FAQ vazio" seria destrutivo: o gestor marcaria
      // "editar FAQ" achando que não há nada e o salvamento apagaria as perguntas reais
      // que estão em produção. Sinaliza a falha e bloqueia a edição do FAQ.
      setFaqFalhou(true);
      setFaqDaLanding(null);
    }
  }

  /** Sincroniza o escopo antes de abrir: sem isso, editar um numero de carteira
   *  abriria com o campo travado como se fosse global. */
  function abrirNumero(item: PortalAcordoNumero | null) {
    setEscopoNumero(item?.escopo ?? "GLOBAL");
    setEditor({ tipo: "numero", item });
  }

  async function executar(
    acao: () => Promise<{ mensagem: string; aviso: string }>,
    erroPadrao = "Falha ao salvar.",
  ) {
    setSalvando(true);
    try {
      const resposta = await acao();
      setEditor(null);
      setFeedback({ type: "success", message: `${resposta.mensagem} ${resposta.aviso}` });
      await carregar();
    } catch (erro) {
      setFeedback({ type: "danger", message: getApiError(erro, erroPadrao) });
    } finally {
      setSalvando(false);
    }
  }

  // Campos numéricos com default no backend: vazio precisa ser OMITIDO, não virar null.
  // Enviar null faz o Pydantic recusar com 422 ("Input should be a valid integer") num
  // campo que o gestor deliberadamente deixou em branco.
  const CAMPOS_NUMERICOS = ["prioridade", "ordem", "id_cedente"];

  function valores(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const obj: Record<string, unknown> = {};
    form.forEach((valor, chave) => {
      if (chave.startsWith("faq_")) return;
      const texto = String(valor).trim();
      if (CAMPOS_NUMERICOS.includes(chave)) {
        // id_cedente é opcional de verdade: vazio significa "sem cedente".
        if (texto === "") {
          if (chave === "id_cedente") obj[chave] = null;
          return;
        }
        obj[chave] = Number(texto);
        return;
      }
      obj[chave] = texto === "" ? null : texto;
    });
    return { obj, form };
  }

  function montarFaq(form: FormData): Array<Record<string, unknown>> {
    const perguntas = form.getAll("faq_pergunta").map(String);
    const respostas = form.getAll("faq_resposta").map(String);
    return perguntas
      .map((pergunta, indice) => ({
        pergunta: pergunta.trim(),
        resposta: (respostas[indice] || "").trim(),
        // Preserva o ativo de cada pergunta: reinserir tudo como ativo republicaria
        // respostas que foram desligadas de propósito.
        ativo: faqDaLanding?.[indice]?.ativo ?? true,
      }))
      .filter((item) => item.pergunta && item.resposta);
  }

  /**
   * Todas as gravações são upsert pela chave natural. Ao clicar em "Novo" e digitar
   * uma chave que já existe, o registro existente seria SOBRESCRITO sem aviso — o
   * gestor acharia que criou. Confirma antes.
   */
  function confirmaSobrescrita(tipo: string, chave: string, existe: boolean) {
    if (!existe) return true;
    return window.confirm(
      `Já existe ${tipo} com "${chave}". Salvar vai ATUALIZAR o registro existente, não criar outro. Continuar?`,
    );
  }

  /**
   * Exclusão é definitiva: apaga a linha e, por cascata da FK, o FAQ junto. Diferente
   * de despublicar, não tem como desfazer pela tela — por isso pede o slug digitado em
   * vez de um confirm, que se aceita no reflexo.
   */
  async function excluirLanding(item: PortalAcordoLanding) {
    const comFaq = item.qtd_faq_ativa
      ? ` Junto vão ${item.qtd_faq_ativa} pergunta(s) do FAQ.`
      : "";
    const digitado = window.prompt(
      [
        `Excluir a landing "${item.slug}" do banco.${comFaq}`,
        "Não é o mesmo que despublicar: o registro deixa de existir e a cópia fica só na " +
          "aba Auditoria. Se o portal tiver página estática para esse slug, a URL continua " +
          "no ar até o próximo build dele.",
        "Digite o slug para confirmar:",
      ].join("\n\n"),
    );
    if (digitado === null) return;
    if (digitado.trim().toLowerCase() !== item.slug.toLowerCase()) {
      setFeedback({ type: "danger", message: "O slug digitado não confere. Nada foi excluído." });
      return;
    }
    await executar(() => excluirPortalAcordoLanding(item.slug), "Falha ao excluir a landing page.");
  }

  /** Uma pergunta preenchida sem resposta seria descartada em silêncio pelo filtro acima. */
  function faqIncompleto(form: FormData): boolean {
    const perguntas = form.getAll("faq_pergunta").map((v) => String(v).trim());
    const respostas = form.getAll("faq_resposta").map((v) => String(v).trim());
    return perguntas.some((pergunta, indice) => Boolean(pergunta) !== Boolean(respostas[indice]));
  }

  const totalPorAba: Record<Aba, number> = {
    carteiras: dados.carteiras.length,
    landings: dados.landings.length,
    mailings: dados.mailings.length,
    numeros: dados.numeros.length,
    aliases: dados.aliases.length,
    auditoria: dados.auditoria.length,
  };

  // Espelha o COALESCE do portal: a landing sem numero proprio serve o da
  // carteira, e nao havendo, o global. Menor PRIORIDADE vence, igual ao backend.
  const numeroHerdado =
    dados.numeros
      .filter(
        (n) =>
          n.ativo &&
          n.canal === "WHATSAPP" &&
          n.escopo === "CARTEIRA" &&
          n.carteira === carteiraDaLanding,
      )
      .sort((a, b) => a.prioridade - b.prioridade || a.id - b.id)[0]?.numero ??
    dados.numeros
      .filter((n) => n.ativo && n.canal === "WHATSAPP" && n.escopo === "GLOBAL")
      .sort((a, b) => a.prioridade - b.prioridade || a.id - b.id)[0]?.numero ??
    null;

  const semAlias = dados.carteiras.filter((item) => item.ativo && !item.qtd_alias).length;
  const semNumero = dados.carteiras.filter((item) => item.ativo && !item.qtd_numero).length;
  const naHome = dados.landings.filter((item) => item.ativo && item.exibir_na_home).length;

  return (
    <div className="stack-lg pq-page" ref={conteudoRef}>
      <FeedbackToastBridge feedback={feedback} successTitle="Configuração salva" errorTitle="Falha ao salvar" />
      <PageHeader
        eyebrow="Portal Acordo / Configuração"
        title="Configuração do Portal Acordo"
        description="Carteiras, páginas do site, mailings do discador, números de atendimento e tradução de nomes. Toda alteração fica registrada no histórico."
        meta={[
          { label: "Carteiras ativas", value: formatNumber(dados.carteiras.filter((i) => i.ativo).length) },
          { label: "No carrossel da home", value: formatNumber(naHome) },
          { label: "Ativas sem alias", value: formatNumber(semAlias) },
          { label: "Ativas sem número", value: formatNumber(semNumero) },
        ]}
        actions={
          <button className="button button--secondary" type="button" onClick={() => void carregar()} disabled={carregando}>
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        }
      />

      <section className="panel">
        <p className="panel__description">
          O site do Portal Acordo leva até 5 minutos para exibir o que você salva aqui. Nesse intervalo, dois acessos
          podem mostrar coisas diferentes. Se a tela confirmou, salvou — não reedite achando que não deu certo.
        </p>
        <div className="tab-strip">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === aba ? "button" : "button button--secondary"}
              onClick={() => setAba(item.id)}
              aria-pressed={item.id === aba}
            >
              {item.label} ({formatNumber(totalPorAba[item.id])})
            </button>
          ))}
        </div>
      </section>

      {error ? <section className="panel"><div className="empty-state">{error}</div></section> : null}

      {aba === "carteiras" ? (
        <section className="panel">
          <div className="panel__header panel__header--action">
            <div>
              <p className="eyebrow">Cadastro base</p>
              <h2>Carteiras</h2>
            </div>
            <div className="panel__actions">
              <button className="button" type="button" onClick={() => setEditor({ tipo: "carteira", item: null })}>
                Nova carteira
              </button>
            </div>
          </div>
          <p className="panel__description">
            Registro canônico. O código é a chave usada por landing, mailing, número e alias — desativar a carteira
            quebra a resolução do mailing, mas <strong>não</strong> tira a landing do ar.
          </p>
          <DataTable
            className="table-scroll-x"
            carregando={carregando}
            data={dados.carteiras}
            exportFileName="portalacordo-carteiras.csv"
            initialSortColumn="nome"
            initialSortDirection="asc"
            columns={[
              { id: "codigo", title: "Código", accessor: (r) => r.codigo, sortable: true },
              { id: "nome", title: "Nome", accessor: (r) => r.nome, sortable: true },
              { id: "id_cedente", title: "Cedente", accessor: (r) => r.id_cedente ?? "—" },
              { id: "ativo", title: "Ativa", accessor: (r) => sim(r.ativo), sortable: true },
              { id: "qtd_landing", title: "Landing", accessor: (r) => r.qtd_landing },
              { id: "qtd_numero", title: "Números", accessor: (r) => r.qtd_numero },
              { id: "qtd_mailing", title: "Mailing", accessor: (r) => r.qtd_mailing },
              { id: "qtd_alias", title: "Aliases", accessor: (r) => r.qtd_alias },
              {
                id: "acoes",
                title: "",
                accessor: () => "",
                render: (r) => (
                  <div className="table-actions">
                    <button className="button button--secondary" type="button" onClick={() => setEditor({ tipo: "carteira", item: r })}>
                      Editar
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {aba === "landings" ? (
        <section className="panel">
          <div className="panel__header panel__header--action">
            <div>
              <p className="eyebrow">Páginas do site</p>
              <h2>Landing pages</h2>
            </div>
            <div className="panel__actions">
              <button className="button" type="button" onClick={() => void abrirLanding(null)}>Nova landing</button>
            </div>
          </div>
          <p className="panel__description">
            <strong>Publicada</strong> controla a página <code>/clientes/&#123;slug&#125;</code>; <strong>na home</strong> controla o card do
            carrossel. São coisas diferentes. O WhatsApp mostrado é o efetivo, com a origem de onde ele veio.
          </p>
          <DataTable
            className="table-scroll-x"
            carregando={carregando}
            data={dados.landings}
            exportFileName="portalacordo-landing-pages.csv"
            initialSortColumn="ordem"
            initialSortDirection="asc"
            pageSize={10}
            columns={[
              { id: "slug", title: "Slug", accessor: (r) => r.slug, sortable: true },
              { id: "nome_cliente", title: "Cliente", accessor: (r) => r.nome_cliente, sortable: true },
              { id: "carteira", title: "Carteira", accessor: (r) => r.carteira ?? "— sem vínculo", sortable: true },
              { id: "ordem", title: "Ordem", accessor: (r) => r.ordem, sortable: true },
              { id: "ativo", title: "Publicada", accessor: (r) => sim(r.ativo), sortable: true },
              { id: "exibir_na_home", title: "Na home", accessor: (r) => sim(r.exibir_na_home), sortable: true },
              {
                id: "whatsapp",
                title: "WhatsApp efetivo",
                accessor: (r) => `${r.whatsapp_efetivo ?? "—"} (${r.whatsapp_origem})`,
                render: (r) => (
                  <>
                    {r.whatsapp_efetivo ?? "—"}
                    <br />
                    <span style={{ opacity: 0.6, fontSize: "0.85em" }}>{r.whatsapp_origem}</span>
                  </>
                ),
              },
              { id: "qtd_faq_ativa", title: "FAQ", accessor: (r) => r.qtd_faq_ativa },
              {
                id: "acoes",
                title: "",
                accessor: () => "",
                // Publicar e exibir-na-home saem da linha e ficam só no modal, nos
                // campos "Publicada" e "Exibir na home". A capacidade não se perde e a
                // coluna de ações para de disputar largura com o resto da tabela.
                render: (r) => (
                  <div className="table-actions">
                    <button className="button button--secondary" type="button" onClick={() => void abrirLanding(r)}>Editar</button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {aba === "mailings" ? (
        <section className="panel">
          <div className="panel__header panel__header--action">
            <div>
              <p className="eyebrow">Discador</p>
              <h2>Mailings do discador</h2>
            </div>
            <div className="panel__actions">
              <button className="button" type="button" onClick={() => setEditor({ tipo: "mailing", item: null })}>Novo mailing</button>
            </div>
          </div>
          <p className="panel__description">
            O prefixo compõe o <strong>nome do arquivo</strong> entregue ao Olos. Só um mailing ativo por carteira: salvar
            um novo desativa o anterior automaticamente. Sem alias cadastrado, a campanha não é resolvida até aqui.
          </p>
          <DataTable
            className="table-scroll-x"
            carregando={carregando}
            data={dados.mailings}
            exportFileName="portalacordo-mailings.csv"
            initialSortColumn="carteira_nome"
            initialSortDirection="asc"
            columns={[
              { id: "carteira_nome", title: "Carteira", accessor: (r) => r.carteira_nome, sortable: true },
              { id: "prefixo", title: "Prefixo", accessor: (r) => r.prefixo, sortable: true },
              { id: "arquivo_exemplo", title: "Arquivo gerado", accessor: (r) => r.arquivo_exemplo,
                render: (r) => <span title={r.arquivo_exemplo}>{r.prefixo}<span style={{ opacity: 0.55 }}>portalacordo_…</span></span> },
              { id: "campanha", title: "Campanha", accessor: (r) => r.campanha ?? "—" },
              { id: "qtd_alias", title: "Aliases", accessor: (r) => r.qtd_alias, sortable: true },
              { id: "ativo", title: "Ativo", accessor: (r) => sim(r.ativo), sortable: true },
              {
                id: "acoes",
                title: "",
                accessor: () => "",
                render: (r) => (
                  <div className="table-actions">
                    <button className="button button--secondary" type="button" onClick={() => setEditor({ tipo: "mailing", item: r })}>Editar</button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {aba === "numeros" ? (
        <section className="panel">
          <div className="panel__header panel__header--action">
            <div>
              <p className="eyebrow">Atendimento</p>
              <h2>Números de atendimento</h2>
            </div>
            <div className="panel__actions">
              <button className="button" type="button" onClick={() => abrirNumero(null)}>Novo número</button>
            </div>
          </div>
          <p className="panel__description">
            Só pode haver <strong>um número global ativo por canal</strong> — salvar outro desativa o atual. Por carteira,
            vários convivem e a prioridade decide qual vale. Grave só dígitos com DDI, sem máscara.
          </p>
          <DataTable
            className="table-scroll-x"
            carregando={carregando}
            data={dados.numeros}
            exportFileName="portalacordo-numeros.csv"
            initialSortColumn="escopo"
            initialSortDirection="asc"
            pageSize={10}
            columns={[
              { id: "canal", title: "Canal", accessor: (r) => r.canal, sortable: true },
              { id: "escopo", title: "Escopo", accessor: (r) => r.escopo, sortable: true },
              { id: "carteira_nome", title: "Carteira", accessor: (r) => r.carteira_nome ?? "— global", sortable: true },
              { id: "numero", title: "Número", accessor: (r) => r.numero, sortable: true },
              { id: "rotulo", title: "Rótulo", accessor: (r) => r.rotulo ?? "—" },
              { id: "prioridade", title: "Prioridade", accessor: (r) => r.prioridade, sortable: true },
              { id: "ativo", title: "Ativo", accessor: (r) => sim(r.ativo), sortable: true },
              {
                id: "acoes",
                title: "",
                accessor: () => "",
                render: (r) => (
                  <div className="table-actions">
                    <button className="button button--secondary" type="button" onClick={() => abrirNumero(r)}>Editar</button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {aba === "aliases" ? (
        <section className="panel">
          <div className="panel__header panel__header--action">
            <div>
              <p className="eyebrow">Tradução de nomes</p>
              <h2>Aliases de carteira</h2>
            </div>
            <div className="panel__actions">
              <button className="button" type="button" onClick={() => setEditor({ tipo: "alias", item: null })}>Novo alias</button>
            </div>
          </div>
          <p className="panel__description">
            Traduz para a carteira certa os nomes que chegam escritos de outro jeito. O monitoramento lista os nomes
            que ainda não têm tradução. Cada texto só pode apontar para uma carteira em todo o sistema.
          </p>
          <DataTable
            className="table-scroll-x"
            carregando={carregando}
            data={dados.aliases}
            exportFileName="portalacordo-aliases.csv"
            initialSortColumn="carteira_nome"
            initialSortDirection="asc"
            pageSize={10}
            columns={[
              { id: "alias", title: "Alias recebido", accessor: (r) => r.alias, sortable: true },
              { id: "carteira_nome", title: "Resolve para", accessor: (r) => r.carteira_nome, sortable: true },
              { id: "tipo_match", title: "Match", accessor: (r) => r.tipo_match, sortable: true },
              { id: "prioridade", title: "Prioridade", accessor: (r) => r.prioridade, sortable: true },
              { id: "ativo", title: "Ativo", accessor: (r) => sim(r.ativo), sortable: true },
              {
                id: "acoes",
                title: "",
                accessor: () => "",
                render: (r) => (
                  <div className="table-actions">
                    <button className="button button--secondary" type="button" onClick={() => setEditor({ tipo: "alias", item: r })}>Editar</button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {aba === "auditoria" ? (
        <section className="panel">
          <div className="panel__header panel__header--action">
            <div>
              <p className="eyebrow">Histórico</p>
              <h2>Auditoria</h2>
            </div>
          </div>
          <p className="panel__description">
            Tudo o que se altera por esta tela fica registrado aqui, sem exceção: ou a alteração e o registro
            acontecem juntos, ou nenhum dos dois. Abra uma linha para ver o antes e o depois.
          </p>
          {dados.auditoria.length ? (
            <DataTable
              className="table-scroll-x"
              carregando={carregando}
              data={dados.auditoria}
              exportFileName="portalacordo-auditoria.csv"
              initialSortColumn="id"
              pageSize={10}
              columns={[
                { id: "criado_em", title: "Quando", accessor: (r) => r.criado_em, render: (r) => dataHora(r.criado_em), sortable: true },
                { id: "ator", title: "Quem", accessor: (r) => r.ator, sortable: true },
                { id: "entidade", title: "Entidade", accessor: (r) => r.entidade, sortable: true },
                { id: "acao", title: "Ação", accessor: (r) => r.acao, sortable: true },
                { id: "id_entidade", title: "ID", accessor: (r) => r.id_entidade ?? "—" },
                { id: "origem_ip", title: "Origem", accessor: (r) => r.origem_ip ?? "—" },
                {
                  id: "acoes",
                  title: "",
                  accessor: () => "",
                  render: (r) => (
                    <div className="table-actions">
                      <button className="button button--secondary" type="button" onClick={() => setEditor({ tipo: "auditoria", item: r })}>
                        Ver diferença
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <div className="empty-state">
              Nenhuma alteração registrada ainda. Assim que alguém salvar algo por aqui, aparece nesta lista.
            </div>
          )}
        </section>
      ) : null}

      {/* ------------------------------------------------------------ editores */}

      <Modal
        open={editor?.tipo === "carteira"}
        title={editor?.tipo === "carteira" && editor.item ? `Carteira ${editor.item.codigo}` : "Nova carteira"}
        description="O registro canônico da carteira. Landing, mailing, número e alias apontam para ela."
        onClose={() => { if (!salvando) setEditor(null); }}
      >
        {editor?.tipo === "carteira" ? (
          <form
            className="stack-md pq-form"
            onSubmit={(e) => {
              const { obj } = valores(e);
              const codigo = String(obj.codigo || "");
              const duplicada = !editor.item && dados.carteiras.some((c) => c.codigo.toUpperCase() === codigo.toUpperCase());
              if (!confirmaSobrescrita("uma carteira", codigo, duplicada)) return;
              void executar(() => salvarPortalAcordoCarteira({ ...obj, id: editor.item?.id, ativo: obj.ativo === "1" }));
            }}
          >
            <section className="surface-card surface-card--compact">
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>Código</span>
                  <input
                    name="codigo"
                    defaultValue={editor.item?.codigo}
                    required
                    pattern="[A-Za-z0-9_ \-]{1,60}"
                    title="Letras, números, espaço, hífen e underscore. Sem acento."
                    placeholder="BANCO_EXEMPLO"
                  />
                  <small className="field-hint field-hint--placeholder">
                    Identifica a carteira nas outras abas. Renomear é seguro: os vínculos não se perdem.
                  </small>
                </label>

                <label className="field">
                  <span>Nome</span>
                  <input name="nome" defaultValue={editor.item?.nome} required maxLength={120} placeholder="Banco Exemplo" />
                  <small className="field-hint field-hint--placeholder">Nome exibido nas listas do Atlas.</small>
                </label>

                <label className="field">
                  <span>ID do cedente</span>
                  <input name="id_cedente" type="number" min={0} defaultValue={editor.item?.id_cedente ?? ""} placeholder="opcional" />
                  <small className="field-hint field-hint--placeholder">
                    O número que identifica o cliente na base da Acme. Ajuda a rastrear a carteira nos eventos.
                  </small>
                </label>

                <label className="field">
                  <span>Ativa</span>
                  <select name="ativo" defaultValue={editor.item ? (editor.item.ativo ? "1" : "0") : "1"}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                  <small className="field-hint">
                    Desativar quebra a resolução do mailing, mas <strong>não</strong> tira a landing do ar.
                  </small>
                </label>
              </div>
            </section>

            <div className="form-footer">
              <button className="button button--ghost-neutral" type="button" disabled={salvando} onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button className="button" type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={editor?.tipo === "mailing"}
        title={editor?.tipo === "mailing" && editor.item ? `Mailing de ${editor.item.carteira_nome}` : "Novo mailing"}
        description="O prefixo compõe o nome do arquivo entregue ao discador Olos."
        onClose={() => { if (!salvando) setEditor(null); }}
      >
        {editor?.tipo === "mailing" ? (
          <form
            className="stack-md pq-form"
            onSubmit={(e) => {
              const { obj } = valores(e);
              const codigo = String(obj.carteira || "");
              const jaTem = !editor.item && dados.mailings.some((m) => m.carteira === codigo && m.ativo);
              if (!confirmaSobrescrita("um mailing ativo para essa carteira", codigo, jaTem)) return;
              void executar(() => salvarPortalAcordoMailing({ ...obj, id: editor.item?.id, ativo: obj.ativo === "1" }));
            }}
          >
            <section className="surface-card surface-card--compact">
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>Carteira</span>
                  {editor.item ? (
                    <>
                      <input type="hidden" name="carteira" value={editor.item.carteira} />
                      <input value={`${editor.item.carteira_nome} (${editor.item.carteira})`} readOnly />
                    </>
                  ) : (
                    <select name="carteira" required defaultValue="">
                      <option value="">Selecione</option>
                      {dados.carteiras.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome} ({c.codigo})</option>)}
                    </select>
                  )}
                  <small className="field-hint field-hint--placeholder">Só um mailing ativo por carteira.</small>
                </label>

                <label className="field">
                  <span>Prefixo</span>
                  <input
                    name="prefixo"
                    defaultValue={editor.item?.prefixo}
                    required
                    pattern="[A-Za-z0-9_]{1,60}"
                    title="Vira nome de arquivo: só letras, números e underscore. Sem espaço, ponto ou barra."
                    placeholder="MU_"
                  />
                  <small className="field-hint field-hint--placeholder">
                    Arquivo gerado: <code>{`${(editor.item?.prefixo ?? "PREFIXO_")}portalacordo_AAAAMMDD_HHMMSS.txt`}</code>
                  </small>
                </label>

                <label className="field">
                  <span>Campanha</span>
                  <input name="campanha" defaultValue={editor.item?.campanha ?? ""} pattern="[A-Za-z0-9_ \-]{0,60}" title="Letras, números, espaço, hífen e underscore." placeholder="opcional" />
                  <small className="field-hint field-hint--placeholder">Campo do layout do Olos. Vazio deriva do prefixo.</small>
                </label>

                <label className="field">
                  <span>Ativo</span>
                  <select name="ativo" defaultValue={editor.item ? (editor.item.ativo ? "1" : "0") : "1"}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                  <small className="field-hint">
                    Desativar não interrompe a geração: o portal cai no prefixo embutido no código dele.
                  </small>
                </label>

                <label className="field field--full">
                  <span>Observação</span>
                  <input name="observacao" defaultValue={editor.item?.observacao ?? ""} maxLength={300} placeholder="Contexto para quem for mexer depois" />
                  <small className="field-hint field-hint--placeholder">Anotação livre para quem mexer depois. Não vai para o discador.</small>
                </label>
              </div>
            </section>

            <div className="form-footer">
              <button className="button button--ghost-neutral" type="button" disabled={salvando} onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button className="button" type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={editor?.tipo === "numero"}
        title={editor?.tipo === "numero" && editor.item ? `Número ${editor.item.numero}` : "Novo número"}
        description="Somente dígitos, com DDI e DDD. Sem máscara."
        onClose={() => { if (!salvando) setEditor(null); }}
      >
        {editor?.tipo === "numero" ? (
          <form
            className="stack-md pq-form"
            onSubmit={(e) => {
              const { obj } = valores(e);
              const escopo = String(obj.escopo);
              void executar(() =>
                salvarPortalAcordoNumero({
                  ...obj,
                  id: editor.item?.id,
                  ativo: obj.ativo === "1",
                  // CK_CFG_NUM_COERENCIA: GLOBAL proíbe carteira, CARTEIRA exige.
                  carteira: escopo === "GLOBAL" ? null : obj.carteira,
                }),
              );
            }}
          >
            <section className="surface-card surface-card--compact">
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>Canal</span>
                  <select name="canal" defaultValue={editor.item?.canal ?? "WHATSAPP"}>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="TELEFONE">Telefone</option>
                  </select>
                  <small className="field-hint field-hint--placeholder">WhatsApp abre conversa; Telefone é o número que a tela exibe para ligação.</small>
                </label>

                <label className="field">
                  <span>Escopo</span>
                  <select name="escopo" defaultValue={editor.item?.escopo ?? "GLOBAL"} onChange={(ev) => setEscopoNumero(ev.target.value)}>
                    <option value="GLOBAL">Global — botão flutuante do portal</option>
                    <option value="CARTEIRA">Por carteira</option>
                  </select>
                  <small className="field-hint">
                    {escopoNumero === "GLOBAL"
                      ? "Só um número global ativo por canal: salvar desativa o atual."
                      : "Vários convivem por carteira; a prioridade decide qual vale."}
                  </small>
                </label>

                <label className="field">
                  <span>Carteira</span>
                  <select
                    name="carteira"
                    defaultValue={editor.item?.carteira ?? ""}
                    disabled={escopoNumero === "GLOBAL"}
                    required={escopoNumero === "CARTEIRA"}
                  >
                    <option value="">{escopoNumero === "GLOBAL" ? "— não se aplica" : "Selecione"}</option>
                    {dados.carteiras.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
                  </select>
                  <small className="field-hint field-hint--placeholder">
                    {escopoNumero === "GLOBAL" ? "O escopo global não pertence a carteira alguma." : "Obrigatória para o escopo por carteira."}
                  </small>
                </label>

                <label className="field">
                  <span>Número</span>
                  <input
                    name="numero"
                    defaultValue={editor.item?.numero}
                    required
                    pattern="[0-9]{10,15}"
                    title="Somente dígitos, 10 a 15, com DDI e DDD. Exemplo: 551130000003."
                    placeholder="551130000003"
                  />
                  <small className="field-hint field-hint--placeholder">Máscara e parênteses são recusados.</small>
                </label>

                <label className="field">
                  <span>Rótulo</span>
                  <input name="rotulo" defaultValue={editor.item?.rotulo ?? ""} maxLength={120} placeholder="Atendimento geral do portal" />
                  <small className="field-hint field-hint--placeholder">Nome interno, só para reconhecer o número nesta lista.</small>
                </label>

                <label className="field">
                  <span>Prioridade</span>
                  <input name="prioridade" type="number" min={0} max={9999} defaultValue={editor.item?.prioridade ?? 100} />
                  <small className="field-hint field-hint--placeholder">Menor número é tentado primeiro.</small>
                </label>

                <label className="field">
                  <span>Ativo</span>
                  <select name="ativo" defaultValue={editor.item ? (editor.item.ativo ? "1" : "0") : "1"}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                  <small className="field-hint field-hint--placeholder">Desativar tira o número do rodízio sem apagar o cadastro.</small>
                </label>

                <div className="field" aria-hidden="true" />
              </div>
            </section>

            <div className="form-footer">
              <button className="button button--ghost-neutral" type="button" disabled={salvando} onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button className="button" type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={editor?.tipo === "alias"}
        title={editor?.tipo === "alias" && editor.item ? `Alias ${editor.item.alias}` : "Novo alias"}
        description="Traduz para a carteira certa um nome que chega escrito de outro jeito."
        onClose={() => { if (!salvando) setEditor(null); }}
      >
        {editor?.tipo === "alias" ? (
          <form
            className="stack-md pq-form"
            onSubmit={(e) => {
              const { obj } = valores(e);
              const alias = String(obj.alias || "");
              const duplicado = !editor.item && dados.aliases.some((a) => a.alias.toUpperCase() === alias.toUpperCase());
              if (!confirmaSobrescrita("um alias", alias, duplicado)) return;
              void executar(() => salvarPortalAcordoAlias({ ...obj, id: editor.item?.id, ativo: obj.ativo === "1" }));
            }}
          >
            <section className="surface-card surface-card--compact">
              <div className="form-grid form-grid--two">
                <label className="field field--full">
                  <span>Alias recebido</span>
                  <input
                    name="alias"
                    defaultValue={editor.item?.alias}
                    required
                    maxLength={120}
                    title="Escreva exatamente como o nome aparece nos eventos."
                    placeholder="BANCO DELTA CONCIERGE PF"
                  />
                  <small className="field-hint field-hint--placeholder">
                    Único no sistema inteiro — um mesmo texto não pode resolver para duas carteiras.
                  </small>
                </label>

                <label className="field">
                  <span>Resolve para a carteira</span>
                  <select name="carteira" defaultValue={editor.item?.carteira ?? ""} required>
                    <option value="">Selecione</option>
                    {dados.carteiras.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome} ({c.codigo})</option>)}
                  </select>
                  <small className="field-hint field-hint--placeholder">A carteira canônica que esse texto passa a representar no dashboard e no mailing.</small>
                </label>

                <label className="field">
                  <span>Tipo de match</span>
                  <select name="tipo_match" defaultValue={editor.item?.tipo_match ?? "EXATO"}>
                    <option value="EXATO">Exato</option>
                    <option value="CONTEM">Contém</option>
                  </select>
                  <small className="field-hint">
                    Exato para um nome específico; Contém para pegar uma família de variantes.
                  </small>
                </label>

                <label className="field">
                  <span>Prioridade</span>
                  <input name="prioridade" type="number" min={0} max={9999} defaultValue={editor.item?.prioridade ?? 100} />
                  <small className="field-hint field-hint--placeholder">
                    Só desempata dentro do mesmo tipo: todo Exato é testado antes de qualquer Contém.
                  </small>
                </label>

                <label className="field">
                  <span>Ativo</span>
                  <select name="ativo" defaultValue={editor.item ? (editor.item.ativo ? "1" : "0") : "1"}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                  <small className="field-hint field-hint--placeholder">Inativo para de resolver, mas o texto continua reservado — não dá para reusá-lo em outra carteira.</small>
                </label>
              </div>
            </section>

            <div className="form-footer">
              <button className="button button--ghost-neutral" type="button" disabled={salvando} onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button className="button" type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={editor?.tipo === "landing"}
        className="modal--wide"
        title={editor?.tipo === "landing" && editor.item ? `Landing ${editor.item.slug}` : "Nova landing page"}
        description="O logo aponta para um arquivo já publicado — não é upload."
        onClose={() => { if (!salvando) setEditor(null); }}
      >
        {editor?.tipo === "landing" ? (
          <form
            className="stack-md pq-form"
            onSubmit={(e) => {
              const { obj, form } = valores(e);
              if (editarFaq && faqIncompleto(form)) {
                setFeedback({
                  type: "danger",
                  message: "Há pergunta sem resposta (ou o contrário) no FAQ. Preencha as duas ou apague as duas.",
                });
                return;
              }
              const payload: Record<string, unknown> = {
                ...obj,
                id: editor.item?.id,
                ativo: obj.ativo === "1",
                exibir_na_home: obj.exibir_na_home === "1",
              };
              // faq ausente mantém o atual; [] apaga tudo. Só enviamos a chave quando o
              // gestor abriu a seção — assim "não mexi" nunca vira "esvaziei".
              if (editarFaq) payload.faq = montarFaq(form);
              void executar(() => salvarPortalAcordoLanding(payload));
            }}
          >
            <section className="surface-card surface-card--compact">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Identificação</p>
                  <h2>Endereço e vínculo da página</h2>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>Slug (URL)</span>
                  <input
                    name="slug"
                    defaultValue={editor.item?.slug}
                    readOnly={!!editor.item}
                    required
                    pattern="[a-z0-9-]{2,60}"
                    title="Minúsculas, números e hífen. De 2 a 60 caracteres."
                    placeholder="banco-exemplo"
                  />
                  <small className="field-hint field-hint--placeholder">
                    {editor.item
                      ? "Não pode mudar: é o link já distribuído em SMS e campanha."
                      : "Vira /clientes/{slug} e não poderá ser alterado depois."}
                  </small>
                </label>

                <label className="field">
                  <span>Carteira</span>
                  <select
                    name="carteira"
                    defaultValue={editor.item?.carteira ?? ""}
                    onChange={(e) => setCarteiraDaLanding(e.target.value)}
                  >
                    <option value="">— sem vínculo</option>
                    {dados.carteiras.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
                  </select>
                  <small className="field-hint">
                    Sem vínculo, a página não herda o WhatsApp nem o mailing da carteira.
                  </small>
                </label>

                <label className="field">
                  <span>Nome do cliente</span>
                  <input name="nome_cliente" defaultValue={editor.item?.nome_cliente} required maxLength={120} placeholder="Banco Exemplo" />
                  <small className="field-hint field-hint--placeholder">
                    É também o nome que chega nos eventos de clique — cadastre um alias igual para o dashboard agrupar.
                  </small>
                </label>

                <label className="field">
                  <span>WhatsApp próprio</span>
                  <input
                    name="numero_whatsapp"
                    defaultValue={editor.item?.numero_whatsapp ?? ""}
                    pattern="[0-9]{10,15}"
                    title="Somente dígitos, com DDI."
                    placeholder={numeroHerdado ?? "opcional"}
                  />
                  <small className="field-hint field-hint--placeholder">
                    {numeroHerdado
                      ? `Vazio usa ${numeroHerdado}, o número da carteira. Preencha só para abrir exceção.`
                      : "Vazio herda da carteira e, na falta, do número global."}
                  </small>
                </label>
              </div>
            </section>

            <section className="surface-card surface-card--compact">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Aparência</p>
                  <h2>Imagens e textos do topo</h2>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <label className="field field--full">
                  <span>Logo</span>
                  <input
                    name="imagem_logo"
                    list="pq-imagens"
                    defaultValue={editor.item?.imagem_logo ?? ""}
                    onChange={(ev) => setLogoEscolhido(ev.target.value)}
                    required
                    pattern="/images/[A-Za-z0-9 ._/\-]{1,240}"
                    title="Caminho interno começando em /images/."
                    placeholder="/images/PortalAcordo/LogoExemplo.png"
                  />
                  <PreviaDoLogo caminho={logoEscolhido} imagens={dados.imagens} />
                  <small className="field-hint field-hint--placeholder">Sai da pasta PortalAcordo do banco de imagens do Atlas. Aparece no card da home e no topo da landing.</small>
                </label>
                <datalist id="pq-imagens">
                  {dados.imagens.map((img) => (
                    <option key={img.caminho} value={img.caminho}>
                      {img.origem === "banco de imagens" ? "banco de imagens" : `${img.usos} uso(s) · bundle`}
                    </option>
                  ))}
                </datalist>

                <label className="field">
                  <span>Imagem de fundo</span>
                  <input name="imagem_fundo" list="pq-imagens" defaultValue={editor.item?.imagem_fundo ?? "/images/image 26.png"} required pattern="/images/[A-Za-z0-9 ._/\-]{1,240}" title="Caminho interno começando em /images/." />
                  <small className="field-hint field-hint--placeholder">Vem do próprio site, não do banco de imagens — trocar depende do Desenvolvimento.</small>
                </label>

                <label className="field">
                  <span>Ordem no carrossel</span>
                  <input name="ordem" type="number" min={0} max={9999} defaultValue={editor.item?.ordem ?? 100} />
                  <small className="field-hint field-hint--placeholder">Menor aparece primeiro.</small>
                </label>

                <label className="field">
                  <span>Classe do logo</span>
                  <input name="logo_class" defaultValue={editor.item?.logo_class ?? ""} maxLength={120} placeholder="scale-125" />
                  <small className="field-hint field-hint--placeholder">Ajuste fino do tamanho na landing.</small>
                </label>

                <label className="field">
                  <span>Classe do logo na home</span>
                  <input name="logo_class_home" defaultValue={editor.item?.logo_class_home ?? ""} maxLength={120} placeholder="scale-125" />
                  <small className="field-hint field-hint--placeholder">Ajuste fino do tamanho no carrossel.</small>
                </label>

                <label className="field">
                  <span>Título</span>
                  <input name="titulo" defaultValue={editor.item?.titulo ?? ""} maxLength={200} placeholder="Vazio usa o texto padrão" />
                  <small className="field-hint field-hint--placeholder">Substitui o texto do topo da landing. Vazio mantém o padrão do portal.</small>
                </label>

                <label className="field">
                  <span>Subtítulo</span>
                  <input name="subtitulo" defaultValue={editor.item?.subtitulo ?? ""} maxLength={300} placeholder="Vazio usa o texto padrão" />
                  <small className="field-hint field-hint--placeholder">Mesma regra do título. Hoje nenhuma landing preenche os dois.</small>
                </label>
              </div>
            </section>

            <section className="surface-card surface-card--compact">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Publicação</p>
                  <h2>Onde a página aparece</h2>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>Publicada</span>
                  <select name="ativo" defaultValue={editor.item ? (editor.item.ativo ? "1" : "0") : "1"}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                  <small className="field-hint">Controla a página /clientes/{"{slug}"}.</small>
                </label>

                <label className="field">
                  <span>Exibir na home</span>
                  <select name="exibir_na_home" defaultValue={editor.item ? (editor.item.exibir_na_home ? "1" : "0") : "1"}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                  <small className="field-hint">
                    Controla o card do carrossel. Tirar a última remove a seção inteira de parceiros.
                  </small>
                </label>
              </div>
            </section>

            <section className="surface-card surface-card--compact">
              <div className="section-header">
                <div>
                  <p className="eyebrow">FAQ</p>
                  <h2>Perguntas da landing</h2>
                </div>
              </div>

              {faqFalhou ? (
                <div className="empty-state empty-state--inline">
                  Não foi possível carregar o FAQ. A edição está bloqueada para não apagar as perguntas que estão no ar —
                  feche e reabra para tentar de novo. Os demais campos podem ser salvos normalmente.
                </div>
              ) : faqDaLanding === null ? (
                <div className="empty-state empty-state--inline">Carregando o FAQ atual...</div>
              ) : (
                <div className="stack-md">
                  <label className="checkbox-card">
                    <input type="checkbox" checked={editarFaq} onChange={(ev) => setEditarFaq(ev.target.checked)} />
                    <span>
                      Editar o FAQ ({faqDaLanding.length} pergunta{faqDaLanding.length === 1 ? "" : "s"} hoje). Sem marcar,
                      o FAQ atual é mantido intacto.
                    </span>
                  </label>

                  {editarFaq ? (
                    <>
                      <p className="panel__description">
                        Apague pergunta e resposta juntas para remover o item. Salvar com tudo em branco apaga o FAQ
                        inteiro. A ordem é renumerada pelo servidor.
                      </p>
                      {Array.from({ length: Math.min(faqDaLanding.length + 3, 20) }).map((_, indice) => (
                        <div className="form-grid form-grid--two" key={indice}>
                          <label className="field">
                            <span>Pergunta {indice + 1}</span>
                            <input name="faq_pergunta" defaultValue={faqDaLanding[indice]?.pergunta ?? ""} maxLength={300} />
                          </label>
                          <label className="field">
                            <span>Resposta {indice + 1}</span>
                            <input name="faq_resposta" defaultValue={faqDaLanding[indice]?.resposta ?? ""} maxLength={1000} />
                          </label>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              )}
            </section>

            <div className="form-footer">
              {editor.item ? (
                <button
                  className="button button--danger"
                  type="button"
                  style={{ marginRight: "auto" }}
                  disabled={salvando}
                  onClick={() => void excluirLanding(editor.item as PortalAcordoLanding)}
                >
                  Excluir
                </button>
              ) : null}
              <button className="button button--ghost-neutral" type="button" disabled={salvando} onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button className="button" type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={editor?.tipo === "auditoria"}
        title={editor?.tipo === "auditoria" ? `${editor.item.acao} em ${editor.item.entidade}` : ""}
        description={editor?.tipo === "auditoria" ? `Por ${editor.item.ator}, em ${editor.item.criado_em}, de ${editor.item.origem_ip ?? "origem desconhecida"}.` : ""}
        onClose={() => setEditor(null)}
      >
        {editor?.tipo === "auditoria" ? (
          <div className="analytics-grid analytics-grid--two">
            <div>
              <p className="eyebrow">Antes</p>
              <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {formatarJson(editor.item.dados_antes)}
              </pre>
            </div>
            <div>
              <p className="eyebrow">Depois</p>
              <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {formatarJson(editor.item.dados_depois)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
