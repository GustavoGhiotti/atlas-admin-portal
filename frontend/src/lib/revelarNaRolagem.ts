import { RefObject, useEffect } from "react";

/**
 * A barra e revelada uma a uma, e nao junto com a faixa. Fica aqui, e nao no
 * componente do grafico, porque so paginas que chamam este hook os escondem -
 * nos outros paineis do Atlas a barra continua animando ao montar.
 */
const ALVOS_INTERNOS = ".bar-chart__row";

/**
 * Revela os blocos de uma pagina conforme eles entram na tela.
 *
 * Observa os filhos diretos do container e marca cada um com `visivel` quando
 * ele aparece. O CSS cuida do resto: enquanto nao esta visivel o bloco fica
 * transparente, e ao ganhar a classe ele executa a animacao de entrada.
 *
 * A classe que ESCONDE (`revelar`) e posta aqui, nao no JSX. Se este efeito nao
 * rodar - JS quebrado, navegador antigo, hidratacao que falhou - a pagina
 * aparece inteira sem animacao, em vez de ficar em branco para sempre.
 *
 * Cada bloco e observado uma vez so: depois de revelado, sai do observador.
 * Rolar de volta nao repete a animacao, que a essa altura seria distracao.
 */
export function useRevelarNaRolagem(
  container: RefObject<HTMLElement | null>,
  dependencias: unknown[] = [],
) {
  useEffect(() => {
    const raiz = container.current;
    if (!raiz) return;

    // Sobreposicao nao entra na revelacao: ela nao rola com a pagina, e some
    // e volta sem o hook reavaliar. Testar a posicao calculada cobre o modal de
    // hoje e qualquer overlay que apareca depois.
    const emFluxo = (elemento: HTMLElement) =>
      getComputedStyle(elemento).position !== "fixed";

    const filhos = [
      ...(Array.from(raiz.children) as HTMLElement[]).filter(emFluxo),
      ...(Array.from(raiz.querySelectorAll(ALVOS_INTERNOS)) as HTMLElement[]),
    ];
    const mostrarTudo = () => {
      raiz.classList.remove("revelar");
      filhos.forEach((filho) => filho.classList.add("visivel"));
    };

    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (semMovimento || typeof IntersectionObserver === "undefined") {
      mostrarTudo();
      return;
    }

    raiz.classList.add("revelar");

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add("visivel");
          observador.unobserve(entrada.target);
        });
      },
      {
        // Margem POSITIVA embaixo: a area de deteccao passa da borda da tela,
        // entao o bloco comeca a entrar enquanto ainda esta abaixo da dobra.
        // Com -8% era o contrario - so disparava depois de aparecer, e a peca
        // se montava sob o olhar de quem rolava, o que lia como travamento.
        // 28% da folga suficiente para as animacoes mais longas (a rosca leva
        // 1,65s) terminarem por volta de quando o bloco chega ao centro.
        rootMargin: "0px 0px 28% 0px",
        threshold: 0.02,
      },
    );

    filhos.forEach((filho) => {
      if (filho.classList.contains("visivel")) return;
      observador.observe(filho);
    });

    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);
}
