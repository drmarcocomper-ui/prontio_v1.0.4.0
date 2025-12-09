// assets/js/evolucao.js
// Tela de Evolução Clínica (ES Module)
// - Carrega paciente atual (state + localStorage fallback)
// - Lista evoluções do paciente
// - Permite cadastrar / editar evolução via API (Evolucao.Salvar)
// - Permite INATIVAR evolução (soft delete) via API (Evolucao.Inativar)
// - Permite filtrar evoluções no front e visualizar em modal
// - Permite usar uma evolução como base para nova
// Regra de negócio permanece no backend (Evolucao.gs).

import { callApi } from './core/api.js';
import { getPacienteAtual } from './core/state.js';
import { hojeISO, formatarDataBR } from './core/utils.js';
import { createPageMessages } from './ui/messages.js';
import {
  openModal as openModalUi,
  closeModal as closeModalUi,
  bindModalCloseButton,
  bindModalCloseOnBackdrop,
} from './ui/modals.js';

// ------------------------------
// Estado interno do módulo
// ------------------------------
let pacienteAtualId = null;
let pacienteAtualNome = null;
let evolucoesCache = []; // mantém lista em memória para edição/filtro
let evolucaoModalAtual = null; // evolução atualmente aberta no modal

// Mensagens da página Evolução
const msgs = createPageMessages('#mensagemEvolucao');

// Wrapper para manter a API antiga (setMensagemEvolucao)
function setMensagemEvolucao(texto, tipo = 'info') {
  if (!texto) {
    msgs.clear();
    return;
  }

  switch (tipo) {
    case 'erro':
      msgs.erro(texto);
      break;
    case 'sucesso':
      msgs.sucesso(texto);
      break;
    default:
      msgs.info(texto);
      break;
  }
}

// ------------------------------
// EXPORT: ponto de entrada da página
// Chamado pelo main.js (initEvolucaoPage)
// ------------------------------
export function initEvolucaoPage() {
  console.log('PRONTIO: initEvolucaoPage');
  inicializarTelaEvolucao();
}

// ------------------------------
// Inicialização da tela
// ------------------------------
async function inicializarTelaEvolucao() {
  // 1) Tenta obter paciente do state global
  const pacienteState = getPacienteAtual();
  if (pacienteState && pacienteState.id) {
    pacienteAtualId = pacienteState.id;
    pacienteAtualNome = pacienteState.nome || '';
  } else {
    // 2) Fallback para localStorage (compatibilidade com fluxos antigos)
    pacienteAtualId = localStorage.getItem('prontio_pacienteAtualId');
    pacienteAtualNome = localStorage.getItem('prontio_pacienteAtualNome');
  }

  const topbarSubtitle = document.getElementById('topbar-subtitle');
  const campoPacienteId = document.getElementById('pacienteId');
  const campoPacienteNome = document.getElementById('pacienteNome');

  if (!pacienteAtualId) {
    setMensagemEvolucao(
      'Nenhum paciente selecionado. Volte à lista de pacientes e selecione um.',
      'erro'
    );

    if (topbarSubtitle) {
      topbarSubtitle.textContent = 'Nenhum paciente selecionado.';
    }
    if (campoPacienteId) campoPacienteId.textContent = '';
    if (campoPacienteNome) campoPacienteNome.textContent = '';
    desabilitarFormulario(true);
    return;
  }

  // Mostrar paciente básico no topo
  if (topbarSubtitle) {
    topbarSubtitle.textContent = pacienteAtualNome
      ? `Paciente: ${pacienteAtualNome}`
      : `Paciente ID: ${pacienteAtualId}`;
  }
  if (campoPacienteId) campoPacienteId.textContent = pacienteAtualId;
  if (campoPacienteNome) campoPacienteNome.textContent = pacienteAtualNome || '';

  prepararFormulario();
  prepararModal();
  prepararFiltro();
  await carregarEvolucoes();
}

// Habilita/desabilita todos os campos do formulário
function desabilitarFormulario(desabilitar) {
  const form = document.getElementById('formEvolucao');
  if (!form) return;
  Array.from(form.elements).forEach((el) => {
    el.disabled = !!desabilitar;
  });
}

// ------------------------------
// Formulário
// ------------------------------
function prepararFormulario() {
  const form = document.getElementById('formEvolucao');
  const btnLimpar = document.getElementById('btnLimpar');
  const btnNovaEvolucao = document.getElementById('btnNovaEvolucao');
  const inputData = document.getElementById('dataEvolucao');

  if (inputData && !inputData.value) {
    inputData.value = hojeISO();
  }

  if (btnLimpar) {
    btnLimpar.addEventListener('click', (e) => {
      e.preventDefault();
      limparFormulario();
    });
  }

  if (btnNovaEvolucao) {
    btnNovaEvolucao.addEventListener('click', (e) => {
      e.preventDefault();
      limparFormulario();
      setMensagemEvolucao('Nova evolução em branco.', 'info');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await salvarEvolucao();
    });
  }
}

function limparFormulario() {
  const form = document.getElementById('formEvolucao');
  if (!form) return;

  form.reset();
  const hiddenId = document.getElementById('idEvolucao');
  if (hiddenId) hiddenId.value = '';

  const inputData = document.getElementById('dataEvolucao');
  if (inputData) {
    inputData.value = hojeISO();
  }
}

// ------------------------------
// Filtro local de evoluções
// ------------------------------
function prepararFiltro() {
  const filtro = document.getElementById('filtroTexto');
  if (!filtro) return;

  filtro.addEventListener('input', () => {
    aplicarFiltroEvolucoes();
  });
}

function aplicarFiltroEvolucoes() {
  const filtro = document.getElementById('filtroTexto');
  if (!filtro) {
    renderizarTabelaEvolucoes(evolucoesCache);
    return;
  }
  const termo = filtro.value.trim().toLowerCase();
  if (!termo) {
    renderizarTabelaEvolucoes(evolucoesCache);
    return;
  }

  const filtradas = evolucoesCache.filter((ev) => {
    const texto = (ev.texto || ev.resumo || '').toLowerCase();
    const tipo = (ev.tipoEvolucao || ev.tipo || '').toLowerCase();
    const prof = (ev.profissional || '').toLowerCase();
    return (
      texto.includes(termo) || tipo.includes(termo) || prof.includes(termo)
    );
  });

  renderizarTabelaEvolucoes(filtradas);
}

// ------------------------------
// Modal de visualização detalhada
// ------------------------------
function prepararModal() {
  // Usa helpers genéricos de modal
  bindModalCloseButton('#modalEvolucao', '#btnFecharModalEvolucao');
  bindModalCloseOnBackdrop('#modalEvolucao');

  const btnUsarBase = document.getElementById('btnUsarComoBase');
  if (btnUsarBase) {
    btnUsarBase.addEventListener('click', () => {
      usarComoBaseNovaEvolucao();
    });
  }
}

function abrirModalEvolucao(idEvolucao) {
  if (!idEvolucao) return;

  const modal = document.getElementById('modalEvolucao');
  if (!modal) return;

  const ev = evolucoesCache.find(
    (x) => String(x.idEvolucao || x.id) === String(idEvolucao)
  );
  if (!ev) {
    setMensagemEvolucao('Evolução não encontrada para visualização.', 'erro');
    return;
  }

  evolucaoModalAtual = ev;

  const spanData = document.getElementById('modalDataEvolucao');
  const spanTipo = document.getElementById('modalTipoEvolucao');
  const spanProf = document.getElementById('modalProfissional');
  const preTexto = document.getElementById('modalTextoEvolucao');

  if (spanData) {
    spanData.textContent = formatarDataParaBR(
      ev.dataEvolucao || ev.data || ''
    );
  }
  if (spanTipo) {
    spanTipo.textContent = ev.tipoEvolucao || ev.tipo || '';
  }
  if (spanProf) {
    spanProf.textContent = ev.profissional || '';
  }
  if (preTexto) {
    preTexto.textContent = ev.texto || ev.resumo || '';
  }

  openModalUi('#modalEvolucao');
}

function fecharModalEvolucao() {
  closeModalUi('#modalEvolucao');
  evolucaoModalAtual = null;
}

function usarComoBaseNovaEvolucao() {
  if (!evolucaoModalAtual) {
    fecharModalEvolucao();
    return;
  }

  const hiddenId = document.getElementById('idEvolucao');
  const inputData = document.getElementById('dataEvolucao');
  const inputTipo = document.getElementById('tipoEvolucao');
  const inputProf = document.getElementById('profissional');
  const textareaTexto = document.getElementById('textoEvolucao');

  // Nova evolução: sem ID (para inserir nova linha)
  if (hiddenId) hiddenId.value = '';

  if (inputData) {
    inputData.value = hojeISO(); // data de hoje para a nova evolução
  }
  if (inputTipo) {
    inputTipo.value =
      evolucaoModalAtual.tipoEvolucao || evolucaoModalAtual.tipo || '';
  }
  if (inputProf) {
    inputProf.value = evolucaoModalAtual.profissional || '';
  }
  if (textareaTexto) {
    textareaTexto.value =
      evolucaoModalAtual.texto || evolucaoModalAtual.resumo || '';
  }

  setMensagemEvolucao(
    'Evolução carregada como base. Ajuste o texto e salve como nova.',
    'info'
  );
  fecharModalEvolucao();
}

// ------------------------------
// Listagem de evoluções
// ------------------------------
async function carregarEvolucoes() {
  const msgLista = document.getElementById('mensagemLista');

  if (!pacienteAtualId) return;

  if (msgLista) {
    msgLista.textContent = 'Carregando evoluções...';
  }

  const resposta = await callApi({
    action: 'Evolucao.ListarPorPaciente',
    payload: { idPaciente: pacienteAtualId },
  });

  if (!resposta || !resposta.success) {
    const erroTexto =
      (resposta && (resposta.errors || []).join(' | ')) ||
      'Erro ao carregar evoluções.';
    if (msgLista) msgLista.textContent = erroTexto;
    console.error('Erro ao carregar evoluções:', resposta);
    return;
  }

  evolucoesCache =
    resposta.data && Array.isArray(resposta.data.evolucoes)
      ? resposta.data.evolucoes
      : [];

  if (!evolucoesCache.length) {
    renderizarTabelaEvolucoes([]);
    return;
  }

  renderizarTabelaEvolucoes(evolucoesCache);
}

function renderizarTabelaEvolucoes(lista) {
  const corpoTabela = document.getElementById('tabelaEvolucoesBody');
  const msgLista = document.getElementById('mensagemLista');
  const filtro = document.getElementById('filtroTexto');
  const termo = filtro ? filtro.value.trim().toLowerCase() : '';

  if (corpoTabela) {
    corpoTabela.innerHTML = '';
  }

  if (!lista || !lista.length) {
    if (msgLista) {
      if (!evolucoesCache.length) {
        msgLista.textContent =
          'Nenhuma evolução registrada para este paciente.';
      } else if (termo) {
        msgLista.textContent =
          'Nenhuma evolução encontrada para o filtro aplicado.';
      } else {
        msgLista.textContent = 'Nenhuma evolução para exibir.';
      }
    }
    return;
  }

  if (msgLista) {
    if (termo) {
      msgLista.textContent = `Exibindo ${lista.length} de ${evolucoesCache.length} evoluções (filtradas).`;
    } else {
      msgLista.textContent = `Total de evoluções: ${lista.length}`;
    }
  }

  if (!corpoTabela) return;

  lista.forEach((ev) => {
    const tr = document.createElement('tr');

    const tdData = document.createElement('td');
    tdData.textContent = formatarDataBR(ev.dataEvolucao || ev.data || '');
    tr.appendChild(tdData);

    const tdTipo = document.createElement('td');
    tdTipo.textContent = ev.tipoEvolucao || ev.tipo || '';
    tr.appendChild(tdTipo);

    const tdProf = document.createElement('td');
    tdProf.textContent = ev.profissional || '';
    tr.appendChild(tdProf);

    const tdTexto = document.createElement('td');
    tdTexto.className = 'texto-resumo';
    const texto = ev.texto || ev.resumo || '';
    tdTexto.textContent = texto;
    tr.appendChild(tdTexto);

    const tdAcoes = document.createElement('td');

    // Botão VER (modal)
    const btnVer = document.createElement('button');
    btnVer.textContent = 'Ver';
    btnVer.className = 'btn secundario';
    btnVer.type = 'button';
    btnVer.style.marginRight = '4px';
    btnVer.addEventListener('click', () => {
      abrirModalEvolucao(ev.idEvolucao || ev.id);
    });
    tdAcoes.appendChild(btnVer);

    // Botão EDITAR
    const btnEditar = document.createElement('button');
    btnEditar.textContent = 'Editar';
    btnEditar.className = 'btn secundario';
    btnEditar.type = 'button';
    btnEditar.style.marginRight = '4px';
    btnEditar.addEventListener('click', () => {
      carregarEvolucaoParaEdicao(ev.idEvolucao || ev.id);
    });
    tdAcoes.appendChild(btnEditar);

    // Botão INATIVAR (soft delete)
    const btnInativar = document.createElement('button');
    btnInativar.textContent = 'Inativar';
    btnInativar.className = 'btn perigo';
    btnInativar.type = 'button';
    btnInativar.addEventListener('click', () => {
      confirmarInativarEvolucao(ev.idEvolucao || ev.id, ev);
    });
    tdAcoes.appendChild(btnInativar);

    tr.appendChild(tdAcoes);

    corpoTabela.appendChild(tr);
  });
}

function carregarEvolucaoParaEdicao(idEvolucao) {
  if (!idEvolucao) return;

  const ev = evolucoesCache.find(
    (x) => String(x.idEvolucao || x.id) === String(idEvolucao)
  );
  if (!ev) {
    setMensagemEvolucao('Evolução não encontrada na lista.', 'erro');
    return;
  }

  const hiddenId = document.getElementById('idEvolucao');
  const inputData = document.getElementById('dataEvolucao');
  const inputTipo = document.getElementById('tipoEvolucao');
  const inputProf = document.getElementById('profissional');
  const textareaTexto = document.getElementById('textoEvolucao');

  if (hiddenId) hiddenId.value = ev.idEvolucao || ev.id || '';
  if (inputData)
    inputData.value = normalizarDataParaInput(
      ev.dataEvolucao || ev.data || ''
    );
  if (inputTipo) inputTipo.value = ev.tipoEvolucao || ev.tipo || '';
  if (inputProf) inputProf.value = ev.profissional || '';
  if (textareaTexto) textareaTexto.value = ev.texto || ev.resumo || '';

  setMensagemEvolucao('Edição de evolução carregada.', 'info');
}

// ------------------------------
// Inativar evolução (soft delete)
// ------------------------------
function confirmarInativarEvolucao(idEvolucao, evRef) {
  if (!idEvolucao) return;

  const data = formatarDataBR(evRef.dataEvolucao || evRef.data || '');
  const tipo = evRef.tipoEvolucao || evRef.tipo || '';
  const resumo = (evRef.texto || evRef.resumo || '').slice(0, 80);

  const mensagem =
    'Você confirma inativar esta evolução?\n\n' +
    (data ? 'Data: ' + data + '\n' : '') +
    (tipo ? 'Tipo: ' + tipo + '\n' : '') +
    (resumo ? 'Resumo: ' + resumo + '\n' : '') +
    '\nEla não será apagada da base, apenas marcada como inativa.';

  const ok = window.confirm(mensagem);
  if (!ok) return;

  inativarEvolucao(idEvolucao);
}

async function inativarEvolucao(idEvolucao) {
  setMensagemEvolucao('Inativando evolução...', 'info');

  const resposta = await callApi({
    action: 'Evolucao.Inativar',
    payload: { idEvolucao },
  });

  if (!resposta || !resposta.success) {
    const erroTexto =
      (resposta && (resposta.errors || []).join(' | ')) ||
      'Erro ao inativar evolução.';
    setMensagemEvolucao(erroTexto, 'erro');
    console.error('Erro ao inativar evolução:', resposta);
    return;
  }

  setMensagemEvolucao('Evolução inativada com sucesso.', 'sucesso');
  await carregarEvolucoes();
}

// ------------------------------
// Salvar evolução
// ------------------------------
async function salvarEvolucao() {
  if (!pacienteAtualId) {
    setMensagemEvolucao(
      'Nenhum paciente selecionado. Não é possível salvar evolução.',
      'erro'
    );
    return;
  }

  const hiddenId = document.getElementById('idEvolucao');
  const inputData = document.getElementById('dataEvolucao');
  const inputTipo = document.getElementById('tipoEvolucao');
  const inputProf = document.getElementById('profissional');
  const textareaTexto = document.getElementById('textoEvolucao');

  const idEvolucao = hiddenId ? hiddenId.value.trim() : '';
  const dataEvolucao = inputData ? inputData.value : '';
  const tipoEvolucao = inputTipo ? inputTipo.value.trim() : '';
  const profissional = inputProf ? inputProf.value.trim() : '';
  const texto = textareaTexto ? textareaTexto.value.trim() : '';

  if (!dataEvolucao) {
    setMensagemEvolucao('Informe a data da evolução.', 'erro');
    return;
  }
  if (!texto) {
    setMensagemEvolucao('Informe o texto da evolução.', 'erro');
    return;
  }

  setMensagemEvolucao('Salvando evolução...', 'info');

  const resposta = await callApi({
    action: 'Evolucao.Salvar',
    payload: {
      idEvolucao: idEvolucao || null,
      idPaciente: pacienteAtualId,
      dataEvolucao,
      tipoEvolucao,
      texto,
      profissional,
    },
  });

  if (!resposta || !resposta.success) {
    const erroTexto =
      (resposta && (resposta.errors || []).join(' | ')) ||
      'Erro ao salvar evolução.';
    setMensagemEvolucao(erroTexto, 'erro');
    console.error('Erro ao salvar evolução:', resposta);
    return;
  }

  setMensagemEvolucao('Evolução salva com sucesso.', 'sucesso');

  // Recarrega lista com dados atualizados
  await carregarEvolucoes();

  // Mantém em edição se for update, ou limpa se for nova
  if (!idEvolucao) {
    limparFormulario();
  }
}

// ------------------------------
// Helpers de data específicos
// ------------------------------

// Formata "yyyy-MM-dd" ou Date para "dd/MM/yyyy"
function formatarDataParaBR(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${dia}/${mes}/${ano}`;
  }
  if (typeof valor === 'string') {
    return formatarDataBR(valor);
  }
  return String(valor);
}

// Garante uma string "yyyy-MM-dd" para colocar no <input type="date">
function normalizarDataParaInput(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  let texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // dd/MM/yyyy
  if (m) {
    const dia = m[1];
    const mes = m[2];
    const ano = m[3];
    return `${ano}-${mes}-${dia}`;
  }

  return texto.substring(0, 10);
}

// ------------------------------
// Retrocompatibilidade com window.PRONTIO
// ------------------------------
try {
  const prontio = (window.PRONTIO = window.PRONTIO || {});
  prontio.pages = prontio.pages || {};
  prontio.pages.evolucao = {
    init: initEvolucaoPage,
  };
} catch (e) {
  // ambiente sem window, ignora
}
