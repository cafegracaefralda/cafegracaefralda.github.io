// Conversas privadas entre pais (só os dois participantes leem). Precisa de login.
var dm = { convs: [], names: {}, unread: {}, blocked: {}, current: null, msgs: [], sig: "", timer: null, badgeTimer: null, profiled: "" };
var dmMsgsEl = $("dmMsgs");
function me(){ return auth.user ? auth.user.id : ""; }
function otherOf(c){ return c.a === me() ? c.b : c.a; }
function dmName(uid){ return dm.names[uid] || "Alguém"; }
function setBadge(n){ var b = $("dmBadge"); b.textContent = n; b.hidden = !n; }

function renderDmList(){
  var box = $("dmList"); box.innerHTML = "";
  if (!dm.convs.length) { box.appendChild(h("p", "hint", "Nenhuma conversa ainda. Chame alguém no privado pelo chat.")); box.firstChild.style.padding = "12px"; return; }
  dm.convs.forEach(function(c){
    var o = otherOf(c), b = h("button", "room"); b.type = "button"; b.setAttribute("aria-pressed", dm.current === c.id);
    var n = dm.unread[c.id] || 0;
    if (n) b.appendChild(h("span", "nb", String(n)));
    b.append(document.createTextNode(dmName(o)), h("small", null, ago(c.ultima_em)));
    b.addEventListener("click", function(){ openConv(c.id); });
    box.appendChild(b);
  });
}
function renderDmTools(){
  var t = $("dmTools"); t.innerHTML = "";
  var c = dm.convs.filter(function(x){ return x.id === dm.current; })[0];
  if (!c) return;
  var o = otherOf(c), blocked = !!dm.blocked[o];
  var bl = h("button", null, blocked ? "Desbloquear" : "Bloquear"); bl.type = "button";
  bl.addEventListener("click", function(){
    var q = blocked ? sb.from("dm_bloqueios").delete().eq("bloqueado", o) : sb.from("dm_bloqueios").insert({ quem: me(), bloqueado: o });
    q.then(function(r){ if (r.error) return toast("Não foi possível fazer isso agora."); dm.blocked[o] = !blocked; toast(blocked ? "Pessoa desbloqueada." : "Pessoa bloqueada. Ela não consegue mais te escrever."); renderDmTools(); });
  });
  var rep = h("a", null, "Denunciar"); rep.href = waLink("Oi, Denny! Quero denunciar uma pessoa nas conversas privadas: " + dmName(o) + ". Motivo: "); rep.target = "_blank"; rep.rel = "noopener";
  t.append(bl, rep);
}
function renderDmMsgs(force){
  var sig = dm.current + ":" + dm.msgs.length + ":" + (dm.msgs.length ? dm.msgs[dm.msgs.length - 1].id : "");
  if (!force && sig === dm.sig) return;
  dm.sig = sig;
  var nearEnd = dmMsgsEl.scrollHeight - dmMsgsEl.scrollTop - dmMsgsEl.clientHeight < 120;
  dmMsgsEl.innerHTML = "";
  if (!dm.current) {
    var e = h("div", "empty"); e.append(h("h3", null, "Suas conversas privadas"), h("p", null, "Escolha uma conversa ao lado, ou chame alguém pelo chat tocando em “Chamar no privado”."));
    dmMsgsEl.appendChild(e); return;
  }
  if (!dm.msgs.length) {
    var e2 = h("div", "empty"); e2.append(h("h3", null, "Diga um oi"), h("p", null, "Comece a conversa. Só vocês dois leem estas mensagens."));
    dmMsgsEl.appendChild(e2); return;
  }
  dm.msgs.forEach(function(m){
    var mine = m.de === me(), row = h("div", "msg" + (mine ? " me" : "")), bub = h("div", "bubble"), top = h("div", "bubble-top");
    row.appendChild(h("span", "avatar", initial(mine ? auth.name() : dmName(m.de))));
    top.append(h("b", null, mine ? "Você" : dmName(m.de)), h("time", null, ago(m.criado_em)));
    bub.append(top, h("p", null, m.texto)); row.appendChild(bub); dmMsgsEl.appendChild(row);
  });
  if (force || nearEnd) dmMsgsEl.scrollTop = dmMsgsEl.scrollHeight;
}

function loadConvs(){
  if (!sb || !auth.user) return Promise.resolve();
  return Promise.all([
    sb.from("dm_conversas").select("id,a,b,ultima_em").order("ultima_em", { ascending: false }),
    sb.from("dm_mensagens").select("conversa_id").eq("lida", false).neq("de", me()),
    sb.from("dm_bloqueios").select("bloqueado")
  ]).then(function(r){
    dm.convs = r[0].data || [];
    dm.unread = {}; (r[1].data || []).forEach(function(x){ dm.unread[x.conversa_id] = (dm.unread[x.conversa_id] || 0) + 1; });
    dm.blocked = {}; (r[2].data || []).forEach(function(x){ dm.blocked[x.bloqueado] = true; });
    var ids = dm.convs.map(otherOf).filter(function(id){ return !dm.names[id]; });
    var total = 0; Object.keys(dm.unread).forEach(function(k){ total += dm.unread[k]; }); setBadge(total);
    if (!ids.length) return;
    return sb.from("perfis").select("user_id,nome").in("user_id", ids).then(function(p){ (p.data || []).forEach(function(x){ dm.names[x.user_id] = x.nome; }); });
  }).then(function(){ renderDmList(); renderDmTools(); });
}
function loadDmMsgs(force){
  var id = dm.current; if (!id || !sb) return;
  sb.from("dm_mensagens").select("id,de,texto,criado_em").eq("conversa_id", id).order("criado_em", { ascending: false }).limit(100).then(function(r){
    if (id !== dm.current || !r.data) return;
    dm.msgs = r.data.slice().reverse(); renderDmMsgs(!!force);
    if (dm.unread[id]) sb.rpc("marcar_lidas", { p_conversa: id }).then(function(){ dm.unread[id] = 0; var t = 0; Object.keys(dm.unread).forEach(function(k){ t += dm.unread[k]; }); setBadge(t); renderDmList(); });
  });
}
function openConv(id){
  dm.current = id; dm.msgs = []; dm.sig = "";
  var c = dm.convs.filter(function(x){ return x.id === id; })[0];
  $("dmTitle").textContent = c ? dmName(otherOf(c)) : "Conversa";
  $("dmComposer").hidden = false;
  renderDmList(); renderDmTools(); renderDmMsgs(true); loadDmMsgs(true);
}
var DM_ERR = { dm_desativado: "Esta pessoa não está recebendo mensagens privadas.", indisponivel: "Não foi possível iniciar esta conversa.",
               nao_encontrado: "Não encontramos essa pessoa.", login_necessario: "Entre com o Google para conversar no privado." };
function openDm(userId, name){
  if (!auth.user) { toast("Entre com o Google para conversar no privado."); return; }
  if (!sb || !userId) return;
  if (userId === me()) { toast("Essa mensagem é sua."); return; }
  dm.names[userId] = name;
  sb.rpc("abrir_conversa", { p_outro: userId }).then(function(r){
    if (r.error) { var m = String(r.error.message || ""), k = Object.keys(DM_ERR).filter(function(x){ return m.indexOf(x) > -1; })[0]; return toast(DM_ERR[k] || "Não foi possível abrir a conversa agora."); }
    var id = r.data;
    go("comunidade", "privado");
    loadConvs().then(function(){ openConv(id); });
  });
}

$("dmComposer").addEventListener("submit", function(e){
  e.preventDefault();
  var texto = $("dmText").value.trim();
  if (!texto || !dm.current || !sb) return;
  $("dmSend").disabled = true;
  sb.from("dm_mensagens").insert({ conversa_id: dm.current, texto: texto }).select("id,de,texto,criado_em").then(function(r){
    $("dmSend").disabled = false;
    if (r.error || !r.data || !r.data.length) { var m = String(r.error && r.error.message || ""); return toast(m.indexOf("muito_rapido") > -1 ? "Calma! Muitas mensagens em pouco tempo." : "Não foi possível enviar. Essa pessoa pode ter bloqueado a conversa."); }
    $("dmText").value = ""; dm.msgs.push(r.data[0]); renderDmMsgs(true);
  });
});
$("dmAccept").addEventListener("change", function(){
  var on = $("dmAccept").checked;
  sb.from("perfis").update({ aceita_dm: on }).eq("user_id", me()).then(function(r){ toast(r.error ? "Não foi possível salvar." : on ? "Você voltou a receber mensagens privadas." : "Mensagens privadas desligadas."); });
});

function startDm(){
  stopDm(); loadConvs().then(function(){ renderDmMsgs(true); });
  sb.from("perfis").select("aceita_dm").eq("user_id", me()).maybeSingle().then(function(r){ if (r.data) $("dmAccept").checked = r.data.aceita_dm !== false; });
  dm.timer = setInterval(function(){ if (!document.hidden) { loadConvs(); loadDmMsgs(false); } }, 6000);
}
function stopDm(){ if (dm.timer) { clearInterval(dm.timer); dm.timer = null; } }

// Perfil criado no primeiro login e aviso de mensagens novas (a cada 45 s) mesmo fora da aba
auth.on(function(){
  if (!auth.user || !sb) { dm = { convs: [], names: {}, unread: {}, blocked: {}, current: null, msgs: [], sig: "", timer: dm.timer, badgeTimer: dm.badgeTimer, profiled: "" }; setBadge(0); return; }
  if (dm.profiled !== me()) { dm.profiled = me(); sb.rpc("garantir_perfil").then(function(){}); }
  if (!dm.badgeTimer) {
    var count = function(){
      if (!auth.user || document.hidden || (dm.timer)) return;
      sb.from("dm_mensagens").select("id", { count: "exact", head: true }).eq("lida", false).neq("de", me()).then(function(r){ if (r.count != null) setBadge(r.count); });
    };
    count(); dm.badgeTimer = setInterval(count, 45000);
  }
});
renderDmMsgs(true);
