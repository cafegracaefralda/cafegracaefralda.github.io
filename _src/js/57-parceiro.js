// Parcerias: clínicas, escolas e marcas pedem o selo ✓ ou patrocínio da Prateleira; a mensagem sai pronta no WhatsApp da equipe.
var ptDlg = $("partnerDlg");
function openPartner(e){ if (e) e.preventDefault(); setStatus($("ptStatus"), ""); ptDlg.showModal(); ptDlg.scrollTop = 0; }
$("partnerOpen").addEventListener("click", openPartner);
$("partnerOpen2").addEventListener("click", openPartner);
$("partnerClose").addEventListener("click", function(){ ptDlg.close(); });
ptDlg.addEventListener("click", function(e){ if (e.target === ptDlg) ptDlg.close(); });
$("ptForm").addEventListener("submit", function(e){
  e.preventDefault();
  var d = { nome: val("pt-name"), org: val("pt-org"), cidade: val("pt-city"), tema: $("pt-int").value, msg: val("pt-msg") }, st = $("ptStatus");
  if (!d.nome) return setStatus(st, "Digite seu nome.", "err");
  if (!d.org) return setStatus(st, "Informe o nome da clínica, escola ou marca.", "err");
  if (!d.cidade) return setStatus(st, "Informe a cidade e o estado.", "err");
  var texto = "Oi! Quero ser parceiro do Café, Graça & Fralda.\n\nNome: " + d.nome + "\nClínica, escola ou marca: " + d.org + "\nCidade: " + d.cidade + "\nInteresse: " + d.tema + (d.msg ? "\n\nO que ofereço: " + d.msg : "");
  var url = waLink(texto), a = h("a", "link", "toque aqui"); a.href = url; a.target = "_blank"; a.rel = "noopener";
  setStatus(st, "", "ok");
  st.append(document.createTextNode("Abrindo o WhatsApp com a sua mensagem pronta. Se não abrir, "), a, document.createTextNode("."));
  window.open(url, "_blank", "noopener");
});
