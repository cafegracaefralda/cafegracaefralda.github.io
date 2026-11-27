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
  act.append(hide, del);
  if (it.cartao) { var cb = h("button", "btn btn-wa btn-sm", "Cartão + WhatsApp"); cb.type = "button"; cb.addEventListener("click", function(){ abrirCartao(it.cartao); }); act.insertBefore(cb, act.firstChild); }
  el.append(body, act); return el;
}
function loadMod(){
  sb.from("indicacoes_membros").select("id,autor,nome,especialidade,onde,plano,planos,como_conheceu,porque,contato,aprovado,criado_em").order("criado_em", { ascending: false }).limit(40).then(function(r){
    var c3 = $("pModInds"); c3.innerHTML = "";
    (r.data || []).forEach(function(x){
      c3.appendChild(modItem("indicacoes_membros", { cartao: x, id: x.id, aprovado: x.aprovado, criado_em: x.criado_em, nome: x.nome + " (por " + x.autor + ")",
        texto: x.especialidade + " · " + x.onde + " · " + (x.plano === "plano" ? "Plano: " + x.planos : "Particular") + " · Conheceu: " + x.como_conheceu + " — " + x.porque + (x.contato ? " · Contato: " + x.contato : "") }, x.aprovado ? "publicada" : "AGUARDANDO"));
    });
    if (!c3.childNodes.length) c3.appendChild(h("p", "muted", "Nenhuma indicação enviada ainda."));
  });
}
$("copyMails").addEventListener("click", function(){ copyText(panel.subs.map(function(s){ return s.email; }).join(", "), "E-mails copiados"); });
$("copyPhones").addEventListener("click", function(){ copyText(panel.subs.map(function(s){ return s.whatsapp; }).join("\n"), "WhatsApps copiados"); });


// --- Alertas de linguagem, anunciantes e ofertas
var ORIGEM_NOME = { posts: "Mesa", post_comentarios: "Comentário na Mesa", pubs: "A Casa", pub_comentarios: "Comentário na Casa", lazer: "Quintal" };
function btnAct(txt, fn, cls){ var b = h("button", "btn btn-ghost btn-sm" + (cls ? " " + cls : ""), txt); b.type = "button"; b.addEventListener("click", fn); return b; }
function loadAlertas(){
  sb.from("alertas").select("id,user_id,autor,origem,nivel,trecho,status,criado_em").order("criado_em", { ascending: false }).limit(60).then(function(r){
    var box = $("pAlertas"); box.innerHTML = ""; var abertos = 0;
    (r.data || []).forEach(function(a){
      if (a.status === "aberto") abertos++;
      var el = h("div", "mod-item" + (a.status === "aberto" ? "" : " off")), body = h("div");
      body.append(h("small", null, (a.nivel === 2 ? "🔴 Ofensa grave (escondida) · " : "🟡 Palavrão · ") + a.autor + " · " + (ORIGEM_NOME[a.origem] || a.origem) + " · " + ago(a.criado_em) + (a.status === "aberto" ? "" : " · resolvido")), h("p", null, a.trecho));
      var act = h("div", "confirm");
      if (a.status === "aberto") {
        var run = function(acao, msg){ return function(){ if (msg && !confirm(msg)) return; sb.rpc("alerta_resolver", { p_id: a.id, p_acao: acao }).then(function(x){ if (x.error) toast("Não foi possível agora."); loadAlertas(); }); }; };
        act.append(btnAct("Ignorar", run("ignorar")), btnAct("Advertir", run("advertir", "Enviar um aviso para esta pessoa?")), btnAct("Apagar", run("apagar", "Apagar este conteúdo?")), btnAct("Banir", run("banir", "Banir esta pessoa? Ela não poderá publicar, comentar nem mandar mensagens."), "danger"));
      }
      el.append(body, act); box.appendChild(el);
    });
    if (!box.childNodes.length) box.appendChild(h("p", "muted", "Nenhum alerta. Tudo tranquilo."));
    var n = $("alertaN"); n.textContent = abertos ? String(abertos) : ""; n.hidden = !abertos;
  });
}
function loadAnunc(){
  sb.from("anunciantes").select("user_id,marca,tipo,instagram,whatsapp,cidade,sobre,status,confiavel,criado_em").order("criado_em", { ascending: false }).limit(100).then(function(r){
    var box = $("pAnunc"); box.innerHTML = "";
    (r.data || []).forEach(function(a){
      var el = h("div", "mod-item" + (a.status === "ativo" ? "" : " off")), body = h("div");
      body.append(h("small", null, a.marca + " · " + a.tipo + " · " + a.status + (a.confiavel ? " · confiável" : "") + " · " + ago(a.criado_em)), h("p", null, [a.instagram, a.whatsapp ? "wa.me/" + a.whatsapp : "", a.cidade].filter(Boolean).join(" · ")), h("p", null, a.sobre || ""));
      var set = function(patch){ return function(){ sb.from("anunciantes").update(patch).eq("user_id", a.user_id).then(loadAnunc); }; };
      var act = h("div", "confirm");
      if (a.whatsapp) { var w = h("a", "btn btn-ghost btn-sm", "WhatsApp"); w.href = "https://wa.me/" + a.whatsapp; w.target = "_blank"; w.rel = "noopener"; act.appendChild(w); }
      if (a.status !== "ativo") act.appendChild(btnAct("Ativar", set({ status: "ativo" })));
      if (a.status === "ativo" && a.whatsapp) { var lk2 = h("a", "btn btn-wa btn-sm", "Enviar link do anúncio"); lk2.href = waLink("Olá, " + a.marca + "! O seu pedido para anunciar na *Café, Graça & Fralda* foi aprovado. 🎉\n\nPara cadastrar o seu anúncio (foto, link, descrição e o que quiser), entre por aqui e toque em *Quero anunciar*:\n" + SITE_URL + "#anunciar", a.whatsapp); lk2.target = "_blank"; lk2.rel = "noopener"; act.appendChild(lk2); }
      if (a.status === "ativo") { act.appendChild(btnAct(a.confiavel ? "Tirar confiável" : "Marcar confiável", set({ confiavel: !a.confiavel }))); act.appendChild(btnAct("Suspender", set({ status: "suspenso" }))); }
      if (a.status === "pendente") act.appendChild(btnAct("Recusar", set({ status: "recusado" })));
      el.append(body, act); box.appendChild(el);
    });
    if (!box.childNodes.length) box.appendChild(h("p", "muted", "Ninguém pediu para anunciar ainda."));
  });
}
function loadOfertasAdm(){
  sb.from("ofertas").select("id,marca,titulo,descricao,preco,cupom,link,categoria,validade,status,cliques,criado_em").order("status", { ascending: true }).order("criado_em", { ascending: false }).limit(100).then(function(r){
    var box = $("pOfertas"); box.innerHTML = "";
    (r.data || []).forEach(function(o){
      var el = h("div", "mod-item" + (o.status === "aprovada" ? "" : " off")), body = h("div");
      var lk = h("a", "link", o.link); lk.href = o.link; lk.target = "_blank"; lk.rel = "noopener noreferrer nofollow";
      body.append(h("small", null, o.marca + " · " + o.status + " · " + o.cliques + " cliques · até " + o.validade + " · " + o.categoria), h("p", null, o.titulo + (o.preco ? " · " + o.preco : "") + (o.cupom ? " · cupom " + o.cupom : "") + (o.descricao ? " — " + o.descricao : "")), lk);
      var set = function(s){ return function(){ sb.from("ofertas").update({ status: s }).eq("id", o.id).then(loadOfertasAdm); }; };
      var act = h("div", "confirm");
      if (o.status !== "aprovada") act.appendChild(btnAct("Aprovar", set("aprovada")));
      if (o.status !== "recusada") act.appendChild(btnAct("Recusar", set("recusada")));
      act.appendChild(btnAct("Excluir", function(){ if (confirm("Excluir esta oferta?")) sb.from("ofertas").delete().eq("id", o.id).then(loadOfertasAdm); }));
      el.append(body, act); box.appendChild(el);
    });
    if (!box.childNodes.length) box.appendChild(h("p", "muted", "Nenhuma oferta enviada ainda."));
  });
}

viewHooks.painel = function(sub){
  if (!auth.ready) return;
  var note = $("panelNote");
  if (!auth.user) { note.textContent = "Entre com o Google para acessar o painel."; $("panelApp").hidden = true; return; }
  if (!auth.admin) { note.textContent = auth.name() ? "Esta área é só para a administração." : "Verificando o seu acesso…"; $("panelApp").hidden = true; return; }
  note.textContent = "Inscritos nos devocionais, membros com WhatsApp e indicações enviadas. As publicações você modera direto na Casa e na Mesa.";
  $("panelApp").hidden = false;
  if (sub === "moderacao") loadMod(); else if (sub === "membros") loadMembros(); else if (sub === "alertas") loadAlertas(); else if (sub === "anunciantes") loadAnunc(); else if (sub === "ofertas") loadOfertasAdm(); else loadSubs();
  if (sub !== "alertas") sb.from("alertas").select("id", { count: "exact", head: true }).eq("status", "aberto").then(function(c){ var n = $("alertaN"); n.textContent = c.count ? String(c.count) : ""; n.hidden = !c.count; });
};
auth.on(function(){ if (route.view === "painel") viewHooks.painel(route.sub); });
