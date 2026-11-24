// Painel do Denny (só administradores): agenda, horários da semana, inscritos e moderação.
var panel = { bookings: [], blocks: [], template: [], subs: [], open: null };
var WEEK_HOURS = [];
for (var hh = 18; hh <= 23; hh++) ["00", "30"].forEach(function(mm){ WEEK_HOURS.push(String(hh).padStart(2, "0") + ":" + mm); });

function panelDays(){
  var out = [], d = nowBR(); d.setHours(0, 0, 0, 0);
  for (var i = 0; i < 28; i++, d.setDate(d.getDate() + 1)) {
    var key = isoDay(d);
    var hasTpl = panel.template.some(function(t){ return t.dia_semana === isoWeekday(d); });
    var hasAny = panel.bookings.some(function(b){ return b.data === key; }) || panel.blocks.some(function(b){ return b.data === key; });
    if (hasTpl || hasAny) out.push(new Date(d));
  }
  return out.slice(0, 21);
}
function findBooking(day, hour){ return panel.bookings.filter(function(b){ return b.data === day && b.hora === hour && b.status === "confirmado"; })[0]; }
function isBlocked(day, hour){ return panel.blocks.some(function(b){ return b.data === day && b.hora === hour; }); }

function renderAgenda(){
  var box = $("pAgenda"); box.innerHTML = "";
  panelDays().forEach(function(d){
    var key = isoDay(d), row = h("div", "dayrow"), lab = h("div");
    lab.append(h("b", null, WEEKDAYS[isoWeekday(d)] + " " + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0")));
    var hours = {};
    panel.template.filter(function(t){ return t.dia_semana === isoWeekday(d); }).forEach(function(t){ hours[t.hora] = 1; });
    panel.bookings.filter(function(b){ return b.data === key && b.status === "confirmado"; }).forEach(function(b){ hours[b.hora] = 1; });
    panel.blocks.filter(function(b){ return b.data === key; }).forEach(function(b){ hours[b.hora] = 1; });
    var slots = h("div", "slots"), nFree = 0, nBlocked = 0;
    Object.keys(hours).sort().forEach(function(t){
      var bk = findBooking(key, t), bl = isBlocked(key, t);
      var s = h("button", "slot " + (bk ? "booked" : bl ? "blocked" : "free"), t); s.type = "button";
      s.title = bk ? bk.nome : bl ? "Bloqueado: toque para liberar" : "Livre: toque para bloquear";
      if (bk) s.addEventListener("click", function(){ openBookingDialog(bk); });
      else if (bl) { nBlocked++; s.addEventListener("click", function(){ sb.from("bloqueios").delete().eq("data", key).eq("hora", t).then(loadPanel); }); }
      else { nFree++; s.addEventListener("click", function(){ sb.from("bloqueios").insert({ data: key, hora: t }).then(loadPanel); }); }
      slots.appendChild(s);
    });
    row.append(lab, slots);
    if (nFree || nBlocked) {
      var day = h("button", "btn btn-ghost btn-sm", nFree ? "Bloquear dia" : "Liberar dia"); day.type = "button";
      day.addEventListener("click", function(){
        if (nFree) {
          var rows = Object.keys(hours).filter(function(t){ return !findBooking(key, t) && !isBlocked(key, t); }).map(function(t){ return { data: key, hora: t }; });
          sb.from("bloqueios").insert(rows).then(loadPanel);
        } else sb.from("bloqueios").delete().eq("data", key).then(loadPanel);
      });
      row.appendChild(day);
    }
    box.appendChild(row);
  });
}

function cancelAs(b, done){
  sb.rpc("cancelar_agendamento", { p_id: b.id }).then(function(r){
    if (r.error) toast("Não foi possível desmarcar agora."); else toast("Horário desmarcado.");
    if (done) done(); loadPanel();
  });
}
function bookingCard(b){
  var card = h("div", "booking"), info = h("div");
  info.append(h("b", null, whenText(b.data, b.hora)), h("small", null, b.nome + " · " + (FORMATS[b.formato] || b.formato) + (b.local ? " · " + b.local : "") + " · " + b.tema));
  var msg = h("small", null, "“" + b.mensagem + "”"); msg.style.cssText = "margin-top:4px;color:var(--ink);white-space:pre-wrap";
  info.appendChild(msg);
  var act = h("div", "confirm"), wa = h("a", "btn btn-wa btn-sm"); wa.href = waLink("Oi " + firstName(b.nome) + "! Aqui é o Denny, sobre o nosso café de " + whenText(b.data, b.hora) + ". ", b.whatsapp.replace(/\D/g, ""));
  wa.target = "_blank"; wa.rel = "noopener"; wa.append(icon("i-wa"), document.createTextNode("WhatsApp"));
  var can = h("button", "btn btn-ghost btn-sm", "Desmarcar"); can.type = "button";
  can.addEventListener("click", function(){
    act.innerHTML = "";
    var yes = h("button", "btn btn-dark btn-sm", "Sim, desmarcar"), no = h("button", "btn btn-ghost btn-sm", "Manter"); yes.type = no.type = "button";
    no.addEventListener("click", function(){ renderBooked(); });
    yes.addEventListener("click", function(){ yes.disabled = true; cancelAs(b); });
    act.append(yes, no);
  });
  act.append(wa, can);
  card.append(info, act);
  return card;
}
function renderBooked(){
  var box = $("pBooked"), today = isoDay(nowBR()); box.innerHTML = "";
  var up = panel.bookings.filter(function(b){ return b.status === "confirmado" && b.data >= today; });
  if (!up.length) { var e = h("div", "empty"); e.append(h("h3", null, "Nenhum café marcado"), h("p", null, "Quando alguém agendar, aparece aqui.")); box.appendChild(e); return; }
  up.forEach(function(b){ box.appendChild(bookingCard(b)); });
}
function openBookingDialog(b){
  readerBody.innerHTML = "";
  var t = h("h3", null, "Café com " + b.nome); t.id = "readerTitle";
  readerBody.append(h("span", "label", "Um café na sua mesa"), t, bookingCard(b));
  dlg.showModal();
}

function renderWeek(){
  var box = $("pWeek"); box.innerHTML = "";
  for (var d = 1; d <= 7; d++) (function(d){
    var row = h("div", "weekrow"), slots = h("div", "slots");
    row.appendChild(h("b", null, WEEKDAYS[d]));
    WEEK_HOURS.forEach(function(t){
      var on = panel.template.some(function(x){ return x.dia_semana === d && x.hora === t; });
      var s = h("button", "slot" + (on ? " on" : ""), t); s.type = "button"; s.setAttribute("aria-pressed", on);
      s.addEventListener("click", function(){
        var q = on ? sb.from("horarios_semana").delete().eq("dia_semana", d).eq("hora", t) : sb.from("horarios_semana").insert({ dia_semana: d, hora: t });
        q.then(loadPanel);
      });
      slots.appendChild(s);
    });
    row.appendChild(slots); box.appendChild(row);
  })(d);
}

function loadPanel(){
  if (!sb || !auth.admin) return;
  var today = isoDay(nowBR());
  Promise.all([
    sb.from("horarios_semana").select("dia_semana,hora"),
    sb.from("agendamentos").select("*").gte("data", today).order("data", { ascending: true }).order("hora", { ascending: true }),
    sb.from("bloqueios").select("data,hora").gte("data", today)
  ]).then(function(r){
    panel.template = r[0].data || []; panel.bookings = r[1].data || []; panel.blocks = r[2].data || [];
    renderAgenda(); renderBooked(); renderWeek();
  });
}
function loadSubs(){
  sb.from("inscritos").select("nome,email,whatsapp,criado_em").order("criado_em", { ascending: false }).limit(500).then(function(r){
    panel.subs = r.data || [];
    $("pSubCount").textContent = panel.subs.length + (panel.subs.length === 1 ? " inscrito" : " inscritos");
    var tb = $("pSubs"); tb.innerHTML = "";
    panel.subs.forEach(function(s){
      var tr = h("tr"); [s.nome, s.email, s.whatsapp, fmtDate.format(new Date(s.criado_em)).replace(".", "")].forEach(function(v){ tr.appendChild(h("td", null, v)); });
      tb.appendChild(tr);
    });
  });
}
function modItem(table, it, extra){
  var el = h("div", "mod-item" + (it.aprovado ? "" : " off")), body = h("div");
  body.append(h("small", null, it.nome + (extra ? " · " + extra : "") + " · " + ago(it.criado_em) + (it.aprovado ? "" : " · oculto")), h("p", null, it.texto));
  var act = h("div", "confirm"), hide = h("button", "btn btn-ghost btn-sm", it.aprovado ? "Ocultar" : "Mostrar"), del = h("button", "btn btn-ghost btn-sm", "Excluir"); hide.type = del.type = "button";
  hide.addEventListener("click", function(){ sb.from(table).update({ aprovado: !it.aprovado }).eq("id", it.id).then(loadMod); });
  del.addEventListener("click", function(){ del.textContent = "Confirmar?"; del.onclick = function(){ sb.from(table).delete().eq("id", it.id).then(loadMod); }; });
  act.append(hide, del); el.append(body, act); return el;
}
function loadMod(){
  Promise.all([
    sb.from("mensagens").select("id,sala,nome,texto,aprovado,criado_em").order("criado_em", { ascending: false }).limit(40),
    sb.from("comentarios").select("id,sobre,nome,texto,aprovado,criado_em").order("criado_em", { ascending: false }).limit(40),
    sb.from("indicacoes_membros").select("id,autor,nome,especialidade,onde,plano,planos,como_conheceu,porque,contato,aprovado,criado_em").order("criado_em", { ascending: false }).limit(40)
  ]).then(function(r){
    var c3 = $("pModInds"); c3.innerHTML = "";
    (r[2].data || []).forEach(function(x){
      c3.appendChild(modItem("indicacoes_membros", { id: x.id, aprovado: x.aprovado, criado_em: x.criado_em, nome: x.nome + " (por " + x.autor + ")",
        texto: x.especialidade + " · " + x.onde + " · " + (x.plano === "plano" ? "Plano: " + x.planos : "Particular") + " · Conheceu: " + x.como_conheceu + " — " + x.porque + (x.contato ? " · Contato: " + x.contato : "") }, x.aprovado ? "publicada" : "AGUARDANDO"));
    });
    if (!c3.childNodes.length) c3.appendChild(h("p", "muted", "Nenhuma indicação enviada ainda."));
    var a = $("pModMsgs"), b = $("pModCmts"); a.innerHTML = ""; b.innerHTML = "";
    (r[0].data || []).forEach(function(m){ a.appendChild(modItem("mensagens", m, "sala " + m.sala)); });
    (r[1].data || []).forEach(function(c){ b.appendChild(modItem("comentarios", c, c.sobre)); });
    if (!a.childNodes.length) a.appendChild(h("p", "muted", "Nenhuma mensagem ainda."));
    if (!b.childNodes.length) b.appendChild(h("p", "muted", "Nenhum comentário ainda."));
  });
}
$("copyMails").addEventListener("click", function(){ copyText(panel.subs.map(function(s){ return s.email; }).join(", "), "E-mails copiados"); });
$("copyPhones").addEventListener("click", function(){ copyText(panel.subs.map(function(s){ return s.whatsapp; }).join("\n"), "WhatsApps copiados"); });

viewHooks.painel = function(sub){
  if (!auth.ready) return;
  var note = $("panelNote");
  if (!auth.user) { note.textContent = "Entre com o Google para acessar o painel."; $("panelApp").hidden = true; return; }
  if (!auth.admin) { note.textContent = auth.name() ? "Esta área é só para o Denny." : "Verificando o seu acesso…"; $("panelApp").hidden = true; return; }
  note.textContent = "Agenda, horários, inscritos, moderação e publicações da Da Casa.";
  $("panelApp").hidden = false;
  loadPanel();
  if (sub === "inscritos") loadSubs();
  if (sub === "moderacao") loadMod();
};
auth.on(function(){ if (route.view === "painel") viewHooks.painel(route.sub); });
