import { FormEvent, useState } from "react";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { consultarEmailTeste, enviarEmailTeste, getApiError } from "@/services/atlasApi";

export default function EmailEnvioTeste() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData(event.currentTarget);
      const data = await enviarEmailTeste({
        carteira: String(formData.get("carteira") || ""),
        grupo: String(formData.get("grupo") || ""),
        canal: String(formData.get("canal") || ""),
        email_cliente: String(formData.get("email_cliente") || ""),
        email_empresa: String(formData.get("email_empresa") || ""),
        id_template: String(formData.get("id_template") || ""),
        variaveis_json: String(formData.get("variaveis_json") || ""),
      });
      setResultado(data);
      setMessage(data.mensagem || "Envio teste inserido com sucesso.");
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
      const data = await consultarEmailTeste(Number(formData.get("id_registro")));
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
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle="Operacao de email concluida" errorTitle="Falha na operacao de email" />
      <PageHeader
        eyebrow="Operacao controlada / Email"
        title="Envio teste SendGrid"
        description="Registre testes de email e valide retornos antes de escalar a operacao."
      />

      <section className="surface-card">
        <div className="section-header"><div><p className="eyebrow">Guia rapido</p><h2>Monte um envio teste com rastreabilidade</h2></div></div>
        <div className="guide-card guide-card--standalone">
          <p>
            Este formulario grava um registro direto na <code>sendgrid.TB_EMAIL_DISPARO</code> com <code>STATUS = PENDENTE</code>.
          </p>
          <div className="guide-grid">
            <div><strong>Carteira</strong><span>Use uma carteira existente. O sistema resolve <code>ID_CEDENTE</code> e <code>NM_CARTEIRA</code> a partir dela.</span></div>
            <div><strong>Grupo</strong><span>Informe o grupo operacional que deve acompanhar o caso de teste, como <code>WO</code> ou outro grupo valido para sua esteira.</span></div>
            <div><strong>Canal</strong><span>Para esta pagina, use <code>envio_teste</code>. Assim o caso fica separado do trafego operacional real.</span></div>
            <div><strong>ID Cliente</strong><span>O sistema gera automaticamente um numero aleatorio seguro para rastrear o teste sem bater com os controles internos reais.</span></div>
            <div><strong>Email cliente</strong><span>Endereco que vai receber o disparo de teste.</span></div>
            <div><strong>Email empresa</strong><span>Endereco remetente configurado para a carteira ou para a operacao.</span></div>
            <div><strong>ID Template</strong><span>Use o identificador real do template no SendGrid, no formato <code>d-...</code>.</span></div>
            <div><strong>Variaveis JSON</strong><span>Campo obrigatorio de template. Precisa ser um JSON valido com as chaves esperadas no modelo.</span></div>
          </div>
        </div>
        <div className="sql-preview">
          <div className="sql-preview__header">
            <p className="eyebrow">Modelo SQL</p>
            <h3>Valide o registro gerado</h3>
            <p>Use a referencia para confirmar como o teste e gravado na fila operacional.</p>
          </div>
          <pre className="result-box sql-preview__code">{`INSERT INTO sendgrid.TB_EMAIL_DISPARO (
    ID_CLIENTE,
    ID_CEDENTE,
    NM_CARTEIRA,
    GRUPO,
    CANAL,
    EMAIL_CLIENTE,
    EMAIL_EMPRESA,
    ID_TEMPLATE,
    VARIAVEIS_JSON,
    STATUS
)
VALUES (
    122466,
    15,
    'GAMA',
    'WO',
    'envio_teste',
    'colaborador01@empresa.example',
    'delta@empresa.example',
    'd-fb413108b1c048a0afab9e67edd24bc7',
    '{"nm_cliente":"CLIENTE","vl_entrada":"1.350,30","anexos":["https://api.empresa.example/boleto/.cliente/Boleto_10440935532970044219368198896.pdf"]}',
    'PENDENTE'
);`}</pre>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-header"><div><p className="eyebrow">Cadastro</p><h2>Registre um envio teste</h2></div></div>
        <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
          <label className="field"><span>Carteira</span><input name="carteira" placeholder="Ex.: BANCOALFA" required /></label>
          <label className="field"><span>Grupo</span><input name="grupo" placeholder="Ex.: WO" required /></label>
          <label className="field"><span>Canal</span><input name="canal" placeholder="Ex.: ENVIO_TESTE" required /></label>
          <label className="field"><span>Email cliente</span><input name="email_cliente" type="email" required /></label>
          <label className="field"><span>Email empresa</span><input name="email_empresa" type="email" required /></label>
          <label className="field"><span>Template</span><input name="id_template" required /></label>
          <label className="field field--full"><span>Variaveis JSON</span><textarea name="variaveis_json" rows={5} defaultValue={'{"nome_cliente":"CLIENTE"}'} /></label>
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
              <article className="info-card"><span>Carteira</span><strong>{resultado.nm_carteira || "-"}</strong></article>
              <article className="info-card"><span>Grupo</span><strong>{resultado.grupo || "-"}</strong></article>
              <article className="info-card"><span>Canal</span><strong>{resultado.canal || "-"}</strong></article>
              <article className="info-card"><span>Email cliente</span><strong>{resultado.email_cliente || "-"}</strong></article>
              <article className="info-card"><span>Dt envio</span><strong>{resultado.dt_envio || "-"}</strong></article>
            </div>
          </>
        ) : <div className="empty-state">Informe um ID para consultar o retorno do teste.</div>}
      </section>
    </div>
  );
}
