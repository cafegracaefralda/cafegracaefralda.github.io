// Compartilhar no Instagram: gera uma imagem (1080x1350) com a logo e o conteúdo. No celular abre o menu de compartilhar
// (escolha Instagram: Feed ou Stories); no computador baixa a imagem e copia a legenda. Publicar sozinho no perfil exigiria a API da Meta (servidor).
function igDesenhar(o, logo){
  var W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d");
  g.fillStyle = "#1D1A17"; g.fillRect(0, 0, W, H); g.fillStyle = "#E2A07C"; g.fillRect(0, 0, W, 10);
  if (logo) g.drawImage(logo, W / 2 - 80, 80, 160, 151);
  g.textAlign = "center"; g.fillStyle = "#E2A07C"; g.font = "600 28px Arial, sans-serif"; g.fillText(String(o.tag || "CAFÉ, GRAÇA & FRALDA").toUpperCase(), W / 2, 310);
  g.fillStyle = "#F6EBDD"; var y = 420;
  if (o.title) {
    g.font = "600 70px Georgia, serif";
    cartaoQuebra(g, o.title, 900).slice(0, 3).forEach(function(l){ g.fillText(l, W / 2, y); y += 84; });
    g.font = "italic 40px Georgia, serif"; g.fillStyle = "#E9DCCB"; y += 40;
  } else { g.font = "italic 56px Georgia, serif"; y = 470; }   // só texto: a frase vira o destaque
  var lh = o.title ? 58 : 78;
  cartaoQuebra(g, String(o.body || "").slice(0, 300), 860).slice(0, 9).forEach(function(l){ g.fillText(l, W / 2, y); y += lh; });
  g.fillStyle = "#E2A07C"; g.font = "600 34px Arial, sans-serif"; g.fillText("Café, Graça & Fralda", W / 2, H - 120);
  g.fillStyle = "#9d9388"; g.font = "400 28px Arial, sans-serif"; g.fillText("cafegracaefralda.github.io", W / 2, H - 76);
  return c;
}
function igCompartilhar(o){
  toast("Preparando a imagem…");
  cartaoLogo().then(function(logo){
    igDesenhar(o, logo).toBlob(function(blob){
      if (!blob) return toast("Não foi possível gerar a imagem.");
      var legenda = (o.title ? o.title + "\n\n" : "") + (o.body ? String(o.body).slice(0, 300) + "\n\n" : "") + "Café, Graça & Fralda · " + SITE_URL + "\n#cafegracaefralda #familia #fe";
      var file = new File([blob], "cafe-graca-fralda.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text: legenda }).catch(function(){}); return; }
      var a = h("a"); a.href = URL.createObjectURL(blob); a.download = "cafe-graca-fralda.png"; document.body.appendChild(a); a.click(); a.remove();
      copyText(legenda, "Imagem baixada e legenda copiada. Abra o Instagram, publique a imagem e cole a legenda.");
    }, "image/png");
  });
}
function igBtn(o, cls){
  var b = h("button", cls || null); b.type = "button"; b.append(icon("i-ig"), document.createTextNode("Instagram"));
  b.addEventListener("click", function(){ igCompartilhar(typeof o === "function" ? o() : o); }); return b;
}
