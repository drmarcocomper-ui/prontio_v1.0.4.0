// =====================================
// PRONTIO - Página de Receita
//
// Versão compatível com o novo core:
// - NÃO usa import/export (sem ES Modules)
// - Usa window.callApi (core/api.js)
// - Registra a página como PRONTIO.pages.receita via PRONTIO.registerPage
//
// Fluxo esperado no PRONTUÁRIO → RECEITA:
// - Prontuário salva localStorage.prontuarioContexto com ID_Paciente, ID_Agenda, etc.
// - Prontuário redireciona para receita.html?idPaciente=...&idAgenda=...
// - Esta página usa PRIMEIRO: URL + contexto, DEPOIS: state/localStorage antigo
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  const callApi =
    global.callApi ||
    function () {
      console.error(
        "[PRONTIO.receita] callApi não definido. Verifique se core/api.js foi carregado."
      );
      return Promise.reject(
        new Error("API não disponível (callApi indefinido).")
      );
    };

  let cacheMedicamentos = [];

  // ---------------------------------
  // Helpers DOM / mensagens
  // ---------------------------------
  function qs(sel) {
    return document.querySelector(sel);
  }

  function createPageMessages(selector) {
    const el = qs(selector);
    if (!el) {
      return {
        clear() {},
        info() {},
        erro() {},
        sucesso() {},
      };
    }

    function clear() {
      el.textContent = "";
      el.className = "mensagem is-hidden";
    }

    function show(texto, tipo) {
      if (!texto) {
        clear();
        return;
      }
      el.textContent = texto;
      el.className = "mensagem";
      el.classList.remove("mensagem-erro", "mensagem-sucesso", "mensagem-info");

      if (tipo === "erro") {
        el.classList.add("mensagem-erro");
      } else if (tipo === "sucesso") {
        el.classList.add("mensagem-sucesso");
      } else {
        el.classList.add("mensagem-info");
      }
    }

    return {
      clear,
      info(texto) {
        show(texto, "info");
      },
      erro(texto) {
        show(texto, "erro");
      },
      sucesso(texto) {
        show(texto, "sucesso");
      },
    };
  }

  const msgs = createPageMessages("#mensagemReceita");

  function mostrarMensagemReceita(texto, tipo = "info") {
    if (!texto) {
      msgs.clear();
      return;
    }
    if (tipo === "erro") msgs.erro(texto);
    else if (tipo === "sucesso") msgs.sucesso(texto);
    else msgs.info(texto);
  }

  // ---------------------------------
  // Helpers de data/hora
  // ---------------------------------
  function formatarDataBR(isoDateStr) {
    if (!isoDateStr || typeof isoDateStr !== "string") return isoDateStr || "";
    const partes = isoDateStr.split("-");
    if (partes.length !== 3) return isoDateStr;
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }

  function formatarHora(hhmmStr) {
    return hhmmStr || "";
  }

  function formatarDataHoraBRRec(isoString) {
    if (!isoString) return "";

    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return isoString;
    }

    const dataIso = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");

    const data = formatarDataBR(dataIso);
    const hora = formatarHora(
      `${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`
    );

    return `${data} ${hora}`;
  }

  // ---------------------------------
  // Paciente atual (PRIORIDADE: URL + contexto do prontuário)
  // ---------------------------------
  function obterPacienteAtual() {
    const params = new URLSearchParams(global.location.search || "");
    const idFromUrl = params.get("idPaciente") || "";

    let ctx = null;
    try {
      const rawCtx = global.localStorage.getItem("prontio.prontuarioContexto");
      if (rawCtx) ctx = JSON.parse(rawCtx);
    } catch (e) {
      console.warn(
        "[PRONTIO.receita] Erro ao ler prontio.prontuarioContexto:",
        e
      );
    }

    const idFromCtx = ctx && (ctx.ID_Paciente || ctx.idPaciente);

    if (idFromUrl) {
      return {
        idPaciente: idFromUrl,
        nomePaciente: (ctx && ctx.nome_paciente) || "",
      };
    }

    if (idFromCtx) {
      return {
        idPaciente: idFromCtx,
        nomePaciente: (ctx && ctx.nome_paciente) || "",
      };
    }

    try {
      const core = PRONTIO.core || {};
      const st = core.state || {};
      if (typeof st.getPacienteAtual === "function") {
        const p = st.getPacienteAtual();
        if (p && (p.id || p.ID_Paciente)) {
          return {
            idPaciente: p.id || p.ID_Paciente,
            nomePaciente: p.nome || p.nome_paciente || "",
          };
        }
      }
    } catch (e) {
      console.warn("[PRONTIO.receita] Erro ao ler PRONTIO.core.state:", e);
    }

    const idAntigo =
      global.localStorage.getItem("prontio_pacienteAtualId") || "";
    const nomeAntigo =
      global.localStorage.getItem("prontio_pacienteAtualNome") || "";
    if (idAntigo) {
      return { idPaciente: idAntigo, nomePaciente: nomeAntigo };
    }

    return null;
  }

  // ---------------------------------
  // Inicialização
  // ---------------------------------
  async function initReceitaPageInternal() {
    console.log("[PRONTIO.receita] initReceitaPage");
    try {
      await inicializarReceita();
    } catch (err) {
      console.error("[PRONTIO.receita] Erro na inicialização:", err);
      mostrarMensagemReceita(
        "Erro ao inicializar a tela de receita: " + err.message,
        "erro"
      );
    }
  }

  async function inicializarReceita() {
    const atual = obterPacienteAtual();

    const spanId = document.getElementById("recPacienteId");
    const spanNome = document.getElementById("recPacienteNome");
    const form = document.getElementById("formReceita");
    const btnLimpar = document.getElementById("btnLimparCamposReceita");
    const inputBuscaMed = document.getElementById("buscaMedicamento");
    const btnRecarregarMed = document.getElementById(
      "btnRecarregarMedicamentos"
    );

    if (!atual || !atual.idPaciente) {
      if (spanId) spanId.textContent = "-";
      if (spanNome) spanNome.textContent = "-";

      mostrarMensagemReceita(
        "Nenhum paciente selecionado. Volte à lista de pacientes, selecione um e depois abra o prontuário/receita.",
        "erro"
      );

      if (form) {
        Array.from(form.elements).forEach(function (el) {
          el.disabled = true;
        });
      }
      return;
    }

    const idPaciente = atual.idPaciente;
    const nomePaciente = atual.nomePaciente || "";

    if (spanId) spanId.textContent = idPaciente;
    if (spanNome) spanNome.textContent = nomePaciente;

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        salvarReceita();
      });
    }

    if (btnLimpar) {
      btnLimpar.addEventListener("click", function () {
        limparCamposReceita();
      });
    }

    if (inputBuscaMed) {
      inputBuscaMed.addEventListener("input", function () {
        aplicarFiltroMedicamentosLocal();
      });
    }

    if (btnRecarregarMed) {
      btnRecarregarMed.addEventListener("click", function () {
        carregarMedicamentos();
      });
    }

    mostrarMensagemReceita("Carregando dados do paciente...", "info");

    try {
      await carregarReceitas();
    } catch (e) {
      console.error("[PRONTIO.receita] Erro em carregarReceitas:", e);
      mostrarMensagemReceita(
        "Não foi possível carregar as receitas anteriores: " + e.message,
        "erro"
      );
    }

    await carregarMedicamentos();
  }

  // ---------------------------------
  // Campos da receita
  // ---------------------------------
  function limparCamposReceita() {
    const campoTexto = document.getElementById("textoMedicamentos");
    const campoObs = document.getElementById("obsReceita");

    if (campoTexto) campoTexto.value = "";
    if (campoObs) campoObs.value = "";

    mostrarMensagemReceita("Campos da receita limpos.", "info");
  }

  // ---------------------------------
  // Salvar receita
  // ---------------------------------
  async function salvarReceita() {
    const atual = obterPacienteAtual();
    if (!atual || !atual.idPaciente) {
      mostrarMensagemReceita(
        "Nenhum paciente selecionado. Volte à lista de pacientes.",
        "erro"
      );
      return;
    }

    const idPaciente = atual.idPaciente;

    const campoTexto = document.getElementById("textoMedicamentos");
    const campoObs = document.getElementById("obsReceita");

    const textoMedicamentos = campoTexto ? campoTexto.value.trim() : "";
    const obsReceita = campoObs ? campoObs.value.trim() : "";

    if (!textoMedicamentos) {
      mostrarMensagemReceita(
        "O campo de medicamentos/posologia é obrigatório.",
        "erro"
      );
      return;
    }

    mostrarMensagemReceita("Salvando receita...", "info");

    try {
      await callApi({
        action: "Receita.Criar",
        payload: {
          idPaciente: idPaciente,
          textoMedicamentos: textoMedicamentos,
          observacoes: obsReceita,
        },
      });

      mostrarMensagemReceita("Receita salva com sucesso.", "sucesso");
      limparCamposReceita();
      await carregarReceitas();
    } catch (err) {
      console.error("[PRONTIO.receita] Erro ao salvar receita:", err);
      mostrarMensagemReceita(
        "Erro ao salvar receita: " + (err.message || err),
        "erro"
      );
    }
  }

  // ---------------------------------
  // Helper para ordenação (mais nova → mais antiga)
  // ---------------------------------
  function obterTimestampReceita_(rec) {
    const val =
      rec.dataHoraCriacao ||
      rec.DataHoraCriacao ||
      rec.dataHora ||
      rec.dataReceita ||
      "";
    if (!val) return 0;
    const t = Date.parse(val);
    return isNaN(t) ? 0 : t;
  }

  // Normaliza diferentes nomes de propriedades vindas do backend
  function normalizarReceita_(rec) {
    return {
      idReceita:
        rec.idReceita || rec.ID_Receita || rec.id_receita || "",
      dataHoraCriacao:
        rec.dataHoraCriacao ||
        rec.DataHoraCriacao ||
        rec.dataHora ||
        rec.data_receita ||
        "",
      textoMedicamentos:
        rec.textoMedicamentos ||
        rec.TextoMedicamentos ||
        rec.texto_medicamentos ||
        "",
      observacoes:
        rec.observacoes || rec.Observacoes || rec.obs || "",
    };
  }

  // ---------------------------------
  // Carregar receitas (ordenadas desc, tolerante a formatos)
  // ---------------------------------
  async function carregarReceitas() {
    const atual = obterPacienteAtual();
    if (!atual || !atual.idPaciente) return;

    const idPaciente = atual.idPaciente;

    let data;
    data = await callApi({
      action: "Receita.ListarPorPaciente",
      payload: { idPaciente: idPaciente },
    });

    let receitas = [];
    if (Array.isArray(data)) {
      receitas = data;
    } else if (data && Array.isArray(data.receitas)) {
      receitas = data.receitas;
    } else if (data && data.data && Array.isArray(data.data.receitas)) {
      receitas = data.data.receitas;
    }

    const tbody = document.getElementById("tabelaReceitasBody");
    if (!tbody) {
      mostrarMensagemReceita(
        "Tabela de receitas não encontrada na tela.",
        "erro"
      );
      return;
    }

    receitas = (receitas || []).map(normalizarReceita_);
    receitas = receitas.slice().sort(function (a, b) {
      const tb = obterTimestampReceita_(b);
      const ta = obterTimestampReceita_(a);
      return tb - ta; // desc
    });

    tbody.innerHTML = "";

    if (!receitas.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "Nenhuma receita registrada para este paciente.";
      td.style.textAlign = "center";
      td.style.color = "#777";
      tr.appendChild(td);
      tbody.appendChild(tr);

      mostrarMensagemReceita(
        "Nenhuma receita encontrada para este paciente.",
        "info"
      );
      return;
    }

    receitas.forEach(function (rec) {
      const tr = document.createElement("tr");
      tr.dataset.idReceita = rec.idReceita || "";

      const tdDataHora = document.createElement("td");
      tdDataHora.className = "col-data-receita";
      tdDataHora.textContent = formatarDataHoraBRRec(rec.dataHoraCriacao);
      tr.appendChild(tdDataHora);

      const tdTexto = document.createElement("td");
      tdTexto.className = "texto-medicamentos-preview";
      tdTexto.textContent = rec.textoMedicamentos || "";
      tr.appendChild(tdTexto);

      const tdObs = document.createElement("td");
      tdObs.className = "texto-obs-preview";
      tdObs.textContent = rec.observacoes || "";
      tr.appendChild(tdObs);

      const tdAcoes = document.createElement("td");
      tdAcoes.className = "col-acoes-receita";

      const divAcoes = document.createElement("div");
      divAcoes.className = "acoes-receita-lista";

      const btnPdf = document.createElement("button");
      btnPdf.type = "button";
      btnPdf.textContent = "PDF";
      btnPdf.className = "btn secundario";
      btnPdf.addEventListener("click", function () {
        const idReceita = rec.idReceita;
        if (!idReceita) {
          alert("ID da receita não encontrado.");
          return;
        }
        gerarPdfReceita(idReceita);
      });

      const btnModelo = document.createElement("button");
      btnModelo.type = "button";
      btnModelo.textContent = "Usar como modelo";
      btnModelo.className = "btn primario";
      btnModelo.addEventListener("click", function () {
        aplicarReceitaComoModelo(rec);
      });

      divAcoes.appendChild(btnPdf);
      divAcoes.appendChild(btnModelo);
      tdAcoes.appendChild(divAcoes);
      tr.appendChild(tdAcoes);

      tbody.appendChild(tr);
    });

    mostrarMensagemReceita(
      "Receitas carregadas: " + receitas.length + " registro(s).",
      "sucesso"
    );
  }

  function aplicarReceitaComoModelo(receita) {
    const campoTexto = document.getElementById("textoMedicamentos");
    const campoObs = document.getElementById("obsReceita");

    if (campoTexto) {
      campoTexto.value = receita.textoMedicamentos || "";
    }
    if (campoObs) {
      campoObs.value = receita.observacoes || "";
    }

    mostrarMensagemReceita(
      "Receita carregada no formulário para edição.",
      "info"
    );

    if (campoTexto) {
      campoTexto.focus();
    }
  }

// ---------------------------------
// Gerar PDF da receita (com impressão automática)
// ---------------------------------
async function gerarPdfReceita(idReceita) {
  mostrarMensagemReceita("Gerando documento da receita...", "info");

  let resp;
  try {
    resp = await callApi({
      action: "Receita.GerarPdf",
      payload: { idReceita }
    });
  } catch (err) {
    console.error("[PRONTIO.receita] Erro ao gerar PDF:", err);
    mostrarMensagemReceita("Erro ao gerar documento da receita: " + err.message, "erro");
    return;
  }

  // ====== CORREÇÃO IMPORTANTE ======
  const html =
    resp?.data?.html ||      // formato PRONTIO correto
    resp?.html ||            // fallback
    null;

  if (!html) {
    mostrarMensagemReceita("Documento gerado, porém HTML não retornado.", "erro");
    console.error("RETORNO DA API (sem html esperado):", resp);
    return;
  }
  // =================================

  mostrarMensagemReceita("Documento gerado. Abrindo para impressão...", "sucesso");

  const win = window.open("", "_blank");
  if (!win) {
    alert("Não foi possível abrir a nova aba. Verifique bloqueador de pop-up.");
    return;
  }

  // script de impressão automática (garantido)
  const scriptPrint = `
    <script>
      window.addEventListener('load', function() {
        window.print();
        setTimeout(() => { window.close(); }, 600);
      });
    <\/script>
  `;

  // injeta script antes de </body> ou no final
  let htmlFinal = html.includes("</body>")
    ? html.replace("</body>", scriptPrint + "</body>")
    : html + scriptPrint;

  win.document.open();
  win.document.write(htmlFinal);
  win.document.close();
}


  // ---------------------------------
  // Catálogo de medicamentos
  // ---------------------------------
  async function carregarMedicamentos() {
    const tbody = document.getElementById("tabelaMedicamentosBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="font-size:12px; text-align:center; padding:6px;">Carregando medicações...</td></tr>';
    }

    let data;
    try {
      data = await callApi({
        action: "Medicamentos_ListarTodos",
        payload: {},
      });
      console.log("[PRONTIO.receita] Medicamentos_ListarTodos =>", data);
    } catch (err) {
      console.error(
        "[PRONTIO.receita] Erro ao carregar catálogo de medicamentos:",
        err
      );
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="5" style="font-size:12px; text-align:center; padding:6px; color:#c62828;">Erro ao carregar catálogo de medicamentos.</td></tr>';
      }
      return;
    }

    // Tolerante a formatos:
    // - data é array
    // - data.medicamentos é array
    // - data.data.medicamentos é array
    let lista = [];
    if (Array.isArray(data)) {
      lista = data;
    } else if (data && Array.isArray(data.medicamentos)) {
      lista = data.medicamentos;
    } else if (data && data.data && Array.isArray(data.data.medicamentos)) {
      lista = data.data.medicamentos;
    }

    cacheMedicamentos = lista || [];
    aplicarFiltroMedicamentosLocal();
  }

  function aplicarFiltroMedicamentosLocal() {
    const inputBusca = document.getElementById("buscaMedicamento");
    const termo = inputBusca
      ? inputBusca.value.trim().toLowerCase()
      : "";

    let lista = cacheMedicamentos.slice();

    if (termo) {
      lista = lista.filter(function (m) {
        const comp =
          (m.nomeMedicacao || "") +
          " " +
          (m.posologia || "") +
          " " +
          (m.quantidade || "") +
          " " +
          (m.viaAdministracao || "");
        return comp.toLowerCase().includes(termo);
      });
    }

    renderizarTabelaMedicamentos(lista);
  }

  function renderizarTabelaMedicamentos(lista) {
    const tbody = document.getElementById("tabelaMedicamentosBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!lista || !lista.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="font-size:12px; text-align:center; padding:6px; color:#777;">Nenhum medicamento encontrado na tabela.</td></tr>';
      return;
    }

    lista.forEach(function (m) {
      const tr = document.createElement("tr");

      const tdNome = document.createElement("td");
      tdNome.textContent = m.nomeMedicacao || "";
      tr.appendChild(tdNome);

      const tdPoso = document.createElement("td");
      tdPoso.textContent = m.posologia || "";
      tr.appendChild(tdPoso);

      const tdQtd = document.createElement("td");
      tdQtd.textContent = m.quantidade || "";
      tr.appendChild(tdQtd);

      const tdVia = document.createElement("td");
      tdVia.textContent = m.viaAdministracao || "";
      tr.appendChild(tdVia);

      const tdAcoes = document.createElement("td");
      tdAcoes.className = "col-med-acoes";

      const btnInserir = document.createElement("button");
      btnInserir.type = "button";
      btnInserir.className = "btn primario";
      btnInserir.style.padding = "3px 8px";
      btnInserir.style.fontSize = "11px";
      btnInserir.textContent = "Inserir";
      btnInserir.addEventListener("click", function () {
        inserirMedicamentoNaReceita(m);
      });

      tdAcoes.appendChild(btnInserir);
      tr.appendChild(tdAcoes);

      tbody.appendChild(tr);
    });
  }

  function inserirMedicamentoNaReceita(med) {
    const campoTexto = document.getElementById("textoMedicamentos");
    if (!campoTexto) return;

    const linhas = [];

    let linha1 = "";
    if (med.nomeMedicacao) {
      linha1 += med.nomeMedicacao;
    }
    if (med.posologia) {
      if (linha1) linha1 += " – ";
      linha1 += med.posologia;
    }
    if (linha1) {
      linhas.push(linha1);
    }

    const detalhes = [];
    if (med.quantidade) {
      detalhes.push("Qtd: " + med.quantidade);
    }
    if (med.viaAdministracao) {
      detalhes.push("Via: " + med.viaAdministracao);
    }
    if (detalhes.length) {
      linhas.push(detalhes.join(" • "));
    }

    const bloco = linhas.join("\n");

    if (campoTexto.value && campoTexto.value.trim().length > 0) {
      if (!campoTexto.value.endsWith("\n")) {
        campoTexto.value += "\n";
      }
      campoTexto.value += "\n";
    }

    campoTexto.value += bloco;
    campoTexto.focus();

    mostrarMensagemReceita(
      "Medicação inserida na receita em bloco separado. Ajuste o texto se necessário.",
      "info"
    );
  }

  // ---------------------------------
  // Registro da página no PRONTIO
  // ---------------------------------
  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("receita", initReceitaPageInternal);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.receita = { init: initReceitaPageInternal };
  }
})(window, document);
