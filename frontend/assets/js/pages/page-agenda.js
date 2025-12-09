// assets/js/pages/page-agenda.js
/**
 * PRONTIO - Página de Agenda (front)
 *
 * Versão para namespace global:
 * - NÃO usa mais import/export
 * - Usa callApi global (exposta por core/api.js)
 * - É registrada em PRONTIO.registerPage("agenda", initAgendaPage)
 */

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const callApi =
    global.callApi ||
    function () {
      console.error(
        "[PRONTIO.agenda] callApi não está definido. Verifique carregamento de core/api.js."
      );
      return Promise.reject(
        new Error("API não inicializada (callApi indefinido).")
      );
    };

  function initAgendaPage() {
    const body = document.body;
    const pageId = body.dataset.pageId || body.getAttribute("data-page") || null;
    if (pageId !== "agenda") {
      console.debug(
        "[PRONTIO.agenda] initAgendaPage chamado, mas data-page != 'agenda' (",
        pageId,
        ")"
      );
      return;
    }

    // Helper para buscar elementos por ID com log de aviso
    function get(id) {
      const el = document.getElementById(id);
      if (!el) {
        console.warn(`Agenda: elemento #${id} não encontrado no DOM.`);
      }
      return el;
    }

    // --- Referências de elementos ---

    const inputData = get("input-data");
    if (!inputData) return; // sem data não faz sentido continuar

    const btnHoje = get("btn-hoje");
    const btnDiaAnterior = get("btn-dia-anterior");
    const btnDiaPosterior = get("btn-dia-posterior");

    const listaHorariosEl = get("agenda-lista-horarios");

    const resumoTotalEl = get("resumo-total");
    const resumoConfirmadosEl = get("resumo-confirmados");
    const resumoFaltasEl = get("resumo-faltas");
    const resumoCanceladosEl = get("resumo-cancelados");
    const resumoConcluidosEl = get("resumo-concluidos");
    const resumoEmAtendimentoEl = get("resumo-em-atendimento");

    const btnNovoAgendamento = get("btn-novo-agendamento");
    const btnBloquearHorario = get("btn-bloquear-horario");

    // Visões
    const secDia = document.querySelector(".agenda-dia");
    const secSemana = document.getElementById("agenda-semana");
    const semanaGridEl = get("agenda-semana-grid");
    const btnVisaoDia = get("btn-visao-dia");
    const btnVisaoSemana = get("btn-visao-semana");

    // Filtros (visão dia)
    const inputFiltroNome = get("filtro-nome");
    const selectFiltroStatus = get("filtro-status");

    // --- ESTADO DA PÁGINA ---

    let modoVisao =
      localStorage.getItem("prontio.agenda.modoVisao") === "semana"
        ? "semana"
        : "dia";

    // Lista de agendamentos do dia (sem grade)
    let horariosOriginaisDia = [];

    // Modal novo agendamento
    const modalOverlay = get("modal-novo-agendamento");
    const btnFecharModal = get("btn-fechar-modal");
    const btnCancelarModal = get("btn-cancelar-modal");
    const formNovoAgendamento = get("form-novo-agendamento");
    const mensagemNovoAgendamento = get("novo-agendamento-mensagem");

    // Campos de novo agendamento
    const inputHoraInicio = get("novo-hora-inicio");
    const inputDuracao = get("novo-duracao");
    const inputNomePaciente = get("novo-nome-paciente");
    const inputTelefone = get("novo-telefone");
    const inputTipo = get("novo-tipo");
    const inputMotivo = get("novo-motivo");
    const inputOrigem = get("novo-origem");
    const inputCanal = get("novo-canal");

    const btnSelecionarPaciente = get("btn-selecionar-paciente");
    const btnLimparPaciente = get("btn-limpar-paciente");

    // Modal edição
    const modalEdit = get("modal-editar-agendamento");
    const btnFecharModalEditar = get("btn-fechar-modal-editar");
    const btnCancelarEditar = get("btn-cancelar-editar");
    const formEditarAgendamento = get("form-editar-agendamento");
    const msgEditarAgendamento = get("editar-agendamento-mensagem");

    const inputEditIdAgenda = get("edit-id-agenda");
    const inputEditData = get("edit-data");
    const inputEditHoraInicio = get("edit-hora-inicio");
    const inputEditDuracao = get("edit-duracao");
    const inputEditNomePaciente = get("edit-nome-paciente");
    const inputEditTipo = get("edit-tipo");
    const inputEditMotivo = get("edit-motivo");
    const inputEditOrigem = get("edit-origem");
    const inputEditCanal = get("edit-canal");

    const btnEditSelecionarPaciente = get("btn-edit-selecionar-paciente");
    const btnEditLimparPaciente = get("btn-edit-limpar-paciente");

    let agendamentoEmEdicao = null;
    let pacienteSelecionadoEditar = null;

    // Modal bloqueio
    const modalBloqueio = get("modal-bloqueio");
    const btnFecharModalBloqueio = get("btn-fechar-modal-bloqueio");
    const btnCancelarBloqueio = get("btn-cancelar-bloqueio");
    const formBloqueio = get("form-bloqueio");
    const mensagemBloqueio = get("bloqueio-mensagem");
    const inputBloqHoraInicio = get("bloq-hora-inicio");
    const inputBloqDuracao = get("bloq-duracao");

    // Modal pacientes
    const modalPacientes = get("modal-pacientes");
    const inputBuscaPaciente = get("busca-paciente-termo");
    const listaPacientesEl = get("lista-pacientes");
    const msgPacientesEl = get("pacientes-resultado-msg");
    const btnFecharModalPacientes = get("btn-fechar-modal-pacientes");

    // Paciente selecionado para NOVO agendamento
    let pacienteSelecionado = null;
    // Contexto de seleção de paciente: 'novo' ou 'editar'
    let contextoSelecaoPaciente = "novo";
    let buscaPacienteTimeout = null;

    // Configuração da agenda (vinda da API) – usada principalmente na SEMANA
    let agendaConfig = {
      hora_inicio_padrao: "08:00",
      hora_fim_padrao: "18:00",
      duracao_grade_minutos: 15, // default 15min
    };
    let agendaConfigCarregada = false;

    // Hora para focar quando abrir visão de dia vindo da semana
    let horaFocoDia = null;

    // ---- Utilitários de data/hora ----

    function formatDateToInput(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function parseInputDate(value) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    function setToday() {
      const today = new Date();
      inputData.value = formatDateToInput(today);
    }

    function formatDataBonita(dataStr) {
      if (!dataStr) return "";
      const [y, m, d] = dataStr.split("-");
      return `${d}/${m}`;
    }

    function getDiaSemanaLabel(dataStr) {
      const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const [y, m, d] = dataStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dias[dt.getDay()];
    }

    function gerarGradeHoras() {
      const iniStr = agendaConfig.hora_inicio_padrao || "08:00";
      const fimStr = agendaConfig.hora_fim_padrao || "18:00";
      const step = agendaConfig.duracao_grade_minutos || 30;

      const [ih, im] = iniStr.split(":").map(Number);
      const [fh, fm] = fimStr.split(":").map(Number);

      let tIni = ih * 60 + im;
      let tFim = fh * 60 + fm;
      if (tFim <= tIni) tFim = tIni + 60;

      const horas = [];
      for (let t = tIni; t <= tFim; t += step) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        const hStr = h < 10 ? "0" + h : "" + h;
        const mStr = m < 10 ? "0" + m : "" + m;
        horas.push(`${hStr}:${mStr}`);
      }
      return horas;
    }

    // ---- Config da agenda (API) ----

    async function carregarAgendaConfigSeNecessario() {
      if (agendaConfigCarregada) return;

      try {
        const data = await callApi({
          action: "AgendaConfig_Obter",
          payload: {},
        });
        if (data) {
          agendaConfig.hora_inicio_padrao =
            data.hora_inicio_padrao || agendaConfig.hora_inicio_padrao;
          agendaConfig.hora_fim_padrao =
            data.hora_fim_padrao || agendaConfig.hora_fim_padrao;
          agendaConfig.duracao_grade_minutos =
            data.duracao_grade_minutos || agendaConfig.duracao_grade_minutos;
        }
      } catch (error) {
        console.warn(
          "Agenda: erro ao carregar AgendaConfig_Obter, usando defaults.",
          error
        );
      } finally {
        agendaConfigCarregada = true;
      }
    }

    // ---- Controle de visão (Dia / Semana) ----

    function setVisao(modo) {
      if (modo !== "dia" && modo !== "semana") return;

      modoVisao = modo;

      try {
        localStorage.setItem("prontio.agenda.modoVisao", modoVisao);
      } catch (e) {
        console.warn("Não foi possível salvar modoVisao no localStorage", e);
      }

      if (modo === "dia") {
        secDia && secDia.classList.remove("hidden");
        secSemana && secSemana.classList.add("hidden");
        btnVisaoDia && btnVisaoDia.classList.add("view-active");
        btnVisaoSemana && btnVisaoSemana.classList.remove("view-active");
        carregarAgendaDia();
      } else {
        secDia && secDia.classList.add("hidden");
        secSemana && secSemana.classList.remove("hidden");
        btnVisaoDia && btnVisaoDia.classList.remove("view-active");
        btnVisaoSemana && btnVisaoSemana.classList.add("view-active");
        carregarAgendaSemana();
      }
    }

    // ---- Agenda do dia ----

    async function carregarAgendaDia() {
      const dataStr = inputData.value;
      if (!dataStr) return;

      await carregarAgendaConfigSeNecessario();

      limparListaHorarios();
      mostrarEstadoCarregando();

      try {
        const data = await callApi({
          action: "Agenda_ListarDia",
          payload: { data: dataStr },
        });

        atualizarResumoDia(data.resumo);

        // data.horarios = [ { hora, agendamentos: [...] }, ... ]
        horariosOriginaisDia = [];
        (data.horarios || []).forEach((slot) => {
          (slot.agendamentos || []).forEach((ag) => {
            horariosOriginaisDia.push(ag);
          });
        });

        console.log("Agenda_ListarDia retorno:", data);
        console.log("Agenda - agendamentos do dia:", horariosOriginaisDia);

        aplicarFiltrosDia();
      } catch (error) {
        console.error(error);
        mostrarErro(
          "Não foi possível carregar a agenda do dia: " + error.message
        );
      } finally {
        removerEstadoCarregando();
      }
    }

    function limparListaHorarios() {
      if (listaHorariosEl) listaHorariosEl.innerHTML = "";
    }

    function mostrarEstadoCarregando() {
      if (!listaHorariosEl) return;
      listaHorariosEl.classList.add("loading");
      listaHorariosEl.innerHTML =
        '<div class="agenda-loading">Carregando agenda...</div>';
    }

    function removerEstadoCarregando() {
      if (!listaHorariosEl) return;
      listaHorariosEl.classList.remove("loading");
    }

    function mostrarErro(mensagem) {
      if (!listaHorariosEl) return;
      listaHorariosEl.innerHTML = `<div class="agenda-erro">${mensagem}</div>`;
    }

    function atualizarResumoDia(resumo) {
      if (resumoTotalEl) resumoTotalEl.textContent = resumo?.total ?? 0;
      if (resumoConfirmadosEl)
        resumoConfirmadosEl.textContent = resumo?.confirmados ?? 0;
      if (resumoFaltasEl) resumoFaltasEl.textContent = resumo?.faltas ?? 0;
      if (resumoCanceladosEl)
        resumoCanceladosEl.textContent = resumo?.cancelados ?? 0;
      if (resumoConcluidosEl)
        resumoConcluidosEl.textContent = resumo?.concluidos ?? 0;
      if (resumoEmAtendimentoEl)
        resumoEmAtendimentoEl.textContent = resumo?.em_atendimento ?? 0;
    }

    // VISÃO DIA: agrupa apenas pelos horários que têm agendamento (sem grade)
    function aplicarFiltrosDia() {
      const horaToKey = (horaStr) => {
        if (!horaStr) return null;
        const parts = String(horaStr).split(":");
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
      };

      const keyToHora = (key) => {
        const h = Math.floor(key / 60);
        const m = key % 60;
        const hStr = h < 10 ? "0" + h : "" + h;
        const mStr = m < 10 ? "0" + m : "" + m;
        return `${hStr}:${mStr}`;
      };

      const termo = (inputFiltroNome?.value || "").toLowerCase().trim();
      const statusFiltro =
        (selectFiltroStatus?.value || "").toLowerCase().trim();

      // Agrupa TODOS os agendamentos pela hora de início
      const grupos = {};
      (horariosOriginaisDia || []).forEach((ag) => {
        const key = horaToKey(ag.hora_inicio);
        if (key == null) return;
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(ag);
      });

      const keys = Object.keys(grupos)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b);

      const slots = [];

      keys.forEach((key) => {
        const agsOriginais = grupos[key] || [];

        const agsFiltrados = agsOriginais.filter((ag) => {
          let ok = true;

          if (termo) {
            const nome = (ag.nome_paciente || "").toLowerCase();
            ok = nome.includes(termo);
          }

          if (ok && statusFiltro) {
            const s = (ag.status || "").toLowerCase();
            ok = s.includes(statusFiltro);
          }

          return ok;
        });

        if (!agsFiltrados.length) return;

        const horaStr = agsFiltrados[0].hora_inicio || keyToHora(key);
        slots.push({ hora: horaStr, agendamentos: agsFiltrados });
      });

      console.log("Agenda - slots dia (após filtro):", slots);

      desenharHorarios(slots);
    }

    function desenharHorarios(horarios) {
      limparListaHorarios();

      if (!listaHorariosEl) return;

      if (!horarios || !horarios.length) {
        listaHorariosEl.innerHTML =
          '<div class="agenda-vazia">Nenhum agendamento para este dia.</div>';
        return;
      }

      let slotParaFoco = null;

      horarios.forEach((slot) => {
        const { hora, agendamentos } = slot;

        const slotEl = document.createElement("div");
        slotEl.className = "agenda-slot";

        const horaEl = document.createElement("div");
        horaEl.className = "agenda-slot-hora";
        horaEl.textContent = hora;

        const conteudoEl = document.createElement("div");
        conteudoEl.className = "agenda-slot-conteudo";

        if (!agendamentos || agendamentos.length === 0) {
          const vazioEl = document.createElement("div");
          vazioEl.className = "agenda-slot-vazio";
          vazioEl.textContent = "Horário livre";
          conteudoEl.appendChild(vazioEl);

          slotEl.addEventListener("dblclick", () => {
            abrirModalBloqueio(hora);
          });
        } else {
          agendamentos.forEach((ag) => {
            let agEl;
            if (ag.bloqueio) {
              agEl = criarCartaoBloqueio(ag);
            } else {
              agEl = criarCartaoAgendamento(ag);
            }
            conteudoEl.appendChild(agEl);
          });
        }

        slotEl.appendChild(horaEl);
        slotEl.appendChild(conteudoEl);
        listaHorariosEl.appendChild(slotEl);

        if (horaFocoDia && hora === horaFocoDia && !slotParaFoco) {
          slotParaFoco = slotEl;
        }
      });

      if (slotParaFoco) {
        slotParaFoco.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      horaFocoDia = null;
    }

    // ---- Agenda da semana ----

    async function carregarAgendaSemana() {
      const dataStr = inputData.value;
      if (!dataStr) return;

      if (semanaGridEl) {
        semanaGridEl.innerHTML =
          '<div class="agenda-loading">Carregando semana...</div>';
      }

      try {
        await carregarAgendaConfigSeNecessario();

        const data = await callApi({
          action: "Agenda_ListarSemana",
          payload: { data_referencia: dataStr },
        });

        desenharSemanaGrid(data.dias || []);
      } catch (error) {
        console.error(error);
        if (semanaGridEl) {
          semanaGridEl.innerHTML =
            '<div class="agenda-erro">Não foi possível carregar a semana: ' +
            error.message +
            "</div>";
        }
      }
    }

    // VISÃO SEMANA: constrói grade só com as horas em que EXISTE agendamento
    function desenharSemanaGrid(dias) {
      if (!semanaGridEl) return;
      semanaGridEl.innerHTML = "";

      if (!dias.length) {
        semanaGridEl.innerHTML =
          '<div class="agenda-vazia">Nenhum agendamento para esta semana.</div>';
        return;
      }

      // Normaliza qualquer formato de hora
      const normalizarHora = (valor) => {
        if (!valor) return null;
        if (valor instanceof Date) {
          const h = valor.getHours();
          const m = valor.getMinutes();
          const hh = h < 10 ? "0" + h : "" + h;
          const mm = m < 10 ? "0" + m : "" + m;
          return `${hh}:${mm}`;
        }
        const partes = String(valor).split(":");
        const h = parseInt(partes[0], 10) || 0;
        const m = parseInt(partes[1] || "0", 10) || 0;
        const hh = h < 10 ? "0" + h : "" + h;
        const mm = m < 10 ? "0" + m : "" + m;
        return `${hh}:${mm}`;
      };

      // Ordena dias
      const diasOrdenados = [...dias].sort((a, b) =>
        a.data.localeCompare(b.data)
      );

      // Flatten das agendas e coleta de todas as horas usadas
      const diaAgMap = {};
      const horasSet = new Set();

      diasOrdenados.forEach((dia) => {
        const ags = [];
        (dia.horarios || []).forEach((slot) => {
          const horaSlot = normalizarHora(slot.hora);
          (slot.agendamentos || []).forEach((ag) => {
            const horaAg = normalizarHora(ag.hora_inicio || horaSlot);
            ags.push({
              ...ag,
              __hora_norm: horaAg,
            });
            if (horaAg) horasSet.add(horaAg);
          });
        });
        diaAgMap[dia.data] = ags;
      });

      const horas = Array.from(horasSet).sort((a, b) => {
        const [ha, ma] = a.split(":").map(Number);
        const [hb, mb] = b.split(":").map(Number);
        const ta = (ha || 0) * 60 + (ma || 0);
        const tb = (hb || 0) * 60 + (mb || 0);
        return ta - tb;
      });

      if (!horas.length) {
        semanaGridEl.innerHTML =
          '<div class="agenda-vazia">Nenhum agendamento para esta semana.</div>';
        return;
      }

      // Cabeçalho
      const headerRow = document.createElement("div");
      headerRow.className = "semana-row semana-header-row";

      const corner = document.createElement("div");
      corner.className = "semana-cell semana-corner-cell";
      corner.textContent = "";
      headerRow.appendChild(corner);

      diasOrdenados.forEach((dia) => {
        const cell = document.createElement("div");
        cell.className = "semana-cell semana-header-cell";
        cell.innerHTML = `
        <div class="semana-header-dia">${getDiaSemanaLabel(dia.data)}</div>
        <div class="semana-header-data">${formatDataBonita(dia.data)}</div>
      `;
        headerRow.appendChild(cell);
      });

      semanaGridEl.appendChild(headerRow);

      // Linhas por cada hora usada na semana
      horas.forEach((hora) => {
        const row = document.createElement("div");
        row.className = "semana-row";

        const horaCell = document.createElement("div");
        horaCell.className = "semana-cell semana-hora-cell";
        horaCell.textContent = hora;
        row.appendChild(horaCell);

        diasOrdenados.forEach((dia) => {
          const cell = document.createElement("div");
          cell.className = "semana-cell semana-slot-cell";

          const agsDia = diaAgMap[dia.data] || [];
          const agsNoHorario = agsDia.filter(
            (ag) => ag.__hora_norm === hora
          );

          if (agsNoHorario.length) {
            agsNoHorario.forEach((ag) => {
              const item = document.createElement("div");
              item.classList.add("semana-agenda-item");
              if (ag.bloqueio) {
                item.classList.add("semana-bloqueio-item");
                item.textContent = "Bloqueado";
              } else {
                const nome = ag.nome_paciente || "(sem nome)";
                const status = ag.status || "";
                const tipo = ag.tipo || "";
                const partes = [nome];
                if (tipo) partes.push(tipo);
                if (status) partes.push(status);
                item.textContent = partes.join(" • ");

                item.addEventListener("click", () => {
                  horaFocoDia = hora;
                  inputData.value = dia.data;
                  setVisao("dia");
                });
              }
              cell.appendChild(item);
            });
          }

          row.appendChild(cell);
        });

        semanaGridEl.appendChild(row);
      });
    }

    // --- Cartão de agendamento normal ---

    function criarCartaoAgendamento(ag) {
      const card = document.createElement("div");
      card.className = "agendamento-card";

      const statusClass = getStatusClass(ag.status);
      card.classList.add(statusClass);

      const linhaPrincipal = document.createElement("div");
      linhaPrincipal.className = "agendamento-linha-principal";

      const nome = document.createElement("span");
      nome.className = "agendamento-nome";
      nome.textContent = ag.nome_paciente || "(sem nome)";

      const tipo = document.createElement("span");
      tipo.className = "agendamento-tipo";
      tipo.textContent = ag.tipo || "";

      linhaPrincipal.appendChild(nome);
      if (tipo.textContent) linhaPrincipal.appendChild(tipo);

      const linhaSecundaria = document.createElement("div");
      linhaSecundaria.className = "agendamento-linha-secundaria";

      const status = document.createElement("span");
      status.className = "agendamento-status";
      status.textContent = ag.status || "Agendado";

      const canal = document.createElement("span");
      canal.className = "agendamento-canal";
      canal.textContent = ag.canal || "";

      linhaSecundaria.appendChild(status);
      if (canal.textContent) linhaSecundaria.appendChild(canal);

      const motivo = document.createElement("div");
      motivo.className = "agendamento-motivo";
      motivo.textContent = ag.motivo || "";

      card.appendChild(linhaPrincipal);
      card.appendChild(linhaSecundaria);
      if (motivo.textContent) card.appendChild(motivo);

      const acoes = document.createElement("div");
      acoes.className = "agendamento-acoes";

      const btnAtender = document.createElement("button");
      btnAtender.type = "button";
      btnAtender.className = "btn-status btn-status-atender";
      btnAtender.textContent = "Atender";
      btnAtender.addEventListener("click", () => {
        abrirProntuario(ag);
      });

      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.className = "btn-status btn-status-editar";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => {
        abrirModalEditarAgendamento(ag);
      });

      const btnConfirmar = document.createElement("button");
      btnConfirmar.type = "button";
      btnConfirmar.className = "btn-status btn-status-confirmar";
      btnConfirmar.textContent = "Confirmar";
      btnConfirmar.addEventListener("click", () => {
        mudarStatusAgendamento(ag.ID_Agenda, "Confirmado", card);
      });

      const btnAtendimento = document.createElement("button");
      btnAtendimento.type = "button";
      btnAtendimento.className = "btn-status btn-status-atendimento";
      btnAtendimento.textContent = "Em atendimento";
      btnAtendimento.addEventListener("click", () => {
        mudarStatusAgendamento(ag.ID_Agenda, "Em atendimento", card);
      });

      const btnFaltou = document.createElement("button");
      btnFaltou.type = "button";
      btnFaltou.className = "btn-status btn-status-faltou";
      btnFaltou.textContent = "Faltou";
      btnFaltou.addEventListener("click", () => {
        mudarStatusAgendamento(ag.ID_Agenda, "Faltou", card);
      });

      const btnCancelar = document.createElement("button");
      btnCancelar.type = "button";
      btnCancelar.className = "btn-status btn-status-cancelar";
      btnCancelar.textContent = "Cancelar";
      btnCancelar.addEventListener("click", () => {
        mudarStatusAgendamento(ag.ID_Agenda, "Cancelado", card);
      });

      const btnConcluido = document.createElement("button");
      btnConcluido.type = "button";
      btnConcluido.className = "btn-status btn-status-concluido";
      btnConcluido.textContent = "Concluído";
      btnConcluido.addEventListener("click", () => {
        mudarStatusAgendamento(ag.ID_Agenda, "Concluído", card);
      });

      acoes.appendChild(btnAtender);
      acoes.appendChild(btnEditar);
      acoes.appendChild(btnConfirmar);
      acoes.appendChild(btnAtendimento);
      acoes.appendChild(btnFaltou);
      acoes.appendChild(btnCancelar);
      acoes.appendChild(btnConcluido);

      card.appendChild(acoes);

      return card;
    }

    // --- Cartão de bloqueio ---

    function criarCartaoBloqueio(ag) {
      const card = document.createElement("div");
      card.className = "agendamento-card bloqueio-card";

      const linhaPrincipal = document.createElement("div");
      linhaPrincipal.className = "agendamento-linha-principal";

      const label = document.createElement("span");
      label.className = "bloqueio-label";
      label.textContent = "Horário bloqueado";

      linhaPrincipal.appendChild(label);
      card.appendChild(linhaPrincipal);

      const info = document.createElement("div");
      info.className = "agendamento-motivo";
      info.textContent = `Das ${ag.hora_inicio} às ${ag.hora_fim}`;
      card.appendChild(info);

      const acoes = document.createElement("div");
      acoes.className = "agendamento-acoes";

      const btnRemover = document.createElement("button");
      btnRemover.type = "button";
      btnRemover.className = "btn-status btn-status-remover-bloqueio";
      btnRemover.textContent = "Remover bloqueio";

      btnRemover.addEventListener("click", () => {
        removerBloqueio(ag.ID_Agenda, card);
      });

      acoes.appendChild(btnRemover);
      card.appendChild(acoes);

      return card;
    }

    // --- Status → classes ---

    function getStatusClass(status) {
      if (!status) return "status-agendado";
      const s = status.toLowerCase();
      if (s.includes("confirm")) return "status-confirmado";
      if (s.includes("falta")) return "status-falta";
      if (s.includes("cancel")) return "status-cancelado";
      if (s.includes("encaixe")) return "status-encaixe";
      if (s.includes("atendimento")) return "status-em-atendimento";
      if (s.includes("conclu")) return "status-concluido";
      return "status-agendado";
    }

    // --- Abrir prontuário ---

  // --- Abrir prontuário ---

  function abrirProntuario(ag) {
    if (!ag.ID_Paciente) {
      alert(
        "Este agendamento não está vinculado a um paciente cadastrado.\n\n" +
          "Use a seleção de pacientes na criação/edição do agendamento para vincular ao prontuário."
      );
      return;
    }

    // Info básica do paciente (retrocompat / outras páginas podem usar)
    const infoPaciente = {
      ID_Paciente: ag.ID_Paciente,
      nome: ag.nome_paciente || "",
      documento: ag.documento_paciente || "",
      telefone: ag.telefone_paciente || "",
    };

    try {
      // chave antiga (caso outras telas usem)
      localStorage.setItem(
        "prontio.pacienteSelecionado",
        JSON.stringify(infoPaciente)
      );
    } catch (e) {
      console.warn("Não foi possível salvar pacienteSelecionado no localStorage", e);
    }

    // NOVO: contexto completo do atendimento, usado pelo prontuário
    const contextoProntuario = {
      ID_Paciente: ag.ID_Paciente,
      nome_paciente: ag.nome_paciente || "",
      documento_paciente: ag.documento_paciente || "",
      telefone_paciente: ag.telefone_paciente || "",
      ID_Agenda: ag.ID_Agenda || "",
      data: ag.data || "",
      hora_inicio: ag.hora_inicio || "",
      status: ag.status || "",
      tipo: ag.tipo || "",
    };

    try {
      localStorage.setItem(
        "prontio.prontuarioContexto",
        JSON.stringify(contextoProntuario)
      );
    } catch (e) {
      console.warn("Não foi possível salvar prontuarioContexto no localStorage", e);
    }

    // Monta URL com idPaciente e, se existir, idAgenda
    const params = new URLSearchParams();
    params.set("idPaciente", ag.ID_Paciente);
    if (ag.ID_Agenda) {
      params.set("idAgenda", ag.ID_Agenda);
    }

    const url = "prontuario.html?" + params.toString();
    window.location.href = url;
  }


    // --- Status / bloqueio API ---

    async function mudarStatusAgendamento(ID_Agenda, novoStatus, cardEl) {
      if (!ID_Agenda) {
        console.error("ID_Agenda não informado para mudar status.");
        return;
      }

      if (cardEl) {
        cardEl.classList.add("agendamento-atualizando");
      }

      try {
        await callApi({
          action: "Agenda_MudarStatus",
          payload: { ID_Agenda, novo_status: novoStatus },
        });

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();
      } catch (error) {
        console.error(error);
        alert("Erro ao mudar status do agendamento: " + error.message);
        if (cardEl) cardEl.classList.remove("agendamento-atualizando");
      }
    }

    async function removerBloqueio(ID_Agenda, cardEl) {
      if (!ID_Agenda) {
        console.error("ID_Agenda não informado para remover bloqueio.");
        return;
      }

      const confirma = confirm(
        "Deseja realmente remover este bloqueio de horário?"
      );
      if (!confirma) return;

      if (cardEl) {
        cardEl.classList.add("agendamento-atualizando");
      }

      try {
        await callApi({
          action: "Agenda_RemoverBloqueio",
          payload: { ID_Agenda },
        });

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();
      } catch (error) {
        console.error(error);
        alert("Erro ao remover bloqueio: " + error.message);
        if (cardEl) cardEl.classList.remove("agendamento-atualizando");
      }
    }

    // --- Modal de novo agendamento ---

    function abrirModalNovoAgendamento(horaPreSelecionada) {
      if (horaPreSelecionada && inputHoraInicio) {
        inputHoraInicio.value = horaPreSelecionada;
      } else if (inputHoraInicio && !inputHoraInicio.value) {
        inputHoraInicio.value = "14:00";
      }

      if (mensagemNovoAgendamento) {
        mensagemNovoAgendamento.textContent = "";
        mensagemNovoAgendamento.className = "form-message";
      }
      contextoSelecaoPaciente = "novo";

      if (modalOverlay) {
        modalOverlay.classList.remove("hidden");
        modalOverlay.classList.add("visible");
      }
    }

    function fecharModalNovoAgendamento() {
      if (modalOverlay) {
        modalOverlay.classList.remove("visible");
        modalOverlay.classList.add("hidden");
      }
      if (formNovoAgendamento) formNovoAgendamento.reset();
      if (inputDuracao) inputDuracao.value = 15;
      if (mensagemNovoAgendamento) mensagemNovoAgendamento.textContent = "";
      limparPacienteSelecionado();
    }

    async function salvarNovoAgendamento(event) {
      event.preventDefault();

      const dataStr = inputData.value;
      const horaStr = inputHoraInicio?.value;
      const duracao = parseInt(inputDuracao?.value || "0", 10);

      if (!dataStr || !horaStr || !duracao) {
        if (mensagemNovoAgendamento) {
          mensagemNovoAgendamento.textContent =
            "Preencha pelo menos data, hora inicial e duração.";
          mensagemNovoAgendamento.className = "form-message erro";
        }
        return;
      }

      const payload = {
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        ID_Paciente: pacienteSelecionado ? pacienteSelecionado.ID_Paciente : "",
        nome_paciente: pacienteSelecionado
          ? pacienteSelecionado.nome
          : inputNomePaciente?.value || "",
        documento_paciente: pacienteSelecionado
          ? pacienteSelecionado.documento
          : "",
        telefone_paciente: pacienteSelecionado
          ? pacienteSelecionado.telefone
          : inputTelefone?.value || "",
        tipo: inputTipo?.value || "",
        motivo: inputMotivo?.value || "",
        origem: inputOrigem?.value || "",
        canal: inputCanal?.value || "",
        ID_Sala: "",
        profissional: "",
        permite_encaixe: true,
      };

      if (mensagemNovoAgendamento) {
        mensagemNovoAgendamento.textContent = "Salvando...";
        mensagemNovoAgendamento.className = "form-message info";
      }

      try {
        await callApi({
          action: "Agenda_Criar",
          payload,
        });

        if (mensagemNovoAgendamento) {
          mensagemNovoAgendamento.textContent =
            "Agendamento criado com sucesso!";
          mensagemNovoAgendamento.className = "form-message sucesso";
        }

        await carregarAgendaDia();

        setTimeout(() => {
          fecharModalNovoAgendamento();
        }, 800);
      } catch (error) {
        console.error(error);

        if (mensagemNovoAgendamento) {
          if (error.code === "AGENDA_CONFLITO_BLOQUEIO") {
            const horaIni = error.details && error.details.hora_inicio;
            const horaFim = error.details && error.details.hora_fim;
            if (horaIni && horaFim) {
              mensagemNovoAgendamento.textContent =
                `Não é possível agendar: horário está bloqueado das ${horaIni} às ${horaFim}.`;
            } else {
              mensagemNovoAgendamento.textContent =
                "Não é possível agendar: horário está bloqueado nesse intervalo.";
            }
            mensagemNovoAgendamento.className = "form-message erro";
          } else if (error.code === "AGENDA_CONFLITO_CONSULTA") {
            const horaIni = error.details && error.details.hora_inicio;
            const horaFim = error.details && error.details.hora_fim;
            const nomePac = error.details && error.details.nome_paciente;

            let msg =
              "Não é possível agendar: já existe consulta neste horário.";
            if (horaIni && horaFim) {
              msg = `Não é possível agendar: já existe consulta das ${horaIni} às ${horaFim}`;
              if (nomePac) msg += ` (${nomePac}).`;
              else msg += ".";
            }
            mensagemNovoAgendamento.textContent = msg;
            mensagemNovoAgendamento.className = "form-message erro";
          } else {
            mensagemNovoAgendamento.textContent =
              "Erro ao salvar agendamento: " + error.message;
            mensagemNovoAgendamento.className = "form-message erro";
          }
        }
      }
    }

    // --- Modal de edição de agendamento ---

    function abrirModalEditarAgendamento(ag) {
      agendamentoEmEdicao = ag;
      pacienteSelecionadoEditar = null;
      contextoSelecaoPaciente = "editar";

      if (inputEditIdAgenda) inputEditIdAgenda.value = ag.ID_Agenda || "";
      if (inputEditData)
        inputEditData.value = ag.data || inputData.value || "";
      if (inputEditHoraInicio)
        inputEditHoraInicio.value = ag.hora_inicio || "";
      if (inputEditDuracao)
        inputEditDuracao.value = ag.duracao_minutos || 15;
      if (inputEditNomePaciente)
        inputEditNomePaciente.value = ag.nome_paciente || "";

      if (inputEditTipo) inputEditTipo.value = ag.tipo || "";
      if (inputEditMotivo) inputEditMotivo.value = ag.motivo || "";
      if (inputEditOrigem) inputEditOrigem.value = ag.origem || "";
      if (inputEditCanal) inputEditCanal.value = ag.canal || "";

      if (msgEditarAgendamento) {
        msgEditarAgendamento.textContent = "";
        msgEditarAgendamento.className = "form-message";
      }

      if (modalEdit) {
        modalEdit.classList.remove("hidden");
        modalEdit.classList.add("visible");
      }
    }

    function fecharModalEditarAgendamento() {
      if (modalEdit) {
        modalEdit.classList.remove("visible");
        modalEdit.classList.add("hidden");
      }
      if (formEditarAgendamento) formEditarAgendamento.reset();
      agendamentoEmEdicao = null;
      pacienteSelecionadoEditar = null;
      if (msgEditarAgendamento) msgEditarAgendamento.textContent = "";
    }

    async function salvarEdicaoAgendamento(event) {
      event.preventDefault();

      if (!agendamentoEmEdicao || !inputEditIdAgenda) {
        if (msgEditarAgendamento) {
          msgEditarAgendamento.textContent =
            "Agendamento inválido para edição.";
          msgEditarAgendamento.className = "form-message erro";
        }
        return;
      }

      const dataStr = inputEditData?.value;
      const horaStr = inputEditHoraInicio?.value;
      const duracao = parseInt(inputEditDuracao?.value || "0", 10);

      if (!dataStr || !horaStr || !duracao) {
        if (msgEditarAgendamento) {
          msgEditarAgendamento.textContent =
            "Preencha pelo menos data, hora inicial e duração.";
          msgEditarAgendamento.className = "form-message erro";
        }
        return;
      }

      const payload = {
        ID_Agenda: inputEditIdAgenda.value,
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        tipo: inputEditTipo?.value || "",
        motivo: inputEditMotivo?.value || "",
        origem: inputEditOrigem?.value || "",
        canal: inputEditCanal?.value || "",
      };

      if (pacienteSelecionadoEditar) {
        payload.ID_Paciente = pacienteSelecionadoEditar.ID_Paciente || "";
        payload.nome_paciente = pacienteSelecionadoEditar.nome || "";
        payload.documento_paciente = pacienteSelecionadoEditar.documento || "";
        payload.telefone_paciente = pacienteSelecionadoEditar.telefone || "";
      }

      if (msgEditarAgendamento) {
        msgEditarAgendamento.textContent = "Salvando alterações...";
        msgEditarAgendamento.className = "form-message info";
      }

      try {
        await callApi({
          action: "Agenda_Atualizar",
          payload,
        });

        if (msgEditarAgendamento) {
          msgEditarAgendamento.textContent =
            "Agendamento atualizado com sucesso!";
          msgEditarAgendamento.className = "form-message sucesso";
        }

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();

        setTimeout(() => {
          fecharModalEditarAgendamento();
        }, 800);
      } catch (error) {
        console.error(error);

        if (msgEditarAgendamento) {
          if (error.code === "AGENDA_CONFLITO_BLOQUEIO") {
            const horaIni = error.details && error.details.hora_inicio;
            const horaFim = error.details && error.details.hora_fim;
            if (horaIni && horaFim) {
              msgEditarAgendamento.textContent =
                `Não é possível reagendar: horário está bloqueado das ${horaIni} às ${horaFim}.`;
            } else {
              msgEditarAgendamento.textContent =
                "Não é possível reagendar: horário está bloqueado nesse intervalo.";
            }
            msgEditarAgendamento.className = "form-message erro";
          } else if (error.code === "AGENDA_CONFLITO_CONSULTA") {
            const horaIni = error.details && error.details.hora_inicio;
            const horaFim = error.details && error.details.hora_fim;
            const nomePac = error.details && error.details.nome_paciente;

            let msg =
              "Não é possível reagendar: já existe consulta neste horário.";
            if (horaIni && horaFim) {
              msg = `Não é possível reagendar: já existe consulta das ${horaIni} às ${horaFim}`;
              if (nomePac) msg += ` (${nomePac}).`;
              else msg += ".";
            }
            msgEditarAgendamento.textContent = msg;
            msgEditarAgendamento.className = "form-message erro";
          } else {
            msgEditarAgendamento.textContent =
              "Erro ao atualizar agendamento: " + error.message;
            msgEditarAgendamento.className = "form-message erro";
          }
        }
      }
    }

    // --- Modal de bloqueio ---

    function abrirModalBloqueio(horaPreSelecionada) {
      if (horaPreSelecionada && inputBloqHoraInicio) {
        inputBloqHoraInicio.value = horaPreSelecionada;
      } else if (inputBloqHoraInicio && !inputBloqHoraInicio.value) {
        inputBloqHoraInicio.value = "12:00";
      }

      if (mensagemBloqueio) {
        mensagemBloqueio.textContent = "";
        mensagemBloqueio.className = "form-message";
      }

      if (modalBloqueio) {
        modalBloqueio.classList.remove("hidden");
        modalBloqueio.classList.add("visible");
      }
    }

    function fecharModalBloqueio() {
      if (modalBloqueio) {
        modalBloqueio.classList.remove("visible");
        modalBloqueio.classList.add("hidden");
      }
      if (formBloqueio) formBloqueio.reset();
      if (inputBloqDuracao) inputBloqDuracao.value = 60;
      if (mensagemBloqueio) mensagemBloqueio.textContent = "";
    }

    async function salvarBloqueio(event) {
      event.preventDefault();

      const dataStr = inputData.value;
      const horaStr = inputBloqHoraInicio?.value;
      const duracao = parseInt(inputBloqDuracao?.value || "0", 10);

      if (!dataStr || !horaStr || !duracao) {
        if (mensagemBloqueio) {
          mensagemBloqueio.textContent =
            "Preencha pelo menos data (acima), hora inicial e duração.";
          mensagemBloqueio.className = "form-message erro";
        }
        return;
      }

      const payload = {
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
      };

      if (mensagemBloqueio) {
        mensagemBloqueio.textContent = "Salvando bloqueio...";
        mensagemBloqueio.className = "form-message info";
      }

      try {
        await callApi({
          action: "Agenda_BloquearHorario",
          payload,
        });

        if (mensagemBloqueio) {
          mensagemBloqueio.textContent = "Horário bloqueado com sucesso!";
          mensagemBloqueio.className = "form-message sucesso";
        }

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();

        setTimeout(() => {
          fecharModalBloqueio();
        }, 800);
      } catch (error) {
        console.error(error);
        if (mensagemBloqueio) {
          mensagemBloqueio.textContent =
            "Erro ao salvar bloqueio: " + error.message;
          mensagemBloqueio.className = "form-message erro";
        }
      }
    }

    // --- Seleção de paciente (integração com Pacientes) ---

    function abrirModalPacientes() {
      if (inputBuscaPaciente) inputBuscaPaciente.value = "";
      if (msgPacientesEl) {
        msgPacientesEl.textContent = "Digite para buscar pacientes.";
        msgPacientesEl.className = "form-message info";
      }
      if (listaPacientesEl) listaPacientesEl.innerHTML = "";
      if (modalPacientes) {
        modalPacientes.classList.remove("hidden");
        modalPacientes.classList.add("visible");
      }
      inputBuscaPaciente && inputBuscaPaciente.focus();
    }

    function fecharModalPacientes() {
      if (modalPacientes) {
        modalPacientes.classList.remove("visible");
        modalPacientes.classList.add("hidden");
      }
      if (inputBuscaPaciente) inputBuscaPaciente.value = "";
      if (listaPacientesEl) listaPacientesEl.innerHTML = "";
      if (msgPacientesEl) msgPacientesEl.textContent = "";
    }

    function aplicarPacienteSelecionado(p) {
      if (contextoSelecaoPaciente === "novo") {
        pacienteSelecionado = p;
        if (inputNomePaciente) inputNomePaciente.value = p ? p.nome : "";
        if (p && p.telefone && inputTelefone && !inputTelefone.value) {
          inputTelefone.value = p.telefone;
        }
      } else {
        pacienteSelecionadoEditar = p;
        if (inputEditNomePaciente)
          inputEditNomePaciente.value = p ? p.nome : "";
      }
    }

    function limparPacienteSelecionado() {
      pacienteSelecionado = null;
      if (inputNomePaciente) inputNomePaciente.value = "";
    }

    function limparPacienteSelecionadoEditar() {
      pacienteSelecionadoEditar = null;
      if (inputEditNomePaciente) {
        inputEditNomePaciente.value = agendamentoEmEdicao
          ? agendamentoEmEdicao.nome_paciente || ""
          : "";
      }
    }

    async function buscarPacientes(termo) {
      if (!termo || termo.trim().length < 2) {
        if (msgPacientesEl) {
          msgPacientesEl.textContent =
            "Digite pelo menos 2 caracteres para buscar.";
          msgPacientesEl.className = "form-message info";
        }
        if (listaPacientesEl) listaPacientesEl.innerHTML = "";
        return;
      }

      if (msgPacientesEl) {
        msgPacientesEl.textContent = "Buscando pacientes...";
        msgPacientesEl.className = "form-message info";
      }
      if (listaPacientesEl) listaPacientesEl.innerHTML = "";

      try {
        const data = await callApi({
          action: "Pacientes_BuscarSimples",
          payload: { termo, limite: 30 },
        });

        const pacientes = data && data.pacientes ? data.pacientes : [];

        if (!pacientes.length) {
          if (msgPacientesEl) {
            msgPacientesEl.textContent =
              "Nenhum paciente encontrado para este termo.";
            msgPacientesEl.className = "form-message info";
          }
          if (listaPacientesEl) listaPacientesEl.innerHTML = "";
          return;
        }

        if (msgPacientesEl) {
          msgPacientesEl.textContent = "";
          msgPacientesEl.className = "form-message";
        }

        if (!listaPacientesEl) return;

        listaPacientesEl.innerHTML = "";
        pacientes.forEach((p) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "paciente-lista-item";

          const linha1 = document.createElement("div");
          linha1.className = "paciente-lista-nome";
          linha1.textContent = p.nome || "(sem nome)";

          const linha2 = document.createElement("div");
          linha2.className = "paciente-lista-detalhes";
          const partes = [];
          if (p.documento) partes.push(p.documento);
          if (p.telefone) partes.push(p.telefone);
          if (p.data_nascimento) partes.push("Nasc.: " + p.data_nascimento);
          linha2.textContent = partes.join(" • ");

          item.appendChild(linha1);
          item.appendChild(linha2);

          item.addEventListener("click", () => {
            aplicarPacienteSelecionado(p);
            fecharModalPacientes();
          });

          listaPacientesEl.appendChild(item);
        });
      } catch (error) {
        console.error(error);
        if (msgPacientesEl) {
          msgPacientesEl.textContent =
            "Erro ao buscar pacientes: " + error.message;
          msgPacientesEl.className = "form-message erro";
        }
        if (listaPacientesEl) listaPacientesEl.innerHTML = "";
      }
    }

    // --- Listeners gerais ---

    if (inputData) {
      inputData.addEventListener("change", () => {
        if (modoVisao === "dia") carregarAgendaDia();
        else carregarAgendaSemana();
      });
    }

    if (btnHoje) {
      btnHoje.addEventListener("click", () => {
        setToday();
        if (modoVisao === "dia") carregarAgendaDia();
        else carregarAgendaSemana();
      });
    }

    if (btnDiaAnterior) {
      btnDiaAnterior.addEventListener("click", () => {
        if (!inputData.value) return;
        const d = parseInputDate(inputData.value);
        if (modoVisao === "semana") d.setDate(d.getDate() - 7);
        else d.setDate(d.getDate() - 1);
        inputData.value = formatDateToInput(d);
        if (modoVisao === "dia") carregarAgendaDia();
        else carregarAgendaSemana();
      });
    }

    if (btnDiaPosterior) {
      btnDiaPosterior.addEventListener("click", () => {
        if (!inputData.value) return;
        const d = parseInputDate(inputData.value);
        if (modoVisao === "semana") d.setDate(d.getDate() + 7);
        else d.setDate(d.getDate() + 1);
        inputData.value = formatDateToInput(d);
        if (modoVisao === "dia") carregarAgendaDia();
        else carregarAgendaSemana();
      });
    }

    if (btnVisaoDia) {
      btnVisaoDia.addEventListener("click", () => {
        setVisao("dia");
      });
    }

    if (btnVisaoSemana) {
      btnVisaoSemana.addEventListener("click", () => {
        setVisao("semana");
      });
    }

    if (inputFiltroNome) {
      inputFiltroNome.addEventListener("input", () => {
        if (modoVisao === "dia") aplicarFiltrosDia();
      });
    }

    if (selectFiltroStatus) {
      selectFiltroStatus.addEventListener("change", () => {
        if (modoVisao === "dia") aplicarFiltrosDia();
      });
    }

    if (btnNovoAgendamento) {
      btnNovoAgendamento.addEventListener("click", () => {
        abrirModalNovoAgendamento();
      });
    }

    if (btnFecharModal) {
      btnFecharModal.addEventListener("click", () => {
        fecharModalNovoAgendamento();
      });
    }

    if (btnCancelarModal) {
      btnCancelarModal.addEventListener("click", () => {
        fecharModalNovoAgendamento();
      });
    }

    if (modalOverlay) {
      modalOverlay.addEventListener("click", (event) => {
        if (event.target === modalOverlay) {
          fecharModalNovoAgendamento();
        }
      });
    }

    if (formNovoAgendamento) {
      formNovoAgendamento.addEventListener("submit", salvarNovoAgendamento);
    }

    if (btnFecharModalEditar) {
      btnFecharModalEditar.addEventListener("click", () => {
        fecharModalEditarAgendamento();
      });
    }

    if (btnCancelarEditar) {
      btnCancelarEditar.addEventListener("click", () => {
        fecharModalEditarAgendamento();
      });
    }

    if (modalEdit) {
      modalEdit.addEventListener("click", (event) => {
        if (event.target === modalEdit) {
          fecharModalEditarAgendamento();
        }
      });
    }

    if (formEditarAgendamento) {
      formEditarAgendamento.addEventListener("submit", salvarEdicaoAgendamento);
    }

    if (btnBloquearHorario) {
      btnBloquearHorario.addEventListener("click", () => {
        abrirModalBloqueio();
      });
    }

    if (btnFecharModalBloqueio) {
      btnFecharModalBloqueio.addEventListener("click", () => {
        fecharModalBloqueio();
      });
    }

    if (btnCancelarBloqueio) {
      btnCancelarBloqueio.addEventListener("click", () => {
        fecharModalBloqueio();
      });
    }

    if (modalBloqueio) {
      modalBloqueio.addEventListener("click", (event) => {
        if (event.target === modalBloqueio) {
          fecharModalBloqueio();
        }
      });
    }

    if (formBloqueio) {
      formBloqueio.addEventListener("submit", salvarBloqueio);
    }

    if (btnSelecionarPaciente) {
      btnSelecionarPaciente.addEventListener("click", () => {
        contextoSelecaoPaciente = "novo";
        abrirModalPacientes();
      });
    }

    if (btnLimparPaciente) {
      btnLimparPaciente.addEventListener("click", () => {
        limparPacienteSelecionado();
      });
    }

    if (btnEditSelecionarPaciente) {
      btnEditSelecionarPaciente.addEventListener("click", () => {
        contextoSelecaoPaciente = "editar";
        abrirModalPacientes();
      });
    }

    if (btnEditLimparPaciente) {
      btnEditLimparPaciente.addEventListener("click", () => {
        limparPacienteSelecionadoEditar();
      });
    }

    if (btnFecharModalPacientes) {
      btnFecharModalPacientes.addEventListener("click", () => {
        fecharModalPacientes();
      });
    }

    if (modalPacientes) {
      modalPacientes.addEventListener("click", (event) => {
        if (event.target === modalPacientes) {
          fecharModalPacientes();
        }
      });
    }

    if (inputBuscaPaciente) {
      inputBuscaPaciente.addEventListener("input", () => {
        const termo = inputBuscaPaciente.value;
        if (buscaPacienteTimeout) clearTimeout(buscaPacienteTimeout);
        buscaPacienteTimeout = setTimeout(() => {
          buscarPacientes(termo);
        }, 300);
      });
    }

    // Inicialização
    setToday();
    setVisao(modoVisao);

    console.debug("[PRONTIO.agenda] initAgendaPage concluído.");
  }

  // Registra página no namespace PRONTIO
  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("agenda", initAgendaPage);
  } else {
    // fallback se main.js ainda não definiu registerPage
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.agenda = { init: initAgendaPage };
  }
})(window, document);
