// =====================================
// PRONTIO - ui/topbar.js
// Controle do topo (topbar) do PRONTIO
//
// - Versão compatível com o padrão de namespaces do PRONTIO
// - NÃO usa import/export (sem ES Modules)
// - Exposto como:
//     PRONTIO.widgets.topbar.init(opts)
//     PRONTIO.ui.setTopbar(config)
//     PRONTIO.ui.initTopbar(opts)
//     window.initTopbar(opts)  (retrocompat)
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};
  PRONTIO.ui = PRONTIO.ui || {};

  function setTextById(id, value) {
    // id pode vir com ou sem "#"
    const cleanId = id && id.startsWith("#") ? id.slice(1) : id;
    if (!cleanId) return;

    const el = document.getElementById(cleanId);
    if (!el) return;

    if (value == null) return; // não mexe se for null/undefined
    el.textContent = value;
  }

  /**
   * Permite setar manualmente título, subtítulo e tag no topo.
   * @param {Object} config
   * @param {string} [config.title]
   * @param {string} [config.subtitle]
   * @param {string} [config.tag]
   */
  function setTopbar(config) {
    config = config || {};

    if (Object.prototype.hasOwnProperty.call(config, "title")) {
      setTextById("topbar-title-text", config.title);
    }
    if (Object.prototype.hasOwnProperty.call(config, "subtitle")) {
      setTextById("topbar-subtitle", config.subtitle);
    }
    if (Object.prototype.hasOwnProperty.call(config, "tag")) {
      setTextById("topbar-tag", config.tag);
    }
  }

  /**
   * Inicializa automaticamente o topo, preenchendo:
   * - título (conforme pageId)
   * - breadcrumb
   * - subtítulo (data-subtitle, se definido)
   * - tag (data-tag, se definido)
   * - meta (data do dia e contexto)
   *
   * @param {Object} opts
   * @param {string} [opts.page]   - usado pelo main.js (pageName)
   * @param {string} [opts.pageId] - opcional, fallback para page
   */
  function initTopbar(opts) {
    opts = opts || {};
    const body = document.body;
    if (!body) return;

    // pageId pode vir de opts.page (main.js) ou opts.pageId ou data-page-id
    const pageId =
      opts.page ||
      opts.pageId ||
      body.getAttribute("data-page") ||
      body.dataset.pageId ||
      "index";

    console.log("PRONTIO.topbar: initTopbar pageId =", pageId);

    // 1) TÍTULO AUTOMÁTICO
    const titleMap = {
      index: "Início",
      agenda: "Agenda",
      pacientes: "Pacientes",
      evolucao: "Evolução",
      exames: "Exames",
      laudo: "Laudo",
      prontuario: "Prontuário",
      receita: "Receita",
      configuracoes: "Configurações",
    };

    const title = titleMap[pageId] || "PRONTIO";
    setTextById("topbar-title-text", title);

    // 2) BREADCRUMB
    setTextById("topbar-breadcrumb", "Início / " + title);

    // 3) SUBTÍTULO (somente se data-subtitle estiver definido)
    const subtitleFromData = body.dataset.subtitle;
    if (subtitleFromData && subtitleFromData.trim() !== "") {
      setTextById("topbar-subtitle", subtitleFromData);
    }

    // 4) TAG (somente se data-tag estiver definido)
    const tagFromData = body.dataset.tag;
    if (tagFromData && tagFromData.trim() !== "") {
      setTextById("topbar-tag", tagFromData);
    }

    // 5) META: Data do dia
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    setTextById("topbar-meta-date", "Hoje: " + dataFormatada);

    // 6) META: Contexto (ex.: Consultório)
    const contexto = body.dataset.context || "Consultório";
    setTextById("topbar-meta-context", contexto);
  }

  // -----------------------------------------------------
  // Registro no namespace PRONTIO (padrão widgets)
  // -----------------------------------------------------

  // Widget usado pelo main.js → PRONTIO.widgets.topbar.init({ page: pageName })
  PRONTIO.widgets.topbar = {
    init: initTopbar,
    set: setTopbar,
  };

  // Também expõe em PRONTIO.ui para uso direto nas páginas, se quiser
  PRONTIO.ui.setTopbar = setTopbar;
  PRONTIO.ui.initTopbar = initTopbar;

  // Retrocompat global: window.initTopbar(opts)
  if (typeof global.initTopbar !== "function") {
    global.initTopbar = initTopbar;
  }
})(window, document);
