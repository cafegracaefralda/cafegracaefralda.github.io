// Profissionais da Casa: perfis com selo ✓ (saúde e fé). A pessoa pede e a mensagem sai pronta no WhatsApp.
var proFilter = "all";
function proLink(cls, href, ic, label){ var a = h("a", "btn btn-sm " + cls); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.append(icon(ic), document.createTextNode(label)); return a; }
function goForm(tema){ if (tema) $("p-tema").value = tema; $("proForm").scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(function(){ $("p-name").focus(); }, 400); }
function renderPros(){
  var box = $("proList"); box.innerHTML = "";
  PROS.forEach(function(p){
    if (proFilter !== "all" && p.area !== proFilter) return;
    var el = h("article", "pro"), top = h("div", "pro-top"), ring = h("span", "pro-ring"), who = h("div", "pro-who");
    ring.appendChild(h("span", null, initial(p.nome.replace(/^(Dra?\.) /, ""))));
    var nm = h("h3", null, p.nome); var s = h("span", "selo", "✓"); s.title = "Profissional da Casa: pessoa de confiança da comunidade"; s.setAttribute("aria-label", "Profissional da Casa"); nm.appendChild(s);
    who.append(nm, h("p", "pro-role", p.papel), h("span", "post-tag", p.area === "saude" ? "🩺 Saúde" : "🙏 Fé e família"));
    top.append(ring, who); el.appendChild(top);
    if (p.resumo) el.appendChild(h("p", "pro-bio", p.resumo));
    if (p.ajuda) {
      el.appendChild(h("span", "pro-sub", "Posso ajudar com"));
      var list = h("div", "pro-help");
      p.ajuda.forEach(function(a){
        var chip = h("button", "pro-chip"); chip.type = "button"; chip.append(h("b", null, a[0]), h("small", null, a[1]));
        chip.addEventListener("click", function(){ goForm(a[0] + " (" + p.nome.split(" ")[0] + ")"); });
        list.appendChild(chip);
      });
      el.appendChild(list);
    }
    var acts = h("div", "pro-acts");
    if (p.whatsapp) acts.appendChild(proLink("btn-wa", waLink("Oi, " + p.nome.split(" ")[0] + "! Vim pela área Profissionais da Casa do Café, Graça & Fralda e gostaria de conversar.", p.whatsapp), "i-wa", "Chamar no WhatsApp"));
    if (p.site) acts.appendChild(proLink("btn-terra", p.site, "i-arrow", "Conhecer o site"));
    if (p.instagram) acts.appendChild(proLink("btn-ghost", "https://instagram.com/" + p.instagram, "i-ig", "@" + p.instagram));
    var need = h("button", "btn btn-ghost btn-sm"); need.type = "button"; need.append(icon("i-cup"), document.createTextNode("Preciso deste profissional"));
    need.addEventListener("click", function(){ goForm(p.area === "saude" ? p.nome + " (" + p.papel.toLowerCase() + ")" : "Aconselhamento familiar (" + p.nome.split(" ")[0] + ")"); });
    acts.appendChild(need); el.appendChild(acts);
    box.appendChild(el);
  });
}
filterChips("proFilters", function(f){ proFilter = f; renderPros(); });
renderPros();
$("casaCta").addEventListener("click", function(){ goForm(); });

var proForm = $("proForm"), proStatus = $("proStatus");
proForm.addEventListener("submit", function(e){
  e.preventDefault();
  if ($("p-site").value) return setStatus(proStatus, "Pronto! Obrigado.", "ok");  // isca contra robôs
  var d = { nome: val("p-name"), cidade: val("p-city"), tema: $("p-tema").value, formato: (proForm.querySelector('input[name="p-format"]:checked') || {}).value || "Chamada no WhatsApp", msg: val("p-msg") };
  if (!d.nome) return setStatus(proStatus, "Digite seu nome.", "err");
  if (!d.cidade) return setStatus(proStatus, "Informe a sua cidade e estado.", "err");
  var texto = "Oi! Preciso de um profissional da Casa.\n\nNome: " + d.nome + "\nCidade: " + d.cidade + "\nCom quem ou sobre o quê: " + d.tema + "\nComo prefiro: " + d.formato + (d.msg ? "\n\nMensagem: " + d.msg : "");
  var url = waLink(texto), a = h("a", "link", "toque aqui"); a.href = url; a.target = "_blank"; a.rel = "noopener";
  setStatus(proStatus, "", ""); proStatus.className = "status ok";
  proStatus.append(document.createTextNode("Abrindo o WhatsApp com a sua mensagem pronta. Se não abrir, "), a, document.createTextNode("."));
  window.open(url, "_blank", "noopener");
});
