// =====================================
// PRONTIO - core/api.js
// Camada de comunicação com a API (Apps Script)
//
// Responsabilidades:
// - Implementar callApi({ action, payload })
// - Usar as configs de core/config.js
// - Tratar erros de rede / timeout / formato
//
// Contrato com o backend (Api.gs):
//   Request (POST, corpo de texto):
//     { "action": "NomeDaAcao", "payload": { ... } }
//
//   Response (sempre JSON):
//     {
//       "success": true/false,
//       "data": { ... } ou null,
//       "errors": [ { code, message, details } ]
//     }
//
// Este módulo simplifica para o front:
//   - Se success === true  → resolve com `data`
//   - Se success === false → lança Error(message)
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const config = PRONTIO.config;

  if (!config || typeof config.getApiBaseUrl !== "function") {
    console.warn(
      "[PRONTIO.api] core/config.js deve ser carregado antes de core/api.js."
    );
  }

  /**
   * callApi
   * @param {Object} options
   * @param {string} options.action - Nome da ação no backend (ex: "AgendaConfig_Obter")
   * @param {Object} [options.payload] - Dados enviados para a API
   * @returns {Promise<any>} - resolve com `data` do backend ou rejeita com Error
   */
  async function callApi({ action, payload = {} }) {
    if (!action || typeof action !== "string") {
      throw new Error('callApi: parâmetro "action" é obrigatório e deve ser string.');
    }

    const baseUrl =
      (config && typeof config.getApiBaseUrl === "function"
        ? config.getApiBaseUrl()
        : "") || "";
    const timeoutMs =
      (config && typeof config.getApiTimeout === "function"
        ? config.getApiTimeout()
        : 20000);

    if (!baseUrl) {
      throw new Error(
        "callApi: URL base da API não definida. Verifique core/config.js."
      );
    }

    // Ajuda no debug: ver qual URL está sendo usada
    console.debug(
      "[PRONTIO.api] Chamando API:",
      baseUrl,
      "action=" + action,
      "payload=",
      payload
    );

    const body = JSON.stringify({
      action: action,
      payload: payload,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    let response;
    try {
      response = await fetch(baseUrl, {
        method: "POST",
        // IMPORTANTE: usar text/plain (ou nenhum header) para evitar preflight CORS
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: body,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err && err.name === "AbortError") {
        throw new Error("Tempo de resposta da API excedido. Tente novamente.");
      }

      console.error("[PRONTIO.api] Erro de rede na callApi:", err);
      throw new Error("Não foi possível se comunicar com o servidor.");
    }

    clearTimeout(timeoutId);

    // Aqui só vamos conseguir ler status se a resposta NÃO for bloqueada por CORS.
    if (!response.ok) {
      console.error(
        "[PRONTIO.api] HTTP error ao chamar API:",
        response.status,
        response.statusText
      );
      // Muitas vezes o Apps Script retorna HTML em erro; então nem tento fazer .json() aqui.
      throw new Error(
        "Erro de comunicação com o servidor (HTTP " + response.status + ")."
      );
    }

    let json;
    try {
      json = await response.json();
    } catch (err) {
      console.error("[PRONTIO.api] Resposta da API não é JSON válido:", err);
      throw new Error("Resposta inválida do servidor (JSON esperado).");
    }

    // Garante o formato mínimo esperado
    if (!json || typeof json.success === "undefined") {
      console.error("[PRONTIO.api] Resposta da API sem campo 'success':", json);
      throw new Error("Resposta inesperada do servidor.");
    }

    if (!json.success) {
      const errors = Array.isArray(json.errors) ? json.errors : [];
      const message =
        (errors[0] && errors[0].message) ||
        "Erro ao processar a requisição no servidor.";

      const error = new Error(message);
      error.apiErrors = errors;
      error.apiData = json.data || null;
      throw error;
    }

    // Sucesso: devolvemos só o `data`
    return json.data;
  }

  // Expor no namespace PRONTIO e como função global (conveniência)
  PRONTIO.api = { callApi: callApi };
  global.callApi = callApi;
})(window);
