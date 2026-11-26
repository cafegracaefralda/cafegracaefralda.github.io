// Mensagens privadas entre pais (só os dois participantes leem): texto, emojis, foto e áudio, em tempo real. Precisa de login.
var dm = { urls: {}, convs: [], names: {}, unread: {}, blocked: {}, current: null, msgs: [], sig: "", timer: null, badgeTimer: null, profiled: "", channel: null };
var dmMsgsEl = $("dmMsgs");
function me(){ return auth.user ? auth.user.id : ""; }
function otherOf(c){ return c.a === me() ? c.b : c.a; }
function dmName(uid){ return dm.names[uid] || "Alguém"; }
function setBadge(n){ $$(".js-dmbadge").forEach(function(b){ b.textContent = n > 9 ? "9+" : String(n); b.hidden = !n; }); }
function totalUnread(){ var t = 0; Object.keys(dm.unread).forEach(function(k){ t += dm.unread[k]; }); return t; }

function renderDmList(){
  var box = $("dmList"); box.innerHTML = "";
  if (!dm.convs.length) { box.appendChild(h("p", "hint", "Nenhuma conversa ainda.")); box.firstChild.style.padding = "12px"; return; }
  dm.convs.forEach(function(c){
    var o = otherOf(c), b = h("button", "room"); b.type = "button"; b.setAttribute("aria-pressed", dm.current === c.id);
    var n = dm.unread[c.id] || 0;
    if (n) b.appendChild(h("span", "nb", String(n)));
    var tx = h("span", "rtx"); tx.append(document.createTextNode(dmName(o)), h("small", null, ago(c.ultima_em)));
    b.append(avSpan(o, dmName(o)), tx);
    b.addEventListener("click", function(){ openConv(c.id); });
    box.appendChild(b);
  });
}
function renderPeople(list){
  var box = $("dmPeople"); box.innerHTML = "";
  if (!list.length) { box.appendChild(h("p", "hint", $("dmSearch").value.trim() ? "Ninguém com esse nome." : "Ainda não há outras pessoas aqui.")); return; }
  list.forEach(function(x){
    var b = h("button", "room"); b.type = "button"; var tx = h("span", "rtx"); tx.append(document.createTextNode(x.nome || "Alguém"), h("small", null, "Conversar no privado"));
    b.append(avSpan(x.user_id, x.nome), tx);
    b.addEventListener("click", function(){ openDm(x.user_id, x.nome || "Alguém"); });
    box.appendChild(b);
  });
}
function loadPeople(){
  if (!sb || !auth.user) return;
  var term = $("dmSearch").value.trim().replace(/[^A-Za-zÀ-ÿ ]/g, "").slice(0, 40);
  if (!term) { $("dmPeople").innerHTML = ""; return; }
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
  var rep = h("a", null, "Denunciar"); rep.href = waLink("Oi! Quero denunciar uma pessoa nas mensagens privadas: " + dmName(o) + ". Motivo: "); rep.target = "_blank"; rep.rel = "noopener";
  t.append(bl, rep);
}

// Foto e áudio
var AUDIO_VIDA = 72 * 3600 * 1000;   // o áudio some 72 horas depois de enviado
function audioVencido(m){ return m.arquivo_tipo === "audio" && Date.now() - new Date(m.criado_em).getTime() > AUDIO_VIDA; }
function fileView(m){
  if (audioVencido(m)) return h("p", "file-off", "🎙️ Áudio expirado (some em 72 h)");
  var url = dm.urls[m.arquivo];
  if (!url) return h("p", "file-off", "Arquivo indisponível");
  if (m.arquivo_tipo === "audio") { var au = h("audio", "audio-msg"); au.controls = true; au.preload = "none"; au.src = url; return au; }
  if (m.arquivo_tipo === "pdf") { var pa = h("a", "file-pdf"); pa.href = url; pa.target = "_blank"; pa.rel = "noopener noreferrer"; pa.append(h("span", null, "📄"), h("b", null, m.arquivo_nome || "Documento.pdf"), h("small", null, "Toque para abrir")); return pa; }
  var a = h("a", "file-a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
  var im = h("img", "file-img"); im.src = url; im.alt = "Foto enviada"; im.loading = "lazy"; a.appendChild(im);
  return a;
}
function signDm(msgs){
  var paths = msgs.filter(function(m){ return !audioVencido(m); }).map(function(m){ return m.arquivo; }).filter(function(x){ return x && !dm.urls[x]; });
  if (!paths.length || !sb) return Promise.resolve();
  return sb.storage.from("privado").createSignedUrls(paths, 3600).then(function(r){ (r.data || []).forEach(function(x){ if (x.signedUrl && x.path) dm.urls[x.path] = x.signedUrl; }); }, function(){});
}
function renderDmMsgs(force){
  var sig = dm.current + ":" + dm.msgs.length + ":" + (dm.msgs.length ? dm.msgs[dm.msgs.length - 1].id : "") + ":" + dm.msgs.filter(function(x){ return x.editado_em; }).length;
  if (!force && sig === dm.sig) return;
  dm.sig = sig;
  var nearEnd = dmMsgsEl.scrollHeight - dmMsgsEl.scrollTop - dmMsgsEl.clientHeight < 120;
  dmMsgsEl.innerHTML = "";
  if (!dm.current) {
    var e = h("div", "empty dm-blank"); e.append(h("span", "dm-ico", "💬"), h("h3", null, "Suas mensagens"));
    dmMsgsEl.appendChild(e); return;
  }
  if (!dm.msgs.length) {
    var e2 = h("div", "empty"); e2.append(h("h3", null, "Diga um oi 👋"), h("p", null, "Comece a conversa."));
    dmMsgsEl.appendChild(e2); return;
  }
  dm.msgs.forEach(function(m){
    var mine = m.de === me(), row = h("div", "msg" + (mine ? " me" : "")), bub = h("div", "bubble"), top = h("div", "bubble-top");
    row.appendChild(avSpan(mine ? me() : m.de, mine ? auth.name() : dmName(m.de)));
    top.append(h("b", null, mine ? "Você" : dmName(m.de)), h("time", null, ago(m.criado_em) + (m.editado_em ? " · editado" : "")));
    bub.appendChild(top);
    if (m.arquivo) bub.appendChild(fileView(m));
    var mtx = null; if (m.texto) { mtx = h("p", null, m.texto); bub.appendChild(mtx); }
    if (mine && m.texto && !m.arquivo && podeEditar(m.criado_em)) { var me2 = h("button", "link dm-edit", "Editar"); me2.type = "button"; me2.addEventListener("click", function(){ editarInline(mtx, m.texto, 1000, function(v){ return salvarTexto("dm_mensagens", m.id, v, function(n){ m.texto = n.texto; m.editado_em = n.editado_em; renderDmMsgs(true); }); }); me2.remove(); }); top.appendChild(me2); }
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
    setBadge(totalUnread());
    if (!ids.length) return;
    return sb.from("perfis").select("user_id,nome").in("user_id", ids).then(function(p){ (p.data || []).forEach(function(x){ dm.names[x.user_id] = x.nome; }); });
  }).then(function(){ renderDmList(); renderDmTools(); });
}
function markConvRead(id){
  if (!dm.unread[id]) return;
  sb.rpc("marcar_lidas", { p_conversa: id }).then(function(){ dm.unread[id] = 0; setBadge(totalUnread()); renderDmList(); if (typeof loadNotifs === "function") loadNotifs(); });
}
var DM_COLS = "id,conversa_id,de,texto,criado_em,arquivo,arquivo_nome,arquivo_tipo,editado_em";
function loadDmMsgs(force){
  var id = dm.current; if (!id || !sb) return;
  sb.from("dm_mensagens").select(DM_COLS).eq("conversa_id", id).order("criado_em", { ascending: false }).limit(100).then(function(r){
    if (id !== dm.current || !r.data) return;
    dm.msgs = r.data.slice().reverse();
    signDm(dm.msgs).then(function(){ if (id === dm.current) renderDmMsgs(!!force); });
    markConvRead(id);
  });
}
function setHeader(c){
  $("dmTitle").textContent = c ? dmName(otherOf(c)) : "Conversa de quarto";
  $("dmAv").textContent = c ? initial(dmName(otherOf(c))) : ""; avTag($("dmAv"), c ? otherOf(c) : ""); $("dmAv").hidden = !c;
}
function openConv(id){
  dm.current = id; dm.msgs = []; dm.sig = "";
  var c = dm.convs.filter(function(x){ return x.id === id; })[0];
  setHeader(c);
  $("dmCompose").hidden = false; dmClearFile(); $("emojiPop").hidden = true;
  $("dmApp").classList.add("thread"); document.body.classList.add("dm-thread");
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
    go("mensagens");
    loadConvs().then(function(){ openConv(id); });
  });
}

/* ---------- Enviar: texto, emoji, foto ou áudio ---------- */
var dmFile = null;
function dmClearFile(){ dmFile = null; $("dmAttach").hidden = true; $("dmAttachName").textContent = ""; }
function niceSize(n){ return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
$("dmFile").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = "";
  if (!f) return;
  shrinkPhoto(f).then(function(blob){
    dmFile = { blob: blob, kind: "image", ext: "jpg", type: "image/jpeg", name: (f.name || "foto").replace(/\.[^.]+$/, "") + ".jpg" };
    $("dmAttachName").textContent = "Foto · " + niceSize(blob.size); $("dmAttach").hidden = false;
  }, function(){ toast("Envie uma foto (JPEG ou PNG). Vídeo não é aceito."); });
});
$("dmPdf").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = "";
  if (!f) return;
  if (f.type !== "application/pdf") return toast("Envie um arquivo PDF.");
  if (f.size > 5 * 1024 * 1024) return toast("O PDF é grande demais (máximo 5 MB).");
  dmFile = { blob: f, kind: "pdf", ext: "pdf", type: "application/pdf", name: String(f.name || "documento.pdf").slice(0, 110) };
  $("dmAttachName").textContent = "PDF · " + niceSize(f.size); $("dmAttach").hidden = false;
});
$("dmAttachDel").addEventListener("click", dmClearFile);

function sendDm(texto, file){
  var conv = dm.current;
  if ((!texto && !file) || !conv || !sb) return Promise.resolve();
  $("dmSend").disabled = true;
  var path = null, up = Promise.resolve();
  if (file) { path = conv + "/" + newUuid() + "." + file.ext; up = sb.storage.from("privado").upload(path, file.blob, { contentType: file.type, upsert: false }); }
  return up.then(function(u){
    if (u && u.error) throw new Error("arquivo");
    var row = { conversa_id: conv, texto: texto };
    if (file) { row.arquivo = path; row.arquivo_nome = String(file.name).slice(0, 120); row.arquivo_tipo = file.kind; }
    return sb.from("dm_mensagens").insert(row).select(DM_COLS).then(function(r){
      if (r.error || !r.data || !r.data.length) { if (path) sb.storage.from("privado").remove([path]); throw new Error(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "rapido" : "msg"); }
      return r.data[0];
    });
  }).then(function(m){
    if (conv === dm.current && !dm.msgs.some(function(x){ return x.id === m.id; })) { dm.msgs.push(m); return signDm([m]).then(function(){ renderDmMsgs(true); }); }
  }).catch(function(err){
    toast(err.message === "rapido" ? "Calma! Muitas mensagens em pouco tempo." : err.message === "arquivo" ? "Não foi possível enviar o arquivo." : "Não foi possível enviar. Essa pessoa pode ter bloqueado a conversa.");
  }).then(function(){ $("dmSend").disabled = false; });
}
$("dmComposer").addEventListener("submit", function(e){
  e.preventDefault();
  var texto = $("dmText").value.trim(), file = dmFile;
  if (!texto && !file) return;
  $("dmText").value = ""; dmClearFile(); $("emojiPop").hidden = true;
  sendDm(texto, file);
});

// Emojis
var EMOJIS = "😀 😁 😂 🥹 😊 😍 🥰 😘 😉 😎 🤗 🤔 😴 😢 😭 😅 🙏 🙌 👏 👍 💪 🤝 ❤️ 🧡 💛 💚 💙 💜 🤍 💕 ✨ 🔥 🌟 ☕ 🍼 👶 🧸 👨‍👩‍👧 🏡 📖 ✝️ 🕊️ 🌿 🌅 🎉 🎂 🥳 😇 🤲 🫶 😌 😬 🙈 💡 🍞 🥣 🧺 🌧️ ☀️".split(" ");
(function buildEmoji(){
  var box = $("emojiPop");
  EMOJIS.forEach(function(em){
    var b = h("button", null, em); b.type = "button"; b.setAttribute("aria-label", em);
    b.addEventListener("click", function(){
      var inp = $("dmText"), s = inp.selectionStart == null ? inp.value.length : inp.selectionStart, e2 = inp.selectionEnd == null ? s : inp.selectionEnd;
      if (inp.value.length + em.length > 1000) return;
      inp.value = inp.value.slice(0, s) + em + inp.value.slice(e2); var pos = s + em.length; inp.focus(); try { inp.setSelectionRange(pos, pos); } catch(x){}
    });
    box.appendChild(b);
  });
})();
$("dmEmoji").addEventListener("click", function(e){ e.stopPropagation(); $("emojiPop").hidden = !$("emojiPop").hidden; });
document.addEventListener("click", function(e){ if (!$("emojiPop").hidden && !$("emojiPop").contains(e.target)) $("emojiPop").hidden = true; });

// Áudio (gravação pelo navegador, até 2 minutos)
var AUDIO_MAX = 60;
var rec = { mr: null, chunks: [], stream: null, t0: 0, timer: null };
var AUDIO_EXT = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3" };
function recUi(on){ $("dmRec").hidden = !on; $("dmMic").hidden = on; }
function recFinish(send){
  clearInterval(rec.timer); rec.timer = null;
  var mr = rec.mr; if (!mr) return;
  mr.onstop = function(){
    if (rec.stream) rec.stream.getTracks().forEach(function(t){ t.stop(); });
    var chunks = rec.chunks; rec.mr = null; rec.stream = null; rec.chunks = [];
    if (!send || !chunks.length) return;
    var base = String(mr.mimeType || chunks[0].type || "audio/webm").split(";")[0];
    var ext = AUDIO_EXT[base];
    var blob = new Blob(chunks, { type: base });
    if (!ext) return toast("Este navegador gravou num formato não aceito.");
    if (blob.size > 5 * 1024 * 1024) return toast("O áudio ficou grande demais (máximo 5 MB).");
    sendDm("", { blob: blob, kind: "audio", ext: ext, type: base, name: "Áudio" });
  };
  try { mr.stop(); } catch(e){}
  recUi(false);
}
$("dmMic").addEventListener("click", function(){
  if (!dm.current) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast("Este navegador não grava áudio.");
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream){
    var mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].filter(function(t){ return MediaRecorder.isTypeSupported(t); })[0];
    rec.stream = stream; rec.chunks = [];
    var opt = { audioBitsPerSecond: 24000 }; if (mime) opt.mimeType = mime;   // voz leve: 1 minuto fica em torno de 200 KB
    rec.mr = new MediaRecorder(stream, opt);
    rec.mr.ondataavailable = function(e){ if (e.data && e.data.size) rec.chunks.push(e.data); };
    rec.mr.start(); rec.t0 = Date.now(); recUi(true); $("dmRecTime").textContent = "0:00 / 1:00";
    rec.timer = setInterval(function(){
      var s = Math.floor((Date.now() - rec.t0) / 1000); $("dmRecTime").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " / 1:00";
      if (s >= AUDIO_MAX) recFinish(true);
    }, 500);
  }, function(){ toast("Permita o microfone para gravar um áudio."); });
});
$("dmRecSend").addEventListener("click", function(){ recFinish(true); });
$("dmRecCancel").addEventListener("click", function(){ recFinish(false); });

$("dmAccept").addEventListener("change", function(){
  var on = $("dmAccept").checked;
  sb.from("perfis").update({ aceita_dm: on }).eq("user_id", me()).then(function(r){ toast(r.error ? "Não foi possível salvar." : on ? "Você voltou a receber mensagens privadas." : "Mensagens privadas desligadas."); });
});

/* ---------- Tempo real e atualização ---------- */
function onRealtime(m){
  if (!m) return;
  if (m.conversa_id === dm.current && !dm.msgs.some(function(x){ return x.id === m.id; })) {
    dm.msgs.push(m);
    signDm([m]).then(function(){ renderDmMsgs(true); });
    if (m.de !== me() && isShown("mensagens")) { dm.unread[m.conversa_id] = (dm.unread[m.conversa_id] || 0) + 1; markConvRead(m.conversa_id); }
  }
  loadConvs();
  if (m.de !== me() && typeof loadNotifs === "function") loadNotifs();
}
function subRealtime(){
  if (dm.channel || !sb || !auth.user || !sb.channel) return;
  try {
    dm.channel = sb.channel("dm-" + me()).on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_mensagens" }, function(p){ onRealtime(p && p.new); }).subscribe();
  } catch(e){ dm.channel = null; }
}
function unsubRealtime(){ try { if (dm.channel && sb) sb.removeChannel(dm.channel); } catch(e){} dm.channel = null; }

function startDm(){
  stopDm(); setTimeout(function(){ if (typeof dmLimparAudios === "function") dmLimparAudios(); }, 1500); loadConvs().then(function(){ renderDmMsgs(true); }); loadPeople();
  sb.from("perfis").select("aceita_dm").eq("user_id", me()).maybeSingle().then(function(r){ if (r.data) $("dmAccept").checked = r.data.aceita_dm !== false; });
  dm.timer = setInterval(function(){ if (!document.hidden) { loadConvs(); loadDmMsgs(false); } }, 6000);
}
function stopDm(){ if (dm.timer) { clearInterval(dm.timer); dm.timer = null; } }
$("dmBack").addEventListener("click", function(){
  $("dmApp").classList.remove("thread"); document.body.classList.remove("dm-thread");
  dm.current = null; dm.msgs = []; dm.sig = ""; setHeader(null); $("dmCompose").hidden = true; $("dmSub").hidden = true; $("dmTools").innerHTML = "";
  renderDmList(); renderDmMsgs(true); loadConvs();
});
viewHooks.mensagens = function(){ if (auth.user) startDm(); };

// Perfil criado no primeiro login, tempo real ligado e selo de mensagens novas
auth.on(function(){
  if (!auth.user || !sb) { unsubRealtime(); dm = { urls: {}, convs: [], names: {}, unread: {}, blocked: {}, current: null, msgs: [], sig: "", timer: dm.timer, badgeTimer: dm.badgeTimer, profiled: "", channel: null }; setBadge(0); return; }
  if (dm.profiled !== me()) { dm.profiled = me(); sb.rpc("garantir_perfil").then(function(){}); }
  subRealtime();
  if (isShown("mensagens") && !dm.timer) startDm();
  if (!dm.badgeTimer) {
    var count = function(){
      if (!auth.user || document.hidden || dm.timer) return;
      sb.from("dm_mensagens").select("id", { count: "exact", head: true }).eq("lida", false).neq("de", me()).then(function(r){ if (r.count != null) setBadge(r.count); });
    };
    count(); dm.badgeTimer = setInterval(count, 45000);
  }
});
renderDmMsgs(true);

// Limpeza dos áudios com mais de 72 horas (arquivo e mensagem): roda quando a pessoa abre as Mensagens
var limpando = false;
function dmLimparAudios(){
  if (limpando || !sb || !auth.user) return; limpando = true;
  sb.rpc("dm_audios_vencidos").then(function(r){
    var paths = (r && r.data) || [];
    if (!paths.length) return;
    return sb.storage.from("privado").remove(paths).then(function(x){
      if (x && x.error) return;
      return sb.rpc("dm_expirar_audios").then(function(){ if (dm.current) loadDmMsgs(true); });
    });
  }).catch(function(){}).then(function(){ limpando = false; });
}
var _hookMsgs = viewHooks.mensagens;
viewHooks.mensagens = function(a){ if (_hookMsgs) _hookMsgs(a); dmLimparAudios(); };
