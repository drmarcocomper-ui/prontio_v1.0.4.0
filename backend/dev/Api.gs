/**
 * PRONTIO - API principal (Apps Script WebApp) - AMBIENTE DEV
 */

var PRONTIO_API_VERSION = '1.0.0-DEV';
var PRONTIO_ENV = 'DEV';

function doPost(e) {
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
    return buildErrorResponse_(err);
  }
}

function doGet(e) {
  var info = {
    name: 'PRONTIO API',
    version: PRONTIO_API_VERSION,
    env: PRONTIO_ENV,
    time: new Date()
  };

  return buildSuccessResponse_(info);
}

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

function routeAction_(action, payload) {
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

  var prefixLC = String(prefix || '').toLowerCase();

  switch (prefixLC) {
    case 'pacientes':
      if (typeof handlePacientesAction === 'function') {
        return handlePacientesAction(action, payload);
      }
      break;

    case 'agenda':
      if (typeof handleAgendaAction === 'function') {
        return handleAgendaAction(action, payload);
      }
      break;

    case 'agendaconfig':
      if (typeof handleAgendaConfigAction === 'function') {
        return handleAgendaConfigAction(action, payload);
      }
      break;

    case 'evolucao':
      if (typeof handleEvolucaoAction === 'function') {
        return handleEvolucaoAction(action, payload);
      }
      break;

    case 'receita':
      if (typeof handleReceitaAction === 'function') {
        return handleReceitaAction(action, payload);
      }
      break;

    case 'laudos':
      if (typeof handleLaudosAction === 'function') {
        return handleLaudosAction(action, payload);
      }
      break;

    case 'docscabecalho':
      if (typeof handleDocsCabecalhoAction === 'function') {
        return handleDocsCabecalhoAction(action, payload);
      }
      break;

    case 'config':
      if (typeof handleConfigAction === 'function') {
        return handleConfigAction(action, payload);
      }
      break;

    case 'exames':
      if (typeof handleExamesAction === 'function') {
        return handleExamesAction(action, payload);
      }
      break;

    case 'medicamentos':
      if (typeof handleMedicamentosAction === 'function') {
        return handleMedicamentosAction(action, payload);
      }
      break;

    // ✅ NOVO: alias canônico do PRONTIO (Remedios.*) roteia para o mesmo módulo
    case 'remedios':
      if (typeof handleMedicamentosAction === 'function') {
        return handleMedicamentosAction(action, payload);
      }
      break;

    case 'auth':
      if (typeof handleAuthAction === 'function') {
        return handleAuthAction(action, payload);
      }
      break;

    case 'usuarios':
      if (typeof handleUsuariosAction === 'function') {
        return handleUsuariosAction(action, payload);
      }
      break;

    case 'chat':
      if (typeof handleChatAction === 'function') {
        return handleChatAction(action, payload);
      }
      break;
  }

  throw {
    code: 'API_UNKNOWN_ACTION',
    message: 'Ação ou módulo desconhecido: ' + action
  };
}

function buildSuccessResponse_(data) {
  var payload = {
    success: true,
    data: typeof data === 'undefined' ? null : data,
    errors: []
  };

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

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

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
