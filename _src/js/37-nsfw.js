// Barreira de nudez no próprio aparelho: a foto é analisada ANTES de sair do celular (nada é enviado para terceiros).
// Carrega o modelo só na primeira foto. Se não conseguir carregar (sem internet/bloqueio), segue sem a análise e a moderação por denúncia continua valendo.
var nsfw = { model: null, loading: null, falhou: false };
function nsfwCarregaScript(src){
  return new Promise(function(ok, erro){ var s = document.createElement("script"); s.src = src; s.async = true; s.crossOrigin = "anonymous"; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
}
function nsfwModelo(){
  if (nsfw.model) return Promise.resolve(nsfw.model);
  if (nsfw.falhou) return Promise.resolve(null);
  if (!nsfw.loading) nsfw.loading = Promise.race([
    nsfwCarregaScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js").then(function(){ return nsfwCarregaScript("https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js"); }).then(function(){ return window.nsfwjs.load(); }),
    new Promise(function(_, no){ setTimeout(function(){ no(new Error("tempo")); }, 20000); })
  ]).then(function(m){ nsfw.model = m; return m; }).catch(function(){ nsfw.falhou = true; return null; });
  return nsfw.loading;
}
function nsfwBloqueia(previsoes){
  var p = {}; previsoes.forEach(function(x){ p[x.className] = x.probability; });
  return (p.Porn || 0) > 0.45 || (p.Hentai || 0) > 0.45 || (p.Sexy || 0) > 0.8;
}
// Devolve uma Promise que resolve se a imagem pode seguir e rejeita (nsfw) se parecer conteúdo adulto
function nsfwGuard(canvas){
  var analisar = window.__nsfwStub ? Promise.resolve(window.__nsfwStub) : nsfwModelo().then(function(m){ return m && { classify: function(c){ return m.classify(c); } }; });
  return analisar.then(function(m){
    if (!m) return;
    return Promise.resolve(m.classify(canvas)).then(function(pr){
      if (nsfwBloqueia(pr)) { toast("Essa imagem parece ter conteúdo adulto e não pode ser enviada. Aqui é uma comunidade de famílias."); throw new Error("nsfw"); }
    });
  });
}
