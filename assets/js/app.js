function normalizarCaminho(caminho) {
  const caminhoSemIndice = caminho.replace(/\/index\.html$/i, "/");
  return caminhoSemIndice.length > 1
    ? caminhoSemIndice.replace(/\/+$/, "")
    : caminhoSemIndice;
}

function init() {
  const caminhoAtual = normalizarCaminho(window.location.pathname);

  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.getAttribute("href").startsWith("#")) {
      return;
    }

    const caminhoDoLink = normalizarCaminho(new URL(link.href, window.location.href).pathname);

    if (caminhoDoLink === caminhoAtual) {
      link.classList.add("ativo");
      link.setAttribute("aria-current", "page");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);

export default { init };
