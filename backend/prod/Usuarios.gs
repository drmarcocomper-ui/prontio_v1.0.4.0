/**
 * ============================================================
 * PRONTIO - Usuarios.gs
 * Módulo de usuários (multiusuário)
 *
 * Responsabilidades:
 * - handleUsuariosAction(action, payload)
 * - Usuarios_Listar
 * - Usuarios_Criar
 * - Usuarios_Atualizar
 *
 * Futuro:
 * - Usuarios_AlterarSenha
 * - Usuarios_Arquivar
 * ============================================================
 */

var USUARIOS_SHEET_NAME = "Usuarios";

/**
 * Roteia ações que começam com "Usuarios_"
 */
function handleUsuariosAction(action, payload) {
  switch (action) {
    case "Usuarios_Listar":
      return Usuarios_Listar_(payload);

    case "Usuarios_Criar":
      return Usuarios_Criar_(payload);

    case "Usuarios_Atualizar":
      return Usuarios_Atualizar_(payload);

    // futuros:
    // case "Usuarios_AlterarSenha":
    // case "Usuarios_Arquivar":

    default:
      throw {
        code: "USUARIOS_UNKNOWN_ACTION",
        message: "Ação de usuários desconhecida: " + action,
        details: { action: action }
      };
  }
}

/**
 * Obtém a planilha de usuários.
 */
function getUsuariosSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USUARIOS_SHEET_NAME);
  if (!sheet) {
    throw {
      code: "USUARIOS_SHEET_NOT_FOUND",
      message: 'Aba de usuários não encontrada: "' + USUARIOS_SHEET_NAME + '".',
      details: null
    };
  }
  return sheet;
}

/**
 * Gera um novo ID de usuário (USR_...)
 */
function gerarNovoUsuarioId_() {
  var sheet = getUsuariosSheet_();
  var lastRow = sheet.getLastRow();
  var proximoNumero = lastRow > 1 ? lastRow - 1 + 1 : 1; // ignora cabeçalho na linha 1
  return "USR_" + proximoNumero;
}

/**
 * Hash de senha (SHA-256 + Base64).
 * NÃO armazena senha em texto puro.
 */
function hashSenha_(senha) {
  if (!senha) return "";
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    senha
  );
  return Utilities.base64Encode(bytes);
}

/**
 * Lista todos os usuários (sem senha).
 */
function Usuarios_Listar_(payload) {
  var sheet = getUsuariosSheet_();
  var range = sheet.getDataRange();
  var values = range.getValues();

  if (values.length <= 1) {
    return [];
  }

  var header = values[0];
  var idxId = header.indexOf("ID_Usuario");
  var idxNome = header.indexOf("Nome");
  var idxLogin = header.indexOf("Login");
  var idxEmail = header.indexOf("Email");
  var idxPerfil = header.indexOf("Perfil");
  var idxAtivo = header.indexOf("Ativo");
  var idxCriadoEm = header.indexOf("CriadoEm");
  var idxAtualizadoEm = header.indexOf("AtualizadoEm");

  var lista = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[idxId]) continue;

    lista.push({
      id: row[idxId],
      nome: row[idxNome] || "",
      login: row[idxLogin] || "",
      email: row[idxEmail] || "",
      perfil: row[idxPerfil] || "",
      ativo: row[idxAtivo] === true || row[idxAtivo] === "TRUE",
      criadoEm: row[idxCriadoEm] || "",
      atualizadoEm: row[idxAtualizadoEm] || ""
    });
  }

  return lista;
}

/**
 * Cria um novo usuário.
 *
 * payload:
 * {
 *   nome: "Fulano",
 *   login: "fulano",
 *   email: "fulano@exemplo.com",
 *   perfil: "admin" | "secretaria" | ...,
 *   senha: "texto digitado no front"
 * }
 */
function Usuarios_Criar_(payload) {
  payload = payload || {};

  var nome = (payload.nome || "").trim();
  var login = (payload.login || "").trim();
  var email = (payload.email || "").trim();
  var perfil = (payload.perfil || "").trim() || "secretaria";
  var senha = payload.senha || "";

  if (!nome) {
    throw {
      code: "USUARIOS_NOME_OBRIGATORIO",
      message: "Nome do usuário é obrigatório.",
      details: null
    };
  }
  if (!login) {
    throw {
      code: "USUARIOS_LOGIN_OBRIGATORIO",
      message: "Login do usuário é obrigatório.",
      details: null
    };
  }
  if (!senha) {
    throw {
      code: "USUARIOS_SENHA_OBRIGATORIA",
      message: "Senha do usuário é obrigatória.",
      details: null
    };
  }

  var sheet = getUsuariosSheet_();
  var range = sheet.getDataRange();
  var values = range.getValues();
  var header = values[0];
  var idxId = header.indexOf("ID_Usuario");
  var idxNome = header.indexOf("Nome");
  var idxLogin = header.indexOf("Login");
  var idxEmail = header.indexOf("Email");
  var idxPerfil = header.indexOf("Perfil");
  var idxAtivo = header.indexOf("Ativo");
  var idxSenhaHash = header.indexOf("SenhaHash");
  var idxCriadoEm = header.indexOf("CriadoEm");
  var idxAtualizadoEm = header.indexOf("AtualizadoEm");

  // Verifica se login já existe
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (
      row[idxLogin] &&
      String(row[idxLogin]).trim().toLowerCase() === login.toLowerCase()
    ) {
      throw {
        code: "USUARIOS_LOGIN_DUPLICADO",
        message: "Já existe um usuário com este login.",
        details: { login: login }
      };
    }
  }

  var novoId = gerarNovoUsuarioId_();
  var agora = new Date();
  var senhaHash = hashSenha_(senha);

  var novaLinha = [];
  novaLinha[idxId] = novoId;
  novaLinha[idxNome] = nome;
  novaLinha[idxLogin] = login;
  novaLinha[idxEmail] = email;
  novaLinha[idxPerfil] = perfil;
  novaLinha[idxAtivo] = true;
  novaLinha[idxSenhaHash] = senhaHash;
  novaLinha[idxCriadoEm] = agora;
  novaLinha[idxAtualizadoEm] = agora;

  sheet.appendRow(novaLinha);

  return {
    id: novoId,
    nome: nome,
    login: login,
    email: email,
    perfil: perfil,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora
  };
}

/**
 * Atualiza dados básicos de um usuário existente.
 *
 * payload:
 * {
 *   id: "USR_1",
 *   nome: "...",
 *   login: "...",
 *   email: "...",
 *   perfil: "admin" | "secretaria" | ...,
 *   ativo: true/false
 * }
 */
function Usuarios_Atualizar_(payload) {
  payload = payload || {};

  var id = (payload.id || "").trim();
  var nome = (payload.nome || "").trim();
  var login = (payload.login || "").trim();
  var email = (payload.email || "").trim();
  var perfil = (payload.perfil || "").trim() || "secretaria";
  var ativo = !!payload.ativo;

  if (!id) {
    throw {
      code: "USUARIOS_ID_OBRIGATORIO",
      message: "ID do usuário é obrigatório para atualização.",
      details: null
    };
  }
  if (!nome) {
    throw {
      code: "USUARIOS_NOME_OBRIGATORIO",
      message: "Nome do usuário é obrigatório.",
      details: null
    };
  }
  if (!login) {
    throw {
      code: "USUARIOS_LOGIN_OBRIGATORIO",
      message: "Login do usuário é obrigatório.",
      details: null
    };
  }

  var sheet = getUsuariosSheet_();
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length <= 1) {
    throw {
      code: "USUARIOS_NAO_ENCONTRADO",
      message: "Usuário não encontrado para atualização.",
      details: { id: id }
    };
  }

  var header = values[0];
  var idxId = header.indexOf("ID_Usuario");
  var idxNome = header.indexOf("Nome");
  var idxLogin = header.indexOf("Login");
  var idxEmail = header.indexOf("Email");
  var idxPerfil = header.indexOf("Perfil");
  var idxAtivo = header.indexOf("Ativo");
  var idxAtualizadoEm = header.indexOf("AtualizadoEm");

  var linhaEncontrada = -1;

  // 1) Localiza a linha do usuário pelo ID
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row[idxId] && String(row[idxId]) === id) {
      linhaEncontrada = i + 1; // +1 porque getValues é 0-based, sheet é 1-based
      break;
    }
  }

  if (linhaEncontrada === -1) {
    throw {
      code: "USUARIOS_NAO_ENCONTRADO",
      message: "Usuário não encontrado para atualização.",
      details: { id: id }
    };
  }

  // 2) Garante que o login não esteja duplicado em outro usuário
  var loginLower = login.toLowerCase();
  for (var j = 1; j < values.length; j++) {
    var rowCheck = values[j];
    if (!rowCheck[idxId]) continue;

    var idCheck = String(rowCheck[idxId]);
    var loginCheck = (rowCheck[idxLogin] || "").toString().trim().toLowerCase();

    if (idCheck !== id && loginCheck === loginLower) {
      throw {
        code: "USUARIOS_LOGIN_DUPLICADO",
        message: "Já existe outro usuário com este login.",
        details: { login: login }
      };
    }
  }

  // 3) Atualiza as colunas na linha encontrada
  var agora = new Date();
  var rowValues = sheet.getRange(linhaEncontrada, 1, 1, sheet.getLastColumn()).getValues()[0];

  rowValues[idxNome] = nome;
  rowValues[idxLogin] = login;
  rowValues[idxEmail] = email;
  rowValues[idxPerfil] = perfil;
  rowValues[idxAtivo] = ativo;
  rowValues[idxAtualizadoEm] = agora;

  sheet.getRange(linhaEncontrada, 1, 1, rowValues.length).setValues([rowValues]);

  return {
    id: id,
    nome: nome,
    login: login,
    email: email,
    perfil: perfil,
    ativo: ativo,
    atualizadoEm: agora
  };
}
