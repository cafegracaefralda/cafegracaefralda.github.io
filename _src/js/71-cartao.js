// Cartão de parceria: a administração gera uma imagem (logo + indicação) e a mensagem pronta para mandar no WhatsApp à pessoa indicada.
var cartao = { x: null, blob: null, texto: "", fone: "" };
function cartaoLogo(){
  return new Promise(function(res){
    var sym = document.getElementById("logo"); if (!sym) return res(null);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.5 -.4 25 23.4" width="500" height="470" color="#F6EBDD">' + sym.innerHTML.replace(/currentColor/g, "#F6EBDD") + "</svg>";
    var im = new Image(); im.onload = function(){ res(im); }; im.onerror = function(){ res(null); };
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
function cartaoQuebra(ctx, txt, max){
  var ws = String(txt).split(/\s+/), lines = [], cur = "";
  ws.forEach(function(w){ var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur); return lines;
}
function cartaoFone(c){
  var d = String(c || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55\d{10,11}$/.test(d) ? d : "";
}
function cartaoDesenhar(x, logo){
  var W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d");
  g.fillStyle = "#1D1A17"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#E2A07C"; g.fillRect(0, 0, W, 10);
  if (logo) g.drawImage(logo, W / 2 - 110, 90, 220, 207);
  g.textAlign = "center"; g.fillStyle = "#F6EBDD"; g.font = "600 46px Georgia, serif"; g.fillText("Café, Graça & Fralda", W / 2, 370);
  g.fillStyle = "#E2A07C"; g.font = "600 26px Arial, sans-serif"; g.fillText("INDICADO(A) PELA COMUNIDADE", W / 2, 470);
  g.fillStyle = "#F6EBDD"; g.font = "600 84px Georgia, serif"; var y = 590;
  cartaoQuebra(g, x.nome, 900).slice(0, 2).forEach(function(l){ g.fillText(l, W / 2, y); y += 98; });
  g.fillStyle = "#E2A07C"; g.font = "400 38px Arial, sans-serif"; g.fillText([x.especialidade, x.onde].filter(Boolean).join(" · "), W / 2, y + 6);
  g.fillStyle = "#F6EBDD"; g.font = "italic 40px Georgia, serif"; y += 100;
  cartaoQuebra(g, "“" + String(x.porque || "").slice(0, 230) + "”", 860).slice(0, 5).forEach(function(l){ g.fillText(l, W / 2, y); y += 58; });
  g.fillStyle = "#9d9388"; g.font = "400 30px Arial, sans-serif"; g.fillText("— " + (x.autor || "um membro") + ", da nossa comunidade", W / 2, y + 20);
  g.fillStyle = "#E2A07C"; g.font = "600 34px Arial, sans-serif"; g.fillText("cafegracaefralda.github.io", W / 2, H - 90);
  return c;
}
function cartaoMensagem(x){
  return "Olá, " + firstName(x.nome) + "! Tudo bem?\n\nAqui é da *Café, Graça & Fralda*, uma comunidade para todas as famílias. " + (x.autor ? "A " + x.autor + ", " : "Uma pessoa ") + "da nossa comunidade indicou o seu trabalho (" + x.especialidade + ") e a gente adorou conhecer.\n\nQueremos te convidar para uma *parceria* com a nossa comunidade. Posso te contar como funciona?\n\nConheça a casa: https://cafegracaefralda.github.io/";
}
function abrirCartao(x){
  cartao.x = x; cartao.texto = cartaoMensagem(x); cartao.fone = cartaoFone(x.contato);
  $("cdTexto").value = cartao.texto; setStatus($("cdStatus"), x.contato && !cartao.fone ? "O contato informado (“" + x.contato + "”) não é um telefone: o WhatsApp vai abrir para você escolher a conversa." : "");
  cartaoLogo().then(function(logo){
    var c = cartaoDesenhar(x, logo);
    c.toBlob(function(b){ cartao.blob = b; $("cdImg").src = URL.createObjectURL(b); $("cardDlg").showModal(); }, "image/png");
  });
}
function cartaoBaixar(){ if (!cartao.blob) return; var a = h("a"); a.href = URL.createObjectURL(cartao.blob); a.download = "indicacao-" + String(cartao.x.nome || "cartao").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png"; document.body.appendChild(a); a.click(); a.remove(); }
$("cdClose").addEventListener("click", function(){ $("cardDlg").close(); });
$("cdBaixar").addEventListener("click", cartaoBaixar);
$("cdEnviar").addEventListener("click", function(){
  var texto = $("cdTexto").value, file = cartao.blob && new File([cartao.blob], "indicacao.png", { type: "image/png" });
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], text: texto }).catch(function(){});   // no celular: escolha o WhatsApp e o contato; a imagem e a mensagem vão juntas
    return;
  }
  cartaoBaixar();
  window.open(waLink(texto, cartao.fone), "_blank", "noopener");
  setStatus($("cdStatus"), "A imagem foi baixada. No WhatsApp, toque no clipe e anexe a imagem antes de enviar.", "ok");
});
