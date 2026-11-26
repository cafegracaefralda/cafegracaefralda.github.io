// Vizinhança: tela limpa (busca + lista). Ao tocar em "Indicar", a pessoa escolhe o assunto e aparece o formulário certo.
var VIZ_OPCOES = [
  { v: "Saúde", e: "🩺", t: "p" }, { v: "Fé e religião", e: "⛪", t: "p" }, { v: "Educação", e: "📚", t: "p" }, { v: "Família", e: "👨‍👩‍👧", t: "p" }, { v: "Casa", e: "🏠", t: "p" },
  { v: "Lazer", e: "🌳", t: "l" }, { v: "Praças e parques", e: "🌿", t: "l" }, { v: "Esporte", e: "⚽", t: "l" }, { v: "Cultura", e: "🎭", t: "l" }, { v: "Filmes e séries", e: "🎬", t: "l" }, { v: "Comer", e: "🍽️", t: "l" }, { v: "Hospedagem", e: "🛏️", t: "l" },
  { v: "Outro", n: "Outros", e: "✨", t: "p" }
];
var vizDlg = $("vizDlg");
function vizReset(){
  $("vizPick").hidden = false; $("indWrap").hidden = true; $("lzForm").hidden = true;
  $("i-cat").closest(".field").hidden = false; $("lz-cat").closest(".field").hidden = false;
}
function vizClose(){ if (vizDlg.open) vizDlg.close(); }
VIZ_OPCOES.forEach(function(o){
  var b = h("button", "viz-op"); b.type = "button"; b.append(h("span", "viz-e", o.e), h("span", null, o.n || o.v));
  b.addEventListener("click", function(){
    $("vizPick").hidden = true;
    if (o.t === "p") { $("i-cat").value = o.v; $("i-cat").closest(".field").hidden = true; $("indOpen").click(); }
    else { $("lz-cat").value = o.v; $("lz-cat").closest(".field").hidden = true; $("lzOpen").click(); }
    vizDlg.scrollTop = 0;
  });
  $("vizGrid").appendChild(b);
});
$("vizNova").addEventListener("click", function(){ vizReset(); setStatus($("indStatus"), ""); setStatus($("lzStatus"), ""); vizDlg.showModal(); });
$("vizClose").addEventListener("click", vizClose);
vizDlg.addEventListener("click", function(e){ if (e.target === vizDlg) vizClose(); });
vizDlg.addEventListener("close", vizReset);
new MutationObserver(function(){ if (vizDlg.open && $("vizPick").hidden && $("indWrap").hidden && $("lzForm").hidden) vizClose(); }).observe($("lzForm"), { attributes: true, attributeFilter: ["hidden"] });
$("vizBusca").addEventListener("input", function(){ viz.q = this.value.trim().toLowerCase(); viz.n = 12; renderFridge(); if (typeof renderLazer === "function") renderLazer(); });

// Filtros: estado, cidade, assunto e "Da Casa ✓". A lista mostra 12 por vez ("Mostrar mais").
Object.keys(UFS).forEach(function(u){ var o = h("option", null, UFS[u] + " (" + u + ")"); o.value = u; $("vizUf").appendChild(o); var o2 = h("option", null, u); o2.value = u; $("i-uf").appendChild(o2); });
["Saúde","Família","Fé","Lazer","Comer","Hospedagem","Casa","Outros"].forEach(function(g){ var o = h("option", null, g); o.value = g; $("vizGrupo").appendChild(o); });
function vizCidades(){
  var sel = $("vizCidade"), set = {}; sel.innerHTML = ""; var o0 = h("option", null, "Todas as cidades"); o0.value = ""; sel.appendChild(o0);
  fridgeItems().forEach(function(p){ var l = vizLoc(p); if (l.uf === viz.uf && l.cidade) set[l.cidade] = 1; });
  Object.keys(set).sort(function(a, b){ return a.localeCompare(b, "pt-BR"); }).forEach(function(c){ var o = h("option", null, c); o.value = c; sel.appendChild(o); });
  sel.disabled = !viz.uf; sel.value = viz.cidade;
}
function vizAplicar(){
  viz.n = 12; renderFridge();
  $("lzUf").value = viz.uf; $("lzCidade").value = viz.cidade;   // os lugares indicados pelas famílias seguem o mesmo estado e cidade
  if (typeof loadLazer === "function") loadLazer(true);
  var lzOn = !viz.casa && (!viz.grupo || viz.grupo === "Lazer"); $("lzList").hidden = !lzOn; $("lzMore").hidden = !lzOn || !lz.more;
}
$("vizUf").addEventListener("change", function(){ viz.uf = this.value; viz.cidade = ""; vizCidades(); vizAplicar(); });
$("vizCidade").addEventListener("change", function(){ viz.cidade = this.value; vizAplicar(); });
$("vizGrupo").addEventListener("change", function(){ viz.grupo = this.value; vizAplicar(); });
$("vizCasa").addEventListener("click", function(){ viz.casa = !viz.casa; this.setAttribute("aria-pressed", viz.casa); vizAplicar(); });
$("vizMais").addEventListener("click", function(){ viz.n += 12; renderFridge(); });
