/**
 * PRONTIO - API principal (Apps Script WebApp) - AMBIENTE DEV
 *
 * Padrão de chamada (front-end):
 *  POST body (text/plain JSON):
 *  {
 *    "action": "Modulo_Acao" ou "Modulo.Acao",
 *    "payload": { ... }
 *  }
 *
 * Resposta padrão:
 * {
 *   "success": true/false,
 *   "data": {...} ou null,
 *   "errors": [ { code, message, details } ]
 * }
 */

var PRONTIO_API_VERSION = '1.0.0-DEV';
var PRONTIO_ENV = 'DEV';

/**
 * Entrada principal para POST (usado pelo front).
 */
function doPost(e) {
  Logger.log('[PRONTIO][doPost] raw event: ' + JSON.stringify(e));

  try {
    var req = parseRequestBody_(e);
    var action = req.action;
    var payload = req.payload || {};

    if (!action) {
      throw {
        code: 'API_MISSING_ACTION',
        message: 'Campo "action" é obrigatório.'
      };
    }

    var data = routeAction_(action, payload);

    return buildSuccessResponse_(data);
  } catch (err) {
    Logger.log('[PRONTIO][doPost] error: ' + JSON.stringify(err));
    return buildErrorResponse_(err);
  }
}

/**
 * GET simples para teste/health-check.
 * Ex.: abrir a URL /exec no navegador.
 */
function doGet(e) {
  Logger.log('[PRONTIO][doGet] raw event: ' + JSON.stringify(e));

  var info = {
    name: 'PRONTIO API',
    version: PRONTIO_API_VERSION,
    env: PRONTIO_ENV,
    time: new Date()
  };

  return buildSuccessResponse_(info);
}

/**
 * Faz o parse do corpo da requisição.
 */
function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw {
      code: 'API_EMPTY_BODY',
      message: 'Corpo da requisição vazio.'
    };
  }

  var raw = e.postData.contents;
  var json;
  try {
    json = JSON.parse(raw);
  } catch (parseError) {
    throw {
      code: 'API_INVALID_JSON',
      message: 'JSON inválido no corpo da requisição.',
      details: String(parseError)
    };
  }

  return {
    action: json.action,
    payload: json.payload || {}
  };
}

/**
 * Roteia a action para o módulo correspondente.
 *
 * Convenção:
 *  - "Pacientes_..."  ou "Pacientes...."   -> handlePacientesAction
 *  - "Agenda_..."     ou "Agenda...."      -> handleAgendaAction
 *  - "AgendaConfig_..."                    -> handleAgendaConfigAction
 *  - "Evolucao_..."                        -> handleEvolucaoAction
 *  - "Receita_..."                         -> handleReceitaAction
 *  - "Laudos_..."                          -> handleLaudosAction
 *  - "DocsCabecalho_..."                   -> handleDocsCabecalhoAction
 *  - "Config_..."                          -> handleConfigAction
 *  - "Exames_..."                          -> handleExamesAction
 *  - "Medicamentos_..."                    -> handleMedicamentosAction
 *  - "Auth_..."                            -> handleAuthAction
 *  - "Usuarios_..."                        -> handleUsuariosAction
 */
function routeAction_(action, payload) {
  // Normaliza prefixo: pega texto antes de "_" ou "."
  var prefix = action;
  var idxUnd = action.indexOf('_');
  var idxDot = action.indexOf('.');

  var cut = -1;
  if (idxUnd >= 0 && idxDot >= 0) {
    cut = Math.min(idxUnd, idxDot);
  } else if (idxUnd >= 0) {
    cut = idxUnd;
  } else if (idxDot >= 0) {
    cut = idxDot;
  }

  if (cut >= 0) {
    prefix = action.substring(0, cut);
  }

  switch (prefix) {
    case 'Pacientes':
      if (typeof handlePacientesAction === 'function') {
        return handlePacientesAction(action, payload);
      }
      break;

    case 'Agenda':
      if (typeof handleAgendaAction === 'function') {
        return handleAgendaAction(action, payload);
      }
      break;

    case 'AgendaConfig':
      if (typeof handleAgendaConfigAction === 'function') {
        return handleAgendaConfigAction(action, payload);
      }
      break;

    case 'Evolucao':
      if (typeof handleEvolucaoAction === 'function') {
        return handleEvolucaoAction(action, payload);
      }
      break;

    case 'Receita':
      if (typeof handleReceitaAction === 'function') {
        return handleReceitaAction(action, payload);
      }
      break;

    case 'Laudos':
      if (typeof handleLaudosAction === 'function') {
        return handleLaudosAction(action, payload);
      }
      break;

    case 'DocsCabecalho':
      if (typeof handleDocsCabecalhoAction === 'function') {
        return handleDocsCabecalhoAction(action, payload);
      }
      break;

    case 'Config':
      if (typeof handleConfigAction === 'function') {
        return handleConfigAction(action, payload);
      }
      break;

    case 'Exames':
      if (typeof handleExamesAction === 'function') {
        return handleExamesAction(action, payload);
      }
      break;

    case 'Medicamentos':
      if (typeof handleMedicamentosAction === 'function') {
        return handleMedicamentosAction(action, payload);
      }
      break;

    case 'Auth':
      if (typeof handleAuthAction === 'function') {
        return handleAuthAction(action, payload);
      }
      break;

    case 'Usuarios':
      if (typeof handleUsuariosAction === 'function') {
        return handleUsuariosAction(action, payload);
      }
      break;
  }

  // Se chegou aqui, não achou handler
  throw {
    code: 'API_UNKNOWN_ACTION',
    message: 'Ação ou módulo desconhecido: ' + action
  };
}

/**
 * Monta resposta de sucesso (sempre HTTP 200, com success: true).
 */
function buildSuccessResponse_(data) {
  var payload = {
    success: true,
    data: typeof data === 'undefined' ? null : data,
    errors: []
  };

  var json = JSON.stringify(payload);

  // IMPORTANTE:
  // Apps Script não permite configurar manualmente headers de CORS
  // na ContentService. O CORS é resolvido pela configuração da
  // implantação (WebApp público) + uso de requisições simples
  // no front (text/plain, sem preflight).
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Monta resposta de erro (sempre HTTP 200, com success: false).
 */
function buildErrorResponse_(err) {
  var errorObj;

  if (err && typeof err === 'object') {
    errorObj = {
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message || 'Erro desconhecido na API.',
      details: err.details || null
    };
  } else {
    errorObj = {
      code: 'UNKNOWN_ERROR',
      message: String(err),
      details: null
    };
  }

  var payload = {
    success: false,
    data: null,
    errors: [errorObj]
  };

  var json = JSON.stringify(payload);

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
