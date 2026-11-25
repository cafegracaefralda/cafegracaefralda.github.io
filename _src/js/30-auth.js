// Login com Google (Supabase Auth) e menu da conta.
var auth = { user: null, admin: false, ready: false, listeners: [] };
auth.on = function(fn){ auth.listeners.push(fn); };
auth.name = function(){ var u = auth.user; return auth.apelido ? auth.apelido : u ? (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || "").split("@")[0] : ""; };
function emitAuth(){ applyAuthUI(); auth.listeners.forEach(function(fn){ try { fn(auth); } catch(e){ console.error(e); } }); }

function applyAuthUI(){
  var inn = !!auth.user;
  $$('[data-auth="in"]').forEach(function(e){ e.hidden = !inn; });
  $$('[data-auth="out"]').forEach(function(e){ e.hidden = inn; });
  $("acctAvatar").textContent = initial(auth.name());
  $("acctName").textContent = firstName(auth.name());
  $("menuName").textContent = auth.name();
  $("menuEmail").textContent = auth.user ? auth.user.email || "" : "";
  $("menuPainel").hidden = !auth.admin; $("menuPublicar").hidden = !auth.admin; $("homePublicar").hidden = !auth.admin;
  if (!inn) $("acctMenu").hidden = true;
  var wall = $("loginWall"); wall.classList.remove("boot"); wall.hidden = inn || !sb;
  document.body.classList.toggle("wall-on", !wall.hidden);
  var gates = [["feedGate", "feedApp"], ["lazerGate", "lazerApp"], ["dmGate", "dmApp"]];
  gates.forEach(function(g){ $(g[0]).hidden = inn; $(g[1]).hidden = !inn; });
}

auth.signIn = function(){
  if (!sb) { toast("O login não está disponível agora. Fale comigo no WhatsApp."); return; }
  lsSet("cgf-after", !location.hash || location.hash === "#inicio" ? "#mesa" : location.hash);
  sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } }
  }).then(function(r){ if (r && r.error) toast("Não foi possível entrar com o Google agora."); });
};
$("lwGoogle").addEventListener("click", auth.signIn);
$("lwForm").addEventListener("submit", function(e){
  e.preventDefault();
  var st = $("lwStatus"), m = val("lw-mail");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return setStatus(st, "Digite um e-mail válido.", "err");
  $("lwSend").disabled = true; setStatus(st, "Enviando…");
  sb.auth.signInWithOtp({ email: m, options: { emailRedirectTo: location.origin + location.pathname } }).then(function(r){
    $("lwSend").disabled = false;
    if (r && r.error) return setStatus(st, "Não foi possível enviar agora. Tente de novo ou entre com o Google.", "err");
    setStatus(st, "Pronto! Abra o e-mail que enviamos e toque no link para entrar.", "ok");
  });
});
auth.signOut = function(){ if (sb) sb.auth.signOut(); };

function setSession(session){
  auth.user = session && session.user ? session.user : null;
  if (!auth.user) auth.apelido = "";
  auth.admin = false;
  var primeira = !auth.ready;
  auth.ready = true;
  if (primeira && auth.user && !location.hash) { history.replaceState(null, "", "#mesa"); if (typeof renderRoute === "function") renderRoute(); }
  emitAuth();
  if (auth.user && sb) {
    sb.rpc("eh_admin").then(function(r){ auth.admin = !!(r && r.data === true); emitAuth(); });
  }
}

$$(".js-login, #loginBtn").forEach(function(b){ b.addEventListener("click", auth.signIn); });
$("acctBtn").addEventListener("click", function(e){ e.stopPropagation(); var m = $("acctMenu"); m.hidden = !m.hidden; $("acctBtn").setAttribute("aria-expanded", !m.hidden); });
document.addEventListener("click", function(e){ if (!$("acctMenu").hidden && !$("acctMenu").contains(e.target)) $("acctMenu").hidden = true; });
$("acctMenu").addEventListener("click", function(){ $("acctMenu").hidden = true; });
$("menuOut").addEventListener("click", function(){ auth.signOut(); go("inicio"); });

if (sb) {
  // Não chame o Supabase de dentro desta função: adie com setTimeout para evitar travar o login.
  sb.auth.onAuthStateChange(function(event, session){
    setTimeout(function(){
      setSession(session);
      if (event === "SIGNED_IN") {
        if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
        var after = lsGet("cgf-after");
        if (after) { lsSet("cgf-after", ""); if (after !== location.hash) location.hash = after; }
      }
    }, 0);
  });
  sb.auth.getSession().then(function(r){ if (!auth.ready) setSession(r && r.data ? r.data.session : null); });
} else {
  auth.ready = true;
  emitAuth();
}
