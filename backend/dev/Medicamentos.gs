/**
 * PRONTIO - Módulo de Medicamentos
 *
 * Aba esperada: "Medicamentos"
 *
 * Sugestão de colunas (linha 1):
 *
 *  A: ID_Medicamento      (opcional, pode ser vazio se não quiser usar)
 *  B: Nome_Medicacao      (ex.: "Dipirona 500mg")
 *  C: Posologia           (ex.: "1 comprimido de 8/8h por 5 dias")
 *  D: Quantidade          (ex.: "10 comp."
 *  E: Via_Administracao   (ex.: "VO", "IM", "EV")
 *  F: Ativo               (opcional: TRUE/FALSE, "SIM"/"NÃO")
 *
 * Retorno esperado pelo front (page-receita.js):
 *
 *  {
 *    medicamentos: [
 *      {
 *        idMedicamento: "MED_001" ou "",
 *        nomeMedicacao: "...",
 *        posologia: "...",
 *        quantidade: "...",
 *        viaAdministracao: "...",
 *        ativo: true/false
 *      },
 *      ...
 *    ]
 *  }
 */

var MEDICAMENTOS_SHEET_NAME = "Medicamentos";

/**
 * Roteador interno de Medicamentos.
 *
 * Chamado a partir de Api.gs -> handleMedicamentosAction(action, payload)
 *
 * Convenção de actions:
 *  - "Medicamentos_ListarTodos"
 *  - "Medicamentos_BuscarPorTermo"
 */
function handleMedicamentosAction(action, payload) {
  payload = payload || {};

  switch (action) {
    case "Medicamentos_ListarTodos":
      return medicamentosListarTodos_();

    case "Medicamentos_BuscarPorTermo":
      return medicamentosBuscarPorTermo_(payload);

    default:
      throw {
        code: "MEDICAMENTOS_UNKNOWN_ACTION",
        message: "Ação de medicamentos desconhecida: " + action,
      };
  }
}

/**
 * Lê TODOS os registros da aba Medicamentos.
 *
 * Retorno:
 *  {
 *    medicamentos: [ { idMedicamento, nomeMedicacao, posologia, quantidade, viaAdministracao, ativo }, ... ]
 *  }
 */
function medicamentosListarTodos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MEDICAMENTOS_SHEET_NAME);

  if (!sheet) {
    // Se a aba ainda não existe, retorna lista vazia
    return {
      medicamentos: [],
    };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    // Só cabeçalho ou vazio
    return {
      medicamentos: [],
    };
  }

  // Lê cabeçalho
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var headerValues = headerRange.getValues()[0];

  // Função auxiliar para achar índice de coluna (1-based) por nome
  function findColIndex_(nomeColuna) {
    nomeColuna = String(nomeColuna || "").toUpperCase().trim();
    for (var i = 0; i < headerValues.length; i++) {
      var h = String(headerValues[i] || "").toUpperCase().trim();
      if (h === nomeColuna) {
        return i + 1; // 1-based
      }
    }
    return -1;
  }

  var colId = findColIndex_("ID_MEDICAMENTO");
  var colNome = findColIndex_("NOME_MEDICACAO");
  var colPosologia = findColIndex_("POSOLOGIA");
  var colQtd = findColIndex_("QUANTIDADE");
  var colVia = findColIndex_("VIA_ADMINISTRACAO");
  var colAtivo = findColIndex_("ATIVO");

  // Lê todas as linhas de dados
  var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  var dataValues = dataRange.getValues();

  var lista = [];

  for (var r = 0; r < dataValues.length; r++) {
    var row = dataValues[r];

    // Nome é obrigatório para considerar o registro
    var nomeMed = colNome > 0 ? String(row[colNome - 1] || "").trim() : "";
    if (!nomeMed) {
      continue;
    }

    var obj = {
      idMedicamento:
        colId > 0 ? String(row[colId - 1] || "").trim() : "",
      nomeMedicacao: nomeMed,
      posologia:
        colPosologia > 0 ? String(row[colPosologia - 1] || "").trim() : "",
      quantidade:
        colQtd > 0 ? String(row[colQtd - 1] || "").trim() : "",
      viaAdministracao:
        colVia > 0 ? String(row[colVia - 1] || "").trim() : "",
      ativo: true,
    };

    if (colAtivo > 0) {
      var valAtivo = row[colAtivo - 1];
      // aceita boolean, "SIM", "NÃO", "ATIVO", etc.
      if (typeof valAtivo === "boolean") {
        obj.ativo = valAtivo;
      } else {
        var sAtivo = String(valAtivo || "")
          .toUpperCase()
          .trim();
        if (!sAtivo || sAtivo === "SIM" || sAtivo === "S" || sAtivo === "ATIVO") {
          obj.ativo = true;
        } else if (sAtivo === "NÃO" || sAtivo === "NAO" || sAtivo === "N" || sAtivo === "INATIVO") {
          obj.ativo = false;
        }
      }
    }

    // Se quiser filtrar somente ativos, descomente:
    // if (!obj.ativo) continue;

    lista.push(obj);
  }

  return {
    medicamentos: lista,
  };
}

/**
 * Busca por termo na aba de Medicamentos.
 *
 * payload:
 *  {
 *    termo: "dipir",
 *    incluirInativos: false (opcional, default false)
 *  }
 *
 * Retorno:
 *  {
 *    medicamentos: [...]
 *  }
 */
function medicamentosBuscarPorTermo_(payload) {
  payload = payload || {};
  var termo = String(payload.termo || "").toLowerCase().trim();
  var incluirInativos = payload.incluirInativos === true;

  var base = medicamentosListarTodos_();
  var lista = base.medicamentos || [];

  if (!termo) {
    // se não tem termo, pode devolver tudo ou nada; aqui devolvemos tudo
    if (!incluirInativos) {
      lista = lista.filter(function (m) {
        return m.ativo;
      });
    }
    return {
      medicamentos: lista,
    };
  }

  var filtrados = lista.filter(function (m) {
    if (!incluirInativos && !m.ativo) return false;

    var comp =
      (m.nomeMedicacao || "") +
      " " +
      (m.posologia || "") +
      " " +
      (m.quantidade || "") +
      " " +
      (m.viaAdministracao || "");
    return comp.toLowerCase().indexOf(termo) !== -1;
  });

  return {
    medicamentos: filtrados,
  };
}
