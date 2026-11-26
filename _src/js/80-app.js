// Instalar o app (PWA): um toque instala (Android/Chrome); no iPhone abre o passo a passo. A barra fica no topo e na tela de entrada.
(function(){
  var sec = $("app"), btn = $("installBtn"), ios = $("iosHelp"), lw = $("lwInstall");
  var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (!document.querySelector('link[rel="manifest"]') || standalone) return;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var deferred = null, dispensado = false;  // o X só some com a barra nesta visita: ao entrar de novo, ela volta até a pessoa instalar
  function mostrar(on){ sec.hidden = !on || dispensado; lw.hidden = !on; document.body.classList.toggle("has-install", !sec.hidden); }
  window.addEventListener("beforeinstallprompt", function(e){ e.preventDefault(); deferred = e; mostrar(true); });
  window.addEventListener("appinstalled", function(){ deferred = null; mostrar(false); toast("App instalado!"); });
  if (isIOS) mostrar(true);
  function instalar(){
    if (!deferred && isIOS) { $("iosSafari").hidden = !/crios|fxios|edgios/i.test(navigator.userAgent); }
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function(r){ deferred = null; if (r && r.outcome !== "accepted") mostrar(false); }); } else ios.showModal();
  }
  btn.addEventListener("click", instalar); lw.addEventListener("click", instalar);
  $("installX").addEventListener("click", function(){ dispensado = true; mostrar(true); });
  $("iosClose").addEventListener("click", function(){ ios.close(); });
  ios.addEventListener("click", function(e){ if (e.target === ios) ios.close(); });
})();

$("year").textContent = new Date().getFullYear();
applyAuthUI();
renderRoute();
