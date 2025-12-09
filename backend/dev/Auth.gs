/**
 * ============================================================
 * PRONTIO - Auth.gs
 * Módulo de autenticação
 *
 * Responsável por:
 * - handleAuthAction(action, payload)
 * - Auth_Login (exemplo simples)
 *
 * IMPORTANTE:
 * - Toda lógica real de autenticação deve ficar aqui
 * - NUNCA no front-end
 * ============================================================
 */

/**
 * Roteia ações que começam com "Auth_" ou "Auth."
 * @param {string} action
 * @param {Object} payload
 * @returns {Object} data - objeto a ser enviado em data pelo Api.gs
 */
function handleAuthAction(action, payload) {
  if (action === "Auth_Login") {
    return Auth_Login_(payload);
  }

  throw {
    code: "AUTH_UNKNOWN_ACTION",
    message: "Ação de autenticação desconhecida: " + action,
    details: { action: action }
  };
}

/**
 * Exemplo de implementação de login.
 * 
 * Este é um EXEMPLO simples:
 * - Usuário e senha fixos;
 * - Em produção, você deve:
 *   - Ler de uma planilha de usuários,
 *   - Ou de outro backend,
 *   - E NUNCA devolver a senha.
 *
 * @param {Object} payload
 * @param {string} payload.usuario
 * @param {string} payload.senha
 * @returns {Object} { token, user }
 */
function Auth_Login_(payload) {
  var usuario = (payload && payload.usuario || "").trim();
  var senha = (payload && payload.senha || "").trim();

  if (!usuario || !senha) {
    throw {
      code: "AUTH_MISSING_CREDENTIALS",
      message: "Usuário e senha são obrigatórios.",
      details: null
    };
  }

  // EXEMPLO: usuário fixo "admin" / senha "1234"
  // Troque isso por validação real com planilha / banco.
  var USUARIO_FIXO = "admin";
  var SENHA_FIXA = "1234";

  if (usuario !== USUARIO_FIXO || senha !== SENHA_FIXA) {
    throw {
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Usuário ou senha inválidos.",
      details: null
    };
  }

  // Aqui poderia gerar um token real (JWT, hash, etc.).
  // Para exemplo, vamos só devolver um string fixo.
  var token = "TOKEN_EXEMPLO_" + new Date().getTime();

  var user = {
    id: "U_ADMIN",
    nome: "Administrador",
    email: "admin@prontio.local",
    perfil: "admin",
    usuario: usuario
  };

  return {
    token: token,
    user: user
  };
}
