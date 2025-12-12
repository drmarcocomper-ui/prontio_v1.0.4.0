/**
 * PRONTIO - Medicamentos.gs (Apps Script)
 *
 * PADRONIZAÇÃO PRONTIO:
 * - Mantém as actions legadas: Medicamentos.*
 * - Adiciona actions canônicas: Remedios.*
 * - Mantém retorno padronizado: { success, data, errors }
 *
 * Observação:
 * - NÃO é necessário renomear o arquivo .gs.
 * - O importante é o contrato de API (actions e formato de retorno).
 */

function handleMedicamentosAction(action, payload) {
  var act = String(action || "");

  // ✅ Alias canônico PRONTIO (Remedios.*) -> aponta para as mesmas implementações
  // Isso permite padronizar o front sem quebrar o legado.
  if (act.indexOf("Remedios.") === 0) act = act.replace("Remedios.", "Medicamentos.");
  if (act.indexOf("Remedios_") === 0) act = act.replace("Remedios_", "Medicamentos_");

  switch (act) {
    case "Medicamentos.Listar":
    case "Medicamentos_Listar":
      return Medicamentos_Listar_(payload);

    case "Medicamentos.ListarAtivos":
    case "Medicamentos_ListarAtivos":
      return Medicamentos_ListarAtivos_(payload);

    case "Medicamentos.ListarTodos":
    case "Medicamentos_ListarTodos":
      return Medicamentos_ListarTodos_(payload);

    case "Medicamentos.Criar":
    case "Medicamentos_Criar":
      return Medicamentos_Criar_(payload);

    case "Medicamentos.Atualizar":
    case "Medicamentos_Atualizar":
      return Medicamentos_Atualizar_(payload);

    case "Medicamentos.DefinirAtivo":
    case "Medicamentos_DefinirAtivo":
      return Medicamentos_DefinirAtivo_(payload);

    case "Medicamentos.DefinirFavorito":
    case "Medicamentos_DefinirFavorito":
      return Medicamentos_DefinirFavorito_(payload);

    default:
      return _medFail_("MEDICAMENTOS_UNKNOWN_ACTION", "Ação de medicamentos/remédios não reconhecida: " + act, { action: act });
  }
}

function Medicamentos_Listar_(payload) {
  payload = payload || {};
  var somenteAtivos = payload.somenteAtivos !== false;
  return somenteAtivos ? Medicamentos_ListarAtivos_(payload) : Medicamentos_ListarTodos_(payload);
}

function Medicamentos_ListarAtivos_(payload) {
  try {
    var sh = _medGetOrCreateMedicamentosSheet_();
    var rows = _medReadAll_(sh);

    var q = String(payload && (payload.q || payload.termo) ? (payload.q || payload.termo) : "").trim().toLowerCase();
    var limit = Number(payload && (payload.limit || payload.limite) ? (payload.limit || payload.limite) : 200);
    if (!isFinite(limit) || limit <= 0) limit = 200;
    if (limit > 500) limit = 500;

    var ativos = rows.filter(function (r) {
      return _medToBool_(r.Ativo, true) === true;
    });

    if (q) {
      ativos = ativos.filter(function (r) {
        var nome = String(r.Nome_Medicacao || "").toLowerCase();
        return nome.indexOf(q) >= 0;
      });
    }

    ativos.sort(function (a, b) {
      var fa = _medToBool_(a.Favorito, false) ? 1 : 0;
      var fb = _medToBool_(b.Favorito, false) ? 1 : 0;
      if (fa !== fb) return fb - fa;

      var na = String(a.Nome_Medicacao || "").toLowerCase();
      var nb = String(b.Nome_Medicacao || "").toLowerCase();
      return na.localeCompare(nb);
    });

    var total = ativos.length;
    var sliced = ativos.slice(0, limit);

    // ✅ PADRONIZAÇÃO: expõe "remedios" (canônico) e "medicamentos" (legado)
    // - O front novo usa data.remedios
    // - O front antigo usa data.medicamentos
    var listaCanonica = sliced.map(function (r) {
      var nome = String(r.Nome_Medicacao || "").trim();
      var apresentacao = String(r.Quantidade || "").trim();
      if (!apresentacao) apresentacao = String(r.Via_Administracao || "").trim();

      // item "canônico" (Remedios)
      return {
        ID_Remedio: String(r.ID_Medicamento || ""),
        idRemedio: String(r.ID_Medicamento || ""),
        Nome_Remedio: nome,
        nomeRemedio: nome,
        remedio: nome,

        // mantém também campos úteis
        Posologia: String(r.Posologia || ""),
        Via_Administracao: String(r.Via_Administracao || ""),
        Quantidade: String(r.Quantidade || ""),
        Tipo_Receita: String(r.Tipo_Receita || ""),

        apresentacao: apresentacao,
        favorito: _medToBool_(r.Favorito, false),
        ativo: _medToBool_(r.Ativo, true)
      };
    });

    // versão legado (Medicamentos) — mantida
    var listaLegado = listaCanonica.map(function (x) {
      return {
        ID_Medicamento: x.ID_Remedio,
        idMedicamento: x.idRemedio,
        Nome_Medicacao: x.Nome_Remedio,
        nome: x.nomeRemedio,
        nomeMedicamento: x.nomeRemedio,
        Posologia: x.Posologia,
        Via_Administracao: x.Via_Administracao,
        Quantidade: x.Quantidade,
        Tipo_Receita: x.Tipo_Receita,
        apresentacao: x.apresentacao,
        favorito: x.favorito,
        ativo: x.ativo
      };
    });

    return _medOk_({
      // ✅ CANÔNICO
      remedios: listaCanonica,
      total: total,
      retornados: listaCanonica.length,

      // ✅ LEGADO (não usar no front novo, mas não quebra o antigo)
      medicamentos: listaLegado
    });
  } catch (err) {
    return _medFail_(
      "MEDICAMENTOS_LISTAR_ATIVOS_ERROR",
      "Falha ao listar itens ativos.",
      String(err && err.message ? err.message : err)
    );
  }
}

function Medicamentos_ListarTodos_(payload) {
  try {
    var sh = _medGetOrCreateMedicamentosSheet_();
    var rows = _medReadAll_(sh);

    var q = String(payload && (payload.q || payload.termo) ? (payload.q || payload.termo) : "").trim().toLowerCase();
    var limit = Number(payload && (payload.limit || payload.limite) ? (payload.limit || payload.limite) : 300);
    if (!isFinite(limit) || limit <= 0) limit = 300;
    if (limit > 1000) limit = 1000;

    if (q) {
      rows = rows.filter(function (r) {
        var nome = String(r.Nome_Medicacao || "").toLowerCase();
        return nome.indexOf(q) >= 0;
      });
    }

    rows.sort(function (a, b) {
      var fa = _medToBool_(a.Favorito, false) ? 1 : 0;
      var fb = _medToBool_(b.Favorito, false) ? 1 : 0;
      if (fa !== fb) return fb - fa;

      var aa = _medToBool_(a.Ativo, true) ? 1 : 0;
      var ab = _medToBool_(b.Ativo, true) ? 1 : 0;
      if (aa !== ab) return ab - aa;

      var na = String(a.Nome_Medicacao || "").toLowerCase();
      var nb = String(b.Nome_Medicacao || "").toLowerCase();
      return na.localeCompare(nb);
    });

    var sliced = rows.slice(0, limit);

    var listaCanonica = sliced.map(function (r) {
      var nome = String(r.Nome_Medicacao || "").trim();
      var apresentacao = String(r.Quantidade || "").trim();
      if (!apresentacao) apresentacao = String(r.Via_Administracao || "").trim();

      return {
        ID_Remedio: String(r.ID_Medicamento || ""),
        idRemedio: String(r.ID_Medicamento || ""),
        Nome_Remedio: nome,
        nomeRemedio: nome,
        remedio: nome,
        Posologia: String(r.Posologia || ""),
        Via_Administracao: String(r.Via_Administracao || ""),
        Quantidade: String(r.Quantidade || ""),
        Tipo_Receita: String(r.Tipo_Receita || ""),
        apresentacao: apresentacao,
        favorito: _medToBool_(r.Favorito, false),
        ativo: _medToBool_(r.Ativo, true),
        CriadoEmISO: String(r.CriadoEmISO || ""),
        AtualizadoEmISO: String(r.AtualizadoEmISO || "")
      };
    });

    var listaLegado = listaCanonica.map(function (x) {
      return {
        ID_Medicamento: x.ID_Remedio,
        idMedicamento: x.idRemedio,
        Nome_Medicacao: x.Nome_Remedio,
        nome: x.nomeRemedio,
        nomeMedicamento: x.nomeRemedio,
        Posologia: x.Posologia,
        Via_Administracao: x.Via_Administracao,
        Quantidade: x.Quantidade,
        Tipo_Receita: x.Tipo_Receita,
        apresentacao: x.apresentacao,
        favorito: x.favorito,
        ativo: x.ativo,
        CriadoEmISO: x.CriadoEmISO,
        AtualizadoEmISO: x.AtualizadoEmISO
      };
    });

    return _medOk_({
      remedios: listaCanonica,
      total: rows.length,
      retornados: listaCanonica.length,
      medicamentos: listaLegado
    });
  } catch (err) {
    return _medFail_(
      "MEDICAMENTOS_LISTAR_TODOS_ERROR",
      "Falha ao listar todos os itens.",
      String(err && err.message ? err.message : err)
    );
  }
}

function Medicamentos_Criar_(payload) {
  try {
    var sh = _medGetOrCreateMedicamentosSheet_();

    // ✅ aceita nome via padrão antigo ou novo
    var nome = String(
      payload && (
        payload.Nome_Medicacao ||
        payload.Nome_Remedio ||
        payload.nomeRemedio ||
        payload.remedio ||
        ""
      )
    ).trim();

    if (!nome) return _medFail_("MEDICAMENTOS_NOME_OBRIGATORIO", "Nome do remédio é obrigatório.", null);

    var id = Utilities.getUuid();
    var nowISO = new Date().toISOString();

    var pos = String(payload && payload.Posologia ? payload.Posologia : "");
    var via = String(payload && payload.Via_Administracao ? payload.Via_Administracao : "");
    var qtd = String(payload && payload.Quantidade ? payload.Quantidade : "");
    var tipo = String(payload && payload.Tipo_Receita ? payload.Tipo_Receita : "");

    var fav = _medToBool_(payload && payload.Favorito, false);
    var ativo = _medToBool_(payload && payload.Ativo, true);

    sh.appendRow([id, nome, pos, via, qtd, tipo, fav, ativo, nowISO, nowISO]);

    return _medOk_({ ID_Remedio: id, ID_Medicamento: id });
  } catch (err) {
    return _medFail_(
      "MEDICAMENTOS_CRIAR_ERROR",
      "Falha ao criar item.",
      String(err && err.message ? err.message : err)
    );
  }
}

function Medicamentos_Atualizar_(payload) {
  try {
    var sh = _medGetOrCreateMedicamentosSheet_();

    var id = String(
      payload && (
        payload.ID_Medicamento ||
        payload.ID_Remedio ||
        payload.idMedicamento ||
        payload.idRemedio ||
        ""
      )
    ).trim();

    if (!id) return _medFail_("MEDICAMENTOS_ID_OBRIGATORIO", "ID é obrigatório.", null);

    var info = _medFindRowById_(sh, id);
    if (!info) return _medFail_("MEDICAMENTOS_NAO_ENCONTRADO", "Item não encontrado.", { id: id });

    var row = info.row;
    var nowISO = new Date().toISOString();

    // aceita update por campos antigos e novos
    if (payload.Nome_Medicacao != null || payload.Nome_Remedio != null || payload.nomeRemedio != null || payload.remedio != null) {
      var nome = String(payload.Nome_Medicacao || payload.Nome_Remedio || payload.nomeRemedio || payload.remedio || "").trim();
      sh.getRange(row, 2).setValue(nome);
    }

    if (payload.Posologia != null) sh.getRange(row, 3).setValue(String(payload.Posologia || ""));
    if (payload.Via_Administracao != null) sh.getRange(row, 4).setValue(String(payload.Via_Administracao || ""));
    if (payload.Quantidade != null) sh.getRange(row, 5).setValue(String(payload.Quantidade || ""));
    if (payload.Tipo_Receita != null) sh.getRange(row, 6).setValue(String(payload.Tipo_Receita || ""));

    sh.getRange(row, 10).setValue(nowISO);

    return _medOk_({ ID_Remedio: id, ID_Medicamento: id });
  } catch (err) {
    return _medFail_(
      "MEDICAMENTOS_ATUALIZAR_ERROR",
      "Falha ao atualizar item.",
      String(err && err.message ? err.message : err)
    );
  }
}

function Medicamentos_DefinirAtivo_(payload) {
  try {
    var sh = _medGetOrCreateMedicamentosSheet_();
    var id = String(payload && (payload.ID_Medicamento || payload.ID_Remedio || payload.idMedicamento || payload.idRemedio) ? (payload.ID_Medicamento || payload.ID_Remedio || payload.idMedicamento || payload.idRemedio) : "").trim();
    if (!id) return _medFail_("MEDICAMENTOS_ID_OBRIGATORIO", "ID é obrigatório.", null);

    var ativo = _medToBool_(payload && payload.Ativo, true);

    var info = _medFindRowById_(sh, id);
    if (!info) return _medFail_("MEDICAMENTOS_NAO_ENCONTRADO", "Item não encontrado.", { id: id });

    var row = info.row;
    var nowISO = new Date().toISOString();

    sh.getRange(row, 8).setValue(ativo);
    sh.getRange(row, 10).setValue(nowISO);

    return _medOk_({ ID_Remedio: id, ID_Medicamento: id, Ativo: ativo });
  } catch (err) {
    return _medFail_(
      "MEDICAMENTOS_DEFINIR_ATIVO_ERROR",
      "Falha ao definir ativo.",
      String(err && err.message ? err.message : err)
    );
  }
}

function Medicamentos_DefinirFavorito_(payload) {
  try {
    var sh = _medGetOrCreateMedicamentosSheet_();
    var id = String(payload && (payload.ID_Medicamento || payload.ID_Remedio || payload.idMedicamento || payload.idRemedio) ? (payload.ID_Medicamento || payload.ID_Remedio || payload.idMedicamento || payload.idRemedio) : "").trim();
    if (!id) return _medFail_("MEDICAMENTOS_ID_OBRIGATORIO", "ID é obrigatório.", null);

    var fav = _medToBool_(payload && payload.Favorito, false);

    var info = _medFindRowById_(sh, id);
    if (!info) return _medFail_("MEDICAMENTOS_NAO_ENCONTRADO", "Item não encontrado.", { id: id });

    var row = info.row;
    var nowISO = new Date().toISOString();

    sh.getRange(row, 7).setValue(fav);
    sh.getRange(row, 10).setValue(nowISO);

    return _medOk_({ ID_Remedio: id, ID_Medicamento: id, Favorito: fav });
  } catch (err) {
    return _medFail_(
      "MEDICAMENTOS_DEFINIR_FAVORITO_ERROR",
      "Falha ao definir favorito.",
      String(err && err.message ? err.message : err)
    );
  }
}

/**
 * ✅ Helpers retorno padronizado
 */
function _medOk_(data) {
  return { success: true, data: data, errors: [] };
}

function _medFail_(code, message, details) {
  return {
    success: false,
    data: null,
    errors: [{
      code: String(code || "MEDICAMENTOS_ERROR"),
      message: String(message || "Erro no módulo de medicamentos."),
      details: typeof details === "undefined" ? null : details
    }]
  };
}

/**
 * Mantidos (seu código original)
 */
