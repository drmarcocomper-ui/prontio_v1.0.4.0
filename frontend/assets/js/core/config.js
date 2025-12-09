// ===================================== 
// PRONTIO - core/config.js
// Configurações globais do front-end
//
// Responsabilidades:
// - Definir ambiente atual (dev/prod)
// - Fornecer URL base da API (Google Apps Script)
// - Definir timeout padrão de chamadas
//
// Uso típico:
//   const apiUrl = PRONTIO.config.getApiBaseUrl();
//   const env = PRONTIO.config.getEnv();
//   const timeout = PRONTIO.config.getApiTimeout();
//
// Para forçar produção no HTML:
//
//   <script>window.PRONTIO_ENV = "prod";</script>
//   <script src="assets/js/core/config.js"></script>
//
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // -------------------------------------
  // Ambiente
  // -------------------------------------
  //
  // Se nada for definido antes, assume "dev".
  // Para forçar "prod" em uma página:
  //   <script>window.PRONTIO_ENV = "prod";</script>
  //   <script src="assets/js/core/config.js"></script>
  //
  const DEFAULT_ENV = global.PRONTIO_ENV || "dev"; // "dev" | "prod"

  // -------------------------------------
  // URLs da API (Google Apps Script)
  // -------------------------------------
  //
  // IDs ATUAIS das IMPLANTAÇÕES WEBAPP:
  //  - DEV  → AKfycbzo-tGKjVoMhbBexSq7kwmO2HpX_OTXe5N5P_a7NKn4d05lXOuP9yK1yDy6N8aID72vog
  //  - PROD → AKfycbzwvF6F1WTHUnU1Ysn0ob-BUOK2IlzmXWUX4E1kXSff761VV9gzLHS_Cr6WI_1DQ8ETeg
  //
  // Cada um corresponde a uma URL /exec do WebApp:
  //
  const API_BASE_URLS = {
    dev: "https://script.google.com/macros/s/AKfycbwcVZwA5pYoA_u0hMV_fZPwPYGz_7G-Fc66L3TXFBrE39-kasS1ZvR8uZV5n8aFCS4DTQ/exec",
    prod: "https://script.google.com/macros/s/AKfycbzwvF6F1WTHUnU1Ysn0ob-BUOK2IlzmXWUX4E1kXSff761VV9gzLHS_Cr6WI_1DQ8ETeg/exec",
  };

  // Timeout padrão de chamadas de API (ms)
  const DEFAULT_API_TIMEOUT = 20000; // 20 segundos

  // -------------------------------------
  // API pública
  // -------------------------------------
  const config = {
    /**
     * Retorna o ambiente atual do front-end.
     * @returns {"dev"|"prod"}
     */
    getEnv() {
      return DEFAULT_ENV;
    },

    /**
     * Retorna a URL base da API do Apps Script.
     * @returns {string}
     */
    getApiBaseUrl() {
      return API_BASE_URLS[DEFAULT_ENV] || API_BASE_URLS.dev;
    },

    /**
     * Retorna o timeout padrão para chamadas API (ms).
     */
    getApiTimeout() {
      return DEFAULT_API_TIMEOUT;
    },

    isProd() {
      return DEFAULT_ENV === "prod";
    },

    isDev() {
      return DEFAULT_ENV === "dev";
    },
  };

  // -------------------------------------
  // Expor no namespace global
  // -------------------------------------
  PRONTIO.config = config;

})(window);
