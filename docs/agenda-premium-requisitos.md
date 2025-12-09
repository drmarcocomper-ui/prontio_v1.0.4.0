# PRONTIO – Roadmap da Agenda (o que ainda falta)

## 0. O que JÁ temos (base atual)

**Backend (Agenda.gs + Pacientes.gs + Api.gs)**  
- `Agenda_ListarDia` – lista agendamentos de um dia, com resumo de status.  
- `Agenda_Criar` – cria agendamento com:
  - conflito com **bloqueios**;
  - conflito com **outras consultas** (se não for encaixe);
  - integração com paciente (ID_Paciente, nome, telefone, etc.).
- `Agenda_MudarStatus` – muda status rápido (Confirmado, Em atendimento, etc.).  
- `Agenda_BloquearHorario` / `Agenda_RemoverBloqueio` – bloqueios de horário.  
- Pacientes:
  - `Pacientes_BuscarSimples` – busca por nome/doc/telefone;
  - `Pacientes_Criar`, `Pacientes_Atualizar`, `Pacientes_Obter`.

**Front (agenda.html + agenda.js + agenda.css)**  
- Visão **por dia** (timeline vertical).  
- Criação de agendamento com:
  - seleção de paciente via busca;
  - integração com backend (ID_Paciente).
- Botões rápidos de status por consulta (Confirmar, Em atendimento, Faltou, Cancelar, Concluído).  
- Bloqueio de horário (botão + duplo clique em horário livre).  
- Resumo do dia (Total, Confirmados, Faltas, Cancelados, Concluídos, Em atendimento).  
- Botão **Atender** que abre `prontuario.html?idPaciente=...` e salva info no `localStorage`.

Isso já é uma agenda bem “premium” básica. Agora vamos ver o que falta para ficar **redonda**.

---

## 1. Edição e reagendamento de consultas (CRUD completo)

Hoje a gente consegue **criar** e **mudar status**, mas não:

- editar tipo, canal, motivo;
- mudar horário/data da consulta;
- alterar o paciente vinculado (troca de paciente).

### Backend

- [ ] Criar ação `Agenda_Atualizar`:
  - Entrada:
    ```json
    {
      "ID_Agenda": "AG20250101-0001",
      "data": "2025-01-02",
      "hora_inicio": "15:00",
      "duracao_minutos": 30,
      "tipo": "Retorno",
      "motivo": "...",
      "canal": "Convênio X",
      "origem": "WhatsApp",
      "ID_Paciente": "PAC000123"  // opcional
    }
    ```
  - Regra:
    - recalcular `hora_fim`;
    - rodar as mesmas verificações:
      - `verificarConflitoBloqueio_`
      - `verificarConflitoConsulta_`;
    - atualizar somente os campos enviados (resto mantém).

- [ ] (Opcional) `Agenda_Excluir`:
  - para realmente remover um registro (talvez melhor só usar `Status = Cancelado` e log).

### Front

- [ ] Ao clicar em um agendamento (ou ícone “✏️”), abrir **modal de edição**:
  - permitir mudar:
    - data/hora;
    - duração;
    - tipo, motivo, canal, origem;
    - paciente (reaproveitar seletor de paciente).
  - chamar `Agenda_Atualizar`.

---

## 2. Visões adicionais: Semana e Mês

Hoje só temos **Visão de Dia**.  
No roadmap inicial falamos em:

- **Visão Semana** – colunas de segunda a sábado, horários em linhas.  
- **Visão Mês** – calendário com quantidade de consultas por dia.

### Backend

- [ ] `Agenda_ListarSemana`
  - Entrada:
    ```json
    { "data_referencia": "2025-02-10" }
    ```
  - Saída:
    ```json
    {
      "dias": [
        { "data": "2025-02-10", "horarios": [ ... ] },
        { "data": "2025-02-11", "horarios": [ ... ] },
        ...
      ]
    }
    ```
  - Reaproveitar internamente a lógica de `Agenda_ListarDia_`.

- [ ] `Agenda_ListarMesResumo`
  - Entrada:
    ```json
    { "ano": 2025, "mes": 2 }
    ```
  - Saída:
    ```json
    {
      "dias": [
        { "data": "2025-02-01", "total": 5, "confirmados": 3 },
        ...
      ]
    }
    ```

### Front

- [ ] Botões de visão na agenda: **Dia | Semana | Mês**.  
- [ ] Componente de **semana**:
  - grid com dias nas colunas e horários nas linhas;
  - clique em uma célula abre modal de agendamento.
- [ ] Componente de **mês**:
  - calendário (tipo “mini calendário”);
  - cada dia mostra só um número (total ou confirmados);
  - clique em um dia leva para a visão de dia.

---

## 3. Filtros, busca e usabilidade na lista do dia

Para uso diário, a agenda ainda pode ficar mais “cirúrgica”:

### Backend (opcional, parte pode ser no front)

- [ ] `Agenda_ListarDia` aceitar filtros simples:
  ```json
  {
    "data": "2025-01-01",
    "status": ["Confirmado", "Em atendimento"],
    "tipo": ["Retorno"],
    "canal": ["Convênio X"]
  }
