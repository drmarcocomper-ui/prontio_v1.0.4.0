// Evolucao.gs
// ---------------------------------------------------------------------------
// Módulo de backend para Evolução Clínica do PRONTIO.
// Corrigido, padronizado e SEM alterar nenhum comportamento existente.
// Usa createApiResponse_() (padrão oficial da API).
// ---------------------------------------------------------------------------

var EVOLUCAO_SHEET_NAME = "Evolucao";

/**
 * Roteador interno do módulo Evolução.
 */
function handleEvolucaoAction(action, payload) {
  try {

    if (action === "Evolucao.Criar") {
      return evolucaoSalvar_(payload, true);
    }

    if (action === "Evolucao.Salvar") {
      return evolucaoSalvar_(payload, false);
    }

    if (action === "Evolucao.Inativar") {
      return evolucaoInativar_(payload);
    }

    if (action === "Evolucao.ListarPorPaciente") {
      return evolucaoListarPorPaciente_(payload);
    }

    // ✅ NOVA AÇÃO: usada no resumo clínico do prontuário
    if (action === "Evolucao.ListarRecentesPorPaciente") {
      return evolucaoListarRecentesPorPaciente_(payload);
    }

    return createApiResponse_(false, null, [
      "Ação não reconhecida em Evolucao: " + action
    ]);

  } catch (e) {
    return createApiResponse_(false, null, [
      "Erro interno em Evolucao: " + e.toString()
    ]);
  }
}

/**
 * Cria a aba, se não existir.
 */
function getEvolucaoSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(EVOLUCAO_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(EVOLUCAO_SHEET_NAME);
    var header = [
      "ID_Evolucao",
      "ID_Paciente",
      "DataEvolucao",
      "TipoEvolucao",
      "Texto",
      "Profissional",
      "Ativo",
      "DataHoraRegistro"
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return sheet;
}

/**
 * Constrói objeto Evolução.
 */
function buildEvolucaoFromRow_(row) {
  var ativoCell = row[6];

  var ativo = true;
  if (
    ativoCell === false ||
    String(ativoCell).toUpperCase() === "FALSE" ||
    String(ativoCell).toUpperCase() === "N"
  ) {
    ativo = false;
  }

  return {
    idEvolucao: row[0] || "",
    idPaciente: row[1] || "",
    dataEvolucao: row[2] || "",     // Na sua aba atual é "DataHora", mas aqui encaramos como data/hora
    tipoEvolucao: row[3] || "",     // Na sua aba atual é "Tipo"
    texto: row[4] || "",
    profissional: row[5] || "",
    ativo: ativo,
    dataHoraRegistro: row[7] || ""
  };
}

/**
 * Data de hoje (yyyy-MM-dd)
 */
function hojeIsoData_() {
  var hoje = new Date();
  return hoje.getFullYear() +
    "-" + ("0" + (hoje.getMonth() + 1)).slice(-2) +
    "-" + ("0" + hoje.getDate()).slice(-2);
}

/**
 * Criar ou atualizar evolução.
 */
function evolucaoSalvar_(payload, compatCriar) {
  var sheet = getEvolucaoSheet_();

  var idPaciente    = payload?.idPaciente?.trim() || "";
  var texto         = payload?.texto?.trim() || "";
  var tipoEvolucao  = payload?.tipoEvolucao?.trim()
                   || payload?.tipo?.trim()
                   || "";
  var profissional  = payload?.profissional?.trim() || "";
  var idEvolucao    = payload?.idEvolucao?.trim() || "";
  var dataEvolucao  = payload?.dataEvolucao?.trim() || "";

  if (!idPaciente)
    return createApiResponse_(false, null, ["idPaciente é obrigatório."]);

  if (!texto)
    return createApiResponse_(false, null, ["texto é obrigatório."]);

  // Evolucao.Criar sempre cria nova evolução
  if (compatCriar) {
    idEvolucao = "";
    dataEvolucao = hojeIsoData_();
  }

  if (!dataEvolucao) {
    dataEvolucao = hojeIsoData_();
  }

  var dataHoraRegistro = new Date().toISOString();

  // ------------------------
  // NOVA EVOLUÇÃO
  // ------------------------
  if (!idEvolucao) {
    idEvolucao = Utilities.getUuid();

    var novaLinha = [
      idEvolucao,
      idPaciente,
      dataEvolucao,
      tipoEvolucao,
      texto,
      profissional,
      true,
      dataHoraRegistro
    ];

    sheet.appendRow(novaLinha);

    var evoObj = buildEvolucaoFromRow_(novaLinha);
    return createApiResponse_(true, { evolucao: evoObj }, []);
  }

  // ------------------------
  // ATUALIZAÇÃO
  // ------------------------
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return createApiResponse_(false, null, [
      "Nenhuma evolução encontrada para atualizar."
    ]);
  }

  var dados = values.slice(1);
  var linhaPlanilha = -1;

  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][0]) === idEvolucao) {
      linhaPlanilha = i + 2;
      break;
    }
  }

  if (linhaPlanilha === -1) {
    return createApiResponse_(false, null, [
      "Evolução não encontrada para o ID informado."
    ]);
  }

  // Atualiza colunas
  sheet.getRange(linhaPlanilha, 2).setValue(idPaciente);
  sheet.getRange(linhaPlanilha, 3).setValue(dataEvolucao);
  sheet.getRange(linhaPlanilha, 4).setValue(tipoEvolucao);
  sheet.getRange(linhaPlanilha, 5).setValue(texto);
  sheet.getRange(linhaPlanilha, 6).setValue(profissional);
  sheet.getRange(linhaPlanilha, 7).setValue(true);
  sheet.getRange(linhaPlanilha, 8).setValue(dataHoraRegistro);

  var rowAtualizada = sheet.getRange(linhaPlanilha, 1, 1, 8).getValues()[0];
  var evoObjAtual = buildEvolucaoFromRow_(rowAtualizada);

  return createApiResponse_(true, { evolucao: evoObjAtual }, []);
}

/**
 * Inativar evolução (soft delete)
 */
function evolucaoInativar_(payload) {
  var idEvolucao = payload?.idEvolucao?.trim() || "";

  if (!idEvolucao)
    return createApiResponse_(false, null, ["idEvolucao é obrigatório."]);

  var sheet = getEvolucaoSheet_();
  var values = sheet.getDataRange().getValues();

  if (values.length <= 1)
    return createApiResponse_(false, null, ["Nenhuma evolução cadastrada."]);

  var dados = values.slice(1);
  var linhaPlanilha = -1;

  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][0]) === idEvolucao) {
      linhaPlanilha = i + 2;
      break;
    }
  }

  if (linhaPlanilha === -1)
    return createApiResponse_(false, null, ["Evolução não encontrada."]);

  sheet.getRange(linhaPlanilha, 7).setValue(false);

  return createApiResponse_(true, {
    idEvolucao: idEvolucao,
    inativado: true
  }, []);
}

/**
 * Listar evoluções ativas de um paciente.
 */
function evolucaoListarPorPaciente_(payload) {
  var idPaciente = payload?.idPaciente?.trim() || "";

  if (!idPaciente)
    return createApiResponse_(false, null, ["idPaciente é obrigatório."]);

  var sheet = getEvolucaoSheet_();
  var values = sheet.getDataRange().getValues();

  if (values.length <= 1)
    return createApiResponse_(true, { evolucoes: [] }, []);

  var dados = values.slice(1);
  var evolucoes = [];

  for (var i = 0; i < dados.length; i++) {
    var evoObj = buildEvolucaoFromRow_(dados[i]);

    if (String(evoObj.idPaciente) === idPaciente && evoObj.ativo) {
      evolucoes.push(evoObj);
    }
  }

  // Ordenar por DataEvolucao + DataHoraRegistro (mais recentes primeiro)
  evolucoes.sort(function (a, b) {
    var keyA = (a.dataEvolucao || "") + (a.dataHoraRegistro || "");
    var keyB = (b.dataEvolucao || "") + (b.dataHoraRegistro || "");
    return keyA > keyB ? -1 : keyA < keyB ? 1 : 0;
  });

  return createApiResponse_(true, { evolucoes: evolucoes }, []);
}

/**
 * ✅ NOVA FUNÇÃO
 * Lista apenas as N últimas evoluções ativas de um paciente
 * reaproveitando a lógica de evolucaoListarPorPaciente_.
 *
 * payload:
 *   {
 *     idPaciente: "ID",
 *     limite: 5   // opcional, 5 por padrão
 *   }
 */
function evolucaoListarRecentesPorPaciente_(payload) {
  var limite = (payload && payload.limite) || 5;

  // Reaproveita a função existente
  var baseResp = evolucaoListarPorPaciente_(payload);
  if (!baseResp || !baseResp.success) {
    return baseResp;
  }

  var evolucoes = (baseResp.data && baseResp.data.evolucoes) || [];

  if (limite > 0 && evolucoes.length > limite) {
    evolucoes = evolucoes.slice(0, limite);
  }

  return createApiResponse_(true, { evolucoes: evolucoes }, []);
}
