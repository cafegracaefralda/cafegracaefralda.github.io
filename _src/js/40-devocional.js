// 5 minutos: devocional da semana, anteriores, leitura em janela e cadastro de novidades.
var dlg = $("reader"), readerBody = $("readerBody");

function pageUrl(a){ return new URL("devocional/" + a.slug + "/", location.href).href; }
function devoLink(a){
  var l = h("a", null, a.title); l.href = "devocional/" + a.slug + "/";
  l.addEventListener("click", function(e){ if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); openReader(a); });
  return l;
}
function shareText(a){
  return "☕ *" + a.title + "*\n_Devocional de 5 minutos · Café, Graça & Fralda_\n\n“" + a.passage[0] + "”\n— " + a.passage[1] +
         "\n\nLeia completo, com oração: " + pageUrl(a);
}
function box(label, text){ var b = h("div", "devo-box"); b.append(h("span", "label", label), h("p", null, text)); return b; }

function openReader(a){
  readerBody.innerHTML = "";
  var title = h("h3", null, a.title); title.id = "readerTitle";
  var v = h("div", "verse", "“" + a.passage[0] + "”"); v.appendChild(h("span", "ref", a.passage[1]));
  readerBody.append(h("span", "label", "5 minutos para a sua casa · " + a.cat), title, h("span", "label", "O que a Bíblia diz sobre isso"), v);
  a.body.forEach(function(t){ readerBody.appendChild(h("p", null, t)); });
  readerBody.append(box("Para pensar", a.think), box("Para hoje", a.today), h("span", "label", "Se quiser, ore assim"), h("p", "devo-pray", a.prayer));
  var foot = h("div", "reader-foot"); foot.appendChild(h("span", "sig", "Café, Graça & Fralda"));
  function act(cls, href, ic, label){ var x = h("a", "btn btn-sm " + cls); x.href = href; x.target = "_blank"; x.rel = "noopener"; x.append(icon(ic), document.createTextNode(label)); return x; }
  foot.append(
    act("btn-wa", "https://wa.me/?text=" + encodeURIComponent(shareText(a)), "i-share", "Compartilhar no WhatsApp"),
    act("btn-ghost", waLink('Oi! Li o devocional "' + a.title + '" e queria conversar: '), "i-wa", "Conversar com a equipe")
  );
  var cm = h("button", "btn btn-sm btn-ghost"); cm.type = "button"; cm.append(icon("i-users"), document.createTextNode("Conversar na Mesa Grande"));
  cm.addEventListener("click", function(){ dlg.close(); go("mesa"); });
  foot.appendChild(cm);
  readerBody.appendChild(foot);
  dlg.showModal(); dlg.scrollTop = 0;
}
$("readerClose").addEventListener("click", function(){ dlg.close(); });
dlg.addEventListener("click", function(e){ if (e.target === dlg) dlg.close(); });

(function renderDevocional(){
  var feat = $("devoFeature"), main = h("div", "df-main"), tags = h("div", "df-tags");
  tags.append(h("span", "badge", "Novo"), h("span", "label", FEATURED.cat + " · 5 min"));
  var btn = h("button", "btn btn-terra"); btn.type = "button"; btn.append(icon("i-book"), document.createTextNode("Ler em 5 minutos"));
  btn.addEventListener("click", function(){ openReader(FEATURED); });
  var ft = h("h3"); ft.appendChild(devoLink(FEATURED));
  main.append(tags, ft, h("p", null, FEATURED.lede), btn);
  main.append(h("p", "df-next", SCHED.next
    ? "Próximo devocional: " + new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(SCHED.next)
    : "Novos devocionais em breve"));
  var side = h("div", "df-side"); side.setAttribute("aria-hidden", "true");
  side.append(h("b", null, "5"), h("span", null, "minutos"), h("p", null, "Um café, uma Palavra. Antes que o bebê acorde."));
  side.lastChild.style.cssText = "font-family:var(--serif);font-style:italic;font-size:19px;line-height:1.35;color:var(--night-ink);text-transform:none;letter-spacing:0;margin-top:8px";
  feat.append(main, side);

  var list = $("devoList");
  ARCHIVE.forEach(function(a, idx){
    var li = h("li", "row" + (idx >= 4 ? " extra" : "")), left = h("div"), meta = h("div", "meta");
    meta.append(h("span", "label", a.cat), h("span", "t", "5 min"));
    var rt = h("h3"); rt.appendChild(devoLink(a)); left.append(meta, rt);
    var go_ = h("button", "go"); go_.type = "button"; go_.setAttribute("aria-label", "Ler " + a.title); go_.appendChild(icon("i-arrow"));
    li.append(left, go_);
    li.addEventListener("click", function(){ openReader(a); });
    list.appendChild(li);
  });
  $("archiveWrap").hidden = ARCHIVE.length === 0;
  var more = $("moreDevos");
  if (ARCHIVE.length > 4) {
    more.hidden = false; more.textContent = "Ver todos (" + ARCHIVE.length + ")";
    more.addEventListener("click", function(){ var all = list.classList.toggle("all"); more.textContent = all ? "Ver menos" : "Ver todos (" + ARCHIVE.length + ")"; });
  }
})();

// Cadastro de novidades (e-mail + WhatsApp)
$("n-phone").addEventListener("input", maskPhone);
var newsForm = $("newsForm"), newsStatus = $("newsStatus");
function finishNews(){
  $("newsWa").href = waLink("Oi! Quero receber os devocionais do Café, Graça & Fralda por e-mail e WhatsApp.\nNome: " + val("n-name") + "\nE-mail: " + val("n-email"));
  newsForm.hidden = true; $("newsDone").hidden = false;
}
newsForm.addEventListener("submit", function(e){
  e.preventDefault();
  var nome = val("n-name"), email = val("n-email"), phone = val("n-phone").replace(/\D/g, "");
  if (!nome) return setStatus(newsStatus, "Digite seu nome.", "err");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus(newsStatus, "Confira o e-mail: ele precisa ter @ e domínio.", "err");
  if (phone.length < 10) return setStatus(newsStatus, "Informe o WhatsApp com DDD, por exemplo (81) 99999-9999.", "err");
  if (!$("n-consent").checked) return setStatus(newsStatus, "Marque a autorização para receber os devocionais.", "err");
  if (!sb) { finishNews(); return; }
  $("newsSend").disabled = true; setStatus(newsStatus, "Cadastrando…");
  sb.from("inscritos").insert({ nome: nome, email: email, whatsapp: "+55" + phone }).then(function(){ finishNews(); $("newsSend").disabled = false; });
});
