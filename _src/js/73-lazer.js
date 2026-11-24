// Lazer em família: lugares para levar as crianças, indicados pelas famílias, sempre com a cidade (o site é do Brasil inteiro).
var lz = { items: [], likes: {}, urls: {}, loaded: false, more: false, tok: 0, cat: "all", file: null, busy: false };
var LZ_PAGE = 12;
filterChips("lzCats", function(c){ lz.cat = c; loadLazer(true); });

function lzFilters(){ return { cidade: $("lzCidade").value.trim().replace(/[^A-Za-zÀ-ÿ' -]/g, "").slice(0, 60), uf: $("lzUf").value }; }
function signLazer(rows){
  var paths = rows.map(function(x){ return x.foto; }).filter(function(f){ return f && !lz.urls[f]; });
  if (!paths.length) return Promise.resolve();
  return sb.storage.from("mural").createSignedUrls(paths, 3600).then(function(r){ (r.data || []).forEach(function(x){ if (x.signedUrl && x.path) lz.urls[x.path] = x.signedUrl; }); }, function(){});
}
function loadLazer(reset){
  if (!sb || !auth.user) return;
  var tok = ++lz.tok, base = reset ? [] : lz.items, f = lzFilters();
  if (reset) { lz.items = []; lz.loaded = false; }
  var q = sb.from("lazer").select("id,user_id,autor,nome_local,cidade,uf,categoria,idades,custo,endereco,porque,foto,aprovado,criado_em").order("criado_em", { ascending: false }).range(base.length, base.length + LZ_PAGE - 1);
  if (f.uf) q = q.eq("uf", f.uf);
  if (f.cidade) q = q.ilike("cidade", "%" + f.cidade + "%");
  if (lz.cat !== "all") q = q.eq("categoria", lz.cat);
  q.then(function(r){
    if (!r.data || tok !== lz.tok) return;
    var fresh = r.data, ids = fresh.map(function(x){ return x.id; });
    lz.more = fresh.length === LZ_PAGE;
    if (!ids.length) { lz.loaded = true; renderLazer(); return; }
    return Promise.all([ sb.from("lazer_curtidas").select("lazer_id,user_id").in("lazer_id", ids), signLazer(fresh) ]).then(function(x){
      if (tok !== lz.tok) return;
      fresh.forEach(function(p){ lz.likes[p.id] = []; });
      (x[0].data || []).forEach(function(l){ (lz.likes[l.lazer_id] = lz.likes[l.lazer_id] || []).push(l.user_id); });
      lz.items = base.concat(fresh); lz.loaded = true; renderLazer();
    });
  });
}
var lzT = null;
$("lzCidade").addEventListener("input", function(){ clearTimeout(lzT); lzT = setTimeout(function(){ lsSet("cgf-cidade", $("lzCidade").value.trim()); loadLazer(true); }, 350); });
$("lzUf").addEventListener("change", function(){ lsSet("cgf-uf", $("lzUf").value); loadLazer(true); });
$("lzMore").addEventListener("click", function(){ loadLazer(false); });
$("lzOpen").addEventListener("click", function(){
  var f = $("lzForm"); f.hidden = !f.hidden;
  if (!f.hidden) { if (!$("lz-cidade").value) $("lz-cidade").value = lsGet("cgf-cidade") || ""; if (!$("lz-uf").value) $("lz-uf").value = lsGet("cgf-uf") || ""; f.scrollIntoView({ behavior: "smooth", block: "start" }); }
});

function mapsUrl(p){ return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.nome_local + (p.endereco ? ", " + p.endereco : "") + ", " + p.cidade + " - " + p.uf); }
function lzShare(p){
  return "📍 *" + p.nome_local + "* · " + p.cidade + "/" + p.uf + "\n" + p.categoria + " · " + p.idades + " · " + p.custo + "\n\n" + p.porque.slice(0, 240) + "\n\nMais lugares para ir com as crianças na Mesa Grande: https://cafegracaefralda.github.io/#lazer";
}
function renderLazer(){
  var box = $("lzList"); box.innerHTML = "";
  $("lzMore").hidden = !lz.more;
  if (!lz.items.length) {
    var e = h("div", "empty card"); var f = lzFilters();
    e.append(h("h3", null, lz.loaded ? (f.cidade || f.uf ? "Nenhuma indicação nesta cidade ainda" : "Ainda não há lugares indicados") : "Carregando…"), h("p", null, lz.loaded ? "Conhece um bom lugar para ir com as crianças? Toque em “Indicar um lugar”." : "")); box.appendChild(e); return;
  }
  lz.items.forEach(function(p){ box.appendChild(renderLz(p)); });
}
function renderLz(p){
  var mine = p.user_id === uid(), el = h("article", "post lz-card"); el.id = "lz-" + p.id;
  var top = h("div", "post-top"), who = h("div", "grow");
  who.append(h("b", null, p.nome_local), h("small", null, "📍 " + p.cidade + ", " + p.uf + " · indicado por " + (mine ? "você" : p.autor) + " · " + ago(p.criado_em)));
  top.append(h("span", "avatar", "📍"), who);
  var mw = h("div", "pmenu-wrap"), mb = h("button", "pmore", "⋯"); mb.type = "button"; mb.setAttribute("aria-label", "Mais opções");
  var menu = h("div", "pmenu"); menu.hidden = true;
  function mi(label, fn){ var b = h("button", null, label); b.type = "button"; b.addEventListener("click", function(){ menu.hidden = true; fn(); }); menu.appendChild(b); }
  if (mine || auth.admin) mi("Apagar", function(){ if (!confirm("Apagar esta indicação?")) return; (p.foto ? sb.storage.from("mural").remove([p.foto]) : Promise.resolve()).then(function(){ return sb.from("lazer").delete().eq("id", p.id); }).then(function(){ lz.items = lz.items.filter(function(x){ return x.id !== p.id; }); renderLazer(); toast("Indicação apagada."); }); });
  if (!mine) mi("Denunciar", function(){ if (!confirm("Denunciar esta indicação?")) return; sb.from("lazer_denuncias").insert({ lazer_id: p.id }).then(function(r){ toast(r.error && String(r.error.message || "").indexOf("duplicate") < 0 ? "Não foi possível denunciar agora." : "Obrigado. Vamos olhar com cuidado."); }); });
  mb.addEventListener("click", function(e){ e.stopPropagation(); var open = menu.hidden; $$(".pmenu").forEach(function(m2){ m2.hidden = true; }); menu.hidden = !open; });
  mw.append(mb, menu); top.appendChild(mw); el.appendChild(top);
  var tags = h("div", "lz-tags"); [p.categoria, p.idades, p.custo].forEach(function(t){ tags.appendChild(h("span", "post-tag", t)); }); el.appendChild(tags);
  el.appendChild(h("p", "post-text", p.porque));
  if (p.endereco) el.appendChild(h("p", "lz-end", "🧭 " + p.endereco));
  if (p.foto && lz.urls[p.foto]) { var im = h("img", "post-img"); im.src = lz.urls[p.foto]; im.alt = "Foto de " + p.nome_local; im.loading = "lazy"; el.appendChild(im); }
  var likes = lz.likes[p.id] || [], liked = likes.indexOf(uid()) > -1;
  var acts = h("div", "post-acts");
  var lk = actBtn(likes.length ? (liked ? "Útil · " : "Útil · ") + likes.length : "Útil", "i-heart", function(){ toggleLzLike(p); }, liked ? "liked" : ""); lk.setAttribute("aria-pressed", liked);
  acts.append(lk, linkBtn("", mapsUrl(p), "i-arrow", "Ver no mapa"), linkBtn("", "https://wa.me/?text=" + encodeURIComponent(lzShare(p)), "i-share", "WhatsApp"));
  el.appendChild(acts); return el;
}
function toggleLzLike(p){
  var l = lz.likes[p.id] = lz.likes[p.id] || [], i = l.indexOf(uid());
  if (i > -1) { l.splice(i, 1); renderLazer(); sb.from("lazer_curtidas").delete().eq("lazer_id", p.id).eq("user_id", uid()).then(function(r){ if (r.error) { l.push(uid()); renderLazer(); } }); }
  else { l.push(uid()); renderLazer(); sb.from("lazer_curtidas").insert({ lazer_id: p.id }).then(function(r){ if (r.error) { var j = l.indexOf(uid()); if (j > -1) l.splice(j, 1); renderLazer(); } }); }
}

/* ---------- Indicar um lugar ---------- */
$("lz-foto").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  shrinkPhoto(f).then(function(b){ lz.file = b; $("lz-foto-nome").textContent = "📷 Foto pronta"; }, function(){ lz.file = null; $("lz-foto-nome").textContent = ""; toast("Não consegui usar essa foto."); });
});
$("lzForm").addEventListener("submit", function(e){
  e.preventDefault();
  var st = $("lzStatus");
  var row = { nome_local: val("lz-nome"), cidade: val("lz-cidade"), uf: $("lz-uf").value, categoria: $("lz-cat").value, idades: $("lz-idades").value, custo: $("lz-custo").value, endereco: val("lz-end") || null, porque: val("lz-porque"), foto: null };
  if (row.nome_local.length < 2) return setStatus(st, "Qual é o nome do lugar?", "err");
  if (row.cidade.length < 2 || !row.uf) return setStatus(st, "Diga a cidade e o estado onde o lugar fica.", "err");
  if (row.porque.length < 2) return setStatus(st, "Conte por que vale a pena ir.", "err");
  if (!sb || !auth.user || lz.busy) return;
  lz.busy = true; $("lzSend").disabled = true; setStatus(st, "Publicando…");
  var path = null, up = Promise.resolve();
  if (lz.file) { path = uid() + "/" + newUuid() + ".jpg"; row.foto = path; up = sb.storage.from("mural").upload(path, lz.file, { contentType: "image/jpeg", upsert: false }); }
  up.then(function(u){
    if (u && u.error) throw new Error("foto");
    return sb.from("lazer").insert(row).select("id,user_id,autor,nome_local,cidade,uf,categoria,idades,custo,endereco,porque,foto,aprovado,criado_em");
  }).then(function(r){
    if (r.error || !r.data || !r.data.length) { if (path) sb.storage.from("mural").remove([path]); throw new Error(String(r.error && r.error.message || "").indexOf("muito_rapido") > -1 ? "rapido" : "lazer"); }
    var p = r.data[0]; lsSet("cgf-cidade", row.cidade); lsSet("cgf-uf", row.uf);
    lz.items.unshift(p); lz.likes[p.id] = []; if (path) lz.urls[path] = "";
    return signLazer([p]).then(function(){ renderLazer(); });
  }).then(function(){
    $("lzForm").reset(); lz.file = null; $("lz-foto-nome").textContent = ""; $("lzForm").hidden = true; setStatus(st, ""); toast("Obrigado por indicar! Outras famílias vão gostar.");
  }).catch(function(err){ setStatus(st, err.message === "rapido" ? "Você já indicou muitos lugares hoje. Volte amanhã." : err.message === "foto" ? "Não foi possível enviar a foto." : "Não foi possível publicar agora. Tente de novo.", "err"); }).then(function(){ lz.busy = false; $("lzSend").disabled = false; });
});
auth.on(function(){ if (!auth.user) { lz.items = []; lz.likes = {}; lz.urls = {}; lz.loaded = false; } });
(function prefill(){ var c = lsGet("cgf-cidade"), u = lsGet("cgf-uf"); if (c) $("lzCidade").value = c; if (u) $("lzUf").value = u; })();
