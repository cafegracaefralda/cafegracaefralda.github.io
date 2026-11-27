// Compartilhar: "acabei de postar no Café, Graça & Fralda" + resumo + link do site (sem imagem).
// No celular abre o menu de compartilhar (escolha Instagram, WhatsApp...); no computador copia o texto com o link.
function igCompartilhar(o){
  var resumo = String(o.title || o.body || "").replace(/\s+/g, " ").trim(), corte = resumo.length > 120;
  resumo = resumo.slice(0, 120).trim();
  var abre = o.acao === "ler" ? "Acabei de ler no Café, Graça & Fralda" : "Acabei de postar no Café, Graça & Fralda";
  var texto = abre + (resumo ? ": “" + resumo + (corte ? "…" : "") + "”" : ".") + "\nVem conferir:";
  if (navigator.share) { navigator.share({ title: "Café, Graça & Fralda", text: texto, url: SITE_URL }).catch(function(){}); return; }
  copyText(texto + " " + SITE_URL, "Texto e link copiados. Cole no Instagram.");
}
function igBtn(o, cls){
  var b = h("button", cls || null); b.type = "button"; b.append(icon("i-ig"), document.createTextNode("Instagram"));
  b.setAttribute("aria-label", "Compartilhar o link no Instagram"); b.addEventListener("click", function(){ igCompartilhar(typeof o === "function" ? o() : o); }); return b;
}
