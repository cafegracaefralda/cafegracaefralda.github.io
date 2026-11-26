// Prateleira: publicações da comunidade (texto, foto, vídeo, PDF, YouTube, link) e as oficiais (com selo). Qualquer pessoa lê; publicar, curtir e comentar exige login.
var home = { items: [], more: false, loaded: false, tok: 0 };
var pubFiltro = "all";
var pub = { items: [], likes: {}, cmts: {}, open: {}, loaded: false, more: false, tok: 0, focus: "", file: null, busy: false };
var PUB_PAGE = 12, PUB_URL = "https://cafegracaefralda.github.io/#prateleira";
var TIPO_OF = { aviso: "📣 Aviso", devocional: "📖 Devocional", evento: "📅 Evento", parceiro: "🤝 Parceiro" };
var TIPO_PUB = { texto: "Publicação", foto: "📷 Foto", video: "🎬 Vídeo", audio: "🎧 Áudio", pdf: "📄 PDF", youtube: "▶️ YouTube", link: "🔗 Link" };

function pubFileUrl(path){ try { return sb.storage.from("prateleira").getPublicUrl(path).data.publicUrl; } catch(e){ return ""; } }
function ytId(url){
  var m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/.exec(String(url || ""));
  return m ? m[1] : "";
}
function pubShareText(p){
  var head = p.titulo || (p.texto || "").split("\n")[0].slice(0, 70) || "Publicação da comunidade";
  var extra = p.youtube ? "\n\n▶ https://youtu.be/" + p.youtube : p.link ? "\n\n" + p.link : p.arquivo ? "\n\n" + pubFileUrl(p.arquivo) : "";
  return (p.oficial ? "📣 *" : "☕ *") + head + "*" + (p.texto && p.titulo ? "\n\n" + p.texto.slice(0, 300) : p.texto && p.texto.length > 70 ? "\n\n" + p.texto.slice(0, 300) : "") + extra + "\n\nVeja na Prateleira do Café, Graça & Fralda: " + PUB_URL;
}
function needLogin(msg){ toast(msg || "Entre com o Google para participar."); }

/* ---------- Destaque: devocional da semana ---------- */
function casaHead(sub){
  var top = h("div", "post-top"), who = h("div", "grow"), av = h("span", "avatar casa");
  av.innerHTML = '<svg><use href="#logo"/></svg>';
  var b = h("b", null, "Café, Graça & Fralda"); b.appendChild(h("span", "selo", "✓"));
  who.append(b, h("small", null, sub));
  top.append(av, who);
  return top;
}
function linkBtn(cls, href, ic, label){ var a = h("a", "btn btn-sm " + cls); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.append(icon(ic), document.createTextNode(label)); return a; }
function renderDestaque(){
  if (typeof FEATURED === "undefined") return;
  ["destaqueDevo", "homeDevo"].forEach(function(id){
    var el = $(id); if (!el) return; el.innerHTML = "";
    var a = FEATURED;
    el.appendChild(casaHead("📖 Devocional da semana · 5 minutos"));
    el.appendChild(h("h3", null, a.title));
    el.appendChild(h("p", "of-verse", quoteVerse(a.passage[0]) + " — " + a.passage[1]));
    var acts = h("div", "post-acts");
    var read = h("button", null); read.type = "button"; read.append(icon("i-book"), document.createTextNode("Ler agora")); read.addEventListener("click", function(){ openReader(a); });
    acts.append(read, linkBtn("", "https://wa.me/?text=" + encodeURIComponent(shareText(a)), "i-share", "Compartilhar"));
    var more = h("button", null); more.type = "button"; more.append(icon("i-arrow"), document.createTextNode("Anteriores")); more.addEventListener("click", function(){ go("prateleira", "devocional"); });
    acts.appendChild(more);
    el.appendChild(acts);
  });
}

/* ---------- Publicar ---------- */
function pubSync(){
  var inn = !!auth.user;
  $("pubForm").hidden = !inn; $("pubGate").hidden = inn;
  $("pubAv").textContent = initial(auth.name()); avTag($("pubAv"), uid()); $("pubAdmin").hidden = !auth.admin; $("pubVideoBox").hidden = !auth.admin;
  if (inn) $("pubText").placeholder = phCompartilhe(firstName(auth.name()));
}
function pubClearAttach(){ pub.file = null; $("pubAttach").hidden = true; $("pubAttachName").textContent = ""; }
function pubClearLink(){ $("pubLink").value = ""; $("pubLinkRow").hidden = true; }
function pubSetFile(f){ pub.file = f; pubClearLink(); $("pubAttachName").textContent = f.label; $("pubAttach").hidden = false; }
function sizeTxt(n){ return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
$("pubFoto").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  shrinkPhoto(f).then(function(blob){ pubSetFile({ blob: blob, kind: "foto", ext: "jpg", type: "image/jpeg", name: "foto.jpg", label: "📷 Foto · " + sizeTxt(blob.size) }); }, function(e){ if (e && e.message === "nsfw") return; toast("Não consegui usar essa foto."); });
});
$("pubVideo").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  if (f.size > 30 * 1024 * 1024) return toast("O vídeo tem mais de 30 MB. Escolha um mais curto ou cole o link do YouTube.");
  var webm = f.type === "video/webm";
  pubSetFile({ blob: f, kind: "video", ext: webm ? "webm" : "mp4", type: webm ? "video/webm" : "video/mp4", name: f.name || "video", label: "🎬 " + (f.name || "Vídeo") + " · " + sizeTxt(f.size) });
});
$("pubAudio").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  var m = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/webm": "webm", "audio/ogg": "ogg" }[f.type];
  if (!m) return toast("Escolha um áudio MP3, M4A, OGG ou WebM.");
  if (f.size > 10 * 1024 * 1024) return toast("O áudio tem mais de 10 MB.");
  pubSetFile({ blob: f, kind: "audio", ext: m, type: f.type, name: f.name || "audio." + m, label: "🎧 " + (f.name || "Áudio") + " · " + sizeTxt(f.size) });
});
$("pubPdf").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  if (f.type !== "application/pdf") return toast("Escolha um arquivo PDF.");
  if (f.size > 30 * 1024 * 1024) return toast("O PDF tem mais de 30 MB.");
  pubSetFile({ blob: f, kind: "pdf", ext: "pdf", type: "application/pdf", name: f.name || "documento.pdf", label: "📄 " + (f.name || "PDF") + " · " + sizeTxt(f.size) });
});
$("pubLinkBtn").addEventListener("click", function(){ pubClearAttach(); $("pubLinkRow").hidden = false; $("pubLink").focus(); });
$("pubLinkDel").addEventListener("click", pubClearLink);
$("pubAttachDel").addEventListener("click", pubClearAttach);

$("pubForm").addEventListener("submit", function(e){
  e.preventDefault();
  if (!sb || !auth.user || pub.busy) return;
  var st = $("pubStatus"), texto = $("pubText").value.trim(), link = $("pubLink").value.trim(), file = pub.file;
  var yt = link ? ytId(link) : "";
  if (link && !yt && !/^https?:\/\/[^\s]+$/i.test(link)) return setStatus(st, "O link precisa começar com https://", "err");
  var titulo = auth.admin ? val("pubTitulo") : "";
  if (!texto && !file && !link && !titulo) return setStatus(st, "Escreva algo ou anexe uma foto, vídeo, PDF ou link.", "err");
  var oficialTipo = auth.admin ? $("pubTipo").value : "";
  var row = { tipo: oficialTipo || (file ? file.kind : yt ? "youtube" : link ? "link" : "texto"), titulo: titulo || null, texto: texto, arquivo: null, arquivo_nome: null,
              youtube: yt || null, link: link && !yt ? link : null, link_texto: link && !yt ? "Abrir link" : null };
  if (oficialTipo) { row.oficial = true; row.fixado = $("pubFixar").checked; }
  pub.busy = true; $("pubSend").disabled = true; setStatus(st, file ? "Enviando o arquivo…" : "Publicando…");
  var path = null, up = Promise.resolve();
  if (file) { path = uid() + "/" + newUuid() + "." + file.ext; row.arquivo = path; row.arquivo_nome = String(file.name).slice(0, 120); up = sb.storage.from("prateleira").upload(path, file.blob, { contentType: file.type, upsert: false }); }
  up.then(function(u){
    if (u && u.error) { var ef = new Error("arquivo"); ef.detail = u.error.message || ""; throw ef; }
    return sb.from("pubs").insert(row).select("id,user_id,autor,oficial,tipo,titulo,texto,arquivo,arquivo_nome,youtube,link,link_texto,fixado,aprovado,criado_em,editado_em");
  }).then(function(r){
    if (r.error || !r.data || !r.data.length) { if (path) sb.storage.from("prateleira").remove([path]); var er = new Error(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "rapido" : "post"); er.detail = r.error ? (r.error.message || r.error.code || "") : "sem resposta"; throw er; }
    var p = r.data[0]; pub.items.unshift(p); if (p.oficial) home.items.unshift(p); pub.likes[p.id] = []; pub.cmts[p.id] = []; renderPubs();
    $("pubText").value = ""; $("pubTitulo").value = ""; $("pubFixar").checked = false; pubClearAttach(); pubClearLink(); setStatus(st, ""); toast("Publicado na Prateleira.");
  }).catch(function(err){
    var msg = err.message === "rapido" ? "Calma! Muitas publicações em pouco tempo." : err.message === "arquivo" ? "Não foi possível enviar o arquivo (máximo 30 MB)." : "Não foi possível publicar agora. Tente de novo.";
    setStatus(st, msg + (err.detail ? " (Detalhe técnico: " + err.detail + ")" : ""), "err"); toast(msg);
  }).then(function(){ pub.busy = false; $("pubSend").disabled = false; });
});

/* ---------- Carregar e mostrar ---------- */
function fetchPubs(st, reset, soOficial){
  if (!sb) { renderPubs(); return; }
  var tok = ++st.tok, base = reset ? [] : st.items;
  if (reset) { st.items = []; st.loaded = false; }
  var cols = "id,autor,oficial,tipo,titulo,texto,arquivo,arquivo_nome,youtube,link,link_texto,fixado,aprovado,criado_em,editado_em" + (auth.user ? ",user_id" : "");
  var q = sb.from("pubs").select(cols).order("fixado", { ascending: false }).order("criado_em", { ascending: false }).range(base.length, base.length + PUB_PAGE - 1);
  if (soOficial) q = q.eq("oficial", true);
  q.then(function(r){
    if (!r.data || tok !== st.tok) return;
    var fresh = r.data, ids = fresh.map(function(x){ return x.id; });
    st.more = fresh.length === PUB_PAGE;
    if (!ids.length) { st.loaded = true; renderPubs(); return; }
    return Promise.all([
      sb.from("pub_curtidas").select(auth.user ? "pub_id,user_id" : "pub_id").in("pub_id", ids),
      sb.from("pub_comentarios").select(auth.user ? "id,pub_id,user_id,nome,texto,criado_em,editado_em" : "id,pub_id,nome,texto,criado_em").in("pub_id", ids).order("criado_em", { ascending: true })
    ]).then(function(x){
      if (tok !== st.tok) return;
      fresh.forEach(function(q2){ pub.likes[q2.id] = []; pub.cmts[q2.id] = []; });
      (x[0].data || []).forEach(function(l){ (pub.likes[l.pub_id] = pub.likes[l.pub_id] || []).push(l.user_id || "x"); });
      (x[1].data || []).forEach(function(c){ (pub.cmts[c.pub_id] = pub.cmts[c.pub_id] || []).push(c); });
      st.items = base.concat(fresh); st.loaded = true; renderPubs();
    });
  });
}
function loadPubs(reset){ fetchPubs(pub, reset, false); }
function loadHome(reset){ fetchPubs(home, reset, true); }
function reloadPubs(){ loadPubs(true); loadHome(true); }
$("pubMore").addEventListener("click", function(){ loadPubs(false); });
$("homeMore").addEventListener("click", function(){ loadHome(false); });

function ytBlock(p){
  var box = h("div", "yt"), b = h("button", "yt-play"); b.type = "button"; b.setAttribute("aria-label", "Assistir no YouTube");
  b.innerHTML = '<span class="yt-ic">▶</span><span class="yt-tx">Toque para assistir</span>';
  b.addEventListener("click", function(){
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + p.youtube + "?autoplay=1&rel=0"; f.title = p.titulo || "Vídeo do YouTube";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.loading = "lazy"; f.referrerPolicy = "strict-origin-when-cross-origin";
    box.innerHTML = ""; box.appendChild(f);
  });
  box.appendChild(b); return box;
}
function mediaOf(p){
  var url = p.arquivo ? pubFileUrl(p.arquivo) : "";
  if (p.youtube) return ytBlock(p);
  if (p.arquivo && /\.jpg$/.test(p.arquivo)) { var im = h("img", "post-img"); im.src = url; im.alt = p.titulo || "Foto de " + p.autor; im.loading = "lazy"; return im; }
  if (p.arquivo && p.tipo !== "audio" && /\.(mp4|webm)$/.test(p.arquivo)) { var v = h("video", "pub-video"); v.controls = true; v.preload = "metadata"; v.setAttribute("playsinline", ""); v.src = url; return v; }
  if (p.arquivo && /\.(mp3|m4a|ogg|webm)$/.test(p.arquivo) && p.tipo === "audio") { var au = h("audio", "pub-audio"); au.controls = true; au.preload = "none"; au.src = url; return au; }
  if (p.arquivo && /\.pdf$/.test(p.arquivo)) {
    var a = h("a", "file-chip pub-file"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.append(h("span", "file-ic", "📄"), h("span", "file-nm", p.arquivo_nome || "documento.pdf"), h("small", null, "Abrir")); return a;
  }
  if (p.link) {
    var host = ""; try { host = new URL(p.link).hostname.replace(/^www\./, ""); } catch(e){}
    var l = h("a", "file-chip pub-file"); l.href = p.link; l.target = "_blank"; l.rel = "noopener noreferrer nofollow ugc";
    l.append(h("span", "file-ic", "🔗"), h("span", "file-nm", host || p.link), h("small", null, p.link_texto || "Abrir")); return l;
  }
  return null;
}
function renderList(box, st, prefix, vazio){
  if (!box) return;
  box.innerHTML = "";
  if (!st.items.length) {
    var e = h("div", "empty card"); e.append(h("h3", null, st.loaded ? vazio[0] : "Carregando…"), h("p", null, st.loaded ? vazio[1] : "")); box.appendChild(e); return;
  }
  st.items.forEach(function(p){ box.appendChild(renderPub(p, prefix)); });
}
function renderPubs(){
  $("pubMore").hidden = !pub.more; $("homeMore").hidden = !home.more;
  var vis = { items: pub.items.filter(function(p){ return pubFiltro === "all" || p.tipo === pubFiltro || (pubFiltro === "link" && p.tipo === "youtube"); }), loaded: pub.loaded };
  renderList($("pubList"), vis, "", ["Nada por aqui ainda", ""]);
  if (home.items.length) renderList($("homeList"), home, "home-", ["", ""]); else $("homeList").innerHTML = "";
  if (home.focus) { var he = $("home-pub-" + home.focus); if (he) { home.focus = ""; he.classList.add("focus"); he.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(function(){ he.classList.remove("focus"); }, 2500); } }
  if (pub.focus) { var fe = $("pub-" + pub.focus); if (fe) { pub.focus = ""; fe.classList.add("focus"); fe.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(function(){ fe.classList.remove("focus"); }, 2400); } }
}
function renderPub(p, prefix){
  var mine = auth.user && p.user_id === uid(), el = h("article", "post" + (p.oficial ? " oficial" : "")); el.id = (prefix || "") + "pub-" + p.id;
  var sub = ago(p.criado_em) + " · " + (p.oficial ? (TIPO_OF[p.tipo] || "📣 Aviso") : (TIPO_PUB[p.tipo] || "Publicação")) + (p.fixado ? " · 📌" : "") + (p.aprovado === false ? " · oculto" : "");
  var top;
  if (p.oficial) top = casaHead(sub); else { top = h("div", "post-top"); var who = h("div", "grow"); who.append(nameLink(mine ? "Você" : p.autor, p.user_id), h("small", null, sub)); top.append(avLink(p.user_id, p.autor), who); }
  // menu ⋯
  var mw = h("div", "pmenu-wrap"), mb = h("button", "pmore", "⋯"); mb.type = "button"; mb.setAttribute("aria-label", "Mais opções"); mb.setAttribute("aria-haspopup", "true");
  var menu = h("div", "pmenu"); menu.hidden = true;
  function mi(label, fn){ var b = h("button", null, label); b.type = "button"; b.addEventListener("click", function(){ menu.hidden = true; fn(); }); menu.appendChild(b); }
  if (mine && !p.oficial && p.texto && podeEditar(p.criado_em)) mi("Editar", function(){ var alvo = el.querySelector(".post-text"); if (alvo) editarInline(alvo, p.texto, 2000, function(v){ return salvarTexto("pubs", p.id, v, function(n){ p.texto = n.texto; p.editado_em = n.editado_em; renderPubs(); }); }); });
  if (mine || auth.admin) mi("Apagar", function(){ if (confirm("Apagar esta publicação?")) deletePub(p); });
  if (auth.admin) { mi(p.fixado ? "Desafixar" : "Fixar no topo", function(){ sb.from("pubs").update({ fixado: !p.fixado }).eq("id", p.id).then(reloadPubs); }); if (p.aprovado === false) mi("Mostrar de novo", function(){ sb.from("pubs").update({ aprovado: true }).eq("id", p.id).then(reloadPubs); }); }
  if (!mine && auth.user) mi("Denunciar", function(){ reportPub(p); });
  if (menu.childNodes.length) { mb.addEventListener("click", function(e){ e.stopPropagation(); var open = menu.hidden; $$(".pmenu").forEach(function(m2){ m2.hidden = true; }); menu.hidden = !open; }); mw.append(mb, menu); top.appendChild(mw); }
  el.appendChild(top);
  if (p.titulo) el.appendChild(h("h3", "pub-title", p.titulo));
  if (p.texto) { var ptx = h("p", "post-text"); ptx.appendChild(richText(p.texto)); el.appendChild(ptx); }
  if (p.oficial && p.tipo === "parceiro") el.appendChild(h("p", "ad-note", "Indicação de parceiro (publicidade). Confira sempre antes de contratar."));
  var m = mediaOf(p); if (m) el.appendChild(m);
  var likes = pub.likes[p.id] || [], liked = auth.user && likes.indexOf(uid()) > -1, cm = pub.cmts[p.id] || [];
  if (likes.length || cm.length) {
    var cnt = h("div", "post-count"); cnt.append(h("span", null, likes.length ? "♥ " + likes.length + (likes.length === 1 ? " curtida" : " curtidas") : ""));
    var cb = h("button", null, cm.length ? cm.length + (cm.length === 1 ? " comentário" : " comentários") : ""); cb.type = "button"; cb.addEventListener("click", function(){ pub.open[p.id] = !pub.open[p.id]; renderPubs(); }); cnt.appendChild(cb); el.appendChild(cnt);
  }
  var acts = h("div", "post-acts");
  var lk = actBtn(liked ? "Curtiu" : "Curtir", "i-heart", function(){ togglePubLike(p); }, liked ? "liked" : ""); lk.setAttribute("aria-pressed", !!liked);
  acts.append(lk, actBtn("Comentar", "i-chat", function(){ pub.open[p.id] = !pub.open[p.id]; renderPubs(); }), linkBtn("", "https://wa.me/?text=" + encodeURIComponent(pubShareText(p)), "i-share", "WhatsApp"));
  el.appendChild(acts);
  if (pub.open[p.id] || cm.length) el.appendChild(renderPubCmts(p, cm, !!pub.open[p.id]));
  return el;
}
function renderPubCmts(p, cm, open){
  var box = h("div", "post-cmts"), list = open ? cm : cm.slice(-1);
  if (!open && cm.length > 1) { var all = h("button", "link", "Ver todos os " + cm.length + " comentários"); all.type = "button"; all.style.cssText = "font-size:13px;font-weight:500;color:var(--muted);text-decoration:none;justify-self:start"; all.addEventListener("click", function(){ pub.open[p.id] = true; renderPubs(); }); box.appendChild(all); }
  list.forEach(function(c){
    var row = h("div", "post-cmt"), body = h("div"), pp = h("p");
    pp.append(h("b", null, auth.user && c.user_id === uid() ? "Você" : c.nome), richText(c.texto)); pp.appendChild(h("small", "c-time", ago(c.criado_em) + (c.editado_em ? " · editado" : "")));
    if (auth.user && c.user_id === uid() && podeEditar(c.criado_em)) { var ce = h("button", "link", "Editar"); ce.type = "button"; ce.addEventListener("click", function(){ editarInline(pp, c.texto, 600, function(v){ return salvarTexto("pub_comentarios", c.id, v, function(n){ c.texto = n.texto; c.editado_em = n.editado_em; renderPubs(); }); }); }); pp.appendChild(ce); }
    if (open && auth.user && (c.user_id === uid() || auth.admin)) {
      var d = h("button", "link", "Apagar"); d.type = "button";
      d.addEventListener("click", function(){ sb.from("pub_comentarios").delete().eq("id", c.id).then(function(r){ if (r.error) return toast("Não foi possível apagar."); pub.cmts[p.id] = pub.cmts[p.id].filter(function(x){ return x.id !== c.id; }); renderPubs(); }); });
      pp.appendChild(d);
    }
    body.appendChild(pp); row.append(avLink(c.user_id, c.nome), body); box.appendChild(row);
  });
  if (open) {
    if (!auth.user) { var lg = h("p", "hint", "Entre com o Google para comentar."); box.appendChild(lg); return box; }
    var f = h("form", "post-cmt-form"), inp = h("input"); inp.placeholder = "Escreva um comentário…"; inp.maxLength = 600; inp.setAttribute("aria-label", "Comentário");
    var send = h("button", "btn btn-terra btn-sm", "Enviar"); send.type = "submit"; f.append(inp, send);
    f.addEventListener("submit", function(e){
      e.preventDefault(); var t = inp.value.trim(); if (!t) return; send.disabled = true;
      sb.from("pub_comentarios").insert({ pub_id: p.id, texto: t }).select("id,pub_id,user_id,nome,texto,criado_em,editado_em").then(function(r){
        if (r.error || !r.data || !r.data.length) { send.disabled = false; return toast(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "Calma! Muitos comentários em pouco tempo." : "Não foi possível comentar agora."); }
        pub.cmts[p.id].push(r.data[0]); renderPubs();
      });
    });
    box.appendChild(f);
  }
  return box;
}
function togglePubLike(p){
  if (!auth.user) return needLogin("Entre com o Google para curtir.");
  var l = pub.likes[p.id] = pub.likes[p.id] || [], i = l.indexOf(uid());
  if (i > -1) { l.splice(i, 1); renderPubs(); sb.from("pub_curtidas").delete().eq("pub_id", p.id).eq("user_id", uid()).then(function(r){ if (r.error) { l.push(uid()); renderPubs(); } }); }
  else { l.push(uid()); renderPubs(); sb.from("pub_curtidas").insert({ pub_id: p.id }).then(function(r){ if (r.error) { var j = l.indexOf(uid()); if (j > -1) l.splice(j, 1); renderPubs(); } }); }
}
function deletePub(p){
  var rm = p.arquivo ? sb.storage.from("prateleira").remove([p.arquivo]) : Promise.resolve();
  Promise.resolve(rm).then(function(){ return sb.from("pubs").delete().eq("id", p.id); }).then(function(r){
    if (r && r.error) return toast("Não foi possível apagar.");
    pub.items = pub.items.filter(function(x){ return x.id !== p.id; }); home.items = home.items.filter(function(x){ return x.id !== p.id; }); renderPubs(); toast("Publicação apagada.");
  });
}
function reportPub(p){
  if (!confirm("Denunciar esta publicação? Ela some se outras pessoas também denunciarem, e a equipe revisa.")) return;
  sb.from("pub_denuncias").insert({ pub_id: p.id }).then(function(r){
    if (r.error && String(r.error.message || "").indexOf("duplicate") < 0) return toast("Não foi possível denunciar agora.");
    toast("Obrigado. Vamos olhar com cuidado.");
  });
}
document.addEventListener("click", function(){ $$(".pmenu").forEach(function(m){ m.hidden = true; }); });

viewHooks.prateleira = function(sub){ if (sub !== "devocional") { renderDestaque(); if (!pub.loaded) loadPubs(true); } };
viewHooks.inicio = function(){ renderDestaque(); if (!home.loaded) loadHome(true); };
auth.on(function(){ pubSync(); if (isShown("prateleira") && currentSub("prateleira") !== "devocional") loadPubs(true); if (isShown("inicio")) loadHome(true); });
pubSync();

filterChips("pubFilters", function(f){ pubFiltro = f; renderPubs(); });
