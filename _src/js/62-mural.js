// Mesa: o cantinho das famílias (posts com foto, curtidas e comentários). Só para quem entrou com o Google.
var TIPOS = [
  { id: "conversa", nome: "Papo de mesa", em: "☕" }, { id: "indicacao", nome: "Indicação", em: "💡" }, { id: "desabafo", nome: "Desabafo", em: "🫶" },
  { id: "oracao", nome: "Oração", em: "🙏" }, { id: "gratidao", nome: "Gratidão", em: "✨" }
];
var TIPO_NOME = {}; TIPOS.forEach(function(t){ TIPO_NOME[t.id] = t.em + " " + t.nome; });
var feed = { seg: false, seguindo: [], tipo: "conversa", filtro: "all", posts: [], likes: {}, cmts: {}, urls: {}, open: {}, loaded: false, more: false, photo: null, busy: false, tok: 0, focus: "", members: [] };
var PAGE = 15;

// Convites para publicar (um por visita, sempre com o nome da pessoa)
var PH_IDX = Math.floor(Math.random() * 4);
function phCompartilhe(n){
  return ["Puxe a cadeira, " + n + ". O que vamos compartilhar hoje?", "Tem café na mesa, " + n + ". Conta pra gente…", "Compartilhe algo com a nossa comunidade, " + n + "…", "Uma dica, um desabafo ou uma graça do dia, " + n + "?"][PH_IDX];
}
function uid(){ return auth.user ? auth.user.id : ""; }

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
      nsfwGuard(c).then(function(){ c.toBlob(function(b){ if (b && b.size <= 3 * 1024 * 1024) resolve(b); else reject(new Error("tamanho")); }, "image/jpeg", 0.82); }, reject);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("tipo")); };
    img.src = url;
  });
}
function newUuid(){ return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function(){ return (Math.random() * 16 | 0).toString(16); }); }
// Publicar (estilo Instagram): foto -> legenda -> Compartilhar. Também dá para só escrever, ou só colocar um link.
var postDlg = $("postDlg");
var MAX_FOTOS = 3;
feed.photos = []; feed.pdf = null;   // fotos: [{ blob, url }]; pdf: { file, name } (só administração)
function pdVer(){
  var box = $("pdPhotos"); box.innerHTML = ""; box.hidden = !feed.photos.length;
  feed.photos.forEach(function(it, i){
    var w = h("div", "pd-th"), im = h("img"); im.src = it.url; im.alt = "Foto " + (i + 1); if (i === 0) im.id = "pdImg";
    var x = h("button", null, "×"); x.type = "button"; x.setAttribute("aria-label", "Tirar a foto " + (i + 1));
    x.addEventListener("click", function(){ URL.revokeObjectURL(it.url); feed.photos.splice(i, 1); pdVer(); });
    w.append(im, x); box.appendChild(w);
  });
  $("pdAddFoto").hidden = feed.photos.length >= MAX_FOTOS;
  $("pdAddFotoTx").textContent = feed.photos.length ? "Adicionar outra foto (" + feed.photos.length + "/" + MAX_FOTOS + ")" : "Adicionar foto (até " + MAX_FOTOS + ")";
  $("pdLinkRow").hidden = !auth.admin; $("pdAddPdf").hidden = !auth.admin; $("pdAddPdfTx").textContent = feed.pdf ? "PDF: " + feed.pdf.name + " (trocar)" : "Anexar PDF (só administração)";
}
function clearPhoto(){ feed.photos.forEach(function(it){ URL.revokeObjectURL(it.url); }); feed.photos = []; feed.pdf = null; $("pdLink").value = ""; pdVer(); }
function abrirPost(opts){
  opts = opts || {};
  $("pdAv").textContent = initial(auth.name()); avTag($("pdAv"), uid());
  var t = $("postText").value.trim(); if (t && !$("pdTexto").value) $("pdTexto").value = t;
  pdVer(); setStatus($("pdStatus"), "");
  if (!postDlg.open) postDlg.showModal();
  if (!opts.foto) $("pdTexto").focus();
}
function pegarFoto(){ $("postFile").click(); }
$("postFotoBtn").addEventListener("click", function(){ if (!auth.user) return; pegarFoto(); });
$("pdAddFoto").addEventListener("click", pegarFoto);
// Administração: link e PDF também direto na caixa da Mesa, junto com as fotos, na mesma postagem
function mesaAdmin(){ ["postLinkBtn", "postPdfBtn"].forEach(function(i){ $(i).hidden = !(auth.user && auth.admin); }); }
auth.on(mesaAdmin); mesaAdmin();
$("postLinkBtn").addEventListener("click", function(){ abrirPost({ foto: true }); $("pdLinkRow").hidden = false; $("pdLink").focus(); });
$("postPdfBtn").addEventListener("click", function(){ abrirPost({ foto: true }); $("postPdf").click(); });
$("pdAddPdf").addEventListener("click", function(){ $("postPdf").click(); });
$("postPdf").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = "";
  if (!f) return;
  if (f.type !== "application/pdf") return toast("Escolha um arquivo PDF.");
  if (f.size > 5 * 1024 * 1024) return toast("O PDF passa de 5 MB.");
  feed.pdf = { file: f, name: String(f.name || "documento.pdf").replace(/\.pdf$/i, "").slice(0, 100) + ".pdf" }; pdVer();
});
$("pdClose").addEventListener("click", function(){ postDlg.close(); });
$("hdrNew").addEventListener("click", function(){ if (!auth.user) return; abrirPost({}); });
$("postFile").addEventListener("change", function(){
  var fs = Array.prototype.slice.call(this.files || [], 0, Math.max(0, MAX_FOTOS - feed.photos.length)); this.value = "";
  if (!fs.length) { if (feed.photos.length >= MAX_FOTOS) toast("Máximo de " + MAX_FOTOS + " fotos por post."); return; }
  var chain = Promise.resolve();
  fs.forEach(function(f){
    chain = chain.then(function(){
      return shrinkPhoto(f).then(function(blob){ if (feed.photos.length < MAX_FOTOS) feed.photos.push({ blob: blob, url: URL.createObjectURL(blob) }); },
        function(e){ if (e && e.message === "nsfw") return; toast("Não consegui usar essa foto. Escolha uma imagem menor."); });
    });
  });
  chain.then(function(){ if (feed.photos.length) { abrirPost({ foto: true }); $("pdTexto").focus(); } });
});
// Link e áudio não entram na Mesa: são exclusivos de quem anuncia (Ofertas) e da Casa. Na Mesa só texto e foto.
var TEM_LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|io|app|me|ly)\b)/i;
function semLink(t, st){ if (TEM_LINK.test(t)) { setStatus(st, "Links são exclusivos de quem anuncia. Na Mesa, conte com as suas palavras. 😉", "err"); return false; } return true; }
function publicar(texto, st, done){
  if (!sb || !auth.user || feed.busy) return;
  feed.busy = true; $("postSend").disabled = true; $("pdEnviar").disabled = true;
  var fotos = feed.photos.map(function(x){ return x.blob; }), pdf = feed.pdf, paths = [], pdfPath = null, todos = [], lk = auth.admin ? $("pdLink").value.trim() : "";
  function limpar(){ if (todos.length) sb.storage.from("mural").remove(todos); }
  var ups = fotos.map(function(blob){
    var path = uid() + "/" + newUuid() + ".jpg"; todos.push(path);
    return sb.storage.from("mural").upload(path, blob, { contentType: "image/jpeg", upsert: false }).then(function(u){ if (u && u.error) { var ef = new Error("foto"); ef.detail = u.error.message || ""; throw ef; } paths.push(path); });
  });
  if (pdf && auth.admin) { pdfPath = uid() + "/" + newUuid() + ".pdf"; todos.push(pdfPath); ups.push(sb.storage.from("mural").upload(pdfPath, pdf.file, { contentType: "application/pdf", upsert: false }).then(function(u){ if (u && u.error) { var ef = new Error("foto"); ef.detail = u.error.message || ""; throw ef; } })); }
  Promise.all(ups).then(function(){
    var row = { tipo: "conversa", texto: texto }, novo = paths.length > 1 || !!pdfPath || !!lk, cols = "id,user_id,nome,tipo,texto,foto,criado_em,editado_em";
    if (paths.length) row.foto = paths[0];
    if (novo) { if (paths.length) row.fotos = paths; if (pdfPath) { row.anexo = pdfPath; row.anexo_nome = pdf.name; } if (lk) row.link = lk; cols += ",fotos,anexo,anexo_nome,link"; }
    return sb.from("posts").insert(row).select(cols).then(function(r){
      if (r.error || !r.data || !r.data.length) {
        limpar();
        var er = new Error(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "rapido" : "post"); er.detail = r.error ? (r.error.message || r.error.code || "") : "sem resposta"; throw er;
      }
      return r.data[0];
    });
  }).then(function(p){
    $("postText").value = ""; $("pdTexto").value = ""; clearPhoto(); if (postDlg.open) postDlg.close();
    if (feed.filtro === "all" || feed.filtro === p.tipo) { feed.posts.unshift(p); feed.likes[p.id] = []; feed.cmts[p.id] = []; signPhotos([p]).then(renderFeed); }
    toast("Publicado na Mesa."); setStatus($("postStatus"), "");
  }).catch(function(err){
    if (err.message === "foto") limpar();
    var msg = err.message === "rapido" ? "Calma! Muitas publicações em pouco tempo." : err.message === "foto" ? "Não foi possível enviar a foto." : "Não foi possível publicar agora. Tente de novo.";
    setStatus(st, msg + (err.detail ? " (Detalhe técnico: " + err.detail + ")" : ""), "err"); toast(msg);
  }).then(function(){ feed.busy = false; $("postSend").disabled = false; $("pdEnviar").disabled = false; });
}
$("postForm").addEventListener("submit", function(e){
  e.preventDefault();
  var texto = $("postText").value.trim(); if (!texto) return;
  if (!semLink(texto, $("postStatus"))) return;
  publicar(texto, $("postStatus"));
});
$("pdEnviar").addEventListener("click", function(){
  var t = $("pdTexto").value.trim(), st = $("pdStatus"), lk = auth.admin ? $("pdLink").value.trim() : "";
  if (lk && !/^https:\/\/[^\s]+\.[^\s]+$/.test(lk)) return setStatus(st, "O link precisa começar com https://", "err");
  if (!t && !feed.photos.length && !lk && !feed.pdf) return setStatus(st, "Escreva uma legenda, escolha uma foto, um PDF ou um link.", "err");
  if (!auth.admin && !semLink(t, st)) return;
  publicar(t || "📷", st);
});

// Carregar a Mesa
function signPhotos(posts){
  var paths = []; posts.forEach(function(p){ [p.foto].concat(p.fotos || [], [p.anexo]).forEach(function(f){ if (f && !feed.urls[f] && paths.indexOf(f) < 0) paths.push(f); }); });
  if (!paths.length) return Promise.resolve();
  return sb.storage.from("mural").createSignedUrls(paths, 3600).then(function(r){
    (r.data || []).forEach(function(x){ if (x.signedUrl && x.path) feed.urls[x.path] = x.signedUrl; });
  }, function(){});
}
function loadFeed(reset){
  if (!sb || !auth.user) return;
  var tok = ++feed.tok, base = reset ? [] : feed.posts;
  if (reset) { feed.posts = []; feed.loaded = false; }
  var COLS = "id,user_id,nome,tipo,texto,foto,aprovado,criado_em,editado_em";
  function consulta(cols){
    var q = sb.from("posts").select(cols).order("criado_em", { ascending: false }).range(base.length, base.length + PAGE - 1);
    if (feed.seg) q = q.in("user_id", feed.seguindo.length ? feed.seguindo : ["00000000-0000-0000-0000-000000000000"]);
    if (feed.filtro !== "all") q = q.eq("tipo", feed.filtro);
    return q;
  }
  consulta(COLS + ",fotos,anexo,anexo_nome,link").then(function(r){ return r.error ? consulta(COLS + ",fotos,anexo,anexo_nome") : r; }).then(function(r){ return r.error ? consulta(COLS) : r; }).then(function(r){
    if (!r.data || tok !== feed.tok) return;
    var fresh = r.data, ids = fresh.map(function(p){ return p.id; });
    feed.more = fresh.length === PAGE;
    if (!ids.length) { feed.loaded = true; renderFeed(); return; }
    return Promise.all([
      sb.from("post_curtidas").select("post_id,user_id").in("post_id", ids),
      sb.from("post_comentarios").select("id,post_id,user_id,nome,texto,criado_em,editado_em").in("post_id", ids).order("criado_em", { ascending: true }),
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
  if (document.activeElement !== $("sideBusca") && !q) return;
  var lista = q ? feed.members.filter(function(p){ return String(p.nome || "").toLowerCase().indexOf(q) > -1; }) : feed.members;
  var achou = lista.slice(0, q ? 8 : 5);
  if (!q && achou.length) side.appendChild(h("p", "hint", "Quem entrou há pouco"));
  achou.forEach(function(p){
    var s = h("button", "side-person"); s.type = "button"; var tx = h("span"); tx.append(h("b", null, p.nome || "Alguém"), h("small", null, "Ver perfil"));
    s.append(avSpan(p.user_id, p.nome), tx); s.addEventListener("mousedown", function(e){ e.preventDefault(); }); s.addEventListener("click", function(){ $("sideBusca").value = ""; $("sideBusca").blur(); side.innerHTML = ""; go("perfil/" + p.user_id); });
    side.appendChild(s);
  });
  if (q && !achou.length) { side.appendChild(h("p", "hint", "Ninguém com esse nome ainda.")); var iv = h("button", "link", "Convidar essa pessoa pelo WhatsApp"); iv.type = "button"; iv.addEventListener("mousedown", function(e){ e.preventDefault(); }); iv.addEventListener("click", function(){ if (typeof abrirConvite === "function") abrirConvite($("sideBusca").value.trim()); }); side.appendChild(iv); }
}
$("sideBusca").addEventListener("focus", renderMembers);
$("sideBusca").addEventListener("blur", function(){ setTimeout(function(){ if (document.activeElement !== $("sideBusca")) $("sidePeople").innerHTML = ""; }, 150); });
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
  who.append(nameLink(mine ? "Você" : p.nome, p.user_id), h("small", null, ago(p.criado_em) + (p.editado_em ? " · editado" : "") + (p.aprovado === false ? " · em análise" : "")));
  top.append(avLink(p.user_id, p.nome), who);
  // menu ⋯ (apagar / denunciar)
  var mw = h("div", "pmenu-wrap"), mb = h("button", "pmore", "⋯"); mb.type = "button"; mb.setAttribute("aria-label", "Mais opções"); mb.setAttribute("aria-haspopup", "true");
  var menu = h("div", "pmenu"); menu.hidden = true;
  if (mine && podeEditar(p.criado_em)) { var ed = h("button", null, "Editar"); ed.type = "button"; ed.addEventListener("click", function(){ menu.hidden = true; editarInline(ptx, p.texto, 1500, function(v){ return salvarTexto("posts", p.id, v, function(n){ p.texto = n.texto; p.editado_em = n.editado_em; renderFeed(); }); }); }); menu.appendChild(ed); }
  if (mine || auth.admin) { var del = h("button", null, "Apagar"); del.type = "button"; del.addEventListener("click", function(){ menu.hidden = true; if (confirm("Apagar esta publicação?")) deletePost(p); }); menu.appendChild(del); }
  if (!mine) { var rep = h("button", null, "Denunciar"); rep.type = "button"; rep.addEventListener("click", function(){ menu.hidden = true; reportPost(p); }); menu.appendChild(rep); }
  mb.addEventListener("click", function(e){ e.stopPropagation(); var open = menu.hidden; $$(".pmenu").forEach(function(m2){ m2.hidden = true; }); menu.hidden = !open; });
  mw.append(mb, menu); top.appendChild(mw);
  var ptx = h("p", "post-text"); ptx.appendChild(richText(p.texto)); el.append(top, ptx);
  if (String(p.texto || "").length > 260) { ptx.style.cssText = "display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden"; var vm = h("button", "post-more", "ver mais"); vm.type = "button"; vm.style.margin = "-6px 16px 10px"; vm.addEventListener("click", function(){ ptx.style.cssText = ""; vm.remove(); }); el.appendChild(vm); }
  var fl = p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []);
  if (fl.length) el.appendChild(galeria(fl.map(function(f){ return feed.urls[f] || ""; }), "Foto publicada por " + p.nome, function(){ if ((feed.likes[p.id] || []).indexOf(uid()) < 0) toggleLike(p); }));
  if (p.anexo && feed.urls[p.anexo]) {
    var an = h("a", "post-anexo"); an.href = feed.urls[p.anexo]; an.target = "_blank"; an.rel = "noopener noreferrer";
    var at = h("div"); at.append(h("b", null, p.anexo_nome || "Documento em PDF"), h("small", null, "Toque para abrir o PDF"));
    an.append(h("span", null, "📄"), at); el.appendChild(an);
  }
  if (p.link && /^https:\/\//.test(p.link)) {
    var lc = h("a", "post-anexo"); lc.href = p.link; lc.target = "_blank"; lc.rel = "noopener noreferrer nofollow"; var lt = h("div"); lt.append(h("b", null, p.link.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 50)), h("small", null, "Toque para abrir o link")); lc.append(h("span", null, "🔗"), lt); el.appendChild(lc);
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
  var sh = actBtn("Compartilhar", "i-share", function(){ var tx = "Olha o que a " + (mine ? "gente" : firstName(p.nome)) + " compartilhou na Café, Graça & Fralda:\n\n" + String(p.texto || "").slice(0, 300) + "\n\nVem para a mesa: https://cafegracaefralda.com.br/"; window.open(waLink(tx, ""), "_blank", "noopener"); });
  sh.classList.add("sh-b"); sh.setAttribute("aria-label", "Compartilhar no WhatsApp"); sh.title = "Compartilhar no WhatsApp"; acts.append(igBtn({ tag: "Mesa", title: "", body: String(p.texto || "").slice(0, 280) }, "ig-b"), sh);
  el.appendChild(acts);
  if (feed.open[p.id] || cm.length) el.appendChild(renderCmts(p, cm, !!feed.open[p.id]));
  return el;
}
function renderCmts(p, cm, open){
  var box = h("div", "post-cmts"), list = open ? cm : cm.slice(-1);
  if (!open && cm.length > 1) { var all = h("button", "link", "Ver todos os " + cm.length + " comentários"); all.type = "button"; all.style.cssText = "font-size:13px;font-weight:500;color:var(--muted);text-decoration:none;justify-self:start"; all.addEventListener("click", function(){ feed.open[p.id] = true; renderFeed(); }); box.appendChild(all); }
  list.forEach(function(c){
    var row = h("div", "post-cmt"), body = h("div"), pp = h("p");
    pp.append(nameLink(c.user_id === uid() ? "Você" : c.nome, c.user_id), richText(c.texto)); pp.appendChild(h("small", "c-time", ago(c.criado_em) + (c.editado_em ? " · editado" : "")));
    if (c.user_id === uid() && podeEditar(c.criado_em)) { var ce = h("button", "link", "Editar"); ce.type = "button"; ce.addEventListener("click", function(){ editarInline(pp, c.texto, 600, function(v){ return salvarTexto("post_comentarios", c.id, v, function(n){ c.texto = n.texto; c.editado_em = n.editado_em; renderFeed(); }); }); }); pp.appendChild(ce); }
    if (open && (c.user_id === uid() || auth.admin)) {
      var d = h("button", "link", "Apagar"); d.type = "button";
      d.addEventListener("click", function(){ sb.from("post_comentarios").delete().eq("id", c.id).then(function(r){ if (r.error) return toast("Não foi possível apagar."); feed.cmts[p.id] = feed.cmts[p.id].filter(function(x){ return x.id !== c.id; }); renderFeed(); }); });
      pp.appendChild(d);
    }
    body.appendChild(pp); row.append(avLink(c.user_id, c.nome), body); box.appendChild(row);
  });
  if (open) {
    var f = h("form", "post-cmt-form"), inp = h("input"); inp.placeholder = "Escreva um comentário…"; inp.maxLength = 600; inp.setAttribute("aria-label", "Comentário");
    var send = h("button", "cm-send", "↑"); send.type = "submit"; send.setAttribute("aria-label", "Enviar comentário"); f.append(avSpan(uid(), auth.name(), "avatar me-av"), inp, send);
    f.addEventListener("submit", function(e){
      e.preventDefault(); var t = inp.value.trim(); if (!t) return; if (TEM_LINK.test(t)) return toast("Links são exclusivos de quem anuncia."); send.disabled = true;
      sb.from("post_comentarios").insert({ post_id: p.id, texto: t }).select("id,post_id,user_id,nome,texto,criado_em,editado_em").then(function(r){
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
  var arqs = [p.foto].concat(p.fotos || [], [p.anexo]).filter(function(f, k, arr){ return f && arr.indexOf(f) === k; });
  var rm = arqs.length ? sb.storage.from("mural").remove(arqs) : Promise.resolve();
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

function mesaSync(){ $("postAv").textContent = initial(auth.name()); avTag($("postAv"), uid()); if (auth.user) $("postText").placeholder = phCompartilhe(firstName(auth.name())); }
viewHooks.mesa = function(sub){
  if (!auth.user) return;
  mesaSync();
  if (!feed.loaded) loadFeed(true);
  loadMembers(); if (typeof loadStories === "function") loadStories();
};
auth.on(function(){ if (auth.user && isShown("mesa")) viewHooks.mesa(currentSub("mesa")); });

// Abas da Mesa: Todos | Seguindo
$$("#feedTabs .chip").forEach(function(b){
  b.addEventListener("click", function(){
    var seg = b.getAttribute("data-f") === "seg";
    $$("#feedTabs .chip").forEach(function(x){ x.setAttribute("aria-pressed", x === b); });
    feed.seg = seg;
    if (!seg) return loadFeed(true);
    sb.from("seguidores").select("seguido").eq("seguidor", uid()).then(function(r){ feed.seguindo = (r.data || []).map(function(x){ return x.seguido; }); loadFeed(true); });
  });
});

// Busca de pessoas no topo (ícone de lupa), como no Instagram
function hdrSearchSync(){ var on = !!auth.user; $("hdrNew").hidden = !on; $("hdrSearch").hidden = !on; if (!on) $("searchPop").hidden = true; }
auth.on(hdrSearchSync); hdrSearchSync();
$("hdrSearch").addEventListener("click", function(e){
  e.stopPropagation(); var abrir = $("searchPop").hidden; $("searchPop").hidden = !abrir; $("hdrSearch").setAttribute("aria-expanded", abrir);
  if (abrir) { var h0 = document.getElementById("top"); document.documentElement.style.setProperty("--hdrh", (h0 ? h0.getBoundingClientRect().bottom : 72) + "px"); loadMembers(); $("sideBusca").focus(); }
});
document.addEventListener("click", function(e){ var sp = $("searchPop"); if (!sp.hidden && !sp.contains(e.target) && e.target.id !== "hdrSearch" && !$("hdrSearch").contains(e.target)) { sp.hidden = true; $("hdrSearch").setAttribute("aria-expanded", "false"); } });
window.addEventListener("hashchange", function(){ $("searchPop").hidden = true; });
