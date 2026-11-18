export async function copyToClipboard(text: string) {
  if (typeof window !== "undefined" && window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // cai para o fallback abaixo
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Nao foi possivel copiar o texto.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copiado = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copiado) {
    throw new Error("Nao foi possivel copiar o texto.");
  }
}
