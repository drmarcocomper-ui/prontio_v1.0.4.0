// =====================================
// PRONTIO - core/auth.js
// Controle de autenticação no FRONT-END
//
// Responsabilidades:
// - Guardar token de sessão (se usado)
// - Guardar dados básicos do usuário logado
// - Sincronizar isso com localStorage
// - Fornecer helpers para páginas/telas:
//
//   const auth = PRONTIO.auth;
//
//   auth.isAuthenticated()
//   auth.getUser()
//   auth.getToken()
//   auth.setSession({ token, user })
//   auth.clearSession()
//   auth.requireAuth()
//
// OBS IMPORTANTE:
// - Este arquivo NÃO faz login sozinho.
// - O login deve ser feito por uma página (ex.: login/usuarios),
//   chamando callApi("Auth_Login") ou similar, e então chamando
//   auth.setSession(...) com o que o backend devolver.
//
// - O backend (Auth.gs) é quem define o contrato exato de login.
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const authNS = (PRONTIO.auth = PRONTIO.auth || {});

  // -------------------------------------
  // Chaves de armazenamento
  // -------------------------------------
  const STORAGE_KEYS = {
    TOKEN: "prontio.auth.token",
    USER: "prontio.auth.user",
  };

  // Em memória (para acesso rápido)
  let currentToken = null;
  let currentUser = null; // { id, nome, email, perfil, ... }

  // -------------------------------------
  // localStorage helpers
  // -------------------------------------
  function lsGet(key) {
    try {
      if (!global.localStorage) return null;
      return global.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      if (!global.localStorage) return;
      if (value === null || value === undefined) {
        global.localStorage.removeItem(key);
      } else {
        global.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Modo privado, quota cheia etc. → ignorar
    }
  }

  // -------------------------------------
  // Inicialização a partir do localStorage
  // -------------------------------------
  function initFromStorage() {
    const token = lsGet(STORAGE_KEYS.TOKEN);
    const userJson = lsGet(STORAGE_KEYS.USER);

    currentToken = token || null;

    if (userJson) {
      try {
        currentUser = JSON.parse(userJson);
      } catch (e) {
        currentUser = null;
      }
    } else {
      currentUser = null;
    }
  }

  // Executa uma vez na carga
  initFromStorage();

  // -------------------------------------
  // API interna
  // -------------------------------------

  /**
   * Define a sessão atual (após login bem-sucedido).
   *
   * @param {Object} session
   * @param {string} [session.token] - token de autenticação (se o backend usar)
   * @param {Object} [session.user]  - dados básicos do usuário logado
   */
  function setSessionInternal(session) {
    const token = session && session.token ? String(session.token) : null;
    const user = session && session.user ? session.user : null;

    currentToken = token;
    currentUser = user;

    lsSet(STORAGE_KEYS.TOKEN, token);

    if (user) {
      try {
        lsSet(STORAGE_KEYS.USER, JSON.stringify(user));
      } catch (e) {
        // Se não conseguir salvar, limpamos para evitar lixo
        lsSet(STORAGE_KEYS.USER, null);
      }
    } else {
      lsSet(STORAGE_KEYS.USER, null);
    }
  }

  /**
   * Limpa completamente a sessão (logout).
   */
  function clearSessionInternal() {
    currentToken = null;
    currentUser = null;
    lsSet(STORAGE_KEYS.TOKEN, null);
    lsSet(STORAGE_KEYS.USER, null);
  }

  /**
   * Retorna true se o usuário estiver autenticado.
   * (Por padrão, considera autenticado se tiver user OU token.)
   */
  function isAuthenticatedInternal() {
    return !!(currentToken || currentUser);
  }

  /**
   * Retorna o token atual (ou null).
   */
  function getTokenInternal() {
    return currentToken || null;
  }

  /**
   * Retorna uma cópia dos dados do usuário atual (ou null).
   */
  function getUserInternal() {
    return currentUser ? { ...currentUser } : null;
  }

  /**
   * Atalho para pegar apenas o nome do usuário (se existir).
   */
  function getUserNameInternal() {
    return currentUser && currentUser.nome
      ? currentUser.nome
      : currentUser && currentUser.name
      ? currentUser.name
      : "";
  }

  /**
   * Garante que a página atual só é acessada por usuário autenticado.
   * Se não estiver autenticado:
   * - opcionalmente redireciona para a página de login.
   *
   * @param {Object} [options]
   * @param {boolean} [options.redirect=true] - se true, redireciona
   * @param {string}  [options.loginUrl]      - URL de login (fallback para "index.html" ou configurado)
   * @returns {boolean} - true se autenticado, false se não
   */
  function requireAuthInternal(options) {
    const opts = options || {};
    const redirect = typeof opts.redirect === "boolean" ? opts.redirect : true;

    if (isAuthenticatedInternal()) {
      return true;
    }

    if (redirect) {
      const loginUrl = resolveLoginUrl(opts.loginUrl);
      try {
        global.location.href = loginUrl;
      } catch (e) {
        // Se não conseguir redirecionar, apenas loga o problema
        console.warn("[PRONTIO.auth] Não foi possível redirecionar para login:", e);
      }
    }

    return false;
  }

  /**
   * Resolve qual URL de login usar.
   * Ordem de prioridade:
   *  1) options.loginUrl (parâmetro)
   *  2) PRONTIO.config.getLoginUrl()    (se existir)
   *  3) window.PRONTIO_LOGIN_URL        (se definido antes)
   *  4) "index.html" (fallback)
   */
  function resolveLoginUrl(explicitUrl) {
    if (explicitUrl) return explicitUrl;

    try {
      if (
        PRONTIO.config &&
        typeof PRONTIO.config.getLoginUrl === "function"
      ) {
        const cfgUrl = PRONTIO.config.getLoginUrl();
        if (cfgUrl) return cfgUrl;
      }
    } catch (e) {
      // ignora
    }

    if (typeof global.PRONTIO_LOGIN_URL === "string") {
      return global.PRONTIO_LOGIN_URL;
    }

    // fallback “seguro”: index.html
    return "index.html";
  }

  // -------------------------------------
  // Exposição pública em PRONTIO.auth
  // -------------------------------------
  authNS.setSession = setSessionInternal;
  authNS.clearSession = clearSessionInternal;
  authNS.isAuthenticated = isAuthenticatedInternal;
  authNS.getToken = getTokenInternal;
  authNS.getUser = getUserInternal;
  authNS.getUserName = getUserNameInternal;
  authNS.requireAuth = requireAuthInternal;

})(window);
