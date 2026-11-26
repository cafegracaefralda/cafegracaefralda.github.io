-- Café, Graça & Fralda · banco v12: Ofertas de parceiros (anunciantes), alertas de linguagem ofensiva e banimento.
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v11). Pode rodar mais de uma vez. Não apaga dados.
--
-- ANUNCIANTES: qualquer membro pede para anunciar (fica "pendente"). A cobrança é combinada fora do site, por WhatsApp;
--   depois a administração ativa a pessoa no Painel. Anunciante novo tem cada oferta revisada; ao ser marcado "confiável",
--   as ofertas publicam direto (a administração pode remover depois).
-- PRODUTOS PROIBIDOS: o banco recusa ofertas de bebida alcoólica, cigarro/vape, apostas, emagrecedores "milagrosos",
--   anabolizantes e medicamentos/curas (nada que faça mal à saúde ou não seja recomendado por médicos).
-- ALERTAS: palavrão leve = publica e avisa a administração; ofensa grave = esconde na hora (ou mascara, nos comentários) e avisa.
--   Mensagens privadas NÃO são lidas: só entram em alerta se alguém denunciar.
-- BANIMENTO: conta banida não publica, não comenta e não manda mensagem. A administração pode desbanir.

-- 1. Banidos
create table if not exists public.banidos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  motivo text not null default '',
  criado_em timestamptz not null default now()
);
alter table public.banidos enable row level security;
drop policy if exists "banidos: so admin" on public.banidos;
create policy "banidos: so admin" on public.banidos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.banidos from anon, authenticated;
grant select, insert, delete on public.banidos to authenticated;

create or replace function public.esta_banido(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.banidos where user_id = uid);
$$;
revoke all on function public.esta_banido(uuid) from public, anon;
grant execute on function public.esta_banido(uuid) to authenticated;

create or replace function public.minha_conta_banida() returns boolean language sql stable security definer set search_path = public as $$
  select public.esta_banido(auth.uid());
$$;
revoke all on function public.minha_conta_banida() from public, anon;
grant execute on function public.minha_conta_banida() to authenticated;

-- 2. Nível de linguagem: 0 = limpo, 1 = palavrão leve, 2 = ofensa grave
create or replace function public.texto_nivel(t text)
returns int language plpgsql immutable as $$
declare s text := lower(translate(coalesce(t, ''), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'));
begin
  if s ~ '(filh[oa] d[aeo] puta|arrombad|vagabund[oa]|\mvadia\M|retardad|mongoloide|vai (se )?matar|vou te matar|te mato|estupr|\mnegr[oa] (sujo|imundo|fedido)|macac[oa] (sujo|imundo))' then return 2; end if;
  if s ~ '(\mporra\M|caralh|\mmerda\M|\mbosta\M|cacete|foda[- ]?se|\mputa\M|\mcu\M|buceta|\mfdp\M|\mvsf\M|\mvtnc\M|desgrac|idiota|imbecil|otari[oa]|babaca|cretin)' then return 1; end if;
  return 0;
end $$;

-- 3. Produtos proibidos nas ofertas
create or replace function public.texto_proibido(t text)
returns boolean language plpgsql immutable as $$
declare s text := lower(translate(coalesce(t, ''), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'));
begin
  return s ~ '(cerveja|\mvinho|vodka|whisky|\mgin\M|cachaca|bebida alcoolica|destilado|licor|champanhe|cigarro|tabaco|narguile|\mvape|\mpod descartavel|\maposta|\mbet\M|cassino|tigrinho|\mbingo|emagrec|queimador de gordura|chá milagroso|cha milagroso|milagre|detox|anabolizante|esteroide|hormonio|\mcura\M|curar|medicamento|remedio|ozempic|sibutramina|\mcbd\M|maconha|cannabis)';
end $$;

-- 4. Anunciantes
create table if not exists public.anunciantes (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  marca text not null check (char_length(marca) between 2 and 80),
  tipo text not null default 'afiliado' check (tipo in ('afiliado', 'loja', 'profissional')),
  instagram text check (instagram is null or char_length(instagram) <= 60),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  cidade text check (cidade is null or char_length(cidade) <= 60),
  status text not null default 'pendente' check (status in ('pendente', 'ativo', 'recusado', 'suspenso')),
  confiavel boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.anunciantes enable row level security;
drop policy if exists "anunciantes: ler" on public.anunciantes;
drop policy if exists "anunciantes: pedir" on public.anunciantes;
drop policy if exists "anunciantes: editar" on public.anunciantes;
create policy "anunciantes: ler" on public.anunciantes for select to authenticated using (user_id = auth.uid() or status = 'ativo' or public.eh_admin());
create policy "anunciantes: pedir" on public.anunciantes for insert to authenticated with check (user_id = auth.uid());
create policy "anunciantes: editar" on public.anunciantes for update to authenticated using (user_id = auth.uid() or public.eh_admin()) with check (user_id = auth.uid() or public.eh_admin());

create or replace function public.anunciantes_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  if public.esta_banido(auth.uid()) then raise exception 'conta_suspensa'; end if;
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g'), '');
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.status := 'pendente'; new.confiavel := false;
  elsif not public.eh_admin() then
    new.status := old.status; new.confiavel := old.confiavel; new.user_id := old.user_id;
  end if;
  if public.texto_nivel(new.marca) > 0 or public.texto_proibido(new.marca) then raise exception 'conteudo_improprio'; end if;
  return new;
end $$;
drop trigger if exists anunciantes_antes_t on public.anunciantes;
create trigger anunciantes_antes_t before insert or update on public.anunciantes for each row execute function public.anunciantes_antes();
revoke all on public.anunciantes from anon, authenticated;
grant select on public.anunciantes to authenticated;
grant insert (marca, tipo, instagram, whatsapp, cidade) on public.anunciantes to authenticated;
grant update (marca, tipo, instagram, whatsapp, cidade, status, confiavel) on public.anunciantes to authenticated;

-- 5. Ofertas
create table if not exists public.ofertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  marca text not null default '',
  titulo text not null check (char_length(titulo) between 3 and 100),
  descricao text not null default '' check (char_length(descricao) <= 400),
  preco text check (preco is null or char_length(preco) <= 40),
  cupom text check (cupom is null or char_length(cupom) <= 30),
  link text not null check (link ~ '^https://' and char_length(link) <= 400),
  foto text check (foto is null or foto ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  categoria text not null default 'Outros' check (categoria in ('Bebê e criança', 'Casa', 'Mamãe', 'Educação', 'Livros e fé', 'Serviços', 'Outros')),
  validade date not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  cliques int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists ofertas_status_idx on public.ofertas (status, validade);
alter table public.ofertas enable row level security;
drop policy if exists "ofertas: ler" on public.ofertas;
drop policy if exists "ofertas: criar" on public.ofertas;
drop policy if exists "ofertas: editar" on public.ofertas;
drop policy if exists "ofertas: apagar" on public.ofertas;
create policy "ofertas: ler" on public.ofertas for select to authenticated using ((status = 'aprovada' and validade >= current_date) or user_id = auth.uid() or public.eh_admin());
create policy "ofertas: criar" on public.ofertas for insert to authenticated with check (user_id = auth.uid());
create policy "ofertas: editar" on public.ofertas for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "ofertas: apagar" on public.ofertas for delete to authenticated using (user_id = auth.uid() or public.eh_admin());

create or replace function public.ofertas_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.anunciantes;
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  if public.esta_banido(auth.uid()) then raise exception 'conta_suspensa'; end if;
  select * into a from public.anunciantes where user_id = auth.uid();
  if a.user_id is null or a.status <> 'ativo' then raise exception 'anunciante_inativo'; end if;
  if public.texto_proibido(new.titulo || ' ' || new.descricao || ' ' || coalesce(new.preco, '') || ' ' || new.marca) then raise exception 'produto_proibido'; end if;
  if public.texto_nivel(new.titulo || ' ' || new.descricao) > 0 then raise exception 'conteudo_improprio'; end if;
  if new.validade < current_date or new.validade > current_date + 60 then raise exception 'dados_invalidos'; end if;
  if (select count(*) from public.ofertas where user_id = auth.uid() and criado_em > now() - interval '1 day') >= 5 then raise exception 'muito_rapido'; end if;
  new.user_id := auth.uid(); new.marca := a.marca; new.cliques := 0;
  new.status := case when a.confiavel then 'aprovada' else 'pendente' end;
  return new;
end $$;
drop trigger if exists ofertas_antes_t on public.ofertas;
create trigger ofertas_antes_t before insert on public.ofertas for each row execute function public.ofertas_antes();
revoke all on public.ofertas from anon, authenticated;
grant select on public.ofertas to authenticated;
grant insert (titulo, descricao, preco, cupom, link, foto, categoria, validade) on public.ofertas to authenticated;
grant update (status) on public.ofertas to authenticated;
grant delete on public.ofertas to authenticated;

create or replace function public.oferta_clique(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  update public.ofertas set cliques = cliques + 1 where id = p_id and status = 'aprovada' and validade >= current_date;
end $$;
revoke all on function public.oferta_clique(uuid) from public, anon;
grant execute on function public.oferta_clique(uuid) to authenticated;

-- 6. Alertas para a administração
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao', 'pedido', 'casa', 'seguir', 'story_curtida'));

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  autor text not null default '',
  origem text not null check (origem in ('posts', 'post_comentarios', 'pubs', 'pub_comentarios', 'lazer')),
  ref_id uuid,
  nivel int not null check (nivel in (1, 2)),
  trecho text not null default '',
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  criado_em timestamptz not null default now()
);
create index if not exists alertas_status_idx on public.alertas (status, criado_em desc);
alter table public.alertas enable row level security;
drop policy if exists "alertas: so admin" on public.alertas;
create policy "alertas: so admin" on public.alertas for select to authenticated using (public.eh_admin());
revoke all on public.alertas from anon, authenticated;
grant select on public.alertas to authenticated;

-- Gatilho de moderação: roda DEPOIS dos outros (nome com "zz"). Bloqueia banidos, avisa a administração e esconde ou mascara.
create or replace function public.moderar_conteudo()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  txt text; nv int; j jsonb := to_jsonb(new); uid uuid; autor text; adm record;
begin
  uid := coalesce((j ->> 'user_id')::uuid, auth.uid());
  if public.esta_banido(uid) then raise exception 'conta_suspensa'; end if;
  if tg_table_name = 'pubs' and coalesce((j ->> 'oficial')::boolean, false) then return new; end if;
  txt := concat_ws(' ', j ->> 'texto', j ->> 'titulo', j ->> 'nome_local', j ->> 'porque');
  nv := public.texto_nivel(txt);
  if nv = 0 then return new; end if;
  autor := coalesce(j ->> 'nome', j ->> 'autor', '');
  insert into public.alertas (user_id, autor, origem, ref_id, nivel, trecho)
    values (uid, autor, tg_table_name, (j ->> 'id')::uuid, nv, left(txt, 280));
  if nv = 2 then
    if tg_table_name in ('posts', 'pubs', 'lazer') then new.aprovado := false;
    elsif tg_table_name in ('post_comentarios', 'pub_comentarios') then new.texto := '[comentário removido por conter ofensas]'; end if;
  end if;
  for adm in select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) loop
    insert into public.notificacoes (user_id, tipo, de_nome, resumo)
      values (adm.id, 'alerta', autor, case when nv = 2 then 'Ofensa grave (escondida): ' else 'Palavrão: ' end || left(txt, 90));
  end loop;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['posts', 'post_comentarios', 'pubs', 'pub_comentarios', 'lazer'] loop
    execute format('drop trigger if exists zz_moderar_t on public.%I', t);
    execute format('create trigger zz_moderar_t before insert on public.%I for each row execute function public.moderar_conteudo()', t);
  end loop;
end $$;

-- Banidos também não mandam mensagem privada nem pedem conversa
create or replace function public.bloquear_banido_dm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.esta_banido(auth.uid()) then raise exception 'conta_suspensa'; end if;
  return new;
end $$;
drop trigger if exists aa_banido_dm_t on public.dm_mensagens;
create trigger aa_banido_dm_t before insert on public.dm_mensagens for each row execute function public.bloquear_banido_dm();

-- 7. Ações da administração sobre um alerta
create or replace function public.alerta_resolver(p_id uuid, p_acao text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.alertas;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  if p_acao not in ('ignorar', 'apagar', 'advertir', 'banir') then raise exception 'dados_invalidos'; end if;
  select * into a from public.alertas where id = p_id;
  if a.id is null then raise exception 'nao_encontrado'; end if;
  if p_acao = 'apagar' and a.ref_id is not null then execute format('delete from public.%I where id = $1', a.origem) using a.ref_id; end if;
  if p_acao = 'advertir' then
    insert into public.notificacoes (user_id, tipo, de_nome, resumo)
      values (a.user_id, 'aviso', 'Administração', 'Mantenha a conversa respeitosa. Linguagem ofensiva pode levar à suspensão da conta.');
  end if;
  if p_acao = 'banir' then
    insert into public.banidos (user_id, motivo) values (a.user_id, left(a.trecho, 120)) on conflict (user_id) do nothing;
    if a.ref_id is not null then execute format('delete from public.%I where id = $1', a.origem) using a.ref_id; end if;
  end if;
  update public.alertas set status = 'resolvido' where id = p_id;
end $$;
revoke all on function public.alerta_resolver(uuid, text) from public, anon;
grant execute on function public.alerta_resolver(uuid, text) to authenticated;

create or replace function public.desbanir(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  delete from public.banidos where user_id = p_user;
end $$;
revoke all on function public.desbanir(uuid) from public, anon;
grant execute on function public.desbanir(uuid) to authenticated;

-- Bucket das fotos das ofertas reaproveita o bucket privado "mural" (pasta da própria pessoa).
