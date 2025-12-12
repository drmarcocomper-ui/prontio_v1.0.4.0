// Receita.gs (PRONTIO) — PADRONIZAÇÃO COMPLETA (AJUSTE 2: ENUM TipoReceita em UPPERCASE)
// Entidade: Receitas
// Itens (canônico em ItensJson): { idRemedio, nomeRemedio, posologia, quantidade, viaAdministracao, observacao, receituarioEspecial, ativo }

var RECEITA_SHEET_NAME = "Receitas";

function handleReceitaAction(action, payload) {
  payload = payload || {};
  var act = String(action || "");

  if (act === "Receita.SalvarRascunho") act = "Receita_SalvarRascunho";
  if (act === "Receita_SalvarRascunho") act = "Receita_SalvarRascunho";

  if (act === "Receita.SalvarFinal") act = "Receita_SalvarFinal";
  if (act === "Receita_SalvarFinal") act = "Receita_SalvarFinal";

  if (act === "Receita.Criar") act = "Receita_Criar";
  if (act === "Receita_Criar") act = "Receita_Criar";

  if (act === "Receita.GerarPDF" || act === "Receita.GerarPdf") act = "Receita_GerarPDF";
  if (act === "Receita_GerarPDF") act = "Receita_GerarPDF";

  if (act === "Receita.ListarPorPaciente") act = "Receita_ListarPorPaciente";
  if (act === "Receita_ListarPorPaciente") act = "Receita_ListarPorPaciente";

  switch (act) {
    case "Receita_SalvarRascunho":
      return receitaSalvar_(payload, "RASCUNHO");

    case "Receita_SalvarFinal":
      return receitaSalvar_(payload, "FINAL");

    case "Receita_Criar": {
      var status = String(payload.status || payload.Status || "").trim().toUpperCase();
      if (status !== "FINAL" && status !== "RASCUNHO") status = "FINAL";
      return receitaSalvar_(payload, status);
    }

    case "Receita_GerarPDF":
      return receitaGerarPdf_(payload);

    case "Receita_ListarPorPaciente":
      return receitaListarPorPaciente_(payload);

    default:
      throw {
        code: "RECEITA_UNKNOWN_ACTION",
        message: "Ação não reconhecida em Receita.gs: " + act,
        details: null
      };
  }
}

function getReceitaSheet_() {
  var ss = PRONTIO_getDb_();
  var sheet = ss.getSheetByName(RECEITA_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(RECEITA_SHEET_NAME);
    var header = [
      "ID_Receita",
      "ID_Paciente",
      "DataHoraCriacao",
      "DataReceita",
      "TextoMedicamentos",
      "Observacoes",
      "TipoReceita",
      "Status",
      "ItensJson"
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    return sheet;
  }

  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var expectedCols = [
    "ID_Receita",
    "ID_Paciente",
    "DataHoraCriacao",
    "DataReceita",
    "TextoMedicamentos",
    "Observacoes",
    "TipoReceita",
    "Status",
    "ItensJson"
  ];

  var existentes = {};
  for (var i = 0; i < headerRow.length; i++) {
    var nome = String(headerRow[i] || "").trim();
    if (nome) existentes[nome] = true;
  }

  var novos = [];
  expectedCols.forEach(function (nome) {
    if (!existentes[nome]) novos.push(nome);
  });

  if (novos.length) {
    sheet.getRange(1, headerRow.length + 1, 1, novos.length).setValues([novos]);
  }

  return sheet;
}

function getReceitaHeaderMap_() {
  var sheet = getReceitaSheet_();
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var map = {};
  headerRow.forEach(function (colName, index) {
    var nome = String(colName || "").trim();
    if (nome) map[nome] = index;
  });
  return map;
}

function buildReceitaFromRow_(row, headerMap) {
  function get(col) {
    var idx = headerMap[col];
    if (idx == null) return "";
    return row[idx];
  }

  var itensJson = String(get("ItensJson") || "").trim();
  var itens = [];
  if (itensJson) {
    try {
      var parsed = JSON.parse(itensJson);
      if (Array.isArray(parsed)) itens = parsed;
    } catch (e) {
      itens = [];
    }
  }

  var texto = String(get("TextoMedicamentos") || "");

  return {
    idReceita: String(get("ID_Receita") || ""),
    ID_Receita: String(get("ID_Receita") || ""),

    idPaciente: String(get("ID_Paciente") || ""),
    ID_Paciente: String(get("ID_Paciente") || ""),

    dataHoraCriacao: String(get("DataHoraCriacao") || ""),

    dataReceita: String(get("DataReceita") || ""),
    DataReceita: String(get("DataReceita") || ""),

    textoMedicamentos: texto,
    TextoMedicamentos: texto,

    observacoes: String(get("Observacoes") || ""),
    Observacoes: String(get("Observacoes") || ""),

    // agora vem como ENUM uppercase (COMUM/ESPECIAL)
    tipoReceita: String(get("TipoReceita") || ""),
    TipoReceita: String(get("TipoReceita") || ""),

    status: String(get("Status") || ""),
    Status: String(get("Status") || ""),

    itens: itens
  };
}

/**
 * Normaliza item recebido do front para o formato canônico PRONTIO (Remedios).
 * Aceita campos antigos (medicamento/Nome_Medicacao/etc) e novos (remedio/Nome_Remedio/etc).
 *
 * Saída canônica:
 * { idRemedio, nomeRemedio, posologia, quantidade, viaAdministracao, observacao, receituarioEspecial, ativo }
 */
function normalizarItemRemedio_(it) {
  if (!it) return null;

  function pickStr_(v) {
    if (v == null) return "";
    return String(v);
  }

  var nomeRemedio = "";
  if (it.nomeRemedio != null && it.nomeRemedio !== "") nomeRemedio = pickStr_(it.nomeRemedio);
  else if (it.Nome_Remedio != null && it.Nome_Remedio !== "") nomeRemedio = pickStr_(it.Nome_Remedio);
  else if (it.remedio != null && it.remedio !== "") nomeRemedio = pickStr_(it.remedio);
  else if (it.nomeMedicacao != null && it.nomeMedicacao !== "") nomeRemedio = pickStr_(it.nomeMedicacao);
  else if (it.Nome_Medicacao != null && it.Nome_Medicacao !== "") nomeRemedio = pickStr_(it.Nome_Medicacao);
  else if (it.nome != null && it.nome !== "") nomeRemedio = pickStr_(it.nome);
  else if (it.medicamento != null && it.medicamento !== "") nomeRemedio = pickStr_(it.medicamento);
  else if (it.NomeMedicamento != null && it.NomeMedicamento !== "") nomeRemedio = pickStr_(it.NomeMedicamento);
  else if (it.Medicamento != null && it.Medicamento !== "") nomeRemedio = pickStr_(it.Medicamento);

  var viaAdministracao = "";
  if (it.viaAdministracao != null && it.viaAdministracao !== "") viaAdministracao = pickStr_(it.viaAdministracao);
  else if (it.Via_Administracao != null && it.Via_Administracao !== "") viaAdministracao = pickStr_(it.Via_Administracao);
  else if (it.via != null && it.via !== "") viaAdministracao = pickStr_(it.via);
  else if (it.Via != null && it.Via !== "") viaAdministracao = pickStr_(it.Via);

  var posologia = it.posologia != null ? pickStr_(it.posologia) : (it.Posologia != null ? pickStr_(it.Posologia) : "");
  var quantidade = it.quantidade != null ? pickStr_(it.quantidade) : (it.Quantidade != null ? pickStr_(it.Quantidade) : "");
  var observacao = it.observacao != null ? pickStr_(it.observacao) : (it.Observacao != null ? pickStr_(it.Observacao) : "");

  var idRemedio = "";
  if (it.idRemedio != null && it.idRemedio !== "") idRemedio = pickStr_(it.idRemedio);
  else if (it.ID_Remedio != null && it.ID_Remedio !== "") idRemedio = pickStr_(it.ID_Remedio);
  else if (it.ID_REMEDIO != null && it.ID_REMEDIO !== "") idRemedio = pickStr_(it.ID_REMEDIO);
  else if (it.idMedicamento != null && it.idMedicamento !== "") idRemedio = pickStr_(it.idMedicamento);
  else if (it.ID_Medicamento != null && it.ID_Medicamento !== "") idRemedio = pickStr_(it.ID_Medicamento);
  else if (it.ID_MEDICAMENTO != null && it.ID_MEDICAMENTO !== "") idRemedio = pickStr_(it.ID_MEDICAMENTO);

  var receituarioEspecial =
    it.receituarioEspecial === true ||
    String(it.Tipo_Receita || it.tipoReceita || it.TipoReceita || "").trim().toUpperCase() === "ESPECIAL";

  var ativo = it.ativo !== false;

  return {
    idRemedio: String(idRemedio || "").trim(),
    nomeRemedio: String(nomeRemedio || "").trim(),
    posologia: String(posologia || "").trim(),
    quantidade: String(quantidade || "").trim(),
    viaAdministracao: String(viaAdministracao || "").trim(),
    observacao: String(observacao || "").trim(),
    receituarioEspecial: receituarioEspecial === true,
    ativo: ativo === true
  };
}

function montarTextoMedicamentos_(itensCanonicos) {
  if (!Array.isArray(itensCanonicos) || !itensCanonicos.length) return "";

  var linhas = itensCanonicos
    .filter(function (it) {
      return it && it.ativo && (it.nomeRemedio || it.posologia);
    })
    .map(function (it, index) {
      var nome = String(it.nomeRemedio || "").trim();
      var pos = String(it.posologia || "").trim();

      var extras = [];
      if (it.quantidade) extras.push("Qtde: " + String(it.quantidade).trim());
      if (it.viaAdministracao) extras.push("Via: " + String(it.viaAdministracao).trim());
      if (it.observacao) extras.push("Obs: " + String(it.observacao).trim());

      var linha = (index + 1) + ") " + nome;
      if (pos) linha += " — " + pos;
      if (extras.length) linha += " | " + extras.join(" | ");
      return linha;
    });

  return linhas.join("\n\n");
}

/**
 * Procura se um item é "Especial" na base de Remedios.
 * Preferência: aba "Remedios"
 * Fallback compat: "Medicamentos"
 */
function isRemedioEspecial_(idRemedio) {
  if (!idRemedio) return false;

  var ss = PRONTIO_getDb_();

  var sheet =
    ss.getSheetByName("Remedios") ||
    ss.getSheetByName("REMEDIOS") ||
    ss.getSheetByName("Medicamentos") ||
    ss.getSheetByName("MEDICAMENTOS");

  if (!sheet) return false;

  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return false;

  var header = values[0];
  var idxId = -1;
  var idxTipo = -1;

  for (var c = 0; c < header.length; c++) {
    var titulo = String(header[c] || "").trim().toUpperCase();

    if (titulo === "ID_REMEDIO" || titulo === "ID_REMEDIOS" || titulo === "ID_REMEDIO ") idxId = c;
    if (titulo === "ID_Remedio".toUpperCase()) idxId = c;
    if (titulo === "ID_MEDICAMENTO") idxId = c;

    if (titulo === "TIPO_RECEITA") idxTipo = c;
  }

  if (idxId < 0 || idxTipo < 0) return false;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var idRow = row[idxId];
    if (String(idRow) === String(idRemedio)) {
      var tipo = String(row[idxTipo] || "").trim().toUpperCase();
      return tipo === "ESPECIAL";
    }
  }

  return false;
}

/**
 * ✅ AJUSTE 2:
 * Retorna ENUM uppercase (COMUM | ESPECIAL)
 */
function detectarTipoReceitaAPartirDosItens_(itensCanonicos) {
  if (!Array.isArray(itensCanonicos) || !itensCanonicos.length) return "COMUM";

  for (var i = 0; i < itensCanonicos.length; i++) {
    var it = itensCanonicos[i];
    if (!it || !it.ativo) continue;

    if (it.receituarioEspecial === true) return "ESPECIAL";
    if (it.idRemedio && isRemedioEspecial_(it.idRemedio)) return "ESPECIAL";
  }

  return "COMUM";
}

function receitaSalvar_(payload, status) {
  payload = payload || {};
  status = status || "FINAL";

  var idPaciente = payload.idPaciente
    ? String(payload.idPaciente).trim()
    : (payload.ID_Paciente ? String(payload.ID_Paciente).trim() : "");

  var itensRaw = Array.isArray(payload.itens)
    ? payload.itens
    : (Array.isArray(payload.Itens) ? payload.Itens : []);

  var obs = payload.observacoes != null
    ? String(payload.observacoes).trim()
    : (payload.Observacoes != null ? String(payload.Observacoes).trim() : "");

  var dataReceitaStr = payload.dataReceita != null
    ? String(payload.dataReceita).trim()
    : (payload.DataReceita != null ? String(payload.DataReceita).trim() : "");

  if (!idPaciente) {
    throw { code: "RECEITA_MISSING_ID_PACIENTE", message: "idPaciente é obrigatório para salvar receita.", details: null };
  }

  if (!Array.isArray(itensRaw) || !itensRaw.length) {
    throw { code: "RECEITA_MISSING_ITENS", message: "É necessário informar ao menos um item de remédio.", details: null };
  }

  var itensCanonicos = itensRaw
    .map(normalizarItemRemedio_)
    .filter(function (it) {
      return it && it.ativo && (it.nomeRemedio || it.posologia);
    });

  if (!itensCanonicos.length) {
    throw { code: "RECEITA_MISSING_ITENS_ATIVOS", message: "Não há itens ativos na receita.", details: null };
  }

  var textoMedicamentos = montarTextoMedicamentos_(itensCanonicos);
  if (!textoMedicamentos) {
    throw { code: "RECEITA_EMPTY_TEXTO", message: "Texto de medicamentos vazio após processamento dos itens.", details: null };
  }

  // ✅ agora tipoReceita é ENUM uppercase
  var tipoReceita = detectarTipoReceitaAPartirDosItens_(itensCanonicos);

  var sheet = getReceitaSheet_();
  var headerMap = getReceitaHeaderMap_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  var idReceita = Utilities.getUuid();
  var dataHoraCriacao = new Date().toISOString();

  var linha = new Array(lastCol).fill("");

  function set(colName, value) {
    var idx = headerMap[colName];
    if (idx == null) return;
    linha[idx] = value;
  }

  set("ID_Receita", idReceita);
  set("ID_Paciente", idPaciente);
  set("DataHoraCriacao", dataHoraCriacao);
  set("DataReceita", dataReceitaStr || "");
  set("TextoMedicamentos", textoMedicamentos);
  set("Observacoes", obs);
  set("TipoReceita", tipoReceita); // COMUM | ESPECIAL
  set("Status", status);
  set("ItensJson", JSON.stringify(itensCanonicos));

  var nextRow = lastRow + 1;
  sheet.getRange(nextRow, 1, 1, lastCol).setValues([linha]);

  var receitaObj = buildReceitaFromRow_(linha, headerMap);

  return { receita: receitaObj };
}

function receitaListarPorPaciente_(payload) {
  payload = payload || {};
  var idPaciente = payload.idPaciente ? String(payload.idPaciente).trim() : (payload.ID_Paciente ? String(payload.ID_Paciente).trim() : "");

  if (!idPaciente) {
    throw { code: "RECEITA_MISSING_ID_PACIENTE", message: "idPaciente é obrigatório em Receita.ListarPorPaciente.", details: null };
  }

  var sheet = getReceitaSheet_();
  var headerMap = getReceitaHeaderMap_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { receitas: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var receitas = [];

  var idxIdPac = headerMap["ID_Paciente"];
  if (idxIdPac == null) return { receitas: [] };

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var idPacRow = row[idxIdPac];
    if (String(idPacRow) === String(idPaciente)) {
      receitas.push(buildReceitaFromRow_(row, headerMap));
    }
  }

  receitas.sort(function (a, b) {
    var da = Date.parse(a.dataHoraCriacao || "") || 0;
    var db = Date.parse(b.dataHoraCriacao || "") || 0;
    return db - da;
  });

  return { receitas: receitas };
}

function obterDadosPacientePorId_(idPaciente) {
  var resultado = { nomePaciente: "", cpfPaciente: "" };
  if (!idPaciente) return resultado;

  var ss = PRONTIO_getDb_();
  var sheet = ss.getSheetByName("Pacientes");
  if (!sheet) return resultado;

  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return resultado;

  var header = values[0];
  var idxId = 0;
  var idxNome = 1;
  var idxCpf = -1;

  for (var c = 0; c < header.length; c++) {
    var titulo = (header[c] || "").toString().trim().toLowerCase();
    if (titulo === "id_paciente" || titulo === "idpaciente") idxId = c;
    if (titulo === "nome" || titulo === "nomecompleto" || titulo === "nome completo") idxNome = c;
    if (titulo === "cpf") idxCpf = c;
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var idRow = row[idxId];
    if (String(idRow) === String(idPaciente)) {
      var nome = row[idxNome];
      var cpf = idxCpf >= 0 ? row[idxCpf] : "";
      resultado.nomePaciente = nome ? String(nome) : "";
      resultado.cpfPaciente = cpf ? String(cpf) : "";
      return resultado;
    }
  }

  return resultado;
}

function receitaGerarPdf_(payload) {
  payload = payload || {};
  var idReceita = payload.idReceita ? String(payload.idReceita).trim() : (payload.ID_Receita ? String(payload.ID_Receita).trim() : "");

  if (!idReceita) {
    throw { code: "RECEITA_MISSING_ID_RECEITA", message: "idReceita é obrigatório em Receita.GerarPDF.", details: null };
  }

  var sheet = getReceitaSheet_();
  var headerMap = getReceitaHeaderMap_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    throw { code: "RECEITA_SHEET_EMPTY", message: "Nenhuma receita encontrada na aba Receitas.", details: null };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var receitaRow = null;

  var idxIdRec = headerMap["ID_Receita"];
  if (idxIdRec == null) {
    throw { code: "RECEITA_COL_MISSING", message: "Coluna ID_Receita não encontrada na aba Receitas.", details: null };
  }

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var idRow = row[idxIdRec];
    if (String(idRow) === String(idReceita)) {
      receitaRow = row;
      break;
    }
  }

  if (!receitaRow) {
    throw { code: "RECEITA_NOT_FOUND", message: "Receita não encontrada para o ID informado.", details: null };
  }

  var rec = buildReceitaFromRow_(receitaRow, headerMap);

  var cabecalhoHtml = (typeof buildCabecalhoHtml_ === "function") ? buildCabecalhoHtml_() : "";
  var cab = (typeof getCabecalhoDocumento_ === "function") ? getCabecalhoDocumento_() : {};

  var dadosPac = obterDadosPacientePorId_(rec.idPaciente);
  var nomePaciente = dadosPac.nomePaciente;
  var cpfPaciente = dadosPac.cpfPaciente;

  var dataBR = "";
  var dataReceitaCampo = rec.dataReceita || rec.DataReceita || "";

  if (dataReceitaCampo) {
    var partes = String(dataReceitaCampo).split("-");
    if (partes.length === 3) {
      var anoR = partes[0];
      var mesR = partes[1];
      var diaR = partes[2];
      if (diaR && mesR && anoR) dataBR = diaR + "/" + mesR + "/" + anoR;
    }
  }

  if (!dataBR && rec.dataHoraCriacao) {
    var d = new Date(rec.dataHoraCriacao);
    if (!isNaN(d.getTime())) {
      var dia = ("0" + d.getDate()).slice(-2);
      var mes = ("0" + (d.getMonth() + 1)).slice(-2);
      var ano = d.getFullYear();
      dataBR = dia + "/" + mes + "/" + ano;
    }
  }

  if (!dataBR) {
    var hoje = new Date();
    var dd = ("0" + hoje.getDate()).slice(-2);
    var mm = ("0" + (hoje.getMonth() + 1)).slice(-2);
    var yy = hoje.getFullYear();
    dataBR = dd + "/" + mm + "/" + yy;
  }

  var textoMedicamentos = rec.textoMedicamentos || rec.TextoMedicamentos || "";
  var observacoes = rec.observacoes || rec.Observacoes || "";

  // ✅ agora tipoReceita é ENUM uppercase
  var tipoReceita = String(rec.tipoReceita || rec.TipoReceita || "").trim().toUpperCase();
  var especial = tipoReceita === "ESPECIAL";

  function buildSingleViaHtml_() {
    var html = "";
    html += cabecalhoHtml;
    html += '<div class="titulo-receita">RECEITA MÉDICA</div>';
    html += '<div class="bloco-info">';
    html += '<span class="rotulo">Data: </span>' + escapeHtml_(dataBR) + "<br>";
    if (nomePaciente) html += '<span class="rotulo">Paciente: </span>' + escapeHtml_(nomePaciente) + "<br>";
    if (cpfPaciente) html += '<span class="rotulo">CPF: </span>' + escapeHtml_(cpfPaciente) + "<br>";
    html += "</div>";
    html += '<div class="bloco-info">';
    html += '<div class="rotulo">Prescrição:</div>';
    html += '<div class="texto-prescricao">' + escapeHtml_(textoMedicamentos) + "</div>";
    html += "</div>";
    if (observacoes) {
      html += '<div class="bloco-info">';
      html += '<div class="rotulo">Observações:</div>';
      html += '<div class="texto-obs">' + escapeHtml_(observacoes) + "</div>";
      html += "</div>";
    }
    html += '<div class="rodape-assinatura">';
    html += '<div class="linha-assinatura"></div>';
    if (cab && cab.medicoNome) html += "<small>" + escapeHtml_(cab.medicoNome) + "</small>";
    if (cab && cab.medicoCRM) html += "<small>CRM: " + escapeHtml_(cab.medicoCRM) + "</small>";
    if (cab && cab.medicoEspecialidade) html += "<small>" + escapeHtml_(cab.medicoEspecialidade) + "</small>";
    html += "</div>";
    return html;
  }

  var html = "";
  html += "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">";
  html += "<title>Receita Médica</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;font-size:13px;margin:24px;color:#111}";
  html += ".titulo-receita{font-size:16px;font-weight:bold;text-align:center;margin-bottom:10px}";
  html += ".bloco-info{margin-bottom:10px}";
  html += ".rotulo{font-weight:bold}";
  html += ".texto-prescricao{white-space:pre-wrap;border:1px solid #ccc;padding:10px;border-radius:6px;min-height:120px}";
  html += ".texto-obs{white-space:pre-wrap;border:1px solid #ccc;padding:8px;border-radius:6px;min-height:60px;font-size:12px}";
  html += ".rodape-assinatura{margin-top:40px;text-align:center}";
  html += ".linha-assinatura{border-top:1px solid #000;width:260px;margin:0 auto 4px auto}";
  html += ".rodape-assinatura small{display:block;font-size:11px;color:#333}";
  html += ".separador-vias{margin:24px 0;border-top:1px dashed #666}";
  html += "@page{margin:18mm}";
  html += "</style></head><body>";

  if (!especial) {
    html += buildSingleViaHtml_();
  } else {
    html += buildSingleViaHtml_();
    html += '<div class="separador-vias"></div>';
    html += buildSingleViaHtml_();
  }

  html += "</body></html>";

  return { html: html };
}

function escapeHtml_(texto) {
  if (!texto && texto !== 0) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
