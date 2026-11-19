// Instalar o app (PWA) e inicialização.
(function(){
  var sec = $("app"), btn = $("installBtn"), ios = $("iosHelp");
  var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (!document.querySelector('link[rel="manifest"]') || standalone) return;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function(e){ e.preventDefault(); deferred = e; sec.hidden = false; });
  window.addEventListener("appinstalled", function(){ sec.hidden = true; });
  if (isIOS) sec.hidden = false;
  btn.addEventListener("click", function(){
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function(){ deferred = null; }); } else ios.showModal();
  });
  $("iosClose").addEventListener("click", function(){ ios.close(); });
  ios.addEventListener("click", function(e){ if (e.target === ios) ios.close(); });
})();

$("year").textContent = new Date().getFullYear();
applyAuthUI();
renderRoute();
