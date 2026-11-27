// Fotos do post: carrossel (deslizar) e, ao tocar numa foto, ela abre inteira num visualizador. Toque duplo curte.
var lb = { srcs: [], i: 0, x0: null };
function lbMostrar(){
  $("lbImg").src = lb.srcs[lb.i]; $("lbCount").textContent = lb.srcs.length > 1 ? (lb.i + 1) + " / " + lb.srcs.length : "";
  $("lbPrev").hidden = lb.i === 0; $("lbNext").hidden = lb.i >= lb.srcs.length - 1;
}
function lbAbrir(srcs, i){ lb.srcs = srcs.filter(Boolean); if (!lb.srcs.length) return; lb.i = Math.min(i, lb.srcs.length - 1); lbMostrar(); if (!$("lbDlg").open) $("lbDlg").showModal(); }
function lbIr(d){ var n = lb.i + d; if (n < 0 || n >= lb.srcs.length) return; lb.i = n; lbMostrar(); }
$("lbClose").addEventListener("click", function(){ $("lbDlg").close(); });
$("lbPrev").addEventListener("click", function(){ lbIr(-1); });
$("lbNext").addEventListener("click", function(){ lbIr(1); });
$("lbDlg").addEventListener("click", function(e){ if (e.target === $("lbDlg")) $("lbDlg").close(); });
$("lbDlg").addEventListener("keydown", function(e){ if (e.key === "ArrowLeft") lbIr(-1); if (e.key === "ArrowRight") lbIr(1); });
$("lbDlg").addEventListener("touchstart", function(e){ lb.x0 = e.touches[0].clientX; }, { passive: true });
$("lbDlg").addEventListener("touchend", function(e){ if (lb.x0 == null) return; var dx = e.changedTouches[0].clientX - lb.x0; lb.x0 = null; if (Math.abs(dx) > 50) lbIr(dx < 0 ? 1 : -1); });

function galeria(srcs, alt, onDouble){
  var n = srcs.length, wrap = h("div", "gal" + (n > 1 ? " multi" : "")), track = h("div", "gal-track"), heart = h("span", "post-heart"), tap = 0, timer = null;
  heart.appendChild(icon("i-heart"));
  srcs.forEach(function(src, k){
    var im = h("img", "post-img"); im.alt = alt + (n > 1 ? " " + (k + 1) + " de " + n : ""); im.loading = "lazy"; im.draggable = false;
    if (src) im.src = src; else im.hidden = true;
    im.addEventListener("click", function(){
      var agora = Date.now();
      if (onDouble && agora - tap < 300) { clearTimeout(timer); tap = 0; heart.classList.remove("pop"); void heart.offsetWidth; heart.classList.add("pop"); onDouble(); return; }
      tap = agora; clearTimeout(timer); timer = setTimeout(function(){ lbAbrir(srcs, k); }, onDouble ? 280 : 0);
    });
    track.appendChild(im);
  });
  wrap.append(track, heart);
  if (n > 1) {
    var cnt = h("span", "gal-count", "1/" + n), dots = h("div", "gal-dots"), ds = [];
    for (var k = 0; k < n; k++) { var d = h("i", k === 0 ? "on" : null); ds.push(d); dots.appendChild(d); }
    var prev = h("button", "gal-nav prev", "‹"), next = h("button", "gal-nav next", "›");
    prev.type = next.type = "button"; prev.setAttribute("aria-label", "Foto anterior"); next.setAttribute("aria-label", "Próxima foto");
    function ir(d2){ track.scrollBy({ left: d2 * track.clientWidth, behavior: "smooth" }); }
    prev.addEventListener("click", function(e){ e.stopPropagation(); ir(-1); }); next.addEventListener("click", function(e){ e.stopPropagation(); ir(1); });
    track.addEventListener("scroll", function(){
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); cnt.textContent = (i + 1) + "/" + n;
      ds.forEach(function(x, j){ x.className = j === i ? "on" : ""; }); prev.hidden = i === 0; next.hidden = i >= n - 1;
    }, { passive: true });
    prev.hidden = true;
    wrap.append(cnt, prev, next, dots);
  }
  return wrap;
}
