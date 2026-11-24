// Telas: cada área é uma tela (como num aplicativo). O endereço (#mesa, #mensagens...) escolhe a tela e a aba.
var VIEWS = ["inicio", "prateleira", "mesa", "mensagens", "indicacoes", "cafe", "palestra", "sobre", "painel"];
var ALIAS = { dacasa: "prateleira", devocional: "prateleira:devocional", novidades: "prateleira:devocional", artigos: "prateleira:devocional", textos: "prateleira:devocional", lazer: "mesa:lazer", stories: "mesa",
              feed: "mesa", mural: "mesa", comunidade: "mesa", postagens: "mesa", chat: "mesa", comentarios: "mesa", privado: "mensagens",
              agendar: "cafe", cadeira: "cafe", contato: "sobre", palestras: "palestra", convite: "palestra", app: "sobre", aprendemos: "inicio", manifesto: "inicio" };
var route = { view: "", sub: "" };
var viewHooks = {};  // viewHooks[tela] = function(aba): roda quando a tela abre
var NAV_OF = { palestra: "cafe" };  // telas que acendem outro item do menu

function parseHash(){
  var p = (location.hash || "").replace(/^#\/?/, "").split("/"), v = p[0], s = p[1] || "";
  if (ALIAS[v]) { var a = ALIAS[v].split(":"); v = a[0]; s = s || a[1] || ""; }
  if (VIEWS.indexOf(v) < 0) v = "inicio";
  return { view: v, sub: s };
}
function isShown(view){ return route.view === view; }
function currentSub(view){ var b = $$(".seg button[aria-selected='true']", $("v-" + view))[0]; return b ? b.getAttribute("data-sub") : ""; }
function setSub(viewEl, sub){
  var tabs = $$(".seg button[data-sub]", viewEl), panels = $$("[data-sub-panel]", viewEl);
  var names = tabs.map(function(b){ return b.getAttribute("data-sub"); });
  if (!names.length) return "";
  if (names.indexOf(sub) < 0) sub = names[0];
  tabs.forEach(function(b){ b.setAttribute("aria-selected", b.getAttribute("data-sub") === sub); });
  panels.forEach(function(p){ p.classList.toggle("on", p.getAttribute("data-sub-panel") === sub); });
  return sub;
}
function setCurrentNav(view){
  var key = NAV_OF[view] || view;
  $$("[data-tab]").forEach(function(a){ if (a.getAttribute("data-tab") === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}

function renderRoute(){
  var r = parseHash(), prev = route.view;
  document.body.classList.toggle("painel-mode", r.view === "painel");
  $$(".view").forEach(function(v){ v.classList.toggle("on", v.getAttribute("data-view") === r.view); });
  var viewEl = $("v-" + r.view);
  r.sub = setSub(viewEl, r.sub);
  route = r;
  document.body.setAttribute("data-view", r.view);
  setCurrentNav(r.view);
  if (prev !== r.view) { if (prev === "mensagens" && typeof stopDm === "function") stopDm(); window.scrollTo({ top: 0, behavior: "auto" }); }
  if (viewHooks[r.view]) viewHooks[r.view](r.sub);
}
function go(view, sub){ history.pushState(null, "", "#" + view + (sub ? "/" + sub : "")); renderRoute(); }
window.addEventListener("hashchange", renderRoute);

// Links internos (#mesa, #cafe/meus...) trocam de tela mesmo quando o endereço já é o mesmo
document.addEventListener("click", function(e){
  var a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  var href = a.getAttribute("href"), name = href.slice(1).split("/")[0];
  if (VIEWS.indexOf(name) < 0 && !ALIAS[name]) return;
  e.preventDefault(); history.pushState(null, "", href); renderRoute();
});

// Abas internas de cada tela (segmented control): trocam o painel sem recarregar
$$(".seg button[data-sub]").forEach(function(b){
  b.addEventListener("click", function(){
    var viewEl = b.closest(".view"), v = viewEl.getAttribute("data-view"), s = b.getAttribute("data-sub");
    setSub(viewEl, s); history.replaceState(null, "", "#" + v + "/" + s);
    route.sub = s;
    if (viewHooks[v]) viewHooks[v](s);
  });
});

// Menu do celular ("Mais")
var menuBtn = $("menuBtn"), navEl = $("nav");
function setMenu(open){ navEl.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu"); menuBtn.querySelector("use").setAttribute("href", open ? "#i-x" : "#i-menu"); }
menuBtn.addEventListener("click", function(){ setMenu(!navEl.classList.contains("open")); });
$("tabMore").addEventListener("click", function(){ setMenu(!navEl.classList.contains("open")); });
navEl.addEventListener("click", function(e){ if (e.target.closest("a")) setMenu(false); });
document.addEventListener("click", function(e){ if (navEl.classList.contains("open") && !navEl.contains(e.target) && !e.target.closest("#menuBtn, #tabMore")) setMenu(false); });

$("readToday").addEventListener("click", function(){ openReader(FEATURED); });
