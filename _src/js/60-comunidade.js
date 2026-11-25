// Indicações: da nossa mesa para a sua (curadas pela equipe + enviadas pelos membros).
function filterChips(groupId, onPick){
  var chips = $$("#" + groupId + " .chip");
  chips.forEach(function(c){
    c.addEventListener("click", function(){
      chips.forEach(function(x){ x.setAttribute("aria-pressed", x === c); });
      onPick(c.getAttribute("data-filter"));
    });
  });
}

/* ---------- Indicações: da nossa mesa para a sua ---------- */
var fridge = $("fridgeNotes");
function seloEl(){ var s = h("span", "selo", "✓"); s.title = "Profissional da Casa: pessoa de confiança da comunidade"; s.setAttribute("aria-label", "Profissional da Casa"); return s; }
var fridgeFilter = "all", fromMembers = [];
function fridgeItems(){ return INDICACOES.concat(fromMembers); }
function loadMemberInds(){
  if (!sb) return;
  sb.from("indicacoes_membros").select("id,autor,nome,categoria,especialidade,onde,atendimento,plano,planos,como_conheceu,porque,contato,aprovado").order("criado_em", { ascending: false }).limit(60).then(function(r){
    if (!r.data) return;
    fromMembers = r.data.map(function(x){
      var c = String(x.contato || "").trim(), d = c.replace(/\D/g, "");
      return { cat: x.categoria, nome: x.nome, oque: x.especialidade, onde: x.onde, modo: x.atendimento, porque: x.porque, como: x.como_conheceu, por: x.autor,
        plano: x.plano === "plano" ? "Aceita plano de saúde: " + x.planos : "Atendimento particular", pend: !x.aprovado,
        whatsapp: d.length >= 10 && c.charAt(0) !== "@" ? d : "", instagram: c.charAt(0) === "@" ? c : "" };
    });
    renderFridge();
  });
}
function renderFridge(filter){
  if (filter) fridgeFilter = filter; else filter = fridgeFilter;
  fridge.innerHTML = "";
  fridgeItems().forEach(function(p){
    if (viz.g !== "all" && vizGroup(p.cat) !== viz.g) return;
    var li = h("li", "note"), tape = h("span", "tape"); tape.style.setProperty("--m", TAPE[p.cat] || "#B65B3A"); tape.setAttribute("aria-hidden", "true");
    var top = h("div", "note-top"); top.append(h("span", "label", p.cat));
    if (p.exemplo) top.append(h("span", "ex", "Exemplo"));
    if (p.pend) top.append(h("span", "ex pend", "Em análise"));
    var why = h("div", "note-why"); why.append(h("span", "note-small", p.por ? "Por que indica" : "Por que indicamos"),h("p", null, "“" + p.porque + "”"));
    var acts = h("div", "note-acts");
    function lnk(cls, href, ic, label){ var a = h("a", "btn btn-sm " + cls); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.append(icon(ic), document.createTextNode(label)); acts.appendChild(a); }
    if (p.whatsapp) lnk("btn-wa", "https://wa.me/" + p.whatsapp.replace(/\D/g, ""), "i-wa", "WhatsApp");
    if (p.site) lnk("btn-terra", p.site, "i-arrow", "Conhecer o site");
    if (p.instagram) lnk("btn-ghost", "https://instagram.com/" + p.instagram.replace(/^@/, ""), "i-ig", "Instagram");
    var hn = h("h3", null, p.nome); if (p.selo) hn.appendChild(seloEl());
    li.append(tape, top, hn, h("p", "note-what", p.oque), why);
    var meta = [p.onde, p.modo].filter(Boolean).join(" · "); if (meta) li.appendChild(h("p", "note-meta", meta));
    if (p.plano) li.appendChild(h("p", "note-meta2", p.plano));
    if (p.como) li.appendChild(h("p", "note-meta2", "Como conheceu: " + p.como));
    if (p.por) li.appendChild(h("p", "note-by", "Indicado por " + p.por));
    if (acts.childNodes.length) li.append(acts);
    fridge.appendChild(li);
  });
}
filterChips("vizFilters", function(g){ viz.g = g; renderFridge(); if (typeof renderLazer === "function") renderLazer(); });
renderFridge("all");

viewHooks.indicacoes = function(){ loadMemberInds(); };
auth.on(function(){ if (isShown("indicacoes")) loadMemberInds(); });
