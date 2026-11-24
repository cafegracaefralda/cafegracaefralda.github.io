// Painel (só administradores): inscritos nos devocionais e indicações enviadas para aprovar.
var panel = { subs: [], members: [] };

function loadSubs(){
  sb.from("inscritos").select("nome,email,whatsapp,criado_em").order("criado_em", { ascending: false }).limit(500).then(function(r){
    panel.subs = r.data || [];
    $("pSubCount").textContent = panel.subs.length + (panel.subs.length === 1 ? " inscrito" : " inscritos");
    var tb = $("pSubs"); tb.innerHTML = "";
    panel.subs.forEach(function(s){
      var tr = h("tr"); [s.nome, s.email, s.whatsapp, fmtDate.format(new Date(s.criado_em)).replace(".", "")].forEach(function(v){ tr.appendChild(h("td", null, v)); });
      tb.appendChild(tr);
    });
  });
}
function loadMembros(){
  sb.rpc("membros_contatos").then(function(r){
    panel.members = r.data || [];
    var comZap = panel.members.filter(function(m){ return m.whatsapp; }).length;
    $("pMemCount").textContent = panel.members.length + (panel.members.length === 1 ? " membro" : " membros") + " · " + comZap + " com WhatsApp";
    var tb = $("pMembers"); tb.innerHTML = "";
    panel.members.forEach(function(m){
      var tr = h("tr"), z = h("td");
      if (m.whatsapp) { var a = h("a", "link", m.whatsapp); a.href = "https://wa.me/" + m.whatsapp; a.target = "_blank"; a.rel = "noopener"; z.appendChild(a); } else z.textContent = "—";
      tr.append(h("td", null, m.nome), h("td", null, m.email || ""), z, h("td", null, fmtDate.format(new Date(m.desde)).replace(".", "")));
      tb.appendChild(tr);
    });
  });
}
$("copyMemMails").addEventListener("click", function(){ copyText(panel.members.map(function(m){ return m.email; }).filter(Boolean).join(", "), "E-mails copiados"); });
$("copyMemPhones").addEventListener("click", function(){ copyText(panel.members.map(function(m){ return m.whatsapp; }).filter(Boolean).join("\n"), "WhatsApps copiados"); });
function modItem(table, it, extra){
  var el = h("div", "mod-item" + (it.aprovado ? "" : " off")), body = h("div");
  body.append(h("small", null, it.nome + (extra ? " · " + extra : "") + " · " + ago(it.criado_em) + (it.aprovado ? "" : " · oculto")), h("p", null, it.texto));
  var act = h("div", "confirm"), hide = h("button", "btn btn-ghost btn-sm", it.aprovado ? "Ocultar" : "Mostrar"), del = h("button", "btn btn-ghost btn-sm", "Excluir"); hide.type = del.type = "button";
  hide.addEventListener("click", function(){ sb.from(table).update({ aprovado: !it.aprovado }).eq("id", it.id).then(loadMod); });
  del.addEventListener("click", function(){ del.textContent = "Confirmar?"; del.onclick = function(){ sb.from(table).delete().eq("id", it.id).then(loadMod); }; });
  act.append(hide, del); el.append(body, act); return el;
}
function loadMod(){
  sb.from("indicacoes_membros").select("id,autor,nome,especialidade,onde,plano,planos,como_conheceu,porque,contato,aprovado,criado_em").order("criado_em", { ascending: false }).limit(40).then(function(r){
    var c3 = $("pModInds"); c3.innerHTML = "";
    (r.data || []).forEach(function(x){
      c3.appendChild(modItem("indicacoes_membros", { id: x.id, aprovado: x.aprovado, criado_em: x.criado_em, nome: x.nome + " (por " + x.autor + ")",
        texto: x.especialidade + " · " + x.onde + " · " + (x.plano === "plano" ? "Plano: " + x.planos : "Particular") + " · Conheceu: " + x.como_conheceu + " — " + x.porque + (x.contato ? " · Contato: " + x.contato : "") }, x.aprovado ? "publicada" : "AGUARDANDO"));
    });
    if (!c3.childNodes.length) c3.appendChild(h("p", "muted", "Nenhuma indicação enviada ainda."));
  });
}
$("copyMails").addEventListener("click", function(){ copyText(panel.subs.map(function(s){ return s.email; }).join(", "), "E-mails copiados"); });
$("copyPhones").addEventListener("click", function(){ copyText(panel.subs.map(function(s){ return s.whatsapp; }).join("\n"), "WhatsApps copiados"); });

viewHooks.painel = function(sub){
  if (!auth.ready) return;
  var note = $("panelNote");
  if (!auth.user) { note.textContent = "Entre com o Google para acessar o painel."; $("panelApp").hidden = true; return; }
  if (!auth.admin) { note.textContent = auth.name() ? "Esta área é só para a administração." : "Verificando o seu acesso…"; $("panelApp").hidden = true; return; }
  note.textContent = "Inscritos nos devocionais, membros com WhatsApp e indicações enviadas. As publicações você modera direto na Prateleira e na Mesa Grande.";
  $("panelApp").hidden = false;
  if (sub === "moderacao") loadMod(); else if (sub === "membros") loadMembros(); else loadSubs();
};
auth.on(function(){ if (route.view === "painel") viewHooks.painel(route.sub); });
