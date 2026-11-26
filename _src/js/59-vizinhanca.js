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
$("vizBusca").addEventListener("input", function(){ viz.q = this.value.trim().toLowerCase(); renderFridge(); if (typeof renderLazer === "function") renderLazer(); });

// Dicas de busca: toque para preencher (especialista, cidade ou nome)
["Pediatra", "Obstetra", "Psicólogo", "Recife", "Salvador", "Belo Horizonte", "Restaurante", "Parque"].forEach(function(t){
  var b = h("button", null, t); b.type = "button";
  b.addEventListener("click", function(){ $("vizBusca").value = t; $("vizBusca").dispatchEvent(new Event("input")); });
  $("vizDicas").appendChild(b);
});
