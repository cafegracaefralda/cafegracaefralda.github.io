// Painel do Denny > Publicar: cria postagens oficiais da Da Casa (aviso, devocional extra, convite, parceiro).
var ofFile = null;
function ofStatus(msg, kind){ setStatus($("ofStatus"), msg, kind); }
$("of-file").addEventListener("change", function(){
  var f = this.files && this.files[0]; this.value = ""; if (!f) return;
  shrinkPhoto(f).then(function(blob){ ofFile = blob; $("of-file-name").textContent = "Imagem pronta (" + Math.max(1, Math.round(blob.size / 1024)) + " KB)"; }, function(){ ofFile = null; $("of-file-name").textContent = ""; ofStatus("Não consegui usar essa imagem.", "err"); });
});
$("ofForm").addEventListener("submit", function(e){
  e.preventDefault();
  var row = { tipo: $("of-tipo").value, titulo: val("of-titulo"), texto: val("of-texto"), link: val("of-link") || null, link_texto: val("of-linkt") || null, fixado: $("of-fixar").checked };
  if (row.titulo.length < 2 || row.texto.length < 2) return ofStatus("Preencha o título e o texto.", "err");
  if (row.link && !/^https?:\/\//.test(row.link)) return ofStatus("O link precisa começar com https://", "err");
  if (!sb || !auth.admin) return ofStatus("Só o Denny publica aqui.", "err");
  $("ofSend").disabled = true; ofStatus("Publicando…");
  var path = null, up = Promise.resolve();
  if (ofFile) { path = newUuid() + ".jpg"; up = sb.storage.from("oficial").upload(path, ofFile, { contentType: "image/jpeg", upsert: false }); row.imagem = path; }
  up.then(function(u){
    if (u && u.error) throw new Error("imagem");
    return sb.from("oficiais").insert(row).select("id");
  }).then(function(r){
    if (r.error) { if (path) sb.storage.from("oficial").remove([path]); throw new Error("post"); }
    ofStatus("Publicado na Da Casa. Use “Copiar para o WhatsApp” abaixo para avisar o grupo e o Canal.", "ok");
    $("ofForm").reset(); ofFile = null; $("of-file-name").textContent = ""; loadAdminOficiais();
  }).catch(function(err){ ofStatus(err.message === "imagem" ? "Não foi possível enviar a imagem." : "Não foi possível publicar agora.", "err"); }).then(function(){ $("ofSend").disabled = false; });
});
function loadAdminOficiais(){
  if (!sb || !auth.admin) return;
  sb.from("oficiais").select("id,tipo,titulo,texto,imagem,link,link_texto,fixado,publicado,criado_em").order("criado_em", { ascending: false }).limit(40).then(function(r){
    var box = $("ofAdminList"); box.innerHTML = "";
    (r.data || []).forEach(function(it){
      var el = h("div", "mod-item" + (it.publicado ? "" : " off")), body = h("div");
      body.append(h("small", null, (TIPO_OF[it.tipo] || it.tipo) + " · " + ago(it.criado_em) + (it.fixado ? " · fixado" : "") + (it.publicado ? "" : " · oculto")), h("p", null, it.titulo));
      var act = h("div", "confirm");
      function btn(label, fn){ var b = h("button", "btn btn-ghost btn-sm", label); b.type = "button"; b.addEventListener("click", fn); act.appendChild(b); return b; }
      btn("Copiar para o WhatsApp", function(){ copyText(ofShareText(it), "Texto para o WhatsApp copiado"); });
      btn(it.fixado ? "Desafixar" : "Fixar", function(){ sb.from("oficiais").update({ fixado: !it.fixado }).eq("id", it.id).then(loadAdminOficiais); });
      btn(it.publicado ? "Ocultar" : "Mostrar", function(){ sb.from("oficiais").update({ publicado: !it.publicado }).eq("id", it.id).then(loadAdminOficiais); });
      var del = btn("Excluir", function(){ del.textContent = "Confirmar?"; del.onclick = function(){ (it.imagem ? sb.storage.from("oficial").remove([it.imagem]) : Promise.resolve()).then(function(){ return sb.from("oficiais").delete().eq("id", it.id); }).then(loadAdminOficiais); }; });
      el.append(body, act); box.appendChild(el);
    });
    if (!box.childNodes.length) box.appendChild(h("p", "muted", "Nenhuma postagem ainda."));
  });
}
var _painelHook = viewHooks.painel;
viewHooks.painel = function(sub){ _painelHook(sub); if (auth.admin && sub === "publicar") loadAdminOficiais(); };
