// Da Casa: postagens oficiais (devocional da semana, avisos, convites e parceiros), publicadas pelo Denny. Qualquer pessoa lê.
var oficial = { items: [], loaded: false };
var TIPO_OF = { aviso: "📣 Aviso", devocional: "📖 Devocional", evento: "📅 Evento", parceiro: "🤝 Parceiro" };
function ofImgUrl(path){ try { return sb.storage.from("oficial").getPublicUrl(path).data.publicUrl; } catch(e){ return ""; } }
function ofShareText(it){
  return "📣 *" + it.titulo + "*\n\n" + it.texto + (it.link ? "\n\n" + it.link : "") + "\n\nCafé, Graça & Fralda: https://cafegracaefralda.github.io/#dacasa";
}
function casaHead(sub, tag){
  var top = h("div", "post-top"), who = h("div", "grow"), av = h("span", "avatar casa");
  av.innerHTML = '<svg><use href="#logo"/></svg>';
  var b = h("b", null, "Café, Graça & Fralda"); b.appendChild(h("span", "selo", "✓")); b.lastChild.setAttribute("title", "Postagem oficial");
  who.append(b, h("small", null, sub));
  top.append(av, who);
  if (tag) top.appendChild(h("span", "post-tag", tag));
  return top;
}
function linkBtn(cls, href, ic, label){ var a = h("a", "btn btn-sm " + cls); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.append(icon(ic), document.createTextNode(label)); return a; }
function renderDestaque(){
  var el = $("destaqueDevo"); if (!el || typeof FEATURED === "undefined") return;
  el.innerHTML = "";
  var a = FEATURED;
  el.appendChild(casaHead("Devocional desta semana · 5 minutos", "📖 Devocional"));
  el.appendChild(h("h3", null, a.title));
  el.appendChild(h("p", "of-verse", "“" + a.passage[0] + "” — " + a.passage[1]));
  el.appendChild(h("p", "post-text", (a.body && a.body[0]) || ""));
  var acts = h("div", "post-acts");
  var read = h("button", null); read.type = "button"; read.append(icon("i-book"), document.createTextNode("Ler agora")); read.addEventListener("click", function(){ openReader(a); });
  acts.append(read, linkBtn("", "https://wa.me/?text=" + encodeURIComponent(shareText(a)), "i-share", "Compartilhar"));
  var more = h("button", null); more.type = "button"; more.append(icon("i-arrow"), document.createTextNode("Anteriores")); more.addEventListener("click", function(){ go("dacasa", "devocional"); });
  acts.appendChild(more);
  el.appendChild(acts);
}
function renderOficial(){
  var box = $("oficialList"); if (!box) return;
  box.innerHTML = "";
  if (!oficial.items.length) {
    var e = h("div", "empty card"); e.append(h("h3", null, "Em breve, mais novidades da casa"), h("p", null, "Avisos, convites e indicações de parceiros aparecem aqui.")); box.appendChild(e); return;
  }
  oficial.items.forEach(function(it){
    var el = h("article", "post oficial");
    el.appendChild(casaHead(ago(it.criado_em) + (it.fixado ? " · 📌 fixado" : ""), TIPO_OF[it.tipo] || "📣 Aviso"));
    el.appendChild(h("h3", null, it.titulo));
    el.appendChild(h("p", "post-text", it.texto));
    if (it.imagem) { var im = h("img", "post-img"); im.src = ofImgUrl(it.imagem); im.alt = it.titulo; im.loading = "lazy"; el.appendChild(im); }
    if (it.tipo === "parceiro") el.appendChild(h("p", "ad-note", "Indicação de parceiro (publicidade). Confira sempre antes de contratar."));
    var acts = h("div", "post-acts");
    if (it.link) acts.appendChild(linkBtn("", it.link, "i-arrow", it.link_texto || "Saiba mais"));
    acts.appendChild(linkBtn("", "https://wa.me/?text=" + encodeURIComponent(ofShareText(it)), "i-share", "Compartilhar"));
    el.appendChild(acts);
    box.appendChild(el);
  });
}
function loadOficial(){
  if (!sb) { renderOficial(); return; }
  sb.from("oficiais").select("id,tipo,titulo,texto,imagem,link,link_texto,fixado,criado_em").eq("publicado", true).order("fixado", { ascending: false }).order("criado_em", { ascending: false }).limit(30).then(function(r){
    if (r.data) { oficial.items = r.data; oficial.loaded = true; }
    renderOficial();
  });
}
viewHooks.dacasa = function(sub){ if (sub !== "devocional") { renderDestaque(); loadOficial(); } };
