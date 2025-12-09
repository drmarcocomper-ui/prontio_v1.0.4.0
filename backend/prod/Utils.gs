/**
 * Utils.gs
 * Funções utilitárias e padronizações gerais.
 */

/**
 * Cria resposta de sucesso padrão da API.
 * @param {any} data
 * @returns {Object}
 */
function prontioSuccess_(data) {
  return createApiResponse_(true, data, []);
}

/**
 * Cria resposta de erro padrão da API (mensagem simples).
 * @param {string} msg
 * @returns {Object}
 */
function prontioError_(msg) {
  return createApiResponse_(false, null, [msg]);
}

/**
 * Geração simples de ID com prefixo.
 * Formato: PREFIX_timestamp_random
 * @param {string} prefix
 * @returns {string}
 */
function generateId_(prefix) {
  var ts = new Date().getTime();
  var rand = Math.floor(Math.random() * 1000);
  return prefix + "_" + ts + "_" + rand;
}

/**
 * Soma minutos a uma hora "HH:MM" e retorna nova hora "HH:MM".
 *
 * Usada em Agenda.gs:
 *  - agendaCriar_
 *  - agendaAtualizar_
 *  - agendaBloquearHorario_
 *
 * @param {string} horaStr - Hora base ("14:00", "08:30", etc.)
 * @param {number} minutes - Minutos a somar (pode ser negativo)
 * @returns {string} nova hora "HH:MM"
 */
function addMinutesToTime_(horaStr, minutes) {
  if (!horaStr) {
    horaStr = "00:00";
  }

  minutes = Number(minutes) || 0;

  var parts = String(horaStr).split(":");
  var h = parseInt(parts[0], 10) || 0;
  var m = parseInt(parts[1], 10) || 0;

  var total = h * 60 + m + minutes;

  // evita valores negativos
  if (total < 0) {
    total = 0;
  }

  // mantém dentro de 0..1439 (24h)
  total = total % (24 * 60);

  var nh = Math.floor(total / 60);
  var nm = total % 60;

  var hh = ("0" + nh).slice(-2);
  var mm = ("0" + nm).slice(-2);

  return hh + ":" + mm;
}
