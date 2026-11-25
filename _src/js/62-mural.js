// Mesa Grande: o cantinho das famílias (posts com foto, curtidas e comentários). Só para quem entrou com o Google.
var TIPOS = [
  { id: "conversa", nome: "Papo de mesa", em: "☕" }, { id: "indicacao", nome: "Indicação", em: "💡" }, { id: "desabafo", nome: "Desabafo", em: "🫶" },
  { id: "oracao", nome: "Oração", em: "🙏" }, { id: "gratidao", nome: "Gratidão", em: "✨" }
];
var TIPO_NOME = {}; TIPOS.forEach(function(t){ TIPO_NOME[t.id] = t.em + " " + t.nome; });
var feed = { tipo: "conversa", filtro: "all", posts: [], likes: {}, cmts: {}, urls: {}, open: {}, loaded: false, more: false, photo: null, busy: false, tok: 0, focus: "", members: [] };
var PAGE = 15;

function uid(){ return auth.user ? auth.user.id : ""; }

// Filtro da Mesa por tipo de publicação
(function buildChips(){
  var fil = $("feedTypes");
  [{ id: "all", nome: "Tudo", em: "" }].concat(TIPOS).forEach(function(t){
    var b = h("button", "chip", (t.em ? t.em + " " : "") + t.nome); b.type = "button"; b.setAttribute("aria-pressed", t.id === "all");
    b.addEventListener("click", function(){ feed.filtro = t.id; $$(".chip", fil).forEach(function(x){ x.setAttribute("aria-pressed", x === b); }); loadFeed(true); });
    fil.appendChild(b);
  });
})();

// Foto: reduz para no máximo 1280 px e salva como JPEG novo (isso também apaga a localização e os dados da câmera)
function shrinkPhoto(file){
  return new Promise(function(resolve, reject){
    if (!/^image\//.test(file.type)) return reject(new Error("tipo"));
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var max = 1280, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ if (b && b.size <= 3 * 1024 * 1024) resolve(b); else reject(new Error("tamanho")); }, "image/jpeg", 0.82);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("tipo")); };
    img.src = url;
  });
}
function newUuid(){ return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function(){ return (Math.random() * 16 | 0).toString(16); }); }
$("postFile").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = "";
  if (!f) return;
  shrinkPhoto(f).then(function(blob){
    feed.photo = blob;
    $("postPhotoImg").src = URL.createObjectURL(blob); $("postPhoto").hidden = false;
  }, function(){ toast("Não consegui usar essa foto. Escolha uma imagem menor."); });
});
function clearPhoto(){ feed.photo = null; $("postPhoto").hidden = true; $("postPhotoImg").removeAttribute("src"); }
$("postPhotoDel").addEventListener("click", clearPhoto);

// Publicar
$("postForm").addEventListener("submit", function(e){
  e.preventDefault();
  var texto = $("postText").value.trim();
  if (!texto || !sb || !auth.user || feed.busy) return;
  feed.busy = true; $("postSend").disabled = true;
  var path = null, up = Promise.resolve();
  if (feed.photo) {
    path = uid() + "/" + newUuid() + ".jpg";
    up = sb.storage.from("mural").upload(path, feed.photo, { contentType: "image/jpeg", upsert: false });
  }
  up.then(function(u){
    if (u && u.error) { var ef = new Error("foto"); ef.detail = u.error.message || ""; throw ef; }
    return sb.from("posts").insert({ tipo: $("postTipo").value || "conversa", texto: texto, foto: path }).select("id,user_id,nome,tipo,texto,foto,criado_em").then(function(r){
      if (r.error || !r.data || !r.data.length) {
        if (path) sb.storage.from("mural").remove([path]);
        var er = new Error(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "rapido" : "post"); er.detail = r.error ? (r.error.message || r.error.code || "") : "sem resposta"; throw er;
      }
      return r.data[0];
    });
  }).then(function(p){
    $("postText").value = ""; clearPhoto();
    if (feed.filtro === "all" || feed.filtro === p.tipo) { feed.posts.unshift(p); feed.likes[p.id] = []; feed.cmts[p.id] = []; signPhotos([p]).then(renderFeed); }
    toast("Publicado na Mesa Grande."); setStatus($("postStatus"), "");
  }).catch(function(err){
    var msg = err.message === "rapido" ? "Calma! Muitas publicações em pouco tempo." : err.message === "foto" ? "Não foi possível enviar a foto." : "Não foi possível publicar agora. Tente de novo.";
    setStatus($("postStatus"), msg + (err.detail ? " (Detalhe técnico: " + err.detail + ")" : ""), "err"); toast(msg);
  }).then(function(){ feed.busy = false; $("postSend").disabled = false; });
});

// Carregar a Mesa
function signPhotos(posts){
  var paths = posts.map(function(p){ return p.foto; }).filter(function(f){ return f && !feed.urls[f]; });
  if (!paths.length) return Promise.resolve();
  return sb.storage.from("mural").createSignedUrls(paths, 3600).then(function(r){
    (r.data || []).forEach(function(x){ if (x.signedUrl && x.path) feed.urls[x.path] = x.signedUrl; });
  }, function(){});
}
function loadFeed(reset){
  if (!sb || !auth.user) return;
  var tok = ++feed.tok, base = reset ? [] : feed.posts;
  if (reset) { feed.posts = []; feed.loaded = false; }
  var q = sb.from("posts").select("id,user_id,nome,tipo,texto,foto,aprovado,criado_em").order("criado_em", { ascending: false }).range(base.length, base.length + PAGE - 1);
  if (feed.filtro !== "all") q = q.eq("tipo", feed.filtro);
  q.then(function(r){
    if (!r.data || tok !== feed.tok) return;
    var fresh = r.data, ids = fresh.map(function(p){ return p.id; });
    feed.more = fresh.length === PAGE;
    if (!ids.length) { feed.loaded = true; renderFeed(); return; }
    return Promise.all([
      sb.from("post_curtidas").select("post_id,user_id").in("post_id", ids),
      sb.from("post_comentarios").select("id,post_id,user_id,nome,texto,criado_em").in("post_id", ids).order("criado_em", { ascending: true }),
      signPhotos(fresh)
    ]).then(function(x){
      if (tok !== feed.tok) return;
      fresh.forEach(function(p){ feed.likes[p.id] = []; feed.cmts[p.id] = []; });
      (x[0].data || []).forEach(function(l){ (feed.likes[l.post_id] = feed.likes[l.post_id] || []).push(l.user_id); });
      (x[1].data || []).forEach(function(c){ (feed.cmts[c.post_id] = feed.cmts[c.post_id] || []).push(c); });
      feed.posts = base.concat(fresh); feed.loaded = true; renderFeed();
    });
  });
}
$("feedMore").addEventListener("click", function(){ loadFeed(false); });

// Quem está na mesa (como os "stories": toque para chamar no privado)
function loadMembers(){
  if (!sb || !auth.user) return;
  sb.from("perfis").select("user_id,nome").neq("user_id", uid()).order("criado_em", { ascending: false }).limit(300).then(function(r){
    if (!r.data) return;
    feed.members = r.data; renderMembers();
  });
}
function renderMembers(){
  var side = $("sidePeople"), q = ($("sideBusca").value || "").trim().toLowerCase(); side.innerHTML = "";
  if (!q) return;
  var achou = feed.members.filter(function(p){ return String(p.nome || "").toLowerCase().indexOf(q) > -1; }).slice(0, 6);
  achou.forEach(function(p){
    var s = h("button", "side-person"); s.type = "button"; var tx = h("span"); tx.append(h("b", null, p.nome || "Alguém"), h("small", null, "Ver perfil"));
    s.append(h("span", "avatar", initial(p.nome)), tx); s.addEventListener("click", function(){ go("perfil/" + p.user_id); });
    side.appendChild(s);
  });
  if (!achou.length) side.appendChild(h("p", "hint", "Ninguém com esse nome."));
}
$("sideBusca").addEventListener("input", renderMembers);

// Desenhar
function renderFeed(){
  var box = $("feedList"); box.innerHTML = "";
  $("feedMore").hidden = !feed.more;
  if (!feed.posts.length) {
    var e = h("div", "empty card"); e.append(h("h3", null, feed.loaded ? "Seja a primeira pessoa a publicar" : "Carregando…"), h("p", null, ""));
    box.appendChild(e); return;
  }
  feed.posts.forEach(function(p){ box.appendChild(renderPost(p)); });
  if (feed.focus) { var fe = $("post-" + feed.focus); if (fe) { feed.focus = ""; fe.classList.add("focus"); fe.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(function(){ fe.classList.remove("focus"); }, 2400); } }
}
function actBtn(label, ic, fn, cls){
  var b = h("button", cls || null); b.type = "button"; b.append(icon(ic), document.createTextNode(label)); b.addEventListener("click", fn); return b;
}
function renderPost(p){
  var mine = p.user_id === uid(), el = h("article", "post"); el.id = "post-" + p.id;
  var top = h("div", "post-top"), who = h("div", "grow");
  who.append(nameLink(mine ? "Você" : p.nome, p.user_id), h("small", null, ago(p.criado_em) + " · " + (TIPO_NOME[p.tipo] || TIPO_NOME.conversa) + (p.aprovado === false ? " · em análise" : "")));
  top.append(h("span", "avatar", initial(p.nome)), who);
  // menu ⋯ (apagar / denunciar)
  var mw = h("div", "pmenu-wrap"), mb = h("button", "pmore", "⋯"); mb.type = "button"; mb.setAttribute("aria-label", "Mais opções"); mb.setAttribute("aria-haspopup", "true");
  var menu = h("div", "pmenu"); menu.hidden = true;
  if (mine || auth.admin) { var del = h("button", null, "Apagar"); del.type = "button"; del.addEventListener("click", function(){ menu.hidden = true; if (confirm("Apagar esta publicação?")) deletePost(p); }); menu.appendChild(del); }
  if (!mine) { var rep = h("button", null, "Denunciar"); rep.type = "button"; rep.addEventListener("click", function(){ menu.hidden = true; reportPost(p); }); menu.appendChild(rep); }
  mb.addEventListener("click", function(e){ e.stopPropagation(); var open = menu.hidden; $$(".pmenu").forEach(function(m2){ m2.hidden = true; }); menu.hidden = !open; });
  mw.append(mb, menu); top.appendChild(mw);
  var ptx = h("p", "post-text"); ptx.appendChild(richText(p.texto)); el.append(top, ptx);
  if (p.foto) {
    var im = h("img", "post-img"); im.alt = "Foto publicada por " + p.nome; im.loading = "lazy";
    if (feed.urls[p.foto]) im.src = feed.urls[p.foto]; else im.hidden = true;
    el.appendChild(im);
  }
  var likes = feed.likes[p.id] || [], liked = likes.indexOf(uid()) > -1, cm = feed.cmts[p.id] || [];
  var cnt = h("div", "post-count");
  cnt.append(h("span", null, likes.length ? "♥ " + likes.length + (likes.length === 1 ? " curtida" : " curtidas") : ""));
  var cb = h("button", null, cm.length ? cm.length + (cm.length === 1 ? " comentário" : " comentários") : ""); cb.type = "button"; cb.addEventListener("click", function(){ feed.open[p.id] = !feed.open[p.id]; renderFeed(); });
  cnt.appendChild(cb);
  if (likes.length || cm.length) el.appendChild(cnt);
  var acts = h("div", "post-acts");
  var lk = actBtn(liked ? "Curtiu" : "Curtir", "i-heart", function(){ toggleLike(p); }, liked ? "liked" : ""); lk.setAttribute("aria-pressed", liked); lk.setAttribute("aria-label", liked ? "Descurtir" : "Curtir");
  acts.append(lk, actBtn("Comentar", "i-chat", function(){ feed.open[p.id] = !feed.open[p.id]; renderFeed(); }));
  if (!mine) acts.appendChild(actBtn("Mensagem", "i-send", function(){ openDm(p.user_id, p.nome); }));
  el.appendChild(acts);
  if (feed.open[p.id] || cm.length) el.appendChild(renderCmts(p, cm, !!feed.open[p.id]));
  return el;
}
function renderCmts(p, cm, open){
  var box = h("div", "post-cmts"), list = open ? cm : cm.slice(-1);
  if (!open && cm.length > 1) { var all = h("button", "link", "Ver todos os " + cm.length + " comentários"); all.type = "button"; all.style.cssText = "font-size:13px;font-weight:500;color:var(--muted);text-decoration:none;justify-self:start"; all.addEventListener("click", function(){ feed.open[p.id] = true; renderFeed(); }); box.appendChild(all); }
  list.forEach(function(c){
    var row = h("div", "post-cmt"), body = h("div"), pp = h("p");
    pp.append(h("b", null, c.user_id === uid() ? "Você" : c.nome), richText(c.texto));
    if (open && (c.user_id === uid() || auth.admin)) {
      var d = h("button", "link", "Apagar"); d.type = "button";
      d.addEventListener("click", function(){ sb.from("post_comentarios").delete().eq("id", c.id).then(function(r){ if (r.error) return toast("Não foi possível apagar."); feed.cmts[p.id] = feed.cmts[p.id].filter(function(x){ return x.id !== c.id; }); renderFeed(); }); });
      pp.appendChild(d);
    }
    body.appendChild(pp); row.append(h("span", "avatar", initial(c.nome)), body); box.appendChild(row);
  });
  if (open) {
    var f = h("form", "post-cmt-form"), inp = h("input"); inp.placeholder = "Escreva um comentário…"; inp.maxLength = 600; inp.setAttribute("aria-label", "Comentário");
    var send = h("button", "btn btn-terra btn-sm", "Enviar"); send.type = "submit"; f.append(inp, send);
    f.addEventListener("submit", function(e){
      e.preventDefault(); var t = inp.value.trim(); if (!t) return; send.disabled = true;
      sb.from("post_comentarios").insert({ post_id: p.id, texto: t }).select("id,post_id,user_id,nome,texto,criado_em").then(function(r){
        if (r.error || !r.data || !r.data.length) { send.disabled = false; return toast(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "Calma! Muitos comentários em pouco tempo." : "Não foi possível comentar agora."); }
        feed.cmts[p.id].push(r.data[0]); renderFeed();
      });
    });
    box.appendChild(f);
  }
  return box;
}
document.addEventListener("click", function(){ $$(".pmenu").forEach(function(m){ m.hidden = true; }); });
function toggleLike(p){
  if (!sb || !auth.user) return;
  var l = feed.likes[p.id] = feed.likes[p.id] || [], i = l.indexOf(uid());
  if (i > -1) { l.splice(i, 1); renderFeed(); sb.from("post_curtidas").delete().eq("post_id", p.id).eq("user_id", uid()).then(function(r){ if (r.error) { l.push(uid()); renderFeed(); } }); }
  else { l.push(uid()); renderFeed(); sb.from("post_curtidas").insert({ post_id: p.id }).then(function(r){ if (r.error) { var j = l.indexOf(uid()); if (j > -1) l.splice(j, 1); renderFeed(); } }); }
}
function deletePost(p){
  var rm = p.foto ? sb.storage.from("mural").remove([p.foto]) : Promise.resolve();
  Promise.resolve(rm).then(function(){ return sb.from("posts").delete().eq("id", p.id); }).then(function(r){
    if (r && r.error) return toast("Não foi possível apagar.");
    feed.posts = feed.posts.filter(function(x){ return x.id !== p.id; }); renderFeed(); toast("Publicação apagada.");
  });
}
function reportPost(p){
  if (!confirm("Denunciar esta publicação? Ela some da Mesa se outras pessoas também denunciarem, e a equipe revisa.")) return;
  sb.from("post_denuncias").insert({ post_id: p.id }).then(function(r){
    if (r.error && String(r.error.message || "").indexOf("duplicate") < 0) return toast("Não foi possível denunciar agora.");
    toast("Obrigado. Vamos olhar com cuidado.");
  });
}
auth.on(function(){ if (!auth.user) { feed.posts = []; feed.likes = {}; feed.cmts = {}; feed.urls = {}; feed.loaded = false; feed.members = []; $("feedList").innerHTML = ""; } });

function mesaSync(){ $("postAv").textContent = initial(auth.name()); if (auth.user) $("postText").placeholder = "No que você está pensando, " + firstName(auth.name()) + "?"; }
viewHooks.mesa = function(sub){
  if (!auth.user) return;
  mesaSync();
  if (!feed.loaded) loadFeed(true);
  loadMembers(); if (typeof loadStories === "function") loadStories();
};
auth.on(function(){ if (auth.user && isShown("mesa")) viewHooks.mesa(currentSub("mesa")); });
