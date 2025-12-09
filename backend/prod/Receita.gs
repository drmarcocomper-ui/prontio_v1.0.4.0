// Receita.gs
// Módulo de backend para receitas do PRONTIO
//
// Aba sugerida na planilha: "Receitas"
//
// COLUNAS (linha 1 = cabeçalho):
// A: ID_Receita        (string UUID)
// B: ID_Paciente       (string)
// C: DataHoraCriacao   (string ISO ex: 2025-11-27T10:22:00.000Z)
// D: TextoMedicamentos (string - prescrição completa)
// E: Observacoes       (string)
//
// Ações expostas na API:
//   - Receita.Criar
//   - Receita.ListarPorPaciente
//   - Receita.GerarPdf
//
// IMPORTANTE:
// - Cabeçalho (logo, nome do médico, CRM, etc.) vem de DocsCabecalho/AgendaConfig:
//     buildCabecalhoHtml_()   → HTML do cabeçalho
//     getCabecalhoDocumento_() → { medicoNome, medicoCRM, medicoEspecialidade, ... }
// - Nome e CPF do paciente vêm da aba "Pacientes" (obterDadosPacientePorId_).

var RECEITA_SHEET_NAME = "Receitas";

/**
 * Roteador interno do módulo Receita.
 */
function handleReceitaAction(action, payload) {
  if (action === "Receita.Criar") {
    return receitaCriar_(payload);
  }
  if (action === "Receita.ListarPorPaciente") {
    return receitaListarPorPaciente_(payload);
  }
  if (action === "Receita.GerarPdf") {
    return receitaGerarPdf_(payload);
  }

  return {
    success: false,
    data: null,
    errors: ["Ação não reconhecida em Receita.gs: " + action],
  };
}

/**
 * Retorna (e cria, se necessário) a aba de Receitas.
 */
function getReceitaSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(RECEITA_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(RECEITA_SHEET_NAME);
    var header = [
      "ID_Receita",
      "ID_Paciente",
      "DataHoraCriacao",
      "TextoMedicamentos",
      "Observacoes",
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return sheet;
}

/**
 * Constrói objeto Receita a partir de uma linha da planilha.
 * row: [ID_Receita, ID_Paciente, DataHoraCriacao, TextoMedicamentos, Observacoes]
 */
function buildReceitaFromRow_(row) {
  return {
    idReceita: row[0] || "",
    idPaciente: row[1] || "",
    dataHoraCriacao: row[2] || "",
    textoMedicamentos: row[3] || "",
    observacoes: row[4] || "",
  };
}

/**
 * Cria uma nova receita.
 * payload:
 * {
 *   idPaciente: string (obrigatório),
 *   textoMedicamentos: string (obrigatório),
 *   observacoes?: string
 * }
 */
function receitaCriar_(payload) {
  var sheet = getReceitaSheet_();

  var idPaciente = (payload && payload.idPaciente)
    ? String(payload.idPaciente).trim()
    : "";
  var textoMedicamentos = (payload && payload.textoMedicamentos)
    ? String(payload.textoMedicamentos).trim()
    : "";
  var observacoes = (payload && payload.observacoes)
    ? String(payload.observacoes).trim()
    : "";

  if (!idPaciente) {
    return {
      success: false,
      data: null,
      errors: ["idPaciente é obrigatório para Receita.Criar."],
    };
  }
  if (!textoMedicamentos) {
    return {
      success: false,
      data: null,
      errors: ["textoMedicamentos é obrigatório para Receita.Criar."],
    };
  }

  var idReceita = Utilities.getUuid();
  var dataHoraCriacao = new Date().toISOString();

  var linha = [
    idReceita,
    idPaciente,
    dataHoraCriacao,
    textoMedicamentos,
    observacoes,
  ];
  sheet.appendRow(linha);

  var recObj = buildReceitaFromRow_(linha);

  return {
    success: true,
    data: { receita: recObj },
    errors: [],
  };
}

/**
 * Lista receitas de um paciente.
 * payload:
 * {
 *   idPaciente: string (obrigatório)
 * }
 */
function receitaListarPorPaciente_(payload) {
  var idPaciente = (payload && payload.idPaciente)
    ? String(payload.idPaciente).trim()
    : "";

  if (!idPaciente) {
    return {
      success: false,
      data: null,
      errors: ["idPaciente é obrigatório para Receita.ListarPorPaciente."],
    };
  }

  var sheet = getReceitaSheet_();
  var values = sheet.getDataRange().getValues();

  if (!values || values.length <= 1) {
    return {
      success: true,
      data: { receitas: [] },
      errors: [],
    };
  }

  var dados = values.slice(1);
  var receitas = [];

  for (var i = 0; i < dados.length; i++) {
    var row = dados[i];
    var idPacRow = row[1];

    if (String(idPacRow) === idPaciente) {
      receitas.push(buildReceitaFromRow_(row));
    }
  }

  // Mais recentes primeiro
  receitas.sort(function (a, b) {
    var da = a.dataHoraCriacao || "";
    var db = b.dataHoraCriacao || "";
    if (da > db) return -1;
    if (da < db) return 1;
    return 0;
  });

  return {
    success: true,
    data: { receitas: receitas },
    errors: [],
  };
}

/**
 * Busca nome e CPF de um paciente na aba "Pacientes" a partir do ID.
 *
 * Estrutura esperada (flexível):
 * linha 1: cabeçalho contendo pelo menos:
 *   "ID_Paciente" (ou similar) em alguma coluna
 *   "Nome" / "NomeCompleto" em alguma coluna
 *   "CPF" em alguma coluna
 */
function obterDadosPacientePorId_(idPaciente) {
  var resultado = { nomePaciente: "", cpfPaciente: "" };

  if (!idPaciente) return resultado;

  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName("Pacientes");
  if (!sheet) return resultado;

  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return resultado;

  var header = values[0];

  var idxId = 0;
  var idxNome = 1;
  var idxCpf = -1;

  // tenta localizar dinamicamente
  for (var c = 0; c < header.length; c++) {
    var titulo = (header[c] || "").toString().trim().toLowerCase();
    if (titulo === "id_paciente" || titulo === "idpaciente") idxId = c;
    if (
      titulo === "nome" ||
      titulo === "nomecompleto" ||
      titulo === "nome completo"
    ) idxNome = c;
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

/**
 * Gera HTML da receita para impressão (PDF).
 *
 * payload: { idReceita }
 *
 * Retorno:
 * {
 *   success: true,
 *   data: { html: "<!DOCTYPE html>..." },
 *   errors: []
 * }
 */
function receitaGerarPdf_(payload) {
  var idReceita = (payload && payload.idReceita)
    ? String(payload.idReceita).trim()
    : "";

  if (!idReceita) {
    return {
      success: false,
      data: null,
      errors: ["idReceita é obrigatório para Receita.GerarPdf."],
    };
  }

  var sheet = getReceitaSheet_();
  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) {
    return {
      success: false,
      data: null,
      errors: ["Nenhuma receita encontrada na planilha."],
    };
  }

  var dados = values.slice(1);
  var receitaRow = null;

  for (var i = 0; i < dados.length; i++) {
    var row = dados[i];
    var idRow = row[0];
    if (String(idRow) === idReceita) {
      receitaRow = row;
      break;
    }
  }

  if (!receitaRow) {
    return {
      success: false,
      data: null,
      errors: ["Receita não encontrada para o ID informado."],
    };
  }

  var rec = buildReceitaFromRow_(receitaRow);

  // Cabeçalho padrão (DocsCabecalho/AgendaConfig)
  var cabecalhoHtml = buildCabecalhoHtml_(); // precisa existir em DocsCabecalho.gs
  var cab = getCabecalhoDocumento_();        // { medicoNome, medicoCRM, medicoEspecialidade, ... }

  // Dados do paciente
  var dadosPac = obterDadosPacientePorId_(rec.idPaciente);
  var nomePaciente = dadosPac.nomePaciente;
  var cpfPaciente = dadosPac.cpfPaciente;

  // Data em dd/MM/yyyy
  var dataBR = "";
  if (rec.dataHoraCriacao) {
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

  // HTML com cabeçalho + prescrição + observações + área de assinatura
  var html = "";
  html += "<!DOCTYPE html>";
  html += '<html lang="pt-BR">';
  html += "<head>";
  html += '<meta charset="UTF-8">';
  html += "<title>Receita Médica</title>";
  html += "<style>";
  html += "body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; color:#111; }";
  html += ".titulo-receita { font-size: 16px; font-weight: bold; text-align:center; margin-bottom: 10px; }";
  html += ".bloco-info { margin-bottom: 10px; }";
  html += ".rotulo { font-weight:bold; }";
  html += ".texto-prescricao { white-space: pre-wrap; border:1px solid #ccc; padding:10px; border-radius:6px; min-height:120px; }";
  html += ".texto-obs { white-space: pre-wrap; border:1px solid #ccc; padding:8px; border-radius:6px; min-height:60px; font-size:12px; }";
  html += ".rodape-assinatura { margin-top: 40px; text-align:center; }";
  html += ".linha-assinatura { border-top:1px solid #000; width:260px; margin:0 auto 4px auto; }";
  html += ".rodape-assinatura small { display:block; font-size:11px; color:#333; }";
  html += "@page { margin: 18mm; }";
  html += "</style>";
  html += "</head>";
  html += "<body>";

  // Cabeçalho médico/clínica
  html += cabecalhoHtml;

  // Título central
  html += '<div class="titulo-receita">RECEITA MÉDICA</div>';

  // Dados principais
  html += '<div class="bloco-info">';
  html += '<span class="rotulo">Data: </span>' + escapeHtml_(dataBR) + "<br>";
  if (nomePaciente) {
    html += '<span class="rotulo">Paciente: </span>' + escapeHtml_(nomePaciente) + "<br>";
  }
  if (cpfPaciente) {
    html += '<span class="rotulo">CPF: </span>' + escapeHtml_(cpfPaciente) + "<br>";
  }
  html += "</div>";

  // Prescrição
  html += '<div class="bloco-info">';
  html += '<div class="rotulo">Prescrição:</div>';
  html += '<div class="texto-prescricao">' + escapeHtml_(rec.textoMedicamentos || "") + "</div>";
  html += "</div>";

  // Observações
  if (rec.observacoes) {
    html += '<div class="bloco-info">';
    html += '<div class="rotulo">Observações:</div>';
    html += '<div class="texto-obs">' + escapeHtml_(rec.observacoes || "") + "</div>";
    html += "</div>";
  }

  // Área para assinatura / carimbo
  html += '<div class="rodape-assinatura">';
  html += '<div class="linha-assinatura"></div>';
  if (cab.medicoNome) {
    html += "<small>" + escapeHtml_(cab.medicoNome) + "</small>";
  }
  if (cab.medicoCRM) {
    html += "<small>CRM: " + escapeHtml_(cab.medicoCRM) + "</small>";
  }
  if (cab.medicoEspecialidade) {
    html += "<small>" + escapeHtml_(cab.medicoEspecialidade) + "</small>";
  }
  html += "</div>";

  html += "</body></html>";

  return {
    success: true,
    data: { html: html },
    errors: [],
  };
}

/**
 * Escapa HTML básico.
 */
function escapeHtml_(texto) {
  if (!texto && texto !== 0) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
