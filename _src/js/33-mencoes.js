// Menções: digite @ para escolher alguém da comunidade (posts e comentários). A pessoa mencionada recebe uma notificação (gatilho no banco).
var mn = { list: [], loaded: false, target: null, items: [], sel: 0 };
function loadMencoes(){
  if (mn.loaded || !sb || !auth.user) return; mn.loaded = true;
  sb.from("perfis").select("user_id,nome,apelido").limit(500).then(function(r){
    mn.list = (r.data || []).map(function(p){ return { id: p.user_id, nome: String(p.apelido || p.nome || "").trim() }; }).filter(function(x){ return x.nome; })
      .sort(function(a, b){ return b.nome.length - a.nome.length; });
  });
}
auth.on(function(){ if (auth.user) loadMencoes(); else { mn.list = []; mn.loaded = false; } });
var NAME_CH = /[\p{L}\p{N}_]/u;
// Texto com @nome vira link para o perfil (sem innerHTML)
function richText(txt){
  var frag = document.createDocumentFragment(), s = String(txt || ""), low = s.toLowerCase(), i = 0, last = 0;
  while ((i = s.indexOf("@", i)) > -1) {
    var ok = null;
    if (i === 0 || !NAME_CH.test(s.charAt(i - 1))) {
      for (var k = 0; k < mn.list.length; k++) {
        var n = mn.list[k], end = i + 1 + n.nome.length;
        if (low.substr(i + 1, n.nome.length) === n.nome.toLowerCase() && (end >= s.length || !NAME_CH.test(s.charAt(end)))) { ok = { n: n, end: end }; break; }
      }
    }
    if (ok) {
      if (i > last) frag.appendChild(document.createTextNode(s.slice(last, i)));
      var a = h("a", "mention", "@" + s.slice(i + 1, ok.end)); a.href = "#perfil/" + (ok.n.id === uid() ? "" : ok.n.id); frag.appendChild(a);
      last = i = ok.end;
    } else i++;
  }
  if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
  return frag;
}
// Lista de sugestões ao digitar @
var mnPop = h("div", "mention-pop"); mnPop.hidden = true; mnPop.setAttribute("role", "listbox"); document.body.appendChild(mnPop);
function mnClose(){ mnPop.hidden = true; mn.target = null; }
function mnField(el){ return !!el && (el.id === "postText" || el.id === "pubText" || el.id === "pdTexto" || el.id === "casaTexto" || (el.closest && !!el.closest(".post-cmt-form"))); }
function mnPick(n){
  var el = mn.target; if (!el) return;
  var pos = el.selectionStart, before = el.value.slice(0, pos), after = el.value.slice(pos);
  var m = /(^|\s)@([\p{L}\p{N}_]*)$/u.exec(before); if (!m) return mnClose();
  var ini = before.length - m[2].length - 1;
  var novo = before.slice(0, ini) + "@" + n.nome + " ";
  el.value = novo + after; el.setSelectionRange(novo.length, novo.length); el.focus(); mnClose();
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
function mnShow(el, q){
  var ql = q.toLowerCase();
  mn.items = mn.list.filter(function(x){ var nl = x.nome.toLowerCase(); return x.id !== uid() && (!ql || nl.indexOf(ql) === 0 || nl.indexOf(" " + ql) > -1); }).slice(0, 5);
  if (!mn.items.length) return mnClose();
  mn.target = el; mn.sel = 0; mnPop.innerHTML = "";
  mn.items.forEach(function(n, i){
    var b = h("button", "mention-item" + (i === 0 ? " on" : "")); b.type = "button"; b.setAttribute("role", "option");
    b.append(avSpan(n.id, n.nome), h("span", null, n.nome));
    b.addEventListener("mousedown", function(e){ e.preventDefault(); mnPick(n); });
    b.addEventListener("touchstart", function(e){ e.preventDefault(); mnPick(n); }, { passive: false });
    mnPop.appendChild(b);
  });
  var dlg = el.closest && el.closest("dialog[open]"); var alvo = dlg || document.body; if (mnPop.parentNode !== alvo) alvo.appendChild(mnPop);   // dentro da tela de postar, a lista precisa ficar por cima
  var r = el.getBoundingClientRect(); mnPop.hidden = false;
  var w = Math.min(280, window.innerWidth - 24), left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
  mnPop.style.width = w + "px"; mnPop.style.left = left + "px";
  var ph = mnPop.offsetHeight, below = r.bottom + 6;
  mnPop.style.top = (below + ph > window.innerHeight - 8 ? Math.max(8, r.top - ph - 6) : below) + "px";
}
document.addEventListener("input", function(e){
  var el = e.target; if (!mnField(el) || !auth.user) return;
  if (!mn.loaded) loadMencoes();
  var m = /(^|\s)@([\p{L}\p{N}_]*)$/u.exec(el.value.slice(0, el.selectionStart));
  if (m) mnShow(el, m[2]); else mnClose();
});
document.addEventListener("keydown", function(e){
  if (mnPop.hidden || !mn.target) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); mn.sel = (mn.sel + (e.key === "ArrowDown" ? 1 : mn.items.length - 1)) % mn.items.length; $$(".mention-item", mnPop).forEach(function(b, i){ b.classList.toggle("on", i === mn.sel); }); }
  else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); mnPick(mn.items[mn.sel]); }
  else if (e.key === "Escape") mnClose();
});
document.addEventListener("focusout", function(e){ if (mnField(e.target)) setTimeout(mnClose, 150); });
window.addEventListener("scroll", mnClose, { passive: true });
