// Convite para palestra: a pessoa preenche os dados e a mensagem sai pronta no WhatsApp do Denny.
$("t-phone").addEventListener("input", maskPhone);
var talkForm = $("talkForm"), talkStatus = $("talkStatus");
talkForm.addEventListener("submit", function(e){
  e.preventDefault();
  var d = {
    nome: val("t-name"), zap: val("t-phone"), org: val("t-org"), cidade: val("t-city"), data: val("t-date"),
    publico: $("t-size").value, formato: (talkForm.querySelector('input[name="t-format"]:checked') || {}).value || "A combinar",
    tema: $("t-topic").value, msg: val("t-msg")
  };
  if (!d.nome) return setStatus(talkStatus, "Digite seu nome.", "err");
  if (d.zap.replace(/\D/g, "").length < 10) return setStatus(talkStatus, "Informe o seu WhatsApp com DDD, por exemplo (81) 99999-9999.", "err");
  if (!d.org) return setStatus(talkStatus, "Informe o nome da igreja ou organização.", "err");
  if (!d.cidade) return setStatus(talkStatus, "Informe a cidade do evento.", "err");
  var texto = "Oi, Denny! Gostaria de convidar você para uma palestra.\n\n" +
    "Nome: " + d.nome + "\nWhatsApp: " + d.zap + "\nIgreja/organização: " + d.org + "\nCidade: " + d.cidade +
    "\nData ou período: " + (d.data || "ainda a combinar") + "\nPúblico estimado: " + (d.publico || "ainda não sei") +
    "\nFormato: " + d.formato + "\nTema: " + d.tema + (d.msg ? "\n\nMensagem: " + d.msg : "");
  var url = waLink(texto);
  setStatus(talkStatus, "", "");
  var a = h("a", "link", "toque aqui"); a.href = url; a.target = "_blank"; a.rel = "noopener";
  talkStatus.className = "status ok";
  talkStatus.append(document.createTextNode("Abrindo o WhatsApp com a sua mensagem pronta. Se não abrir, "), a, document.createTextNode("."));
  window.open(url, "_blank", "noopener");
});
