// =====================================
// PRONTIO - main.js
// Ponto de inicialização global do front-end.
//
// Versão loader + inicialização:
// - NÃO usa ES Modules (import/export).
// - O HTML carrega APENAS este arquivo:
//     <script src="assets/js/main.js"></script>
// - Este arquivo carrega TODOS os demais:
//   core/*.js, ui/*.js, widgets/*.js, pages/page-*.js
//
// IMPORTANTE:
// - Se algum script opcional não existir, será apenas logado um WARNING,
//   mas o sistema NÃO PARA (o bootstrap sempre roda).
// =====================================

(function (global, document) {
  "use strict";

  const SCRIPT_BASE = "assets/js/";

  // =====================================
  // LISTA DE SCRIPTS A CARREGAR
  // Ajuste conforme os arquivos que você REALMENTE tem no projeto.
  // =====================================

  const SCRIPT_FILES = [
    // ------- CORE -------
    "core/config.js",
    "core/utils.js",
    "core/helpers.js",
    "core/dom.js",
    "core/storage.js",
    "core/state.js",
    "core/api.js",
    "core/auth.js",
    "core/session.js",
    "core/theme.js",
    "core/ui-core.js",
    "core/router.js",
    "core/app.js", // se não existir, será apenas um warning

    // ------- PRINT CORE -------
    "print/print-core.js",

    // ------- UI BÁSICA -------
    "ui/messages.js",
    "ui/modals.js",

    // ------- WIDGETS -------
    "widgets/widget-form.js",
    "widgets/widget-table.js",
    "widgets/widget-sidebar.js",
    "widgets/widget-modais.js",
    "widgets/widget-toast.js",
    "widgets/widget-topbar.js",
    "widgets/widget-calendar.js",
    "widgets/widget-searchbar.js",
    "widgets/widget-drawer.js",

    // ------- PÁGINAS -------
    "pages/page-index.js",
    "pages/page-login.js",      // se ainda não existir, tudo bem
    "pages/page-pacientes.js",
    "pages/page-agenda.js",
    "pages/page-evolucao.js",
    "pages/page-prontuario.js",
    "pages/page-receita.js",
    "pages/page-laudo.js",
    "pages/page-exames.js",
    "pages/page-configuracoes.js",
    "pages/page-usuarios.js"
  ];

  // =====================================
  // LOADER DE SCRIPTS
  // =====================================

  function loadScript(path) {
    return new Promise(function (resolve) {
      const fullSrc = SCRIPT_BASE + path;
      const s = document.createElement("script");
      s.src = fullSrc;
      s.async = false; // garante ordem

      s.onload = function () {
        // console.debug("[PRONTIO.main] Script carregado:", fullSrc);
        resolve();
      };

      s.onerror = function (err) {
        console.warn(
          "[PRONTIO.main] NÃO foi possível carregar script (seguindo sem ele):",
          fullSrc,
          err
        );
        // NÃO rejeita: continua a corrente para não quebrar o bootstrap
        resolve();
      };

      document.head.appendChild(s);
    });
  }

  function loadScriptsSequentially(list) {
    return list.reduce(function (chain, path) {
      return chain.then(function () {
        return loadScript(path);
      });
    }, Promise.resolve());
  }

  // =====================================
  // BOOTSTRAP PRONTIO (depois que todos os scripts forem carregados)
  // =====================================

  function bootstrapPRONTIO() {
    const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

    // Garante subnamespaces
    PRONTIO.core = PRONTIO.core || {};
    PRONTIO.ui = PRONTIO.ui || {};
    PRONTIO.widgets = PRONTIO.widgets || {};
    PRONTIO.pages = PRONTIO.pages || {};

    // =====================================
    // Registro de páginas (retrocompat)
    // =====================================

    if (typeof PRONTIO.registerPage !== "function") {
      PRONTIO.registerPage = function registerPage(pageName, initFn) {
        if (!pageName || typeof initFn !== "function") {
          console.warn(
            "[PRONTIO.main] registerPage: parâmetros inválidos.",
            pageName,
            initFn
          );
          return;
        }

        PRONTIO.pages[pageName] = { init: initFn };

        if (
          PRONTIO.core &&
          PRONTIO.core.router &&
          typeof PRONTIO.core.router.register === "function"
        ) {
          PRONTIO.core.router.register(pageName, initFn);
        }

        console.debug(
          "[PRONTIO.main] Página registrada:",
          pageName,
          "→",
          initFn.name || "anon"
        );
      };
    }

    if (typeof PRONTIO.initPage !== "function") {
      PRONTIO.initPage = function initPage(pageName) {
        if (!pageName) {
          console.warn(
            "[PRONTIO.main] initPage chamado sem pageName. Nada será inicializado."
          );
          return;
        }

        const pageObj =
          PRONTIO.pages && typeof PRONTIO.pages === "object"
            ? PRONTIO.pages[pageName]
            : null;

        if (!pageObj || typeof pageObj.init !== "function") {
          console.warn(
            "[PRONTIO.main] Página não registrada ou sem init():",
            pageName,
            "Verifique se existe algo como PRONTIO.registerPage('" +
              pageName +
              "', fn)."
          );
          return;
        }

        try {
          console.debug(
            "[PRONTIO.main] Inicializando página (initPage):",
            pageName
          );
          pageObj.init();
        } catch (err) {
          console.error(
            "[PRONTIO.main] Erro ao executar inicializador da página:",
            pageName,
            err
          );
        }
      };
    }

    // =====================================
    // Preferências globais (tema, sidebar, etc.)
    // =====================================

    function applyUserPreferences() {
      try {
        if (PRONTIO.theme && typeof PRONTIO.theme.init === "function") {
          PRONTIO.theme.init();
        } else if (
          PRONTIO.ui &&
          typeof PRONTIO.ui.initTheme === "function"
        ) {
          PRONTIO.ui.initTheme();
        }
      } catch (e) {
        console.error("[PRONTIO.main] Erro ao inicializar tema:", e);
      }

      try {
        const storage = PRONTIO.core.storage;
        const body = document.body;

        if (storage && typeof storage.isSidebarCompact === "function" && body) {
          const compact = storage.isSidebarCompact();
          if (compact) {
            body.classList.add("sidebar-compact");
          } else {
            body.classList.remove("sidebar-compact");
          }
        }
      } catch (e) {
        console.error(
          "[PRONTIO.main] Erro ao aplicar preferência de sidebar:",
          e
        );
      }
    }

    // =====================================
    // Inicialização de layout (sidebar / topbar)
    // =====================================

    function detectCurrentPageName() {
      const body = document.body;
      if (!body) return "";

      return (
        body.getAttribute("data-page") ||
        body.getAttribute("data-page-id") ||
        ""
      );
    }

    function initLayout(pageName) {
      try {
        const sidebarWidget =
          PRONTIO.widgets && PRONTIO.widgets.sidebar
            ? PRONTIO.widgets.sidebar
            : null;

        if (sidebarWidget && typeof sidebarWidget.init === "function") {
          sidebarWidget.init();
        } else if (typeof global.initSidebar === "function") {
          global.initSidebar();
        }
      } catch (e) {
        console.error("[PRONTIO.main] Erro ao inicializar sidebar:", e);
      }

      try {
        const topbarWidget =
          PRONTIO.widgets && PRONTIO.widgets.topbar
            ? PRONTIO.widgets.topbar
            : null;

        if (topbarWidget && typeof topbarWidget.init === "function") {
          topbarWidget.init({ page: pageName });
        } else if (typeof global.initTopbar === "function") {
          global.initTopbar({ pageId: pageName });
        }
      } catch (e) {
        console.error("[PRONTIO.main] Erro ao inicializar topbar:", e);
      }
    }

    // =====================================
    // Inicialização de UI global (nome, ano, etc.)
    // =====================================

    function initGlobalUI() {
      try {
        const uiCore =
          PRONTIO.core && PRONTIO.core.uiCore ? PRONTIO.core.uiCore : null;

        if (uiCore && typeof uiCore.initGlobalUI === "function") {
          uiCore.initGlobalUI();
        }
      } catch (e) {
        console.error("[PRONTIO.main] Erro ao inicializar UI global:", e);
      }
    }

    // =====================================
    // Inicialização da página específica
    // =====================================

    function initCurrentPage() {
      const router =
        PRONTIO.core && PRONTIO.core.router
          ? PRONTIO.core.router
          : null;

      // 1) Tenta usar o router (se existir)
      if (router && typeof router.start === "function") {
        try {
          console.debug("[PRONTIO.main] Tentando iniciar página via router...");
          router.start();
        } catch (err) {
          console.error(
            "[PRONTIO.main] Erro ao iniciar página via router:",
            err
          );
        }
      }

      // 2) SEMPRE faz o fallback para PRONTIO.initPage
      //    (assim páginas que ainda não usam router continuam funcionando)
      const pageName = detectCurrentPageName();

      if (!pageName) {
        console.warn(
          "[PRONTIO.main] <body> não possui data-page ou data-page-id. Nenhuma página específica será inicializada."
        );
        return;
      }

      if (typeof PRONTIO.initPage === "function") {
        try {
          PRONTIO.initPage(pageName);
        } catch (err) {
          console.error(
            "[PRONTIO.main] Erro ao executar inicializador da página (initPage):",
            pageName,
            err
          );
        }
      } else {
        console.warn(
          "[PRONTIO.main] PRONTIO.initPage não está definido. Verifique o registro das páginas."
        );
      }
    }

    // =====================================
    // Fluxo principal (após DOM pronto)
    // =====================================

    function onReady() {
      try {
        const session =
          PRONTIO.core && PRONTIO.core.session ? PRONTIO.core.session : null;
        if (session && typeof session.init === "function") {
          session.init();
        }
      } catch (e) {
        console.error("[PRONTIO.main] Erro ao inicializar sessão:", e);
      }

      applyUserPreferences();

      const pageName = detectCurrentPageName();
      initLayout(pageName);
      initGlobalUI();
      initCurrentPage();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady);
    } else {
      onReady();
    }
  }

  // =====================================
  // BOOTSTRAP GERAL
  // =====================================

  function start() {
    loadScriptsSequentially(SCRIPT_FILES)
      .then(function () {
        bootstrapPRONTIO();
      })
      .catch(function (err) {
        // Em teoria, não deve cair aqui porque loadScript nunca rejeita,
        // mas deixamos logado se algo muito estranho acontecer.
        console.error(
          "[PRONTIO.main] Erro inesperado no carregamento de scripts:",
          err
        );
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window, document);
