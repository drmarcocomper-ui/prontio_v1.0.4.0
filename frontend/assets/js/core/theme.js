// =====================================
// PRONTIO - core/theme.js
// Controle de tema (claro/escuro)
//
// Responsabilidades:
// - Ler tema salvo (localStorage)
// - Aplicar tema no <body> via data-theme
// - Sincronizar ícones (sol/lua) e aria-pressed
// - Expor PRONTIO.theme.init()
// - Retrocompat: PRONTIO.ui.initTheme
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const themeNS = (PRONTIO.theme = PRONTIO.theme || {});

  const STORAGE_KEY = "prontio.theme"; // 'light' | 'dark'

  // -----------------------------------------------------
  // Funções internas
  // -----------------------------------------------------

  /**
   * Detecta tema preferido inicial:
   * - se houver em localStorage, usa
   * - senão, tenta preferência do sistema (media query)
   * - fallback: 'light'
   */
  function detectarTemaInicial() {
    try {
      const salvo = global.localStorage.getItem(STORAGE_KEY);
      if (salvo === "light" || salvo === "dark") return salvo;
    } catch (e) {
      // se localStorage não estiver disponível, ignora
    }

    if (global.matchMedia) {
      const prefereEscuro = global.matchMedia("(prefers-color-scheme: dark)");
      if (prefereEscuro.matches) return "dark";
    }

    return "light";
  }

  /**
   * Aplica o tema no <body> e atualiza ícones/botões.
   * @param {'light'|'dark'} tema
   */
  function aplicarTema(tema) {
    const body = document.body;
    if (!body) return;

    // Ex: <body data-theme="dark">
    body.dataset.theme = tema;

    // Botões que alternam tema (sidebar e topo)
    const botoesToggle = document.querySelectorAll(".js-toggle-theme");

    botoesToggle.forEach((btn) => {
      // aria-pressed
      btn.setAttribute("aria-pressed", tema === "dark" ? "true" : "false");

      // Ícones internos (sol/lua), se existirem
      const iconSun = btn.querySelector(".js-theme-icon-sun");
      const iconMoon = btn.querySelector(".js-theme-icon-moon");

      if (iconSun && iconMoon) {
        if (tema === "dark") {
          iconSun.style.display = "none";
          iconMoon.style.display = "block";
        } else {
          iconSun.style.display = "block";
          iconMoon.style.display = "none";
        }
      }
    });
  }

  /**
   * Alterna o tema atual (light <-> dark)
   */
  function alternarTema() {
    const body = document.body;
    const temaAtual = body && body.dataset.theme === "dark" ? "dark" : "light";
    const novoTema = temaAtual === "dark" ? "light" : "dark";

    aplicarTema(novoTema);

    try {
      global.localStorage.setItem(STORAGE_KEY, novoTema);
    } catch (e) {
      // ignore erro de localStorage
    }
  }

  // -----------------------------------------------------
  // Função pública: init
  // -----------------------------------------------------

  /**
   * Inicializa o controle de tema:
   * - aplica tema inicial
   * - conecta eventos nos botões de alternância
   */
  function initTheme() {
    // 1) Aplica tema inicial
    const temaInicial = detectarTemaInicial();
    aplicarTema(temaInicial);

    // 2) Liga eventos nos botões que alternam tema
    const botoesToggle = document.querySelectorAll(".js-toggle-theme");

    botoesToggle.forEach((btn) => {
      // evita adicionar múltiplos listeners se initTheme for chamado de novo
      if (btn.dataset.themeBound === "true") return;
      btn.dataset.themeBound = "true";

      btn.addEventListener("click", function (event) {
        event.preventDefault();
        alternarTema();
      });
    });
  }

  // -----------------------------------------------------
  // Expor no namespace PRONTIO
  // -----------------------------------------------------
  themeNS.init = initTheme;
  themeNS.apply = aplicarTema;
  themeNS.toggle = alternarTema;
  themeNS.detectInitial = detectarTemaInicial;

  // -----------------------------------------------------
  // Retrocompat: PRONTIO.ui.initTheme
  // -----------------------------------------------------
  try {
    PRONTIO.ui = PRONTIO.ui || {};
    PRONTIO.ui.initTheme = initTheme;
  } catch (e) {
    // ambiente sem window → ignora
  }
})(window, document);
