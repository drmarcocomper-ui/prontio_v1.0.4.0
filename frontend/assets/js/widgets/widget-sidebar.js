// =====================================
// PRONTIO - ui/sidebar.js
// Controle da sidebar (menu lateral) do PRONTIO.
//
// Desktop:
//  - Sempre inicia EXPANDIDA (sem body.sidebar-compact).
//  - Botão .js-toggle-compact alterna body.sidebar-compact (recolhe/expande).
//
// Mobile (max-width: 900px):
//  - Sidebar funciona como drawer (off-canvas), controlado por body.sidebar-open.
//  - Botão .js-toggle-sidebar abre/fecha o drawer.
//  - Clicar no backdrop ou em um link do menu fecha o drawer.
//
// Em todas as larguras:
//  - Destaca o link ativo com base em data-page-id do <body>.
//
// CSS esperado (exemplo):
//   body.sidebar-compact .sidebar { width: 72px; ... }
//   body.sidebar-compact .sidebar .nav-link .label { display: none; }
//   @media (max-width: 900px) .sidebar => translateX(-100%)
//   body.sidebar-open .sidebar => translateX(0)
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};
  PRONTIO.ui = PRONTIO.ui || {};

  function getSidebarElement() {
    return document.getElementById("sidebar");
  }

  /* -------- helpers de estado compacto (desktop) -------- */

  /**
   * Aplica estado compacto / expandido usando APENAS body.sidebar-compact.
   * @param {boolean} isCompactFlag
   */
  function setCompact(isCompactFlag) {
    const body = document.body;
    if (!body) return;

    if (isCompactFlag) {
      body.classList.add("sidebar-compact");
    } else {
      body.classList.remove("sidebar-compact");
    }
  }

  function isCompact() {
    const body = document.body;
    if (!body) return false;
    return body.classList.contains("sidebar-compact");
  }

  /**
   * Ajusta aria-pressed no botão de toggle compacto.
   * @param {HTMLElement} btn
   * @param {boolean} isCompactFlag
   */
  function syncToggleButtonAria(btn, isCompactFlag) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", isCompactFlag ? "true" : "false");
  }

  /* -------- helpers de drawer (mobile) -------- */

  function openDrawer() {
    const body = document.body;
    if (!body) return;
    body.classList.add("sidebar-open");
  }

  function closeDrawer() {
    const body = document.body;
    if (!body) return;
    body.classList.remove("sidebar-open");
  }

  function toggleDrawer() {
    const body = document.body;
    if (!body) return;
    const open = body.classList.contains("sidebar-open");
    if (open) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  /* -------- destacar link ativo -------- */

  /**
   * Destaca o link ativo conforme data-page-id do <body>.
   * Usa classe .active e aria-current="page".
   */
  function highlightActiveNavLink(sidebar) {
    if (!sidebar || !document.body) return;

    const pageId = document.body.dataset.pageId || "";
    if (!pageId) return;

    const links = sidebar.querySelectorAll(".nav-link[data-page-id]");
    links.forEach(function (link) {
      const linkPageId = link.getAttribute("data-page-id") || "";
      const isActive = linkPageId === pageId;

      if (isActive) {
        link.classList.add("active"); // seu CSS usa .nav-link.active
        if (!link.hasAttribute("aria-current")) {
          link.setAttribute("aria-current", "page");
        }
      } else {
        link.classList.remove("active");
        if (link.getAttribute("aria-current") === "page") {
          link.removeAttribute("aria-current");
        }
      }
    });
  }

  // -----------------------------------------------------
  // Inicializador público
  // -----------------------------------------------------

  function initSidebar() {
    const sidebar = getSidebarElement();
    if (!sidebar) {
      console.warn("PRONTIO.sidebar: #sidebar não encontrado.");
      return;
    }

    const body = document.body;
    if (!body) {
      console.warn("PRONTIO.sidebar: document.body não disponível.");
      return;
    }

    // Estado inicial global:
    // - sem compacto
    // - sem drawer aberto
    body.classList.remove("sidebar-compact");
    body.classList.remove("sidebar-open");

    // 1) Botão de modo compacto (desktop)
    const btnCompact = sidebar.querySelector(".js-toggle-compact");
    if (btnCompact) {
      // estado inicial: expandido => aria-pressed = false
      syncToggleButtonAria(btnCompact, false);

      btnCompact.addEventListener("click", function () {
        const isMobile = global.matchMedia("(max-width: 900px)").matches;

        // Em mobile, esse botão pode atuar como toggle do drawer
        if (isMobile) {
          toggleDrawer();
          return;
        }

        const next = !isCompact();
        setCompact(next);
        syncToggleButtonAria(btnCompact, next);
      });
    }

    // 2) Botão sanduíche para abrir/fechar drawer (mobile)
    const toggleSidebarButtons = document.querySelectorAll(".js-toggle-sidebar");
    toggleSidebarButtons.forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        toggleDrawer();
      });
    });

    // 3) Backdrop do drawer (fecha ao clicar)
    const backdrop = document.querySelector("[data-sidebar-backdrop]");
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        closeDrawer();
      });
    }

    // 4) Ao clicar em qualquer link do menu, fecha o drawer em mobile
    const navLinks = sidebar.querySelectorAll(".nav-link");
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        const isMobile = global.matchMedia("(max-width: 900px)").matches;
        if (isMobile) {
          closeDrawer();
        }
      });
    });

    // 5) Destacar link ativo
    highlightActiveNavLink(sidebar);

    console.log(
      "PRONTIO.sidebar: initSidebar concluído. Compacto? =",
      isCompact(),
      "| Drawer aberto? =",
      body.classList.contains("sidebar-open")
    );
  }

  // -----------------------------------------------------
  // Registro no namespace PRONTIO (padrão widgets)
  // -----------------------------------------------------

  PRONTIO.widgets.sidebar = {
    init: initSidebar
  };

  // -----------------------------------------------------
  // Retrocompat: window.initSidebar e PRONTIO.ui.sidebar.init
  // -----------------------------------------------------
  try {
    PRONTIO.ui.sidebar = PRONTIO.ui.sidebar || {};
    PRONTIO.ui.sidebar.init = initSidebar;

    // função global antiga, se alguma página ainda chamar direto
    global.initSidebar = global.initSidebar || initSidebar;
  } catch (e) {
    // ambiente sem window (ex.: testes), ignorar
  }
})(window, document);
