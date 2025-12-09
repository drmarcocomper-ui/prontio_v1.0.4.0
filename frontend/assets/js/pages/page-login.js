// =====================================
// PRONTIO - pages/page-login.js
// Tela de login
//
// Fluxo:
// - Usuário informa usuário + senha
// - Chama callApi({ action: "Auth_Login", payload })
// - Se sucesso: PRONTIO.auth.setSession({ token, user })
// - Redireciona para index.html (ou outra página inicial)
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const api = PRONTIO.api || {};
  const auth = PRONTIO.auth || {};
  const widgets = (PRONTIO.widgets = PRONTIO.widgets || {});
  const toastWidget = widgets.toast || null;

  const callApi =
    typeof api.callApi === "function"
      ? api.callApi
      : typeof global.callApi === "function"
      ? global.callApi
      : null;

  function mostrarMensagemLogin(texto, tipo) {
    if (toastWidget && typeof toastWidget.createPageMessages === "function") {
      const pageMsg = toastWidget.createPageMessages("#mensagemLogin");
      const opts = { autoHide: tipo === "sucesso", autoHideDelay: 3000 };

      switch (tipo) {
        case "sucesso":
          pageMsg.sucesso(texto, opts);
          return;
        case "erro":
          pageMsg.erro(texto, opts);
          return;
        default:
          pageMsg.info(texto, opts);
          return;
      }
    }

    // Fallback em <div id="mensagemLogin">
    const div = document.getElementById("mensagemLogin");
    if (!div) return;

    if (!texto) {
      div.className = "mensagem is-hidden";
      div.textContent = "";
      return;
    }

    div.className = "mensagem";
    div.textContent = texto;

    switch (tipo) {
      case "sucesso":
        div.classList.add("mensagem-sucesso");
        break;
      case "erro":
        div.classList.add("mensagem-erro");
        break;
      default:
        div.classList.add("mensagem-info");
        break;
    }
  }

  async function realizarLogin(event) {
    event.preventDefault();

    if (!callApi) {
      console.error("[PRONTIO.login] callApi não disponível.");
      mostrarMensagemLogin(
        "Erro interno: API não disponível. Verifique console.",
        "erro"
      );
      return;
    }

    const usuarioEl = document.getElementById("loginUsuario");
    const senhaEl = document.getElementById("loginSenha");

    const usuario = (usuarioEl?.value || "").trim();
    const senha = (senhaEl?.value || "").trim();

    if (!usuario || !senha) {
      mostrarMensagemLogin("Informe usuário e senha.", "erro");
      return;
    }

    mostrarMensagemLogin("Autenticando...", "info");

    try {
      // O backend Auth_Login deve devolver:
      // { token: "...", user: { id, nome, email, perfil... } }
      const result = await callApi({
        action: "Auth_Login",
        payload: { usuario, senha },
      });

      if (auth && typeof auth.setSession === "function") {
        auth.setSession({
          token: result && result.token ? result.token : null,
          user: result && result.user ? result.user : null,
        });
      }

      mostrarMensagemLogin("Login realizado com sucesso.", "sucesso");

      // Redireciona depois de um pequeno delay
      setTimeout(function () {
        // Página inicial pós-login (ajuste se quiser ir direto para agenda etc.)
        global.location.href = "index.html";
      }, 600);
    } catch (error) {
      console.error("[PRONTIO.login] Erro no login:", error);
      const msg =
        (error && error.message) || "Erro inesperado ao tentar fazer login.";
      mostrarMensagemLogin(msg, "erro");
    }
  }

  function initLoginPage() {
    const yearEl = document.getElementById("login-year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }

    const form = document.getElementById("formLogin");
    if (form) {
      form.addEventListener("submit", realizarLogin);
    }
  }

  if (typeof PRONTIO.registerPageInitializer === "function") {
    PRONTIO.registerPageInitializer("login", initLoginPage);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.login = { init: initLoginPage };
  }
})(window, document);
