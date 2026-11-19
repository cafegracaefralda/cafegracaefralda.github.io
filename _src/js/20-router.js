// Página única: as seções ficam empilhadas e o menu rola até elas. #painel abre uma página só do Denny.
var VIEWS = ["inicio", "devocional", "cafe", "comunidade", "palestra", "sobre", "painel"];
var ALIAS = { agendar: "cafe", cadeira: "cafe", mesa: "comunidade", indicacoes: "comunidade:indicacoes", comentarios: "comunidade:comentarios",
              contato: "sobre", palestras: "palestra", convite: "palestra", novidades: "devocional", artigos: "devocional", textos: "devocional", app: "sobre", aprendemos: "inicio", manifesto: "inicio" };
var route = { view: "", sub: "" };
var viewHooks = {};  // viewHooks[view] = function(sub): roda quando a seção aparece na tela
var seen = {};       // seções que estão (ou estão quase) na tela

function parseHash(){
  var p = (location.hash || "").replace(/^#\/?/, "").split("/"), v = p[0], s = p[1] || "";
  if (ALIAS[v]) { var a = ALIAS[v].split(":"); v = a[0]; s = s || a[1] || ""; }
  if (VIEWS.indexOf(v) < 0) v = "inicio";
  return { view: v, sub: s };
}
function isShown(view){ return !!seen[view] || route.view === view; }
function currentSub(view){ var b = $$(".seg button[aria-selected='true']", $("v-" + view))[0]; return b ? b.getAttribute("data-sub") : ""; }
function setSub(viewEl, sub){
  var tabs = $$(".seg button[data-sub]", viewEl), panels = $$("[data-sub-panel]", viewEl);
  var names = tabs.map(function(b){ return b.getAttribute("data-sub"); });
  if (names.indexOf(sub) < 0) sub = names[0];
  tabs.forEach(function(b){ b.setAttribute("aria-selected", b.getAttribute("data-sub") === sub); });
  panels.forEach(function(p){ p.classList.toggle("on", p.getAttribute("data-sub-panel") === sub); });
  return sub;
}
function setCurrentNav(view){
  $$("[data-tab]").forEach(function(a){ if (a.getAttribute("data-tab") === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}

function renderRoute(){
  var r = parseHash(), prev = route.view, first = prev === "";
  document.body.classList.toggle("painel-mode", r.view === "painel");
  var viewEl = $("v-" + r.view);
  r.sub = setSub(viewEl, r.sub);
  route = r;
  document.body.setAttribute("data-view", r.view);
  setCurrentNav(r.view);
  if (!(first && !location.hash)) {
    if (r.view === "painel" || r.view === "inicio") window.scrollTo({ top: 0, behavior: first ? "auto" : "smooth" });
    else viewEl.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "start" });
  }
  if (r.view === "painel" && viewHooks.painel) viewHooks.painel(r.sub);
  else if (viewHooks[r.view]) viewHooks[r.view](r.sub);
}
function go(view, sub){ history.pushState(null, "", "#" + view + (sub ? "/" + sub : "")); renderRoute(); }
window.addEventListener("hashchange", renderRoute);

// Links internos (#cafe, #comunidade/comentarios...) rolam até a seção mesmo quando o endereço já é o mesmo
document.addEventListener("click", function(e){
  var a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  var href = a.getAttribute("href"), name = href.slice(1).split("/")[0];
  if (VIEWS.indexOf(name) < 0 && !ALIAS[name]) return;
  e.preventDefault(); history.pushState(null, "", href); renderRoute();
});

// Abas internas de cada seção (segmented control): trocam o painel sem rolar a página
$$(".seg button[data-sub]").forEach(function(b){
  b.addEventListener("click", function(){
    var viewEl = b.closest(".view"), v = viewEl.getAttribute("data-view"), s = b.getAttribute("data-sub");
    setSub(viewEl, s); history.replaceState(null, "", "#" + v + "/" + s);
    if (viewHooks[v]) viewHooks[v](s);
  });
});

// Menu do celular
var menuBtn = $("menuBtn"), navEl = $("nav");
function setMenu(open){ navEl.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu"); menuBtn.querySelector("use").setAttribute("href", open ? "#i-x" : "#i-menu"); }
menuBtn.addEventListener("click", function(){ setMenu(!navEl.classList.contains("open")); });
navEl.addEventListener("click", function(e){ if (e.target.closest("a")) setMenu(false); });

// Carrega os dados de cada seção quando ela chega perto da tela, e marca no menu a seção atual
var viewEls = ["inicio", "devocional", "cafe", "comunidade", "palestra", "sobre"].map(function(v){ return $("v-" + v); });
if ("IntersectionObserver" in window) {
  var loader = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var v = e.target.getAttribute("data-view"), was = seen[v];
      seen[v] = e.isIntersecting;
      if (e.isIntersecting && !was && viewHooks[v]) viewHooks[v](currentSub(v));
      if (!e.isIntersecting && v === "comunidade") stopChat();
    });
  }, { rootMargin: "250px 0px 250px 0px" });
  var spy = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if (e.isIntersecting && route.view !== "painel") setCurrentNav(e.target.getAttribute("data-view")); });
  }, { rootMargin: "-40% 0px -55% 0px" });
  viewEls.forEach(function(el){ loader.observe(el); spy.observe(el); });
} else {
  viewEls.forEach(function(el){ seen[el.getAttribute("data-view")] = true; });
}

$("readToday").addEventListener("click", function(){ openReader(FEATURED); });
