// Stories: fotos que somem em 24 horas. Só para quem entrou. Toque na pessoa para ver; "Seu story" para publicar.
var stories = { groups: [], urls: {}, cur: null, idx: 0, timer: null, file: null };
var storyInput = document.createElement("input"); storyInput.type = "file"; storyInput.accept = "image/*"; storyInput.hidden = true; document.body.appendChild(storyInput);
var STORY_MS = 5000;

function groupStories(rows){
  var by = {}, order = [];
  rows.forEach(function(s){ if (!by[s.user_id]) { by[s.user_id] = { user_id: s.user_id, nome: s.nome, items: [] }; order.push(by[s.user_id]); } by[s.user_id].items.push(s); });
  order.forEach(function(g){ g.last = g.items[g.items.length - 1].criado_em; });
  order.sort(function(a, b){ return a.user_id === uid() ? -1 : b.user_id === uid() ? 1 : (a.last < b.last ? 1 : -1); });
  return order;
}
function signStories(rows){
  var paths = rows.map(function(s){ return s.foto; }).filter(function(f){ return f && !stories.urls[f]; });
  if (!paths.length || !sb) return Promise.resolve();
  return sb.storage.from("mural").createSignedUrls(paths, 3600).then(function(r){ (r.data || []).forEach(function(x){ if (x.signedUrl && x.path) stories.urls[x.path] = x.signedUrl; }); }, function(){});
}
function loadStories(){
  if (!sb || !auth.user) return;
  sb.from("stories").select("id,user_id,nome,foto,legenda,criado_em").order("criado_em", { ascending: true }).limit(120).then(function(r){
    if (!r.data) return;
    var vivos = [], limite = Date.now() - 86400000;
    r.data.forEach(function(x){
      if (new Date(x.criado_em).getTime() > limite) vivos.push(x);
      else if (x.user_id === uid()) { sb.storage.from("mural").remove([x.foto]).then(function(){ return sb.from("stories").delete().eq("id", x.id).then(function(){}); }); }
    });
    signStories(vivos).then(function(){ stories.groups = groupStories(vivos); renderStories(); });
  });
}
function tile(label, letter, cls, onClick, badge, userId){
  var b = h("button", "person" + (cls ? " " + cls : "")); b.type = "button";
  var ring = h("span", "ring"), ini = h("span", null, letter); if (userId) avTag(ini, userId); ring.appendChild(ini);
  if (badge) ring.appendChild(h("i", "plus", "+"));
  b.append(ring, h("small", null, label)); b.addEventListener("click", onClick); return b;
}
function renderStories(){
  var row = $("storiesRow"); if (!row) return; row.innerHTML = "";
  var mine = stories.groups.filter(function(g){ return g.user_id === uid(); })[0];
  row.appendChild(tile("Seu story", initial(auth.name()), mine ? "" : "me", function(){ if (mine) openStory(mine); else storyInput.click(); }, true, uid()));
  stories.groups.forEach(function(g){
    if (g.user_id === uid()) return;
    row.appendChild(tile(g.nome || "Alguém", initial(g.nome), "", function(){ openStory(g); }, false, g.user_id));
  });

}

/* ---------- Novo story ---------- */
storyInput.addEventListener("change", function(){
  var f = storyInput.files && storyInput.files[0]; storyInput.value = ""; if (!f) return;
  shrinkPhoto(f).then(function(blob){
    stories.file = blob; $("storyNewImg").src = URL.createObjectURL(blob); $("storyCap").value = ""; $("storyNew").showModal();
  }, function(){ toast("Não consegui usar essa foto."); });
});
$("storyNewClose").addEventListener("click", function(){ $("storyNew").close(); stories.file = null; });
$("storyPost").addEventListener("click", function(){
  if (!stories.file || !sb || !auth.user) return;
  var btn = $("storyPost"); btn.disabled = true;
  var path = uid() + "/" + newUuid() + ".jpg";
  sb.storage.from("mural").upload(path, stories.file, { contentType: "image/jpeg", upsert: false }).then(function(u){
    if (u && u.error) throw new Error("foto");
    return sb.from("stories").insert({ foto: path, legenda: $("storyCap").value.trim() || null }).select("id");
  }).then(function(r){
    if (r.error) { sb.storage.from("mural").remove([path]); throw new Error(String(r.error.message || "").indexOf("muito_rapido") > -1 ? "rapido" : "story"); }
    $("storyNew").close(); stories.file = null; toast("Story publicado. Some em 24 horas."); loadStories();
  }).catch(function(err){ toast(err.message === "rapido" ? "Calma! Muitos stories hoje." : "Não foi possível publicar o story."); }).then(function(){ btn.disabled = false; });
});

/* ---------- Ver story (tela cheia no celular) ---------- */
function showStory(){
  var g = stories.cur, s = g.items[stories.idx], dlg = $("storyView");
  clearTimeout(stories.timer);
  var bars = $("storyBars"); bars.innerHTML = "";
  g.items.forEach(function(x, i){ var bar = h("span", "bar" + (i < stories.idx ? " done" : i === stories.idx ? " run" : "")); bar.appendChild(h("i")); bars.appendChild(bar); });
  $("storyAv").textContent = initial(g.nome); avTag($("storyAv"), g.user_id); $("storyNm").textContent = g.user_id === uid() ? "Você" : g.nome; $("storyTm").textContent = ago(s.criado_em);
  $("storyImg").src = stories.urls[s.foto] || ""; $("storyCapView").textContent = s.legenda || ""; $("storyCapView").hidden = !s.legenda;
  var acts = $("storyActs"); acts.innerHTML = "";
  if (g.user_id === uid()) {
    var add = h("button", "btn btn-ghost btn-sm", "Adicionar outro"); add.type = "button"; add.addEventListener("click", function(){ closeStory(); storyInput.click(); });
    var del = h("button", "btn btn-ghost btn-sm", "Apagar"); del.type = "button";
    del.addEventListener("click", function(){ if (!confirm("Apagar este story?")) return; sb.storage.from("mural").remove([s.foto]); sb.from("stories").delete().eq("id", s.id).then(function(){ closeStory(); loadStories(); toast("Story apagado."); }); });
    acts.append(add, del);
  } else {
    var dmb = h("button", "btn btn-terra btn-sm", "Responder no privado"); dmb.type = "button"; dmb.addEventListener("click", function(){ closeStory(); openDm(g.user_id, g.nome); });
    acts.appendChild(dmb);
  }
  if (!dlg.open) dlg.showModal();
  stories.left = STORY_MS; stories.paused = false; dlg.classList.remove("paused"); setPauseIcon(false);
  stories.t0 = Date.now(); stories.timer = setTimeout(nextStory, STORY_MS);
}
function openStory(g){ stories.cur = g; stories.idx = 0; showStory(); }
function nextStory(){
  var g = stories.cur; if (!g) return;
  if (stories.idx < g.items.length - 1) { stories.idx++; showStory(); return; }
  var i = stories.groups.indexOf(g), nx = stories.groups[i + 1];
  if (nx && nx.user_id !== uid()) { openStory(nx); } else closeStory();
}
function prevStory(){ if (stories.idx > 0) { stories.idx--; showStory(); } else showStory(); }
function closeStory(){ clearTimeout(stories.timer); stories.cur = null; var d = $("storyView"); if (d.open) d.close(); }
$("storyNext").addEventListener("click", nextStory);
$("storyPrev").addEventListener("click", prevStory);
$("storyViewClose").addEventListener("click", closeStory);
$("storyView").addEventListener("close", function(){ clearTimeout(stories.timer); });
$("storyView").addEventListener("click", function(e){ if (e.target === $("storyView")) closeStory(); });
document.addEventListener("keydown", function(e){ if (!$("storyView").open) return; if (e.key === "ArrowRight") nextStory(); else if (e.key === "ArrowLeft") prevStory(); });
auth.on(function(){ if (!auth.user) { stories.groups = []; stories.urls = {}; } });

var ICO_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
var ICO_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.8l-10-6.5A1 1 0 0 0 8 5.5Z" fill="currentColor"/></svg>';
function setPauseIcon(paused){ var b = $("storyPause"); b.innerHTML = paused ? ICO_PLAY : ICO_PAUSE; b.setAttribute("aria-label", paused ? "Continuar story" : "Pausar story"); }
// Pausar: botão no topo ou segurar o dedo na foto. Ao soltar (ou tocar em ▶), continua de onde parou.
function pauseStory(on){
  var dlg = $("storyView"); if (!stories.cur || on === stories.paused) return;
  stories.paused = on; dlg.classList.toggle("paused", on);
  if (on) { clearTimeout(stories.timer); stories.left = Math.max(300, stories.left - (Date.now() - stories.t0)); }
  else { stories.t0 = Date.now(); stories.timer = setTimeout(nextStory, stories.left); }
  setPauseIcon(on);
}
$("storyPause").addEventListener("click", function(){ pauseStory(!stories.paused); });
var holdT = null, held = false;
$("storyView").querySelector(".story-img-wrap").addEventListener("pointerdown", function(){ held = false; holdT = setTimeout(function(){ held = true; pauseStory(true); }, 220); });
["pointerup", "pointercancel", "pointerleave"].forEach(function(ev){ $("storyView").querySelector(".story-img-wrap").addEventListener(ev, function(){ clearTimeout(holdT); if (held) { held = false; pauseStory(false); } }); });
document.addEventListener("keydown", function(e){ if ($("storyView").open && (e.key === " " || e.key === "p")) { e.preventDefault(); pauseStory(!stories.paused); } });
