// Telas (views) e navegação por hash: #inicio, #devocional, #cafe, #comunidade, #sobre, #painel
var VIEWS = ["inicio", "devocional", "cafe", "comunidade", "sobre", "painel"];
var ALIAS = { agendar: "cafe", cadeira: "cafe", mesa: "comunidade", indicacoes: "comunidade:indicacoes", comentarios: "comunidade:comentarios",
              contato: "sobre", novidades: "devocional", artigos: "devocional", textos: "devocional", app: "sobre", aprendemos: "inicio", manifesto: "inicio" };
var route = { view: "", sub: "" };
var viewHooks = {};  // viewHooks[view] = function(sub)

function parseHash(){
  var p = (location.hash || "").replace(/^#\/?/, "").split("/"), v = p[0], s = p[1] || "";
  if (ALIAS[v]) { var a = ALIAS[v].split(":"); v = a[0]; s = s || a[1] || ""; }
  if (VIEWS.indexOf(v) < 0) v = "inicio";
  return { view: v, sub: s };
}
function go(view, sub){ var hash = "#" + view + (sub ? "/" + sub : ""); if (location.hash === hash) renderRoute(); else location.hash = hash; }

function setSub(viewEl, sub){
  var tabs = $$(".seg button[data-sub]", viewEl);
  var panels = $$("[data-sub-panel]", viewEl);
  var names = tabs.map(function(b){ return b.getAttribute("data-sub"); });
  if (names.indexOf(sub) < 0) sub = names[0];
  tabs.forEach(function(b){ b.setAttribute("aria-selected", b.getAttribute("data-sub") === sub); });
  panels.forEach(function(p){ p.classList.toggle("on", p.getAttribute("data-sub-panel") === sub); });
  return sub;
}

function renderRoute(){
  var r = parseHash(), changed = r.view !== route.view;
  $$(".view").forEach(function(v){ v.classList.toggle("on", v.getAttribute("data-view") === r.view); });
  $$("[data-tab]").forEach(function(a){ if (a.getAttribute("data-tab") === r.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  var viewEl = $("v-" + r.view);
  r.sub = setSub(viewEl, r.sub);
  route = r;
  document.body.setAttribute("data-view", r.view);
  if (changed) window.scrollTo(0, 0);
  if (viewHooks[r.view]) viewHooks[r.view](r.sub);
}
window.addEventListener("hashchange", renderRoute);

// Abas internas de cada tela (segmented control) atualizam o hash
$$(".seg button[data-sub]").forEach(function(b){
  b.addEventListener("click", function(){ go(route.view, b.getAttribute("data-sub")); });
});
// Atalhos dentro da página
$("readToday").addEventListener("click", function(){ go("devocional"); setTimeout(function(){ openReader(FEATURED); }, 60); });
