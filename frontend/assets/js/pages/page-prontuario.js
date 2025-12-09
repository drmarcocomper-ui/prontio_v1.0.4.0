/**
 * PRONTIO - Página de Prontuário
 *
 * - Lê contexto (idPaciente / idAgenda) de URL, localStorage e state.
 * - Preenche cabeçalho do paciente/atendimento.
 * - Carrega automaticamente a ÚLTIMA evolução do paciente.
 * - Botão "Carregar histórico completo" mostra todas as evoluções.
 * - Última evolução do histórico:
 *    - botão "Usar como modelo" → copia texto para nova evolução
 *    - botão "Editar evolução" → permite editar apenas no dia de criação
 */

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const callApi =
    global.callApi ||
    function () {
      console.warn(
        "[PRONTIO.prontuario] callApi não definido – usando apenas dados locais."
      );
      return Promise.reject(
        new Error("API não disponível nesta página (callApi indefinido).")
      );
    };

  function qs(sel) {
    return document.querySelector(sel);
  }

  function getQueryParams() {
    const params = new URLSearchParams(global.location.search || "");
    const obj = {};
    params.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }

  function setMensagemEvolucao({ tipo = "info", texto = "" }) {
    const box = qs("#mensagemEvolucao");
    if (!box) return;

    if (!texto) {
      box.classList.add("is-hidden");
      box.textContent = "";
      return;
    }

    box.textContent = texto;
    box.classList.remove("is-hidden");
    box.classList.remove("mensagem-erro", "mensagem-sucesso", "mensagem-info");

    const classe =
      tipo === "erro"
        ? "mensagem-erro"
        : tipo === "sucesso"
        ? "mensagem-sucesso"
        : "mensagem-info";

    box.classList.add(classe);
  }

  // -----------------------------
  // CONTEXTO
  // -----------------------------

  function carregarContextoProntuario() {
    const params = getQueryParams();
    let ctxStorage = null;
    let ctxState = null;

    try {
      const raw = global.localStorage.getItem("prontio.prontuarioContexto");
      if (raw) ctxStorage = JSON.parse(raw);
    } catch (e) {
      console.warn(
        "[PRONTIO.prontuario] Erro ao ler prontio.prontuarioContexto",
        e
      );
    }

    try {
      if (
        PRONTIO.core &&
        PRONTIO.core.state &&
        typeof PRONTIO.core.state.getPacienteAtual === "function"
      ) {
        ctxState = PRONTIO.core.state.getPacienteAtual();
      } else if (
        PRONTIO.state &&
        typeof PRONTIO.state.getPacienteAtual === "function"
      ) {
        ctxState = PRONTIO.state.getPacienteAtual();
      }
    } catch (e) {
      console.warn(
        "[PRONTIO.prontuario] Erro ao obter pacienteAtual do state:",
        e
      );
    }

    const contexto = {
      idPaciente:
        params.idPaciente ||
        params.id ||
        (ctxStorage &&
          (ctxStorage.idPaciente ||
            ctxStorage.ID_Paciente ||
            ctxStorage.pacienteId)) ||
        (ctxState &&
          (ctxState.idPaciente ||
            ctxState.ID_Paciente ||
            ctxState.id)) ||
        "",
      idAgenda:
        params.idAgenda ||
        (ctxStorage && (ctxStorage.ID_Agenda || ctxStorage.idAgenda)) ||
        (ctxState && (ctxState.ID_Agenda || ctxState.idAgenda)) ||
        "",
      data:
        (ctxStorage && ctxStorage.data) ||
        (ctxState && (ctxState.data || ctxState.data_agenda)) ||
        "",
      hora:
        (ctxStorage && ctxStorage.hora_inicio) ||
        (ctxState && (ctxState.hora || ctxState.hora_inicio)) ||
        "",
      status:
        (ctxStorage && ctxStorage.status) ||
        (ctxState && ctxState.status) ||
        "",
      nome:
        (ctxStorage && (ctxStorage.nome_paciente || ctxStorage.nome)) ||
        (ctxState && (ctxState.nomeCompleto || ctxState.nome)) ||
        "",
      documento:
        (ctxStorage && ctxStorage.documento_paciente) ||
        (ctxState && ctxState.documento_paciente) ||
        "",
      telefone:
        (ctxStorage && ctxStorage.telefone_paciente) ||
        (ctxState && (ctxState.telefone || ctxState.telefone1)) ||
        "",
      tipo:
        (ctxStorage && ctxStorage.tipo) ||
        (ctxState && ctxState.tipo) ||
        "",
    };

    return contexto;
  }

  function aplicarContextoNaUI(contexto) {
    const spanNome = qs("#prontuario-paciente-nome");
    const spanId = qs("#prontuario-paciente-id");
    const spanData = qs("#info-agenda-data");
    const spanHora = qs("#info-agenda-hora");
    const spanStatus = qs("#info-agenda-status");
    const spanIdAgenda = qs("#info-agenda-id");
    const topbarMetaContext = qs("#topbar-meta-context");

    if (spanNome) spanNome.textContent = contexto.nome || "Paciente";
    if (spanId) spanId.textContent = contexto.idPaciente || "—";
    if (spanData) {
      spanData.textContent = contexto.data
        ? contexto.data.split("-").reverse().join("/")
        : "—";
    }
    if (spanHora) spanHora.textContent = contexto.hora || "—";
    if (spanStatus) spanStatus.textContent = contexto.status || "—";
    if (spanIdAgenda) spanIdAgenda.textContent = contexto.idAgenda || "—";
    if (topbarMetaContext && contexto.idPaciente) {
      topbarMetaContext.textContent = `Paciente #${contexto.idPaciente}`;
    }
  }

  // -----------------------------
  // ESTADO DO HISTÓRICO
  // -----------------------------

  let historicoCompletoCarregado = false;
  let listaEvolucoesPacienteCache = [];
  let ultimaEvolucaoGlobal = null;
  let idEvolucaoEmEdicao = null;

  // -----------------------------
  // HELPERS DE DATA/HORA
  // -----------------------------

  function parseDataHora(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    const isoLike = s.replace(" ", "T");
    d = new Date(isoLike);
    if (!isNaN(d.getTime())) return d;

    return null;
  }

  function ordenarEvolucoesPorDataHora(lista) {
    return (lista || []).slice().sort(function (a, b) {
      const aRaw =
        a.dataHoraRegistro || a.dataHora || a.dataReferencia || a.data || "";
      const bRaw =
        b.dataHoraRegistro || b.dataHora || b.dataReferencia || b.data || "";
      const aDate = parseDataHora(aRaw) || new Date(0);
      const bDate = parseDataHora(bRaw) || new Date(0);
      return bDate.getTime() - aDate.getTime(); // mais recente primeiro
    });
  }

  function isHoje(dataRaw) {
    const d = parseDataHora(dataRaw);
    if (!d) return false;
    const hoje = new Date();
    return (
      d.getFullYear() === hoje.getFullYear() &&
      d.getMonth() === hoje.getMonth() &&
      d.getDate() === hoje.getDate()
    );
  }

  // -----------------------------
  // LEITURA SEGURA DA RESPOSTA
  // -----------------------------

  function extrairPayloadEvolucao(resposta) {
    if (!resposta || typeof resposta !== "object") return {};
    if (Object.prototype.hasOwnProperty.call(resposta, "data")) {
      return resposta.data || {};
    }
    return resposta;
  }

  // -----------------------------
  // LISTAGEM DE EVOLUÇÕES (GLOBAL)
  // -----------------------------

  function renderListaEvolucoes(lista, ulElement, emptyElement, contexto, opcoes) {
    if (!ulElement || !emptyElement) return;

    const marcarUltimaGlobalComoPrimeira =
      opcoes && opcoes.marcarUltimaGlobalComoPrimeira;

    ulElement.innerHTML = "";

    if (!lista || !lista.length) {
      emptyElement.classList.remove("is-hidden");
      return;
    }

    emptyElement.classList.add("is-hidden");

    lista.forEach((ev, index) => {
      const li = document.createElement("li");
      li.className = "evolucao-item";

      const dataHora =
        ev.dataHoraRegistro || ev.dataHora || ev.data || "";
      const autor = ev.autor || ev.profissional || "";
      const origem = ev.origem || "";
      const idEvo = ev.idEvolucao || ev.ID_Evolucao || ev.id || "";

      let dataHoraFmt = dataHora;
      if (dataHora && dataHora.includes("T")) {
        const [d, t] = dataHora.split("T");
        const [ano, mes, dia] = d.split("-");
        const hhmm = t.substring(0, 5);
        dataHoraFmt = `${dia}/${mes}/${ano} ${hhmm}`;
      }

      const isUltimaGlobal =
        marcarUltimaGlobalComoPrimeira && index === 0;

      let acoesHtml = "";
      if (isUltimaGlobal && idEvo) {
        acoesHtml = `
          <div class="evo-actions">
            <button type="button" class="btn-evo-usar-modelo" data-id-evolucao="${idEvo}">
              Usar como modelo
            </button>
            <button type="button" class="btn-evo-editar" data-id-evolucao="${idEvo}">
              Editar evolução
            </button>
          </div>
        `;
      }

      li.dataset.idEvolucao = idEvo;

      li.innerHTML = `
        <div class="evo-header">
          <span class="evo-data">${dataHoraFmt || "Data/Hora não informada"}</span>
          ${autor ? `<span class="evo-autor">${autor}</span>` : ""}
          ${origem ? `<span class="evo-origem badge">${origem}</span>` : ""}
        </div>
        <div class="evo-texto">${(ev.texto || "").replace(/\n/g, "<br>")}</div>
        ${acoesHtml}
      `;

      ulElement.appendChild(li);
    });

    ulElement
      .querySelectorAll(".btn-evo-usar-modelo")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          const id = btn.dataset.idEvolucao;
          handleUsarModeloUltimaEvolucao(id);
        });
      });

    ulElement
      .querySelectorAll(".btn-evo-editar")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          const id = btn.dataset.idEvolucao;
          handleEditarUltimaEvolucao(id);
        });
      });
  }

  async function carregarHistoricoPaciente(contexto, opcoes) {
    const ul = qs("#listaEvolucoesPaciente");
    const vazio = qs("#listaEvolucoesPacienteVazia");
    const sec = qs("#secHistoricoPaciente");

    const apenasUltima = !!(opcoes && opcoes.apenasUltima);

    if (!ul || !vazio) return;

    if (!contexto.idPaciente) {
      if (sec) sec.classList.remove("is-hidden");
      vazio.textContent =
        "Não é possível carregar histórico: ID do paciente não informado.";
      vazio.classList.remove("is-hidden");
      ul.innerHTML = "";
      return;
    }

    if (sec) sec.classList.remove("is-hidden");

    vazio.textContent = apenasUltima
      ? "Carregando última evolução clínica..."
      : "Carregando histórico clínico completo...";
    vazio.classList.remove("is-hidden");
    ul.innerHTML = "";

    try {
      const resp = await callApi({
        action: "Evolucao.ListarPorPaciente",
        payload: { idPaciente: contexto.idPaciente },
      });

      const data = extrairPayloadEvolucao(resp);
      console.log("Prontuário: Evolucao.ListarPorPaciente =>", data);

      let evolucoesBrutas =
        data.evolucoes || data.lista || data.items || data.rows || [];

      if (!evolucoesBrutas.length && Array.isArray(data)) {
        evolucoesBrutas = data;
      }

      const evolucoesOrdenadas = ordenarEvolucoesPorDataHora(evolucoesBrutas);

      listaEvolucoesPacienteCache = evolucoesOrdenadas;
      ultimaEvolucaoGlobal = evolucoesOrdenadas[0] || null;

      let listaParaMostrar = evolucoesOrdenadas;

      if (apenasUltima && ultimaEvolucaoGlobal) {
        listaParaMostrar = [ultimaEvolucaoGlobal];
        historicoCompletoCarregado = false;
      } else {
        historicoCompletoCarregado = true;
      }

      renderListaEvolucoes(
        listaParaMostrar,
        ul,
        vazio,
        contexto,
        { marcarUltimaGlobalComoPrimeira: true }
      );

      if (!evolucoesOrdenadas.length) {
        vazio.textContent =
          "Nenhuma evolução encontrada para este paciente.";
      }
    } catch (e) {
      console.error("Prontuário: erro ao carregar histórico do paciente:", e);
      vazio.textContent =
        "Erro ao carregar histórico do paciente. Tente novamente.";
      vazio.classList.remove("is-hidden");
    }
  }

  // -----------------------------
  // AÇÕES SOBRE A ÚLTIMA EVOLUÇÃO
  // -----------------------------

  function encontrarEvolucaoPorId(id) {
    if (!id || !listaEvolucoesPacienteCache) return null;
    return listaEvolucoesPacienteCache.find(function (ev) {
      const evId = ev.idEvolucao || ev.ID_Evolucao || ev.id || "";
      return String(evId) === String(id);
    });
  }

  function handleUsarModeloUltimaEvolucao(idEvolucao) {
    const textarea = qs("#textoEvolucao");
    if (!textarea) return;

    const ev =
      encontrarEvolucaoPorId(idEvolucao) || ultimaEvolucaoGlobal || null;

    if (!ev) {
      alert("Não foi possível localizar a última evolução para usar como modelo.");
      return;
    }

    textarea.value = ev.texto || "";
    textarea.focus();

    setMensagemEvolucao({
      tipo: "info",
      texto: "Texto da última evolução copiado para o campo de nova evolução.",
    });

    idEvolucaoEmEdicao = null;
  }

  function handleEditarUltimaEvolucao(idEvolucao) {
    const textarea = qs("#textoEvolucao");
    if (!textarea) return;

    const ev =
      encontrarEvolucaoPorId(idEvolucao) || ultimaEvolucaoGlobal || null;

    if (!ev) {
      alert("Não foi possível localizar a última evolução para edição.");
      return;
    }

    const dataRaw =
      ev.dataHoraRegistro || ev.dataHora || ev.dataReferencia || ev.data;

    if (!isHoje(dataRaw)) {
      alert(
        "Edição permitida apenas até o final do dia da criação da evolução."
      );
      return;
    }

    textarea.value = ev.texto || "";
    textarea.focus();
    idEvolucaoEmEdicao = ev.idEvolucao || ev.ID_Evolucao || ev.id || null;

    setMensagemEvolucao({
      tipo: "info",
      texto:
        "Editando a última evolução registrada hoje. Ao salvar, o texto será atualizado.",
    });
  }

  // -----------------------------
  // SALVAR / ATUALIZAR EVOLUÇÃO
  // -----------------------------

  async function salvarEvolucao(contexto, event) {
    event.preventDefault();

    const textarea = qs("#textoEvolucao");
    if (!textarea || !textarea.value.trim()) {
      setMensagemEvolucao({
        tipo: "erro",
        texto: "Digite o texto da evolução antes de salvar.",
      });
      return;
    }

    if (!contexto.idPaciente) {
      setMensagemEvolucao({
        tipo: "erro",
        texto:
          "ID do paciente não informado. Não é possível salvar evolução.",
      });
      return;
    }

    const isEdicao = !!idEvolucaoEmEdicao;

    try {
      setMensagemEvolucao({
        tipo: "info",
        texto: isEdicao
          ? "Atualizando evolução..."
          : "Salvando nova evolução...",
      });

      const payload = {
        idPaciente: contexto.idPaciente,
        idAgenda: contexto.idAgenda || "",
        texto: textarea.value.trim(),
        dataReferencia: contexto.data || "",
        horaReferencia: contexto.hora || "",
        origem: "PRONTUARIO",
      };

      if (isEdicao) {
        payload.idEvolucao = idEvolucaoEmEdicao;
      }

      await callApi({
        action: "Evolucao.Salvar",
        payload,
      });

      setMensagemEvolucao({
        tipo: "sucesso",
        texto: isEdicao
          ? "Evolução atualizada com sucesso."
          : "Evolução salva com sucesso.",
      });
      textarea.value = "";
      idEvolucaoEmEdicao = null;

      await carregarHistoricoPaciente(
        contexto,
        { apenasUltima: !historicoCompletoCarregado }
      );
    } catch (e) {
      console.error("Prontuário: erro ao salvar evolução:", e);
      setMensagemEvolucao({
        tipo: "erro",
        texto:
          "Não foi possível salvar a evolução. Verifique os dados e tente novamente.",
      });
    }
  }

  // -----------------------------
  // Inicialização
  // -----------------------------

  function initProntuarioPageInternal() {
    console.log("[PRONTIO.prontuario] initProntuarioPage");

    const contexto = carregarContextoProntuario();
    aplicarContextoNaUI(contexto);

    const formEvo = qs("#formEvolucao");
    if (formEvo) {
      formEvo.addEventListener("submit", function (ev) {
        salvarEvolucao(contexto, ev);
      });
    }

    const btnHistorico = qs("#btnCarregarHistoricoPaciente");
    if (btnHistorico) {
      btnHistorico.addEventListener("click", function () {
        carregarHistoricoPaciente(contexto, { apenasUltima: false });
      });
    }

    // Ao abrir: carrega apenas a ÚLTIMA evolução clínica
    carregarHistoricoPaciente(contexto, { apenasUltima: true });

    const btnNovaReceita = qs("#btnNovaReceita");
    if (btnNovaReceita) {
      btnNovaReceita.addEventListener("click", function () {
        if (!contexto.idPaciente) {
          alert(
            "Nenhum paciente associado ao prontuário. Abra a partir da Agenda ou selecione um paciente."
          );
          return;
        }

        const params = new URLSearchParams();
        params.set("idPaciente", contexto.idPaciente);
        if (contexto.idAgenda) params.set("idAgenda", contexto.idAgenda);

        try {
          global.localStorage.setItem(
            "prontio.prontuarioContexto",
            JSON.stringify({
              ID_Paciente: contexto.idPaciente,
              ID_Agenda: contexto.idAgenda || "",
              nome_paciente: contexto.nome || "",
              documento_paciente: contexto.documento || "",
              telefone_paciente: contexto.telefone || "",
              data: contexto.data || "",
              hora_inicio: contexto.hora || "",
              status: contexto.status || "",
              tipo: contexto.tipo || "",
            })
          );
        } catch (e) {
          console.warn(
            "[PRONTIO.prontuario] Não foi possível salvar contexto para receita:",
            e
          );
        }

        const url = "receita.html?" + params.toString();
        global.location.href = url;
      });
    }
  }

  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("prontuario", initProntuarioPageInternal);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.prontuario = { init: initProntuarioPageInternal };
  }
})(window, document);
