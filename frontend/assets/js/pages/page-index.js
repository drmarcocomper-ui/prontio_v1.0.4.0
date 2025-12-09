// assets/js/index.js
// Tela inicial (index) = Lista de Atendimento
// Mostra todos os agendamentos do dia de hoje para frente,
// ordenados por data e hora, usando a ação de API: Agenda.ListarAFuturo

import { callApi } from './core/api.js';
import { formatarDataBR } from './core/utils.js';
import { createPageMessages } from './ui/messages.js';

// Mensagens da página (usa o elemento #mensagemListaAtendimento)
const msgs = createPageMessages('#mensagemListaAtendimento');

// Referências de DOM (inicializadas em initIndexPage)
let tbody = null;
let infoUltimaAtualizacao = null;
let btnRecarregar = null;

// -----------------------------------------------------
// Export: ponto de entrada da página
// Chamado pelo main.js -> initIndexPage()
// -----------------------------------------------------
export function initIndexPage() {
  console.log('PRONTIO: initIndexPage');

  tbody = document.getElementById('tabelaAtendimentoBody');
  infoUltimaAtualizacao = document.getElementById('infoUltimaAtualizacao');
  btnRecarregar = document.getElementById('btnRecarregarLista');

  if (btnRecarregar) {
    btnRecarregar.addEventListener('click', (ev) => {
      ev.preventDefault();
      carregarListaAtendimento();
    });
  }

  // Carrega automaticamente ao abrir a página
  carregarListaAtendimento();
}

// -----------------------------------------------------
// Helpers de mensagem (wrapper para msgs)
// -----------------------------------------------------
function atualizarMensagem(texto, tipo) {
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

// -----------------------------------------------------
// Tabela de atendimentos
// -----------------------------------------------------
function limparTabela() {
  if (!tbody) return;
  tbody.innerHTML = '';
}

function renderizarEstadoCarregando() {
  if (!tbody) return;
  limparTabela();

  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 5;
  td.classList.add('linha-vazia');
  td.textContent = 'Carregando lista de atendimento...';
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function criarBadgeStatus(status) {
  const span = document.createElement('span');
  span.classList.add('badge-status');

  if (!status) {
    span.textContent = 'N/A';
    span.classList.add('badge-outro');
    return span;
  }

  const s = String(status).toUpperCase();
  span.textContent = status;

  if (s === 'AGENDADO') {
    span.classList.add('badge-agendado');
  } else if (s === 'CONFIRMADO') {
    span.classList.add('badge-confirmado');
  } else if (s === 'CANCELADO') {
    span.classList.add('badge-cancelado');
  } else if (s === 'FALTOU') {
    span.classList.add('badge-faltou');
  } else {
    span.classList.add('badge-outro');
  }

  return span;
}

function renderizarLinhas(agendamentos) {
  limparTabela();

  if (!tbody) return;

  if (!agendamentos || agendamentos.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.classList.add('linha-vazia');
    td.textContent = 'Nenhum atendimento agendado a partir de hoje.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  agendamentos.forEach((ag) => {
    const tr = document.createElement('tr');

    const tdData = document.createElement('td');
    tdData.classList.add('col-data');
    tdData.textContent = formatarDataBR(ag.dataConsulta || '');
    tr.appendChild(tdData);

    const tdHora = document.createElement('td');
    tdHora.classList.add('col-hora');
    tdHora.textContent = ag.horaConsulta || '';
    tr.appendChild(tdHora);

    const tdPaciente = document.createElement('td');
    tdPaciente.classList.add('col-paciente');
    tdPaciente.textContent = ag.nomePaciente || '';
    tr.appendChild(tdPaciente);

    const tdTipo = document.createElement('td');
    tdTipo.classList.add('col-tipo');
    tdTipo.textContent = ag.tipo || '';
    tr.appendChild(tdTipo);

    const tdStatus = document.createElement('td');
    tdStatus.classList.add('col-status');
    tdStatus.appendChild(criarBadgeStatus(ag.status));
    tr.appendChild(tdStatus);

    tbody.appendChild(tr);
  });
}

// -----------------------------------------------------
// Carregamento da lista de atendimento (API)
// -----------------------------------------------------
async function carregarListaAtendimento() {
  atualizarMensagem('Carregando lista de atendimento...', 'info');
  renderizarEstadoCarregando();
  if (btnRecarregar) btnRecarregar.disabled = true;

  try {
    // Seu callApi já:
    // - envia { action, payload }
    // - verifica success
    // - lança erro se success = false
    // - retorna APENAS json.data
    //
    // Então aqui recebemos diretamente o "data" da API:
    // { agendamentos: [...] }
    const data = await callApi({
      action: 'Agenda.ListarAFuturo',
      payload: {},
    });

    const agendamentos = (data && data.agendamentos) || [];

    renderizarLinhas(agendamentos);

    const qtd = agendamentos.length;
    const msgInfo =
      qtd === 0
        ? 'Nenhum atendimento agendado a partir de hoje.'
        : `Encontrado(s) ${qtd} atendimento(s) do dia de hoje para frente.`;
    atualizarMensagem(msgInfo, 'sucesso');

    if (infoUltimaAtualizacao) {
      const agora = new Date();
      const dd = String(agora.getDate()).padStart(2, '0');
      const mm = String(agora.getMonth() + 1).padStart(2, '0');
      const yyyy = agora.getFullYear();
      const hh = String(agora.getHours()).padStart(2, '0');
      const min = String(agora.getMinutes()).padStart(2, '0');
      infoUltimaAtualizacao.textContent = `Atualizado em ${dd}/${mm}/${yyyy} às ${hh}:${min}`;
    }
  } catch (erro) {
    console.error('Erro ao carregar Lista de Atendimento:', erro);
    const msg =
      (erro && erro.message) ||
      'Falha na comunicação com o servidor. Verifique sua conexão ou tente novamente.';
    atualizarMensagem(msg, 'erro');
    limparTabela();
  } finally {
    if (btnRecarregar) btnRecarregar.disabled = false;
  }
}

// -----------------------------------------------------
// Retrocompatibilidade com window.PRONTIO
// -----------------------------------------------------
try {
  const prontio = (window.PRONTIO = window.PRONTIO || {});
  prontio.pages = prontio.pages || {};
  prontio.pages.index = {
    init: initIndexPage,
  };
} catch (e) {
  // ambiente sem window, ignora
}
