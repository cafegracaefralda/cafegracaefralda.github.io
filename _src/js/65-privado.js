// Conversas privadas entre pais (só os dois participantes leem). Precisa de login.
var dm = { urls: {}, convs: [], names: {}, unread: {}, blocked: {}, current: null, msgs: [], sig: "", timer: null, badgeTimer: null, profiled: "" };
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
    var tx = h("span", "rtx"); tx.append(document.createTextNode(dmName(o)), h("small", null, ago(c.ultima_em)));
    b.append(h("span", "avatar", initial(dmName(o))), tx);
    b.addEventListener("click", function(){ openConv(c.id); });
    box.appendChild(b);
  });
}
function renderPeople(list){
  var box = $("dmPeople"); box.innerHTML = "";
  if (!list.length) { box.appendChild(h("p", "hint", $("dmSearch").value.trim() ? "Ninguém com esse nome." : "Ainda não há outras pessoas aqui.")); return; }
  list.forEach(function(x){
    var b = h("button", "room"); b.type = "button"; var tx = h("span", "rtx"); tx.append(document.createTextNode(x.nome || "Alguém"), h("small", null, "Conversar no privado"));
    b.append(h("span", "avatar", initial(x.nome)), tx);
    b.addEventListener("click", function(){ openDm(x.user_id, x.nome || "Alguém"); });
    box.appendChild(b);
  });
}
function loadPeople(){
  if (!sb || !auth.user) return;
  var term = $("dmSearch").value.trim().replace(/[^A-Za-zÀ-ÿ ]/g, "").slice(0, 40);
  var q = sb.from("perfis").select("user_id,nome").eq("aceita_dm", true).neq("user_id", me()).order("criado_em", { ascending: false }).limit(30);
  if (term) q = q.ilike("nome", "%" + term + "%");
  q.then(function(r){ if (r.data) renderPeople(r.data); });
}
var peopleT = null;
$("dmSearch").addEventListener("input", function(){ clearTimeout(peopleT); peopleT = setTimeout(loadPeople, 250); });
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
function fileView(m){
  var url = dm.urls[m.arquivo];
  if (!url) return h("p", "file-off", "Arquivo indisponível");
  var a = h("a", "file-a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
  if (m.arquivo_tipo === "image") { var im = h("img", "file-img"); im.src = url; im.alt = "Foto enviada"; im.loading = "lazy"; a.appendChild(im); }
  else { a.className = "file-chip"; a.append(h("span", "file-ic", "📄"), h("span", "file-nm", m.arquivo_nome || "arquivo.pdf"), h("small", null, "Abrir")); }
  return a;
}
function signDm(msgs){
  var paths = msgs.map(function(m){ return m.arquivo; }).filter(function(x){ return x && !dm.urls[x]; });
  if (!paths.length || !sb) return Promise.resolve();
  return sb.storage.from("privado").createSignedUrls(paths, 3600).then(function(r){ (r.data || []).forEach(function(x){ if (x.signedUrl && x.path) dm.urls[x.path] = x.signedUrl; }); }, function(){});
}
function renderDmMsgs(force){
  var sig = dm.current + ":" + dm.msgs.length + ":" + (dm.msgs.length ? dm.msgs[dm.msgs.length - 1].id : "");
  if (!force && sig === dm.sig) return;
  dm.sig = sig;
  var nearEnd = dmMsgsEl.scrollHeight - dmMsgsEl.scrollTop - dmMsgsEl.clientHeight < 120;
  dmMsgsEl.innerHTML = "";
  if (!dm.current) {
    var e = h("div", "empty"); e.append(h("h3", null, "Suas conversas privadas"), h("p", null, "Escolha uma conversa ao lado, ou procure uma pessoa pelo nome em “Encontrar pessoas”."));
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
    bub.appendChild(top);
    if (m.arquivo) bub.appendChild(fileView(m));
    if (m.texto) bub.appendChild(h("p", null, m.texto));
    row.appendChild(bub); dmMsgsEl.appendChild(row);
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
  sb.from("dm_mensagens").select("id,de,texto,criado_em,arquivo,arquivo_nome,arquivo_tipo").eq("conversa_id", id).order("criado_em", { ascending: false }).limit(100).then(function(r){
    if (id !== dm.current || !r.data) return;
    dm.msgs = r.data.slice().reverse();
    signDm(dm.msgs).then(function(){ if (id === dm.current) renderDmMsgs(!!force); });
    if (dm.unread[id]) sb.rpc("marcar_lidas", { p_conversa: id }).then(function(){ dm.unread[id] = 0; var t = 0; Object.keys(dm.unread).forEach(function(k){ t += dm.unread[k]; }); setBadge(t); renderDmList(); });
  });
}
function openConv(id){
  dm.current = id; dm.msgs = []; dm.sig = "";
  var c = dm.convs.filter(function(x){ return x.id === id; })[0];
  $("dmTitle").textContent = c ? dmName(otherOf(c)) : "Conversa";
  $("dmAv").textContent = c ? initial(dmName(otherOf(c))) : ""; $("dmAv").hidden = !c; $("dmSub").hidden = false;
  $("dmCompose").hidden = false; dmClearFile();
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

var dmFile = null;
function dmClearFile(){ dmFile = null; $("dmAttach").hidden = true; $("dmAttachName").textContent = ""; }
function niceSize(n){ return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
$("dmFile").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = "";
  if (!f) return;
  var pdf = f.type === "application/pdf";
  if (pdf) {
    if (f.size > 5 * 1024 * 1024) return toast("O PDF tem mais de 5 MB.");
    dmFile = { blob: f, kind: "pdf", ext: "pdf", type: "application/pdf", name: f.name };
    $("dmAttachName").textContent = f.name + " · " + niceSize(f.size); $("dmAttach").hidden = false;
  } else {
    shrinkPhoto(f).then(function(blob){
      dmFile = { blob: blob, kind: "image", ext: "jpg", type: "image/jpeg", name: (f.name || "foto").replace(/\.[^.]+$/, "") + ".jpg" };
      $("dmAttachName").textContent = "Foto · " + niceSize(blob.size); $("dmAttach").hidden = false;
    }, function(){ toast("Envie uma foto (JPEG, PNG) ou um PDF de até 5 MB."); });
  }
});
$("dmAttachDel").addEventListener("click", dmClearFile);
function newId(){ return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function(){ return (Math.random() * 16 | 0).toString(16); }); }
$("dmComposer").addEventListener("submit", function(e){
  e.preventDefault();
  var texto = $("dmText").value.trim(), file = dmFile;
  if ((!texto && !file) || !dm.current || !sb) return;
  $("dmSend").disabled = true;
  var conv = dm.current, path = null, up = Promise.resolve();
  if (file) { path = conv + "/" + newId() + "." + file.ext; up = sb.storage.from("privado").upload(path, file.blob, { contentType: file.type, upsert: false }); }
  up.then(function(u){
    if (u && u.error) throw new Error("arquivo");
    var row = { conversa_id: conv, texto: texto };
    if (file) { row.arquivo = path; row.arquivo_nome = String(file.name).slice(0, 120); row.arquivo_tipo = file.kind; }
    return sb.from("dm_mensagens").insert(row).select("id,de,texto,criado_em,arquivo,arquivo_nome,arquivo_tipo").then(function(r){
      if (r.error || !r.data || !r.data.length) { if (path) sb.storage.from("privado").remove([path]); throw new Error(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "rapido" : "msg"); }
      return r.data[0];
    });
  }).then(function(m){
    $("dmText").value = ""; dmClearFile();
    if (conv === dm.current) { dm.msgs.push(m); return signDm([m]).then(function(){ renderDmMsgs(true); }); }
  }).catch(function(err){
    toast(err.message === "rapido" ? "Calma! Muitas mensagens em pouco tempo." : err.message === "arquivo" ? "Não foi possível enviar o arquivo." : "Não foi possível enviar. Essa pessoa pode ter bloqueado a conversa.");
  }).then(function(){ $("dmSend").disabled = false; });
});
$("dmAccept").addEventListener("change", function(){
  var on = $("dmAccept").checked;
  sb.from("perfis").update({ aceita_dm: on }).eq("user_id", me()).then(function(r){ toast(r.error ? "Não foi possível salvar." : on ? "Você voltou a receber mensagens privadas." : "Mensagens privadas desligadas."); });
});

function startDm(){
  stopDm(); loadConvs().then(function(){ renderDmMsgs(true); }); loadPeople();
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
