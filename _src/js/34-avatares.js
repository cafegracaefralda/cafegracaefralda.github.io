// Foto de perfil em todo lugar: qualquer .avatar com data-av="<id da pessoa>" ganha a foto dela (se tiver). Sem foto, fica a inicial.
var av = { map: {}, busy: false, timer: null };
function avTag(el, userId){ if (!el) return el; if (userId) el.setAttribute("data-av", userId); else el.removeAttribute("data-av"); avSoon(); return el; }
function avSpan(userId, nome, cls){ var s = h("span", cls || "avatar", initial(nome)); return avTag(s, userId); }
function avPaint(root){
  $$("[data-av]", root || document).forEach(function(el){
    var u = av.map[el.getAttribute("data-av")];
    if (u) { el.style.backgroundImage = 'url("' + u + '")'; el.classList.add("has-img"); }
    else { el.style.backgroundImage = ""; el.classList.remove("has-img"); }
  });
}
function avLoad(){
  if (!sb || !auth.user || av.busy) return;
  var ids = [];
  $$("[data-av]").forEach(function(el){ var id = el.getAttribute("data-av"); if (av.map[id] === undefined && ids.indexOf(id) < 0) ids.push(id); });
  if (!ids.length) { avPaint(); return; }
  ids = ids.slice(0, 80); av.busy = true;
  sb.from("perfis").select("user_id,avatar").in("user_id", ids).then(function(r){
    var rows = r.data || [], paths = [];
    ids.forEach(function(id){ av.map[id] = ""; });
    rows.forEach(function(x){ if (x.avatar) paths.push(x.avatar); });
    if (!paths.length) return;
    return sb.storage.from("mural").createSignedUrls(paths, 3600).then(function(s){
      var byPath = {}; (s.data || []).forEach(function(o){ if (o.path && o.signedUrl) byPath[o.path] = o.signedUrl; });
      rows.forEach(function(x){ if (x.avatar && byPath[x.avatar]) av.map[x.user_id] = byPath[x.avatar]; });
    });
  }).catch(function(){}).then(function(){ av.busy = false; avPaint(); if ($$("[data-av]").some(function(el){ return av.map[el.getAttribute("data-av")] === undefined; })) avSoon(); });
}
function avSoon(){ clearTimeout(av.timer); av.timer = setTimeout(avLoad, 120); }
function avForget(userId){ delete av.map[userId]; avSoon(); }
new MutationObserver(function(muts){
  for (var i = 0; i < muts.length; i++) { var m = muts[i]; if (m.type === "attributes" || m.addedNodes.length) { avSoon(); return; } }
}).observe(document.body, { childList: true, subtree: true });
auth.on(function(){ if (!auth.user) { av.map = {}; } avSoon(); });

// Foto de perfil clicável (como no Instagram): leva ao perfil da pessoa
function avLink(userId, nome, cls){
  var s = avSpan(userId, nome, cls); if (!userId) return s;
  s.classList.add("av-link"); s.setAttribute("role", "link"); s.tabIndex = 0; s.setAttribute("aria-label", "Ver perfil de " + nome);
  var ir = function(e){ e.stopPropagation(); go("perfil" + (userId === uid() ? "" : "/" + userId)); };
  s.addEventListener("click", ir); s.addEventListener("keydown", function(e){ if (e.key === "Enter") ir(e); });
  return s;
}
// Endereços de internet no texto viram link clicável
function linkify(frag){
  var w = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT), nodes = [], n;
  while ((n = w.nextNode())) nodes.push(n);
  nodes.forEach(function(t){
    var s = t.nodeValue, re = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, m, last = 0, f = document.createDocumentFragment(), any = false;
    while ((m = re.exec(s))) {
      any = true; var u = m[0].replace(/[.,;:!?)]+$/, ""); if (m.index > last) f.appendChild(document.createTextNode(s.slice(last, m.index)));
      var a = h("a", null, u.length > 42 ? u.slice(0, 40) + "…" : u); a.href = /^https?:/i.test(u) ? u : "https://" + u; a.target = "_blank"; a.rel = "noopener noreferrer nofollow"; f.appendChild(a);
      last = m.index + u.length; re.lastIndex = last;
    }
    if (!any) return; if (last < s.length) f.appendChild(document.createTextNode(s.slice(last))); t.parentNode.replaceChild(f, t);
  });
  return frag;
}
