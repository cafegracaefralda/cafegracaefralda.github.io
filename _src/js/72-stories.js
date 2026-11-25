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
    signStories(r.data).then(function(){ stories.groups = groupStories(r.data); renderStories(); });
  });
}
function tile(label, letter, cls, onClick, badge){
  var b = h("button", "person" + (cls ? " " + cls : "")); b.type = "button";
  var ring = h("span", "ring"); ring.appendChild(h("span", null, letter));
  if (badge) ring.appendChild(h("i", "plus", "+"));
  b.append(ring, h("small", null, label)); b.addEventListener("click", onClick); return b;
}
function renderStories(){
  var row = $("storiesRow"); if (!row) return; row.innerHTML = "";
  var mine = stories.groups.filter(function(g){ return g.user_id === uid(); })[0];
  row.appendChild(tile("Seu story", initial(auth.name()), mine ? "" : "me", function(){ if (mine) openStory(mine); else storyInput.click(); }, true));
  stories.groups.forEach(function(g){
    if (g.user_id === uid()) return;
    row.appendChild(tile(g.nome || "Alguém", initial(g.nome), "", function(){ openStory(g); }));
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
  $("storyAv").textContent = initial(g.nome); $("storyNm").textContent = g.user_id === uid() ? "Você" : g.nome; $("storyTm").textContent = ago(s.criado_em);
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
  stories.timer = setTimeout(nextStory, STORY_MS);
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
