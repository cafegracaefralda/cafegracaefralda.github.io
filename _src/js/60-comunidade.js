// Comunidade: chat entre pais (com login), comentários públicos e indicações.
function filterChips(groupId, onPick){
  var chips = $$("#" + groupId + " .chip");
  chips.forEach(function(c){
    c.addEventListener("click", function(){
      chips.forEach(function(x){ x.setAttribute("aria-pressed", x === c); });
      onPick(c.getAttribute("data-filter"));
    });
  });
}

/* ---------- Chat: "Levante a mão" ---------- */
var ROOMS = [
  { id: "geral", nome: "Mesa geral", desc: "Papo livre entre pais" },
  { id: "sono", nome: "Sono e madrugadas", desc: "Quem está acordado às 3h" },
  { id: "birra", nome: "Birra e limites", desc: "Disciplina com graça" },
  { id: "casamento", nome: "Casamento", desc: "Depois dos filhos" },
  { id: "cansaco", nome: "Cansaço", desc: "Desabafos e respiros" },
  { id: "fe", nome: "Fé em casa", desc: "Orar e ensinar os filhos" },
  { id: "duvidas", nome: "Dúvidas sobre fé", desc: "Pergunte sem medo" }
];
var chat = { room: "geral", msgs: [], hand: false, timer: null, sig: "" };
var msgsEl = $("msgs");

function renderRooms(){
  var box = $("rooms"); box.innerHTML = "";
  ROOMS.forEach(function(r){
    var b = h("button", "room"); b.type = "button"; b.setAttribute("aria-pressed", r.id === chat.room);
    b.append(document.createTextNode(r.nome), h("small", null, r.desc));
    b.addEventListener("click", function(){ chat.room = r.id; chat.msgs = []; chat.sig = ""; $("chatTitle").textContent = r.nome; renderRooms(); renderMsgs(true); loadMsgs(true); });
    box.appendChild(b);
  });
}
function renderMsgs(force){
  var sig = chat.msgs.length + ":" + (chat.msgs.length ? chat.msgs[chat.msgs.length - 1].id : "");
  if (!force && sig === chat.sig) return;
  chat.sig = sig;
  var nearEnd = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 120;
  msgsEl.innerHTML = "";
  if (!chat.msgs.length) {
    var e = h("div", "empty"); e.append(h("h3", null, "Ninguém levantou a mão ainda"), h("p", null, "Puxe uma cadeira e comece a conversa. A primeira pergunta é sempre a mais corajosa."));
    msgsEl.appendChild(e); return;
  }
  chat.msgs.forEach(function(m){
    var me = auth.user && m.user_id === auth.user.id;
    var row = h("div", "msg" + (me ? " me" : "")), bub = h("div", "bubble" + (m.mao ? " mao" : "")), top = h("div", "bubble-top");
    row.appendChild(h("span", "avatar", initial(m.nome)));
    top.append(h("b", null, me ? "Você" : m.nome), h("time", null, ago(m.criado_em)));
    bub.appendChild(top);
    if (m.mao) bub.appendChild(h("span", "tag-mao", "✋ Levantou a mão"));
    bub.appendChild(h("p", null, m.texto));
    var act = h("div", "bubble-act");
    if (me) {
      var del = h("button", null, "Apagar"); del.type = "button";
      del.addEventListener("click", function(){ sb.from("mensagens").delete().eq("id", m.id).then(function(){ chat.msgs = chat.msgs.filter(function(x){ return x.id !== m.id; }); renderMsgs(true); }); });
      act.appendChild(del);
    } else {
      var dmb = h("button", null, "Chamar no privado"); dmb.type = "button";
      dmb.addEventListener("click", function(){ openDm(m.user_id, m.nome); });
      act.appendChild(dmb);
      var rep = h("a", null, "Denunciar"); rep.href = waLink('Oi, Denny! Quero denunciar uma mensagem no chat (sala ' + chat.room + ', de ' + m.nome + '): "' + m.texto.slice(0, 120) + '"'); rep.target = "_blank"; rep.rel = "noopener";
      act.appendChild(rep);
    }
    bub.appendChild(act); row.appendChild(bub); msgsEl.appendChild(row);
  });
  if (force || nearEnd) msgsEl.scrollTop = msgsEl.scrollHeight;
}
function loadMsgs(force){
  if (!sb || !auth.user) return;
  var room = chat.room;
  sb.from("mensagens").select("id,user_id,nome,texto,mao,criado_em").eq("sala", room).eq("aprovado", true)
    .order("criado_em", { ascending: false }).limit(80).then(function(r){
      if (room !== chat.room || !r.data) return;
      chat.msgs = r.data.slice().reverse(); renderMsgs(!!force);
    });
}
function startChat(){ stopChat(); loadMsgs(true); chat.timer = setInterval(function(){ if (!document.hidden) loadMsgs(false); }, 5000); }
function stopChat(){ if (chat.timer) { clearInterval(chat.timer); chat.timer = null; } }

$("composer").addEventListener("submit", function(e){
  e.preventDefault();
  var texto = $("msgText").value.trim();
  if (!texto || !sb || !auth.user) return;
  $("msgSend").disabled = true;
  sb.from("mensagens").insert({ sala: chat.room, texto: texto, mao: chat.hand }).select("id,user_id,nome,texto,mao,criado_em").then(function(r){
    $("msgSend").disabled = false;
    if (r.error || !r.data || !r.data.length) { toast("Não foi possível enviar agora. Tente de novo."); return; }
    $("msgText").value = ""; chat.hand = false; $("handBtn").setAttribute("aria-pressed", "false");
    chat.msgs.push(r.data[0]); renderMsgs(true);
  });
});
$("handBtn").addEventListener("click", function(){ chat.hand = !chat.hand; $("handBtn").setAttribute("aria-pressed", chat.hand); $("msgText").focus(); });
$("rulesToggle").addEventListener("click", function(e){ e.preventDefault(); $("chatRules").hidden = !$("chatRules").hidden; });
$("rulesOk").addEventListener("click", function(){ lsSet("cgf-rules", "1"); $("chatRules").hidden = true; });
renderRooms();

/* ---------- Comentários públicos ---------- */
var cmtList = $("cmtList"), cmtStatus = $("cmtStatus");
(function fillSobre(){
  var sel = $("c-sobre"), seen = {};
  ["Geral"].concat(DEVOS.map(function(d){ return d.title; })).concat(["Um café na sua mesa", "O site e o app"]).forEach(function(t){
    if (seen[t]) return; seen[t] = 1; var o = h("option", null, t); o.value = t; sel.appendChild(o);
  });
})();
function renderComments(items){
  cmtList.innerHTML = "";
  $("cmtCount").textContent = items.length === 1 ? "1 comentário" : items.length + " comentários";
  if (!items.length) {
    var e = h("div", "empty card"); e.append(h("h3", null, "Seja o primeiro a comentar"), h("p", null, "Ainda está quieto por aqui. Puxe uma cadeira e comece a conversa."));
    cmtList.appendChild(e); return;
  }
  items.forEach(function(c){
    var el = h("article", "cmt"), top = h("div", "cmt-top");
    top.append(h("span", "avatar", initial(c.nome)), h("b", null, c.nome), h("time", null, ago(c.criado_em)));
    el.appendChild(top);
    if (c.sobre && c.sobre !== "Geral") el.appendChild(h("span", "about", "Sobre: " + c.sobre));
    el.appendChild(h("p", null, c.texto)); cmtList.appendChild(el);
  });
}
var cmtCache = [];
function loadComments(){
  if (!sb) { renderComments([]); return; }
  sb.from("comentarios").select("id,sobre,nome,texto,criado_em").eq("aprovado", true).order("criado_em", { ascending: false }).limit(60).then(function(r){
    if (r.data) { cmtCache = r.data; renderComments(cmtCache); }
  });
}
$("cmtForm").addEventListener("submit", function(e){
  e.preventDefault();
  if ($("c-site").value) { setStatus(cmtStatus, "Comentário publicado. Obrigado!", "ok"); return; }  // isca contra robôs
  var nome = val("c-name"), texto = val("c-text"), sobre = $("c-sobre").value;
  if (!nome || !texto) return setStatus(cmtStatus, "Escreva seu nome e o comentário.", "err");
  if (Date.now() - (+lsGet("cgf-cmt-ts") || 0) < 30000) return setStatus(cmtStatus, "Aguarde alguns segundos para comentar de novo.", "err");
  if (!sb) return setStatus(cmtStatus, "Comentários indisponíveis agora. Fale comigo no WhatsApp.", "err");
  $("cmtSend").disabled = true; setStatus(cmtStatus, "Publicando…");
  sb.from("comentarios").insert({ sobre: sobre, nome: nome, texto: texto }).select("id,sobre,nome,texto,criado_em").then(function(r){
    $("cmtSend").disabled = false;
    if (r.error) return setStatus(cmtStatus, "Não foi possível publicar agora. Tente de novo em instantes.", "err");
    lsSet("cgf-cmt-ts", String(Date.now()));
    $("c-text").value = ""; setStatus(cmtStatus, "Comentário publicado. Obrigado por puxar uma cadeira!", "ok");
    if (r.data && r.data[0]) { cmtCache.unshift(r.data[0]); renderComments(cmtCache); } else loadComments();
  });
});

/* ---------- Indicações: da nossa mesa para a sua ---------- */
var fridge = $("fridgeNotes");
var fridgeFilter = "all", fromMembers = [];
function fridgeItems(){ return INDICACOES.concat(fromMembers); }
function loadMemberInds(){
  if (!sb) return;
  sb.from("indicacoes_membros").select("id,autor,nome,categoria,especialidade,onde,atendimento,plano,planos,como_conheceu,porque,contato,aprovado").order("criado_em", { ascending: false }).limit(60).then(function(r){
    if (!r.data) return;
    fromMembers = r.data.map(function(x){
      var c = String(x.contato || "").trim(), d = c.replace(/\D/g, "");
      return { cat: x.categoria, nome: x.nome, oque: x.especialidade, onde: x.onde, modo: x.atendimento, porque: x.porque, como: x.como_conheceu, por: x.autor,
        plano: x.plano === "plano" ? "Aceita plano de saúde: " + x.planos : "Atendimento particular", pend: !x.aprovado,
        whatsapp: d.length >= 10 && c.charAt(0) !== "@" ? d : "", instagram: c.charAt(0) === "@" ? c : "" };
    });
    renderFridge();
  });
}
function renderFridge(filter){
  if (filter) fridgeFilter = filter; else filter = fridgeFilter;
  fridge.innerHTML = "";
  fridgeItems().forEach(function(p){
    if (filter !== "all" && p.cat !== filter) return;
    var li = h("li", "note"), tape = h("span", "tape"); tape.style.setProperty("--m", TAPE[p.cat] || "#B65B3A"); tape.setAttribute("aria-hidden", "true");
    var top = h("div", "note-top"); top.append(h("span", "label", p.cat));
    if (p.exemplo) top.append(h("span", "ex", "Exemplo"));
    if (p.pend) top.append(h("span", "ex pend", "Em análise"));
    var why = h("div", "note-why"); why.append(h("span", "note-small", p.por ? "Por que indica" : "Por que indicamos"),h("p", null, "“" + p.porque + "”"));
    var acts = h("div", "note-acts");
    function lnk(cls, href, ic, label){ var a = h("a", "btn btn-sm " + cls); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.append(icon(ic), document.createTextNode(label)); acts.appendChild(a); }
    if (p.whatsapp) lnk("btn-wa", "https://wa.me/" + p.whatsapp.replace(/\D/g, ""), "i-wa", "WhatsApp");
    if (p.instagram) lnk("btn-ghost", "https://instagram.com/" + p.instagram.replace(/^@/, ""), "i-ig", "Instagram");
    li.append(tape, top, h("h3", null, p.nome), h("p", "note-what", p.oque), why, h("p", "note-meta", p.onde + " · " + p.modo));
    if (p.plano) li.appendChild(h("p", "note-meta2", p.plano));
    if (p.como) li.appendChild(h("p", "note-meta2", "Como conheceu: " + p.como));
    if (p.por) li.appendChild(h("p", "note-by", "Indicado por " + p.por));
    if (acts.childNodes.length) li.append(acts);
    fridge.appendChild(li);
  });
}
filterChips("fridgeFilters", renderFridge);
renderFridge("all");

viewHooks.comunidade = function(sub){
  if (sub === "indicacoes") loadMemberInds();
  if (sub === "chat" && auth.user) {
    $("chatRules").hidden = lsGet("cgf-rules") === "1";
    startChat();
  } else stopChat();
  if (sub === "privado" && auth.user) startDm(); else stopDm();
  if (sub === "comentarios") { loadComments(); if (auth.user && !val("c-name")) $("c-name").value = firstName(auth.name()); }
};
auth.on(function(){ if (isShown("comunidade")) viewHooks.comunidade(currentSub("comunidade")); else { stopChat(); stopDm(); } });
document.addEventListener("visibilitychange", function(){ if (!document.hidden && chat.timer) loadMsgs(false); });
