import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <span className="not-found-code">404</span>
        <h1>Página não encontrada</h1>
        <p className="not-found-description">
          O erro <strong>404</strong> indica que a página solicitada não existe ou não está disponível neste endereço.
        </p>
        <div className="not-found-actions">
          <button className="button" type="button" onClick={() => navigate(-1)}>
            Voltar
          </button>
          <button className="button button--secondary" type="button" onClick={() => navigate("/", { replace: true })}>
            Ir para o início
          </button>
        </div>
      </section>
    </main>
  );
}
