// Um café na sua mesa: agendar, ver e desmarcar. Seg a sex, das 20h às 22h (horário de Brasília), 30 minutos.
var FORMATS = { whatsapp: "Chamada no WhatsApp", video: "Vídeo (o Denny manda o link)", presencial: "Presencial" };
var DEFAULT_TEMPLATE = [];
[1, 2, 3, 4, 5].forEach(function(d){ ["20:00", "20:30", "21:00", "21:30"].forEach(function(t){ DEFAULT_TEMPLATE.push({ dia_semana: d, hora: t }); }); });
var MIN_NOTICE_MIN = 60, BOOK_DAYS = 10;
var cafe = { template: DEFAULT_TEMPLATE, taken: {}, days: [], day: null, time: null, mine: [], loaded: false };

function slotKey(day, time){ return day + "_" + time; }
function hoursFor(d){
  return cafe.template.filter(function(t){ return t.dia_semana === isoWeekday(d); }).map(function(t){ return t.hora; }).sort();
}
function slotOpen(day, time){
  if (cafe.taken[slotKey(day, time)]) return false;
  var d = parseDay(day), t = time.split(":");
  d.setHours(+t[0], +t[1], 0, 0);
  return d - nowBR() > MIN_NOTICE_MIN * 60000;
}
function buildDays(){
  var out = [], d = nowBR(); d.setHours(0, 0, 0, 0);
  for (var i = 0; i < 45 && out.length < BOOK_DAYS; i++, d.setDate(d.getDate() + 1)) {
    var key = isoDay(d);
    if (hoursFor(d).some(function(t){ return slotOpen(key, t); })) out.push(new Date(d));
  }
  cafe.days = out;
}

var bDays = $("bookDays"), bTimes = $("bookTimes"), bForm = $("bookForm"), bStatus = $("bookStatus"), bSend = $("bookSend"), bDone = $("bookDone");
function opt(name, value, html, checked, disabled){
  var l = h("label", "opt"), i = h("input"), s = h("span");
  i.type = "radio"; i.name = name; i.value = value; i.checked = !!checked; i.disabled = !!disabled;
  s.innerHTML = html; l.append(i, s); return { label: l, input: i };
}
function renderDays(){
  bDays.innerHTML = "";
  if (!cafe.days.length) { bDays.appendChild(h("p", "hint", "Não há horários livres nos próximos dias. Chame no WhatsApp que a gente encaixa.")); return; }
  if (cafe.day && cafe.days.every(function(d){ return isoDay(d) !== cafe.day; })) { cafe.day = null; cafe.time = null; }
  cafe.days.forEach(function(d){
    var key = isoDay(d), wd = WEEKDAYS[isoWeekday(d)];
    var o = opt("b-day", key, "<small>" + wd + "</small><b>" + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "</b>", cafe.day === key);
    o.input.addEventListener("change", function(){ cafe.day = key; cafe.time = null; renderTimes(); });
    bDays.appendChild(o.label);
  });
}
function renderTimes(){
  bTimes.innerHTML = "";
  if (!cafe.day) { bTimes.appendChild(h("p", "hint", "Escolha um dia para ver os horários.")); return; }
  if (cafe.time && !slotOpen(cafe.day, cafe.time)) cafe.time = null;
  var hours = hoursFor(parseDay(cafe.day)), any = false;
  hours.forEach(function(t){
    var open = slotOpen(cafe.day, t); any = any || open;
    var o = opt("b-time", t, t, cafe.time === t, !open);
    o.input.addEventListener("change", function(){ cafe.time = t; });
    bTimes.appendChild(o.label);
  });
  if (!any) bTimes.appendChild(h("p", "hint", "Esse dia já está cheio. Escolha outro."));
}

function loadAvailability(){
  if (!sb) { buildDays(); renderDays(); renderTimes(); return; }
  Promise.all([
    sb.from("horarios_semana").select("dia_semana,hora"),
    sb.from("horarios_ocupados").select("data,hora").gte("data", isoDay(nowBR()))
  ]).then(function(r){
    if (r[0].data && r[0].data.length) cafe.template = r[0].data;
    if (r[1].data) { cafe.taken = {}; r[1].data.forEach(function(x){ cafe.taken[slotKey(x.data, x.hora)] = true; }); }
    cafe.loaded = true;
    buildDays(); renderDays(); renderTimes();
  }).catch(function(){ buildDays(); renderDays(); renderTimes(); });
}

$$('input[name="b-format"]').forEach(function(r){
  r.addEventListener("change", function(){ $("placeField").hidden = checkedVal("b-format") !== "presencial"; });
});
function checkedVal(name){ var el = bForm.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
$("b-phone").addEventListener("input", maskPhone);

var BOOK_ERR = {
  horario_ocupado: "Alguém acabou de reservar esse horário. Escolha outro, por favor.",
  horario_indisponivel: "Esse horário não está mais disponível. Escolha outro.",
  horario_passado: "Esse horário já passou. Escolha outro.",
  limite_agendamentos: "Você já tem 2 cafés marcados. Desmarque um para marcar outro.",
  login_necessario: "Entre com o Google para agendar.",
  dados_invalidos: "Confira os campos e tente de novo."
};

bForm.addEventListener("submit", function(e){
  e.preventDefault();
  var b = { p_data: cafe.day, p_hora: cafe.time, p_formato: checkedVal("b-format"), p_local: val("b-place"), p_tema: checkedVal("b-topic"),
            p_mensagem: val("b-need"), p_whatsapp: val("b-phone").replace(/\D/g, "") };
  if (b.p_formato === "presencial" && b.p_local.length < 3) return setStatus(bStatus, "Informe o bairro e a cidade para o encontro presencial.", "err");
  if (!b.p_tema) return setStatus(bStatus, "Escolha sobre o que quer conversar.", "err");
  if (b.p_mensagem.length < 5) return setStatus(bStatus, "Conte um pouco do que está no seu coração.", "err");
  if (!b.p_data || !b.p_hora) return setStatus(bStatus, "Escolha o dia e o horário.", "err");
  if (b.p_whatsapp.length < 10) return setStatus(bStatus, "Informe o WhatsApp com DDD, por exemplo (81) 99999-9999.", "err");
  if (b.p_formato !== "presencial") b.p_local = "";
  b.p_whatsapp = "+55" + b.p_whatsapp;
  if (!sb || !auth.user) return setStatus(bStatus, BOOK_ERR.login_necessario, "err");
  bSend.disabled = true; setStatus(bStatus, "Reservando seu horário…");
  sb.rpc("agendar", b).then(function(r){
    bSend.disabled = false;
    if (r.error) {
      var c = errCode(r.error);
      if (c === "horario_ocupado" || c === "horario_indisponivel") { cafe.taken[slotKey(b.p_data, b.p_hora)] = true; cafe.time = null; buildDays(); renderDays(); renderTimes(); }
      return setStatus(bStatus, BOOK_ERR[c] || "Não foi possível agendar agora. Tente de novo ou chame no WhatsApp.", "err");
    }
    lsSet("cgf-zap", val("b-phone"));
    cafe.taken[slotKey(b.p_data, b.p_hora)] = true;
    finishBooking(b); loadMine();
  });
});

function whenText(day, time){ return fmtLong.format(parseDay(day)) + ", às " + time; }
function finishBooking(b){
  var sum = $("bookSummary"); sum.innerHTML = "";
  [["Quando", whenText(b.p_data, b.p_hora)], ["Como", FORMATS[b.p_formato] + (b.p_local ? " · " + b.p_local : "")], ["Assunto", b.p_tema]].forEach(function(r){
    var li = h("li"); li.append(h("b", null, r[0] + ": "), document.createTextNode(r[1])); sum.appendChild(li);
  });
  $("bookDoneText").textContent = b.p_formato === "whatsapp"
    ? "Na hora marcada, o Denny te chama por chamada no WhatsApp. Se precisar mudar, desmarque em “Meus horários”."
    : b.p_formato === "video" ? "O Denny manda o link da chamada pelo WhatsApp antes do horário. Se precisar mudar, desmarque em “Meus horários”."
    : "O Denny confirma o endereço pelo WhatsApp. Se precisar mudar, desmarque em “Meus horários”.";
  $("bookWa").href = waLink("Oi, Denny! Acabei de marcar Um café na sua mesa.\nQuando: " + whenText(b.p_data, b.p_hora) + "\nComo: " + FORMATS[b.p_formato] +
    (b.p_local ? " (" + b.p_local + ")" : "") + "\nAssunto: " + b.p_tema);
  bForm.hidden = true; bDone.hidden = false;
}
$("bookAgain").addEventListener("click", function(){
  cafe.time = null; $("b-need").value = ""; setStatus(bStatus, ""); renderTimes(); bDone.hidden = true; bForm.hidden = false;
});

// Meus horários
function loadMine(){
  if (!sb || !auth.user) return;
  sb.from("agendamentos").select("id,data,hora,formato,local,tema,status").eq("user_id", auth.user.id)
    .order("data", { ascending: true }).order("hora", { ascending: true }).then(function(r){
      cafe.mine = r.data || []; renderMine();
    });
}
function renderMine(){
  var box = $("myList"), today = isoDay(nowBR());
  box.innerHTML = "";
  var up = cafe.mine.filter(function(x){ return x.status === "confirmado" && x.data >= today; });
  var rest = cafe.mine.filter(function(x){ return up.indexOf(x) < 0; }).reverse();
  $("mineCount").textContent = up.length ? "(" + up.length + ")" : "";
  if (!cafe.mine.length) {
    var e = h("div", "empty"); e.append(h("h3", null, "Nenhum café marcado"), h("p", null, "Quando você agendar, o seu horário aparece aqui e dá para desmarcar."));
    box.appendChild(e); return;
  }
  up.concat(rest).forEach(function(x){
    var past = up.indexOf(x) < 0, row = h("div", "booking" + (past ? " off" : ""));
    var info = h("div"), b = h("b", null, whenText(x.data, x.hora));
    info.append(b, h("small", null, FORMATS[x.formato] + (x.local ? " · " + x.local : "") + " · " + x.tema));
    row.appendChild(info);
    if (!past) {
      var act = h("div", "confirm"), btn = h("button", "btn btn-ghost btn-sm", "Desmarcar"); btn.type = "button";
      btn.addEventListener("click", function(){
        act.innerHTML = "";
        var yes = h("button", "btn btn-dark btn-sm", "Sim, desmarcar"), no = h("button", "btn btn-ghost btn-sm", "Manter"); yes.type = no.type = "button";
        no.addEventListener("click", renderMine);
        yes.addEventListener("click", function(){
          yes.disabled = true;
          sb.rpc("cancelar_agendamento", { p_id: x.id }).then(function(r){
            if (r.error) { toast("Não foi possível desmarcar agora. Chame o Denny no WhatsApp."); renderMine(); return; }
            delete cafe.taken[slotKey(x.data, x.hora)];
            toast("Horário desmarcado."); loadMine(); loadAvailability();
          });
        });
        act.append(h("span", "hint", "Desmarcar este horário?"), yes, no);
      });
      act.appendChild(btn); row.appendChild(act);
    } else row.appendChild(h("span", "pill-s cancel", x.status === "cancelado" ? "Desmarcado" : "Realizado"));
    box.appendChild(row);
  });
}

viewHooks.cafe = function(sub){
  loadAvailability();
  if (auth.user) { loadMine(); if (!val("b-phone") && lsGet("cgf-zap")) $("b-phone").value = lsGet("cgf-zap"); }
};
auth.on(function(){ if (isShown("cafe")) viewHooks.cafe(currentSub("cafe")); });
setInterval(function(){ if (!document.hidden && isShown("cafe") && !bForm.hidden) loadAvailability(); }, 60000);
