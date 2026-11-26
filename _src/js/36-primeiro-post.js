// Primeiro post: toda vez que entrar, até a pessoa publicar o primeiro, aparece o convite para se apresentar.
var pmFeito = false;
function pmTentar(tentativa){
  if (pmFeito || !auth.user || !sb) return;
  if (navigator.webdriver && !window.__forcaPrimeiroPost) return;  // testes automáticos não são interrompidos
  if ($("contatoDlg").open || $("pfDlg").open) { if (tentativa < 12) setTimeout(function(){ pmTentar(tentativa + 1); }, 2500); return; }
  pmFeito = true;
  Promise.all([
    sb.from("posts").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id),
    sb.from("pubs").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("oficial", false)
  ]).then(function(r){
    if ((r[0].count || 0) + (r[1].count || 0) > 0 || r[0].error) return;
    var nome = firstName(auth.name());
    $("pmTexto").value = "Oi, eu sou " + nome + ", de ____. Vim conhecer a comunidade e estou feliz de estar aqui. ☕";
    setStatus($("pmStatus"), ""); $("primeiroDlg").showModal();
  });
}
auth.on(function(){ if (auth.user) setTimeout(function(){ pmTentar(0); }, 3500); else pmFeito = false; });
$("pmClose").addEventListener("click", function(){ $("primeiroDlg").close(); });
$("pmPublicar").addEventListener("click", function(){
  var t = $("pmTexto").value.trim(), st = $("pmStatus");
  if (t.length < 3) return setStatus(st, "Escreva uma frase para se apresentar.", "err");
  if (/____/.test(t)) return setStatus(st, "Complete de onde você é (troque os traços).", "err");
  $("pmPublicar").disabled = true; setStatus(st, "Publicando…");
  sb.from("posts").insert({ tipo: "conversa", texto: t }).then(function(r){
    $("pmPublicar").disabled = false;
    if (r.error) return setStatus(st, "Não foi possível publicar agora. Tente de novo.", "err");
    $("primeiroDlg").close(); toast("Primeiro post publicado! Bem-vinda(o) à mesa."); go("mesa"); if (typeof loadFeed === "function") loadFeed(true);
  });
});
