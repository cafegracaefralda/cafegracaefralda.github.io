// Indicar um profissional (membros logados). A indicação só aparece no site depois que a equipe aprova.
var indWrap = $("indWrap"), indForm = $("indForm");
function indSync(){ indForm.hidden = !auth.user; $("indGate").hidden = !!auth.user; }
auth.on(indSync); indSync();
$("indOpen").addEventListener("click", function(){ indWrap.hidden = !indWrap.hidden; if (!indWrap.hidden) indWrap.scrollIntoView({ behavior: "smooth", block: "center" }); });
$$('input[name="i-plano"]').forEach(function(r){
  r.addEventListener("change", function(){ var on = document.querySelector('input[name="i-plano"]:checked').value === "plano"; $("i-planos").hidden = !on; if (on) $("i-planos").focus(); });
});
indForm.addEventListener("submit", function(e){
  e.preventDefault();
  var st = $("indStatus");
  if ($("i-site").value) { setStatus(st, "Indicação enviada. Obrigado!", "ok"); return; }  // isca contra robôs
  var plano = document.querySelector('input[name="i-plano"]:checked').value;
  var row = { nome: val("i-nome"), especialidade: val("i-esp"), categoria: $("i-cat").value, atendimento: $("i-modo").value, onde: val("i-onde"),
              como_conheceu: val("i-como"), porque: val("i-porque"), contato: val("i-contato") || null, plano: plano, planos: plano === "plano" ? val("i-planos") : null };
  if (row.nome.length < 2 || row.especialidade.length < 2 || row.onde.length < 2 || row.como_conheceu.length < 2 || row.porque.length < 2) return setStatus(st, "Preencha nome, especialidade, onde fica, como conheceu e por que indica.", "err");
  if (plano === "plano" && (row.planos || "").length < 2) return setStatus(st, "Diga qual plano de saúde o profissional aceita.", "err");
  if (!sb || !auth.user) return setStatus(st, "Entre com o Google para indicar.", "err");
  $("indSend").disabled = true; setStatus(st, "Enviando…");
  sb.from("indicacoes_membros").insert(row).then(function(r){
    $("indSend").disabled = false;
    if (r.error) return setStatus(st, String(r.error.message || "").indexOf("muito_rapido") > -1 ? "Você já enviou várias indicações hoje. Volte amanhã." : "Não foi possível enviar agora. Tente de novo.", "err");
    indForm.reset(); $("i-planos").hidden = true;
    setStatus(st, "Recebi! A equipe confere e publica em breve. Obrigado por indicar.", "ok");
    loadMemberInds(); if (typeof vizClose === "function") setTimeout(vizClose, 1600);
  });
});
