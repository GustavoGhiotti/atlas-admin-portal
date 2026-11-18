import { FormEvent, useState } from "react";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { consultarRcsTeste, consultarSmsTeste, enviarRcsTeste, enviarSmsTeste, getApiError } from "@/services/atlasApi";

export default function SmsEnvioTeste({ tipo = "SMS" }: { tipo?: "SMS" | "RCS" }) {
  const enviarTeste = tipo === "RCS" ? enviarRcsTeste : enviarSmsTeste;
  const consultarTeste = tipo === "RCS" ? consultarRcsTeste : consultarSmsTeste;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData(event.currentTarget);
      const data = await enviarTeste({
        id_cedente: Number(formData.get("id_cedente")),
        canal: String(formData.get("canal") || ""),
        num_cliente: String(formData.get("num_cliente") || ""),
        mensagem_template: String(formData.get("mensagem_template") || ""),
        variaveis_json: String(formData.get("variaveis_json") || ""),
      });
      setMessage(data.mensagem || "Envio teste inserido com sucesso.");
      setResultado(data);
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao inserir envio teste."));
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupLoading(true);
    setError("");
    try {
      const formData = new FormData(event.currentTarget);
      const data = await consultarTeste(Number(formData.get("id_registro")));
      setResultado(data);
      setMessage("Consulta realizada com sucesso.");
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao consultar envio teste."));
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle={`Operação ${tipo} concluída`} errorTitle={`Falha na operação ${tipo}`} />
      <PageHeader
        eyebrow={`Operação controlada / ${tipo}`}
        title={`Envio teste ${tipo} Infobip`}
        description={`Registre testes de ${tipo} e valide retornos antes de impactar a operação.`}
      />

      <section className="surface-card">
        <div className="section-header"><div><p className="eyebrow">Guia rápido</p><h2>Monte um envio de teste com rastreabilidade</h2></div></div>
        <div className="guide-card guide-card--standalone">
          <p>
            Este formulário grava um registro diretamente na <code>{tipo === "RCS" ? "infobip.TB_ENVIO_RCS_MENSAGEM" : "infobip.TB_ENVIO_MENSAGEM"}</code> com <code>STATUS = PENDENTE</code>.
          </p>
          <div className="guide-grid">
            <div><strong>Carteira</strong><span>Use uma carteira ativa. O sistema preenche <code>ID_CEDENTE</code> e <code>CEDENTE</code> a partir dela.</span></div>
            <div><strong>Canal</strong><span>Para esta página, use <code>envio_teste</code>. Assim, o caso fica identificado como teste e não se mistura com os canais operacionais.</span></div>
            <div><strong>ID do cliente</strong><span>Controle interno do cliente. Para o envio de teste, o sistema gera automaticamente um número aleatório seguro para rastreá-lo sem coincidir com controles internos reais.</span></div>
            <div><strong>Número do cliente</strong><span>Informe o DDD e o número, usando apenas algarismos. Exemplo: <code>11999999999</code>.</span></div>
            <div><strong>Mensagem</strong><span>Texto que será gravado em <code>{tipo === "RCS" ? "MENSAGEM" : "MENSAGEM_TEMPLATE"}</code>.</span></div>
            <div><strong>Variáveis JSON</strong><span>Campo opcional para rastreamento e apoio ao teste. O conteúdo deve ser um JSON válido.</span></div>
          </div>
        </div>
        <div className="sql-preview">
          <div className="sql-preview__header">
            <p className="eyebrow">Modelo SQL</p>
            <h3>Valide o registro gerado</h3>
            <p>Use a referencia para confirmar como o teste e gravado na base operacional.</p>
          </div>
          <pre className="result-box sql-preview__code">{tipo === "RCS" ? `INSERT INTO infobip.TB_ENVIO_RCS_MENSAGEM (
    ID_CLIENTE, ID_CEDENTE, CEDENTE, CANAL, NM_USUARIO_ENVIO, NUM_CLIENTE, MENSAGEM, VARIAVEIS_JSON, STATUS
)
VALUES (
    12345678, 1, 'VEGA', 'PREVENTIVO', 'USUARIO_ROBO', '11999999999',
    'aqui vemos o texto',
    '{"titulo":"teste","imagem":"https://api.empresa.example/.png","orientation":"VERTICAL","altura":"MEDIUM","botoes":[{"texto":"Abrir boleto","retorno":"abrir_boleto","url":"https://www.portalacordo.example/home"}]}',
    'PENDENTE'
);` : `INSERT INTO infobip.TB_ENVIO_MENSAGEM (
    CEDENTE, CANAL, ID_CEDENTE, ID_CLIENTE, NUM_CLIENTE, MENSAGEM_TEMPLATE, VARIAVEIS_JSON, STATUS
)
VALUES (
    'BANCOALFA', 'envio_teste', 51, 12345678, '11999999999',
    'Ola! {nome_cliente}, seu acordo para o dia {data}.',
    '{"nome_cliente":"CLIENTE","data":"01/01/2026"}',
    'PENDENTE'
);`}</pre>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-header"><div><p className="eyebrow">Cadastro</p><h2>Registre um envio teste</h2></div></div>
        <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
          <label className="field"><span>ID cedente</span><input name="id_cedente" type="number" min="1" placeholder="Ex.: 3" required /></label>
          <label className="field"><span>Canal</span><input name="canal" placeholder="Ex.: ENVIO_TESTE" required /></label>
          <label className="field field--full"><span>Número do cliente</span><input name="num_cliente" placeholder="11999999999" required /></label>
          <label className="field"><span>Mensagem</span><textarea name="mensagem_template" rows={5} defaultValue={tipo === "RCS" ? "aqui vemos o texto" : "Ola! {nome_cliente}, seu acordo para o dia {data}."} /></label>
          <label className="field"><span>Variáveis JSON</span><textarea name="variaveis_json" rows={12} defaultValue={tipo === "RCS" ? JSON.stringify({ titulo: "teste", imagem: "https://api.empresa.example/.png", orientation: "VERTICAL", altura: "MEDIUM", botoes: [{ texto: "Abrir boleto", retorno: "abrir_boleto", url: "https://www.portalacordo.example/home" }, { texto: "Enviar comprovante", retorno: "enviar_comprovante", url: "https://www.portalacordo.example/home" }] }, null, 2) : '{"nome_cliente":"CLIENTE","data":"01/01/2026"}'} /></label>
          <button className="button field--full" type="submit" disabled={loading}>{loading ? "Enviando..." : "Inserir envio teste"}</button>
        </form>
      </section>

      <section className="surface-card">
        <div className="section-header"><div><p className="eyebrow">Consulta</p><h2>Consulte o retorno do teste</h2></div></div>
        <form className="inline-form" onSubmit={handleLookup}>
          <label className="field field--grow"><span>ID cliente</span><input name="id_registro" type="number" min="1" required /></label>
          <button className="button button--secondary" type="submit" disabled={lookupLoading}>{lookupLoading ? "Consultando..." : "Consultar"}</button>
        </form>
        {resultado ? (
          <>
            <div className="info-grid">
              <article className="info-card"><span>ID</span><strong>{resultado.id || "-"}</strong></article>
              <article className="info-card"><span>ID cliente</span><strong>{resultado.id_cliente || "-"}</strong></article>
              <article className="info-card"><span>Status</span><strong>{resultado.status || "-"}</strong></article>
              <article className="info-card"><span>Status desc</span><strong>{resultado.status_desc || "-"}</strong></article>
              <article className="info-card"><span>Cedente</span><strong>{resultado.cedente || "-"}</strong></article>
              <article className="info-card"><span>Canal</span><strong>{resultado.canal || "-"}</strong></article>
              <article className="info-card"><span>Número do cliente</span><strong>{resultado.num_cliente || "-"}</strong></article>
              <article className="info-card"><span>Dt envio</span><strong>{resultado.dt_envio || "-"}</strong></article>
            </div>
          </>
        ) : <div className="empty-state">Informe um ID para consultar o retorno do teste.</div>}
      </section>
    </div>
  );
}
