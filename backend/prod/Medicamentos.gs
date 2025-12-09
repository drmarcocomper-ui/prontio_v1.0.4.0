// Medicamentos.gs
// Módulo backend do PRONTIO para catálogo de medicamentos.
//
// Tabela esperada:
//
//  Planilha: (mesmo arquivo ou outro, ver abaixo)
//  Aba: "Medicamentos"
//
//  Colunas (linha 1 = cabeçalho):
//    A: Nome da Medicação
//    B: Posologia
//    C: Quantidade
//    D: Via de Administração
//
// O FRONT não conhece esses detalhes. Ele chama:
//   - Medicamentos.ListarTodos
//   - Medicamentos.BuscarPorTermo
//
// E recebe objetos no formato:
//   {
//      nomeMedicacao: string,
//      posologia: string,
//      quantidade: string,
//      viaAdministracao: string
//   }

// Se a tabela de medicamentos estiver em OUTRA planilha,
// coloque aqui o ID DA OUTRA PLANILHA.
// Se estiver na MESMA planilha do PRONTIO, deixe vazio "" para usar o active.
var MEDICAMENTOS_SPREADSHEET_ID = ""; // ex.: "1AbC...xyz"  (deixe "" para usar SpreadsheetApp.getActive())

var MEDICAMENTOS_SHEET_NAME = "Medicamentos";

/**
 * Roteador interno do módulo Medicamentos.
 * Ações:
 *  - Medicamentos.ListarTodos
 *  - Medicamentos.BuscarPorTermo
 */
function handleMedicamentosAction(action, payload) {
  if (action === "Medicamentos.ListarTodos") {
    return medicamentosListarTodos_();
  }

  if (action === "Medicamentos.BuscarPorTermo") {
    return medicamentosBuscarPorTermo_(payload);
  }

  return {
    success: false,
    data: null,
    errors: ["Ação não reconhecida em Medicamentos.gs: " + action],
  };
}

/**
 * Retorna a planilha de medicamentos, criando aba (com cabeçalho) se necessário.
 */
function getMedicamentosSheet_() {
  var ss;
  if (MEDICAMENTOS_SPREADSHEET_ID && MEDICAMENTOS_SPREADSHEET_ID.trim() !== "") {
    ss = SpreadsheetApp.openById(MEDICAMENTOS_SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActive();
  }

  var sheet = ss.getSheetByName(MEDICAMENTOS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MEDICAMENTOS_SHEET_NAME);
    var header = [
      "Nome da Medicação",
      "Posologia",
      "Quantidade",
      "Via de Administração",
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return sheet;
}

/**
 * Constrói objeto medicamento a partir de uma linha [Nome, Posologia, Quantidade, Via].
 */
function buildMedicamentoFromRow_(row) {
  return {
    nomeMedicacao: row[0] || "",
    posologia: row[1] || "",
    quantidade: row[2] || "",
    viaAdministracao: row[3] || "",
  };
}

/**
 * Lista TODOS os medicamentos cadastrados na aba "Medicamentos".
 */
function medicamentosListarTodos_() {
  var sheet = getMedicamentosSheet_();
  var range = sheet.getDataRange();
  var values = range.getValues();

  if (!values || values.length <= 1) {
    return {
      success: true,
      data: {
        medicamentos: [],
      },
      errors: [],
    };
  }

  var dados = values.slice(1);
  var lista = [];

  for (var i = 0; i < dados.length; i++) {
    var row = dados[i];

    // Ignora linhas totalmente em branco
    if (!row[0] && !row[1] && !row[2] && !row[3]) {
      continue;
    }

    var med = buildMedicamentoFromRow_(row);
    lista.push(med);
  }

  return {
    success: true,
    data: {
      medicamentos: lista,
    },
    errors: [],
  };
}

/**
 * Lista medicamentos filtrando por um termo simples (nome/posologia/via).
 * payload:
 *   { termo?: string }
 *
 * Se termo vier vazio ou ausente, retorna o mesmo que ListarTodos.
 */
function medicamentosBuscarPorTermo_(payload) {
  var termo =
    payload && payload.termo ? String(payload.termo).toLowerCase().trim() : "";

  // Se não tem termo, devolve tudo
  if (!termo) {
    return medicamentosListarTodos_();
  }

  var base = medicamentosListarTodos_();
  if (!base.success) {
    return base;
  }

  var todos = base.data && base.data.medicamentos ? base.data.medicamentos : [];
  var filtrados = [];

  for (var i = 0; i < todos.length; i++) {
    var m = todos[i];
    var comp =
      (m.nomeMedicacao || "") +
      " " +
      (m.posologia || "") +
      " " +
      (m.quantidade || "") +
      " " +
      (m.viaAdministracao || "");
    comp = comp.toLowerCase();

    if (comp.indexOf(termo) >= 0) {
      filtrados.push(m);
    }
  }

  return {
    success: true,
    data: {
      medicamentos: filtrados,
    },
    errors: [],
  };
}
