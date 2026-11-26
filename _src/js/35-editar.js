// Editar o que você publicou: só o texto, só a própria pessoa e só até 5 minutos depois (o banco confere de novo).
var EDIT_MS = 5 * 60 * 1000;
function podeEditar(criado_em){ return !!criado_em && Date.now() - new Date(criado_em).getTime() <= EDIT_MS; }
function editarInline(alvo, atual, max, salvar){
  var box = h("div", "edit-box"), ta = h("textarea"); ta.value = atual; ta.maxLength = max; ta.rows = Math.min(7, Math.max(2, Math.ceil(atual.length / 48)));
  ta.setAttribute("aria-label", "Editar texto");
  var bar = h("div", "edit-bar"), ok = h("button", "btn btn-terra btn-sm", "Salvar"), no = h("button", "btn btn-ghost btn-sm", "Cancelar"); ok.type = no.type = "button"; bar.append(ok, no); box.append(ta, bar);
  alvo.replaceWith(box); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  no.addEventListener("click", function(){ box.replaceWith(alvo); });
  ok.addEventListener("click", function(){
    var v = ta.value.trim();
    if (!v) return toast("O texto não pode ficar vazio.");
    if (v === atual) return box.replaceWith(alvo);
    ok.disabled = true;
    salvar(v).then(function(r){
      if (r && r.error) { ok.disabled = false; toast(String(r.error.message || "").indexOf("tempo_esgotado") > -1 ? "O tempo para editar acabou (5 minutos)." : "Não foi possível salvar agora."); }
    });
  });
}
// Atualiza uma linha (texto) e devolve { error } ou aplica o resultado
function salvarTexto(tabela, id, v, aplicar){
  if ((tabela === "posts" || tabela === "post_comentarios") && typeof TEM_LINK !== "undefined" && TEM_LINK.test(v)) { toast("Links são exclusivos de quem anuncia."); return Promise.resolve({ error: { message: "link" } }); }
  return sb.from(tabela).update({ texto: v }).eq("id", id).select("id,texto,editado_em").then(function(r){
    if (r.error || !r.data || !r.data.length) return { error: r.error || { message: "x" } };
    aplicar(r.data[0]); return {};
  });
}
