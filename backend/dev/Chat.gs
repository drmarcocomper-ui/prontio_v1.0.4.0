/**
 * PRONTIO - Chat.gs (módulo de chat)
 *
 * OBJETIVO (Opção 1):
 * - Garantir uma conversa fixa "Secretaria" sempre disponível.
 * - Ela aparece no Chat_ListConversations independentemente do context/patientId.
 *
 * IMPORTANTE (padrão do seu Api.gs):
 * - Este módulo retorna APENAS "data" (objeto/array) em caso de sucesso.
 * - Em erro, deve dar throw { code, message, details } para o Api.gs embrulhar.
 *
 * Abas (somente backend conhece):
 * - CHAT_CONVERSAS
 * - CHAT_MENSAGENS
 * - CHAT_PARTICIPANTES
 */

function handleChatAction(action, payload) {
  var act = String(action || "");

  switch (act) {
    case "Chat_ListConversations":
    case "chat.listConversations":
      return Chat_ListConversations_(payload);

    case "Chat_GetMessages":
    case "chat.getMessages":
      return Chat_GetMessages_(payload);

    case "Chat_SendMessage":
    case "chat.sendMessage":
      return Chat_SendMessage_(payload);

    case "Chat_MarkAsRead":
    case "chat.markAsRead":
      return Chat_MarkAsRead_(payload);

    case "Chat_CreateGroupDraft":
    case "chat.createGroupDraft":
      return Chat_CreateGroupDraft_(payload);

    default:
      _chatThrow_("CHAT_UNKNOWN_ACTION", "Ação de chat não reconhecida: " + act, null);
  }
}

/**
 * Estrutura sugerida das abas (backend):
 *
 * CHAT_CONVERSAS:
 *  conversationId | title | context | patientId | createdAtISO | updatedAtISO
 *
 * CHAT_PARTICIPANTES:
 *  conversationId | userId | role | isActive | lastReadAtISO
 *
 * CHAT_MENSAGENS:
 *  messageId | conversationId | senderUserId | text | createdAtISO
 */

/**
 * Regra Opção 1:
 * - Conversa fixa "Secretaria" sempre existe.
 * - Ela deve aparecer sempre na lista, mesmo quando o front filtra por context/patientId.
 *
 * Implementação:
 * - A conversa fixa é armazenada com:
 *   title="Secretaria"
 *   context="GLOBAL"
 *   patientId=""
 */
function Chat_ListConversations_(payload) {
  try {
    var ss = SpreadsheetApp.getActive();
    var shC = _chatGetOrCreateSheet_(ss, "CHAT_CONVERSAS", ["conversationId","title","context","patientId","createdAtISO","updatedAtISO"]);
    var shM = _chatGetOrCreateSheet_(ss, "CHAT_MENSAGENS", ["messageId","conversationId","senderUserId","text","createdAtISO"]);
    _chatGetOrCreateSheet_(ss, "CHAT_PARTICIPANTES", ["conversationId","userId","role","isActive","lastReadAtISO"]);

    // 1) garante conversa fixa
    var secretariaConvId = _chatEnsureFixedConversation_(shC, "Secretaria", "GLOBAL", "");

    // 2) lê dados
    var context = String(payload && payload.context ? payload.context : "");
    var patientId = payload && payload.patientId ? String(payload.patientId) : "";

    var convRows = _chatReadData_(shC);
    var msgRows = _chatReadData_(shM);

    // 3) filtra conversas "normais" conforme o front pediu
    var convs = convRows.map(function (r) {
      return {
        conversationId: String(r.conversationId || ""),
        title: r.title,
        context: r.context,
        patientId: r.patientId,
        createdAtISO: r.createdAtISO,
        updatedAtISO: r.updatedAtISO
      };
    }).filter(function (c) {
      return Boolean(c.conversationId);
    });

    // aplica filtros do front
    if (context) convs = convs.filter(function (c) { return String(c.context || "") === context; });
    if (patientId) convs = convs.filter(function (c) { return String(c.patientId || "") === patientId; });

    // 4) adiciona "Secretaria" sempre (mesmo se não bater no filtro)
    var secretariaRow = convRows.find(function (r) { return String(r.conversationId) === String(secretariaConvId); });
    if (secretariaRow) {
      var existsInList = convs.some(function (c) { return String(c.conversationId) === String(secretariaConvId); });
      if (!existsInList) {
        convs.unshift({
          conversationId: String(secretariaRow.conversationId || ""),
          title: secretariaRow.title || "Secretaria",
          context: secretariaRow.context || "GLOBAL",
          patientId: secretariaRow.patientId || "",
          createdAtISO: secretariaRow.createdAtISO,
          updatedAtISO: secretariaRow.updatedAtISO
        });
      }
    }

    // last message por conversa
    var lastByConv = {};
    msgRows.forEach(function (m) {
      var cid = String(m.conversationId || "");
      if (!cid) return;
      var t = String(m.createdAtISO || "");
      if (!lastByConv[cid] || t > String(lastByConv[cid].createdAtISO || "")) {
        lastByConv[cid] = m;
      }
    });

    // unread placeholder (depende de auth + participantes)
    var unreadTotal = 0;

    var out = convs.map(function (c) {
      var last = lastByConv[c.conversationId];
      return {
        conversationId: c.conversationId,
        title: c.title || "Conversa",
        lastMessagePreview: last ? String(last.text || "").slice(0, 60) : "",
        lastMessageTimeLabel: last ? _chatFormatTimeLabel_(last.createdAtISO) : "",
        unreadCount: 0,
        isOnline: false
      };
    });

    // ordena por última atividade (última msg, senão updatedAt)
    out.sort(function (a, b) {
      // força Secretaria sempre no topo? (se quiser, comente o bloco abaixo)
      if (String(a.conversationId) === String(secretariaConvId)) return -1;
      if (String(b.conversationId) === String(secretariaConvId)) return 1;

      var ta = _chatGetConvLastTime_(a.conversationId, lastByConv, convRows);
      var tb = _chatGetConvLastTime_(b.conversationId, lastByConv, convRows);
      return tb.localeCompare(ta);
    });

    return {
      conversations: out,
      unreadTotal: unreadTotal
    };

  } catch (err) {
    _chatThrow_("CHAT_LIST_ERROR", "Falha ao listar conversas.", String(err && err.message ? err.message : err));
  }
}

function Chat_GetMessages_(payload) {
  try {
    var ss = SpreadsheetApp.getActive();
    var shC = _chatGetOrCreateSheet_(ss, "CHAT_CONVERSAS", ["conversationId","title","context","patientId","createdAtISO","updatedAtISO"]);
    var shM = _chatGetOrCreateSheet_(ss, "CHAT_MENSAGENS", ["messageId","conversationId","senderUserId","text","createdAtISO"]);

    var conversationId = String(payload && payload.conversationId ? payload.conversationId : "");
    var limit = Math.max(1, Math.min(200, Number(payload && payload.limit ? payload.limit : 50)));

    if (!conversationId) _chatThrow_("CHAT_MISSING_CONVERSATION_ID", "conversationId é obrigatório.", null);

    var convRows = _chatReadData_(shC);
    var msgRows = _chatReadData_(shM);

    var conv = convRows.find(function (r) { return String(r.conversationId) === conversationId; });
    if (!conv) _chatThrow_("CHAT_CONVERSATION_NOT_FOUND", "Conversa não encontrada.", { conversationId: conversationId });

    var msgs = msgRows
      .filter(function (m) { return String(m.conversationId) === conversationId; })
      .sort(function (a, b) { return String(a.createdAtISO).localeCompare(String(b.createdAtISO)); });

    var start = Math.max(0, msgs.length - limit);
    var sliced = msgs.slice(start);

    // isMine depende de auth/sessão (placeholder false)
    var outMsgs = sliced.map(function (m) {
      return {
        messageId: String(m.messageId || ""),
        conversationId: String(m.conversationId || ""),
        senderUserId: String(m.senderUserId || ""),
        text: String(m.text || ""),
        createdAtISO: m.createdAtISO,
        timeLabel: _chatFormatTimeLabel_(m.createdAtISO),
        isMine: false
      };
    });

    return {
      conversation: {
        conversationId: String(conv.conversationId || ""),
        title: conv.title || "Conversa"
      },
      messages: outMsgs
    };

  } catch (err) {
    _chatThrow_("CHAT_GET_MESSAGES_ERROR", "Falha ao carregar mensagens.", String(err && err.message ? err.message : err));
  }
}

function Chat_SendMessage_(payload) {
  try {
    var ss = SpreadsheetApp.getActive();
    var shC = _chatGetOrCreateSheet_(ss, "CHAT_CONVERSAS", ["conversationId","title","context","patientId","createdAtISO","updatedAtISO"]);
    var shM = _chatGetOrCreateSheet_(ss, "CHAT_MENSAGENS", ["messageId","conversationId","senderUserId","text","createdAtISO"]);

    var conversationId = String(payload && payload.conversationId ? payload.conversationId : "");
    var text = String(payload && payload.text ? payload.text : "").trim();

    if (!conversationId) _chatThrow_("CHAT_MISSING_CONVERSATION_ID", "conversationId é obrigatório.", null);
    if (!text) _chatThrow_("CHAT_MISSING_TEXT", "text é obrigatório.", null);

    var convRows = _chatReadData_(shC);
    var convIndex = convRows.findIndex(function (r) { return String(r.conversationId) === conversationId; });
    if (convIndex < 0) _chatThrow_("CHAT_CONVERSATION_NOT_FOUND", "Conversa não encontrada.", { conversationId: conversationId });

    var nowISO = new Date().toISOString();
    var messageId = Utilities.getUuid();

    // integrar com auth depois (backend)
    var senderUserId = "";

    shM.appendRow([messageId, conversationId, senderUserId, text, nowISO]);

    // updatedAtISO
    var rowNumber = convIndex + 2;
    shC.getRange(rowNumber, 6).setValue(nowISO);

    return { messageId: messageId, createdAtISO: nowISO };

  } catch (err) {
    _chatThrow_("CHAT_SEND_ERROR", "Falha ao enviar mensagem.", String(err && err.message ? err.message : err));
  }
}

function Chat_MarkAsRead_(payload) {
  try {
    var conversationId = String(payload && payload.conversationId ? payload.conversationId : "");
    if (!conversationId) _chatThrow_("CHAT_MISSING_CONVERSATION_ID", "conversationId é obrigatório.", null);

    // Placeholder (quando tiver auth, atualizar CHAT_PARTICIPANTES.lastReadAtISO)
    return { conversationId: conversationId };

  } catch (err) {
    _chatThrow_("CHAT_MARK_READ_ERROR", "Falha ao marcar como lida.", String(err && err.message ? err.message : err));
  }
}

function Chat_CreateGroupDraft_(payload) {
  try {
    var ss = SpreadsheetApp.getActive();
    var shC = _chatGetOrCreateSheet_(ss, "CHAT_CONVERSAS", ["conversationId","title","context","patientId","createdAtISO","updatedAtISO"]);

    var context = String(payload && payload.context ? payload.context : "");
    var patientId = String(payload && payload.patientId ? payload.patientId : "");
    var nowISO = new Date().toISOString();

    var conversationId = Utilities.getUuid();
    var title = "Nova conversa";

    shC.appendRow([conversationId, title, context, patientId, nowISO, nowISO]);

    return { conversationId: conversationId, title: title };

  } catch (err) {
    _chatThrow_("CHAT_CREATE_DRAFT_ERROR", "Falha ao criar conversa.", String(err && err.message ? err.message : err));
  }
}

/* =========================
   Helpers internos
========================= */

function _chatEnsureFixedConversation_(shC, title, context, patientId) {
  var rows = _chatReadData_(shC);

  var found = rows.find(function (r) {
    return String(r.title || "").trim() === String(title).trim()
      && String(r.context || "") === String(context || "")
      && String(r.patientId || "") === String(patientId || "");
  });

  if (found && found.conversationId) return String(found.conversationId);

  var nowISO = new Date().toISOString();
  var conversationId = Utilities.getUuid();

  shC.appendRow([conversationId, title, context, patientId, nowISO, nowISO]);

  return conversationId;
}

function _chatThrow_(code, message, details) {
  throw {
    code: String(code || "CHAT_ERROR"),
    message: String(message || "Erro no módulo de chat."),
    details: typeof details === "undefined" ? null : details
  };
}

function _chatGetOrCreateSheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
  } else {
    var firstRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
    var needsHeader = firstRow.join("") === "";
    if (needsHeader) sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

function _chatReadData_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function _chatFormatTimeLabel_(iso) {
  if (!iso) return "";
  try {
    var d = new Date(iso);
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  } catch (e) {
    return "";
  }
}

function _chatGetConvLastTime_(conversationId, lastByConv, convRows) {
  var last = lastByConv[String(conversationId)];
  if (last && last.createdAtISO) return String(last.createdAtISO);

  var conv = convRows.find(function (r) { return String(r.conversationId) === String(conversationId); });
  if (conv && conv.updatedAtISO) return String(conv.updatedAtISO);

  return "0000-00-00T00:00:00.000Z";
}
