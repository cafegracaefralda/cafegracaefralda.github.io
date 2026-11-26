// A Casa: a administração publica foto(s), vídeo(s), PDF(s), link e YouTube JUNTOS na mesma postagem.
var casa = { fotos: [], videos: [], docs: [], busy: false };
var CASA_MAX = { fotos: 6, videos: 2, docs: 3 }, CASA_MB = 30;
function casaSync(){
  var on = !!(auth.user && auth.admin); $("casaForm").hidden = !on;
  if (on) { $("casaAv").textContent = initial(auth.name()); avTag($("casaAv"), uid()); }
}
auth.on(casaSync); casaSync();
function casaChips(){
  var box = $("casaAnexos"); box.innerHTML = "";
  [["fotos", "📷"], ["videos", "🎬"], ["docs", "📄"]].forEach(function(k){
    casa[k[0]].forEach(function(it, i){
      var c = h("span", "casa-chip"), t = h("span", null, k[1] + " " + it.name), x = h("button", null, "×"); x.type = "button"; x.setAttribute("aria-label", "Tirar " + it.name);
      x.addEventListener("click", function(){ if (it.url) URL.revokeObjectURL(it.url); casa[k[0]].splice(i, 1); casaChips(); });
      c.append(t, x); box.appendChild(c);
    });
  });
}
function casaLimpar(){
  ["fotos", "videos", "docs"].forEach(function(k){ casa[k].forEach(function(it){ if (it.url) URL.revokeObjectURL(it.url); }); casa[k] = []; });
  $("casaTitulo").value = ""; $("casaTexto").value = ""; $("casaLink").value = ""; $("casaLinkRow").hidden = true; $("casaFixar").checked = false; casaChips();
}
$("casaFotoBtn").addEventListener("click", function(){ $("casaFotoIn").click(); });
$("casaVideoBtn").addEventListener("click", function(){ $("casaVideoIn").click(); });
$("casaPdfBtn").addEventListener("click", function(){ $("casaPdfIn").click(); });
$("casaLinkBtn").addEventListener("click", function(){ $("casaLinkRow").hidden = false; $("casaLink").focus(); });
$("casaLinkDel").addEventListener("click", function(){ $("casaLink").value = ""; $("casaLinkRow").hidden = true; });
$("casaFotoIn").addEventListener("change", function(){
  var fs = Array.prototype.slice.call(this.files || [], 0, Math.max(0, CASA_MAX.fotos - casa.fotos.length)); this.value = "";
  var chain = Promise.resolve();
  fs.forEach(function(f){ chain = chain.then(function(){ return shrinkPhoto(f).then(function(blob){ casa.fotos.push({ blob: blob, name: (f.name || "foto").slice(0, 30), url: URL.createObjectURL(blob) }); }, function(e){ if (!e || e.message !== "nsfw") toast("Não consegui usar essa foto."); }); }); });
  chain.then(casaChips);
});
function casaArquivos(inp, tipo, rx, chave, msg){
  var fs = Array.prototype.slice.call(inp.files || []); inp.value = "";
  fs.forEach(function(f){
    if (!rx.test(f.type)) return toast(msg);
    if (f.size > CASA_MB * 1024 * 1024) return toast("O arquivo passa de " + CASA_MB + " MB.");
    if (casa[chave].length >= CASA_MAX[chave]) return toast("Máximo de " + CASA_MAX[chave] + " por postagem.");
    casa[chave].push({ blob: f, name: String(f.name || "arquivo").slice(0, 110) });
  });
  casaChips();
}
$("casaVideoIn").addEventListener("change", function(){ casaArquivos(this, "video", /^video\/(mp4|webm)$/, "videos", "Use vídeo MP4 ou WebM."); });
$("casaPdfIn").addEventListener("change", function(){ casaArquivos(this, "pdf", /^application\/pdf$/, "docs", "Escolha um arquivo PDF."); });

$("casaForm").addEventListener("submit", function(e){
  e.preventDefault();
  if (!sb || !auth.user || !auth.admin || casa.busy) return;
  var st = $("casaStatus"), titulo = $("casaTitulo").value.trim(), texto = $("casaTexto").value.trim(), link = $("casaLink").value.trim();
  var yt = link ? ytId(link) : "";
  if (link && !yt && !/^https:\/\/[^\s]+\.[^\s]+$/i.test(link)) return setStatus(st, "O link precisa começar com https://", "err");
  if (!titulo && !texto) return setStatus(st, "Escreva um título ou um texto para a postagem.", "err");
  casa.busy = true; $("casaSend").disabled = true; setStatus(st, "Publicando…");
  var enviados = [], jobs = [];
  function sobe(it, ext, tipo){
    var path = uid() + "/" + newUuid() + "." + ext; enviados.push(path);
    return sb.storage.from("prateleira").upload(path, it.blob, { contentType: tipo, upsert: false }).then(function(u){ if (u && u.error) throw new Error("arquivo"); return path; });
  }
  var pf = Promise.all(casa.fotos.map(function(it){ return sobe(it, "jpg", "image/jpeg"); }));
  var pv = Promise.all(casa.videos.map(function(it){ return sobe(it, /webm/.test(it.blob.type) ? "webm" : "mp4", it.blob.type); }));
  var pd = Promise.all(casa.docs.map(function(it){ return sobe(it, "pdf", "application/pdf"); }));
  Promise.all([pf, pv, pd]).then(function(r){
    var fotos = r[0], videos = r[1], docs = r[2], total = fotos.length + videos.length + docs.length;
    var row = { tipo: $("casaTipo").value, oficial: true, fixado: $("casaFixar").checked, titulo: titulo || null, texto: texto, youtube: yt || null, link: link && !yt ? link : null, link_texto: link && !yt ? "Abrir link" : null };
    var cols = "id,user_id,autor,oficial,tipo,titulo,texto,arquivo,arquivo_nome,youtube,link,link_texto,fixado,aprovado,criado_em,editado_em";
    if (total === 1) {   // um arquivo só: formato simples (funciona mesmo antes do v22)
      row.arquivo = (fotos[0] || videos[0] || docs[0]); row.arquivo_nome = (casa.fotos[0] || casa.videos[0] || casa.docs[0]).name.slice(0, 120);
    } else if (total > 1) {
      if (fotos.length) row.fotos = fotos; if (videos.length) row.videos = videos;
      if (docs.length) { row.docs = docs; row.docs_nomes = casa.docs.map(function(d){ return d.name.slice(0, 120); }); }
      cols += ",fotos,videos,docs,docs_nomes";
    }
    return sb.from("pubs").insert(row).select(cols).then(function(x){
      if (x.error || !x.data || !x.data.length) { if (enviados.length) sb.storage.from("prateleira").remove(enviados); var er = new Error("post"); er.detail = x.error ? (x.error.message || "") : ""; throw er; }
      return x.data[0];
    });
  }).then(function(p){
    casaLimpar(); setStatus(st, ""); toast("Publicado em A Casa.");
    pub.items.unshift(p); if (p.oficial) home.items.unshift(p); pub.likes[p.id] = []; pub.cmts[p.id] = []; renderPubs();
  }).catch(function(err){
    if (enviados.length && err.message === "arquivo") sb.storage.from("prateleira").remove(enviados);
    var m = err.message === "arquivo" ? "Não foi possível enviar um dos arquivos." : (/dados_invalidos|column|schema/i.test(err.detail || "") ? "Para postar vários anexos de uma vez, rode o SQL v22 no Supabase." : "Não foi possível publicar agora. Tente de novo.");
    setStatus(st, m, "err"); toast(m);
  }).then(function(){ casa.busy = false; $("casaSend").disabled = false; });
});
