// Ofertas de parceiros (A Casa > Ofertas). Anunciante pede para entrar (pendente), a administração ativa depois de combinar por WhatsApp.
// Oferta de anunciante novo passa por revisão; anunciante "confiável" publica direto. Todo anúncio aparece identificado.
var of = { items: [], urls: {}, filtro: "all", loaded: false, anunc: undefined, file: null, busy: false };
var ZAP_EQUIPE = "5581992702353";

function ofSign(list){
  var paths = list.map(function(o){ return o.foto; }).filter(function(p){ return p && !of.urls[p]; });
  if (!paths.length) return Promise.resolve();
  return sb.storage.from("mural").createSignedUrls(paths, 3600).then(function(r){ (r.data || []).forEach(function(x){ if (x.path && x.signedUrl) of.urls[x.path] = x.signedUrl; }); });
}
function loadOfertas(){
  if (!sb || !auth.user) return;
  var hoje = new Date().toISOString().slice(0, 10);
  sb.from("ofertas").select("id,user_id,marca,titulo,descricao,preco,cupom,link,foto,categoria,validade,status,criado_em").eq("status", "aprovada").gte("validade", hoje).order("criado_em", { ascending: false }).limit(60).then(function(r){
    of.items = r.data || []; of.loaded = true;
    return ofSign(of.items).then(renderOfertas);
  });
}
function ofCard(o){
  var el = h("article", "of-card");
  if (o.foto && of.urls[o.foto]) { var im = h("img", "of-img"); im.src = of.urls[o.foto]; im.alt = o.titulo; im.loading = "lazy"; el.appendChild(im); }
  var b = h("div", "of-body");
  b.append(h("span", "of-ad", "Anúncio · " + o.marca), h("h3", null, o.titulo));
  if (o.descricao) b.appendChild(h("p", "muted", o.descricao));
  if (o.preco) b.appendChild(h("b", "of-preco", o.preco));
  var acts = h("div", "of-acts");
  if (o.cupom) { var cp = h("button", "btn btn-ghost btn-sm", "Cupom " + o.cupom); cp.type = "button"; cp.addEventListener("click", function(){ copyText(o.cupom, "Cupom copiado"); }); acts.appendChild(cp); }
  var a = h("a", "btn btn-terra btn-sm", "Ver oferta"); a.href = o.link; a.target = "_blank"; a.rel = "noopener noreferrer sponsored nofollow";
  a.addEventListener("click", function(){ if (sb) sb.rpc("oferta_clique", { p_id: o.id }).then(function(){}); });
  acts.appendChild(a);
  b.append(acts, h("small", "of-note", "Link do parceiro (pode ser de afiliado). Válido até " + o.validade.split("-").reverse().join("/") + "."));
  el.appendChild(b); return el;
}
function renderOfertas(){
  var box = $("ofList"); box.innerHTML = "";
  var l = of.items.filter(function(o){ return of.filtro === "all" || o.categoria === of.filtro; });
  if (!l.length) { var e = h("div", "empty card"); e.append(h("h3", null, of.loaded ? "Sem ofertas por enquanto" : "Carregando…"), h("p", null, "")); box.appendChild(e); return; }
  l.forEach(function(o){ box.appendChild(ofCard(o)); });
}
filterChips("ofFilters", function(f){ of.filtro = f; renderOfertas(); });

// --- quero anunciar
var anDlg = $("anDlg"), ofDlg = $("ofDlg");
$("an-zap").addEventListener("input", maskPhone);
function anInfo(txt){ $("anForm").hidden = true; $("anInfo").hidden = false; $("anInfoTxt").textContent = txt; }
$("anOk").addEventListener("click", function(){ anDlg.close(); });
$("ofAnunciar").addEventListener("click", function(){
  if (!auth.user || !sb) return;
  sb.from("anunciantes").select("marca,status,confiavel").eq("user_id", auth.user.id).maybeSingle().then(function(r){
    var a = r.data; of.anunc = a || null;
    if (a && a.status === "ativo") { setStatus($("ofStatus"), ""); of.file = null; $("of-foto-nome").textContent = ""; $("ofForm").reset(); ofDlg.showModal(); return; }
    anDlg.showModal(); anDlg.scrollTop = 0; setStatus($("anStatus"), "");
    if (!a) { $("anForm").hidden = false; $("anInfo").hidden = true; return; }
    if (a.status === "pendente") anInfo("Recebemos o seu pedido, " + a.marca + ". A equipe analisa e você recebe a resposta aqui no site, no sininho 🔔.");
    else anInfo("A sua conta de parceiro não está ativa no momento. Qualquer novidade, você recebe o aviso aqui no site, no sininho 🔔.");
  });
});
$("anClose").addEventListener("click", function(){ anDlg.close(); });
$("ofClose").addEventListener("click", function(){ ofDlg.close(); });
$("anForm").addEventListener("submit", function(e){
  e.preventDefault();
  var st = $("anStatus"), marca = val("an-marca"), raw = $("an-zap").value.trim(), zap = (function(){ var d = raw.replace(/\D/g, ""); if (d.length === 10 || d.length === 11) d = "55" + d; return /^55[0-9]{10,11}$/.test(d) ? d : ""; })();
  if (marca.length < 2) return setStatus(st, "Informe o nome ou a marca.", "err");
  if (!zap) return setStatus(st, "Informe o WhatsApp com DDD, por exemplo (81) 99999-9999.", "err");
  if (!$("an-ok").checked) return setStatus(st, "Marque que entendeu as regras para continuar.", "err");
  $("anSend").disabled = true; setStatus(st, "Enviando…");
  sb.from("anunciantes").insert({ marca: marca, tipo: $("an-tipo").value, instagram: val("an-ig") || null, whatsapp: zap, cidade: val("an-cidade") || null, sobre: val("an-sobre") || null }).then(function(r){
    $("anSend").disabled = false;
    if (r.error) { var m = String(r.error.message || ""); return setStatus(st, m.indexOf("conteudo_improprio") > -1 ? "Escolha um nome respeitoso para a marca." : m.indexOf("conta_suspensa") > -1 ? "Sua conta está suspensa." : "Não foi possível enviar agora. Tente de novo.", "err"); }
    setStatus(st, ""); anInfo("Pedido enviado! A equipe analisa e você recebe a resposta aqui no site, no sininho 🔔.");
  });
});
$("of-foto").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  shrinkPhoto(f).then(function(b){ of.file = b; $("of-foto-nome").textContent = "📷 Foto pronta"; }, function(e){ if (e && e.message === "nsfw") { of.file = null; return; } of.file = null; toast("Não consegui usar essa foto."); });
});
$("ofForm").addEventListener("submit", function(e){
  e.preventDefault();
  if (of.busy) return;
  var st = $("ofStatus"), titulo = val("of-titulo"), link = val("of-link");
  if (titulo.length < 3) return setStatus(st, "Escreva um título.", "err");
  if (!/^https:\/\/[^\s]+\.[^\s]+$/.test(link)) return setStatus(st, "O link precisa começar com https://", "err");
  of.busy = true; $("ofSend").disabled = true; setStatus(st, "Enviando…");
  var dias = parseInt($("of-dias").value, 10), v = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  var path = null, up = Promise.resolve({});
  if (of.file) { path = uid() + "/" + newUuid() + ".jpg"; up = sb.storage.from("mural").upload(path, of.file, { contentType: "image/jpeg", upsert: false }); }
  up.then(function(u){
    if (u && u.error) throw new Error("foto");
    return sb.from("ofertas").insert({ titulo: titulo, descricao: val("of-desc"), preco: val("of-preco") || null, cupom: val("of-cupom") || null, link: link, foto: path, categoria: $("of-cat").value, validade: v });
  }).then(function(r){
    if (r.error) { if (path) sb.storage.from("mural").remove([path]); throw new Error(String(r.error.message || "")); }
    of.busy = false; $("ofSend").disabled = false; ofDlg.close();
    toast(of.anunc && of.anunc.confiavel ? "Oferta publicada." : "Oferta enviada! A equipe revisa e publica em breve."); of.file = null; loadOfertas();
  }).catch(function(err){
    of.busy = false; $("ofSend").disabled = false; var m = err.message || "";
    setStatus(st, m === "foto" ? "Não foi possível enviar a foto." : m.indexOf("produto_proibido") > -1 ? "Esse tipo de produto não pode ser anunciado na comunidade (bebida alcoólica, cigarro, apostas, emagrecedores, medicamentos e itens que façam mal à saúde)." : m.indexOf("conteudo_improprio") > -1 ? "Revise o texto: há palavras que não combinam com a comunidade." : m.indexOf("muito_rapido") > -1 ? "Você já enviou muitas ofertas hoje. Volte amanhã." : m.indexOf("conta_suspensa") > -1 ? "Sua conta está suspensa." : "Não foi possível enviar agora. Tente de novo.", "err");
  });
});
var _hookInicio = viewHooks.inicio;
viewHooks.inicio = function(sub){ if (_hookInicio) _hookInicio(sub); if (sub === "ofertas" && auth.user) loadOfertas(); };
auth.on(function(){ if (auth.user && isShown("inicio") && currentSub("inicio") === "ofertas") loadOfertas(); if (!auth.user) { of.items = []; of.loaded = false; } });

// Menu "Anunciar na comunidade": mesmo fluxo do botão "Quero anunciar" (pedido e resposta dentro do site, sem WhatsApp)
$("navAnunciar").addEventListener("click", function(e){ e.preventDefault(); $("ofAnunciar").click(); });
