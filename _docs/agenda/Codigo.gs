/**
 * Café, Graça & Fralda: agenda do "Um café na sua mesa".
 *
 * Roda na sua conta Google (Google Apps Script). Quando alguém marca um horário no site:
 *   1. cria o evento na sua Agenda do Google (com link do Google Meet, se for online);
 *   2. manda um e-mail de aviso para você na hora;
 *   3. convida a pessoa pelo e-mail dela, se ela informou.
 * O site também consulta este script para esconder os horários em que você já tem compromisso.
 *
 * Passo a passo de instalação: veja COMO-CONFIGURAR.md, na mesma pasta.
 */

const CONFIG = {
  AGENDA: 'primary',            // 'primary' = sua agenda principal
  AVISO_PARA: '',               // e-mail que recebe o aviso; vazio = o e-mail desta conta
  HORARIOS: ['20:00', '20:30', '21:00', '21:30'],
  DURACAO_MIN: 30,
  FUSO: 'America/Sao_Paulo',
  DIAS_A_FRENTE: 21
};

/** O site pergunta quais horários estão ocupados. Responde só data e hora, nunca nomes. */
function doGet() {
  const agora = new Date();
  const fim = new Date(agora.getTime() + CONFIG.DIAS_A_FRENTE * 86400000);
  const eventos = agenda_().getEvents(agora, fim).filter(function (ev) { return !ev.isAllDayEvent(); });
  const ocupados = [];
  for (let d = 0; d <= CONFIG.DIAS_A_FRENTE; d++) {
    const dia = Utilities.formatDate(new Date(agora.getTime() + d * 86400000), CONFIG.FUSO, 'yyyy-MM-dd');
    CONFIG.HORARIOS.forEach(function (hora) {
      const ini = inicio_(dia, hora), fimSlot = new Date(ini.getTime() + CONFIG.DURACAO_MIN * 60000);
      const conflito = eventos.some(function (ev) { return ev.getStartTime() < fimSlot && ev.getEndTime() > ini; });
      if (conflito) ocupados.push(dia + '_' + hora.replace(':', ''));
    });
  }
  return json_({ ocupados: ocupados });
}

/** O site envia um pedido de horário. */
function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);
    const pedido = {
      data: texto_(b.data, 10), hora: texto_(b.hora, 5),
      formato: texto_(b.formato, 40), local: texto_(b.local, 80), tema: texto_(b.tema, 40),
      mensagem: texto_(b.mensagem, 1500), nome: texto_(b.nome, 60),
      whatsapp: texto_(b.whatsapp, 20), email: texto_(b.email, 120)
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pedido.data) || CONFIG.HORARIOS.indexOf(pedido.hora) < 0) return json_({ ok: false, erro: 'invalido' });
    if (!pedido.nome || !pedido.mensagem || pedido.whatsapp.replace(/\D/g, '').length < 10) return json_({ ok: false, erro: 'invalido' });
    if (pedido.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pedido.email)) pedido.email = '';

    const ini = inicio_(pedido.data, pedido.hora);
    const fim = new Date(ini.getTime() + CONFIG.DURACAO_MIN * 60000);
    const diaSemana = Number(Utilities.formatDate(ini, CONFIG.FUSO, 'u'));
    if (diaSemana > 5 || ini < new Date()) return json_({ ok: false, erro: 'invalido' });
    const ocupado = agenda_().getEvents(ini, fim).some(function (ev) { return !ev.isAllDayEvent(); });
    if (ocupado) return json_({ ok: false, erro: 'ocupado' });

    const online = pedido.formato !== 'Presencial';
    const quando = Utilities.formatDate(ini, CONFIG.FUSO, "dd/MM 'às' HH:mm");
    const zap = 'https://wa.me/' + pedido.whatsapp.replace(/\D/g, '');
    const descricao = [
      'Um café na sua mesa · Café, Graça & Fralda',
      '',
      'Nome: ' + pedido.nome,
      'WhatsApp: ' + zap,
      pedido.email ? 'E-mail: ' + pedido.email : '',
      'Como: ' + pedido.formato + (pedido.local ? ' (' + pedido.local + ')' : ''),
      'Assunto: ' + pedido.tema,
      '',
      'O que está no coração:',
      pedido.mensagem
    ].filter(function (l, i, arr) { return l !== '' || arr[i - 1] !== ''; }).join('\n');

    const evento = {
      summary: '☕ Café na sua mesa · ' + pedido.nome,
      description: descricao,
      location: online ? '' : pedido.local,
      start: { dateTime: ini.toISOString(), timeZone: CONFIG.FUSO },
      end: { dateTime: fim.toISOString(), timeZone: CONFIG.FUSO },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] }
    };
    if (pedido.email) evento.attendees = [{ email: pedido.email, displayName: pedido.nome }];
    if (online) evento.conferenceData = { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } };

    const criado = Calendar.Events.insert(evento, CONFIG.AGENDA, {
      conferenceDataVersion: 1,
      sendUpdates: pedido.email ? 'all' : 'none'
    });
    const meet = criado.hangoutLink || '';

    MailApp.sendEmail({
      to: CONFIG.AVISO_PARA || Session.getEffectiveUser().getEmail(),
      subject: '☕ Novo café marcado: ' + pedido.nome + ' · ' + quando,
      body: descricao + '\n\n' +
        (meet ? 'Link da chamada: ' + meet + '\n' : '') +
        'Abrir na agenda: ' + criado.htmlLink + '\n' +
        'Responder no WhatsApp: ' + zap
    });

    return json_({ ok: true, meet: meet });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, erro: 'falha' });
  } finally {
    trava.releaseLock();
  }
}

function agenda_() {
  return CONFIG.AGENDA === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CONFIG.AGENDA);
}
function inicio_(dia, hora) {
  return Utilities.parseDate(dia + ' ' + hora, CONFIG.FUSO, 'yyyy-MM-dd HH:mm');
}
function texto_(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Rode esta função uma vez pelo editor para autorizar e testar o aviso por e-mail. */
function testarAviso() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '☕ Teste do Café na sua mesa', 'Se este e-mail chegou, o aviso de novos agendamentos está funcionando.');
}
