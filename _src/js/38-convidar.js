// Convidar amigos e conhecidos pelo WhatsApp: a pessoa digita o número e a conversa abre com o convite pronto.
var SITE_URL = "https://cafegracaefralda.github.io/";
function foneBR(v){
  var d = String(v || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (/^55\d{10,11}$/.test(d)) return d;
  return "";
}
function foneMask(v){
  var d = String(v || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length > 6) return "(" + d.slice(0, 2) + ") " + d.slice(2, d.length > 10 ? 7 : 6) + "-" + d.slice(d.length > 10 ? 7 : 6);
  if (d.length > 2) return "(" + d.slice(0, 2) + ") " + d.slice(2);
  return d;
}
function conviteTexto(nome){
  var eu = firstName(auth.name()), oi = nome ? "Oi, " + firstName(nome) + "!" : "Oi!";
  return oi + " Aqui é " + (eu || "um amigo") + ". Estou na *Café, Graça & Fralda*, uma comunidade para todas as famílias: conversa, dicas, indicações de profissionais e lugares, tudo com gente de confiança.\n\nAchei que você ia gostar. Entra por aqui:\n" + SITE_URL;
}
function abrirConvite(nome){
  if (!auth.user) return;
  $("ivNome").value = nome && !/\d/.test(nome) ? nome : ""; $("ivFone").value = nome && /\d/.test(nome) ? foneMask(nome) : "";
  setStatus($("ivStatus"), ""); $("ivContatos").hidden = !(navigator.contacts && navigator.contacts.select);
  $("ivLink").hidden = false; $("inviteDlg").showModal();
}
document.addEventListener("click", function(e){ var b = e.target.closest && e.target.closest("[data-invite]"); if (b) { e.preventDefault(); abrirConvite(); } });
$("ivClose").addEventListener("click", function(){ $("inviteDlg").close(); });
$("ivFone").addEventListener("input", function(){ this.value = foneMask(this.value); });
$("ivEnviar").addEventListener("click", function(){
  var f = foneBR($("ivFone").value), st = $("ivStatus");
  if (!f) return setStatus(st, "Confira o número: DDD + número, como (31) 91234-5678.", "err");
  window.open(waLink(conviteTexto($("ivNome").value.trim()), f), "_blank", "noopener");
  setStatus(st, "Abrimos o WhatsApp com o convite pronto. É só tocar em enviar. Quer convidar outra pessoa? Digite o próximo número.", "ok");
  $("ivNome").value = ""; $("ivFone").value = ""; $("ivNome").focus();
});
$("ivContatos").addEventListener("click", function(){
  navigator.contacts.select(["name", "tel"], { multiple: false }).then(function(r){
    var c = r && r[0]; if (!c) return;
    $("ivNome").value = (c.name && c.name[0]) || ""; $("ivFone").value = foneMask((c.tel && c.tel[0]) || "");
  }).catch(function(){});
});
$("ivLink").addEventListener("click", function(){
  var tx = conviteTexto("");
  if (navigator.share) return navigator.share({ title: "Café, Graça & Fralda", text: tx }).catch(function(){});
  window.open(waLink(tx, ""), "_blank", "noopener");
});
