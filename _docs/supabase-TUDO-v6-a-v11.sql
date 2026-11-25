-- Café, Graça & Fralda · TUDO de uma vez (v6 a v11). Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Pressupõe que o v2, v3, v4 e v5 já foram rodados. Pode rodar mais de uma vez sem problema. Não apaga dados.

-- ======== v6-notificacoes ========
-- Café, Graça & Fralda · banco de dados v6: notificações (sininho).
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do v2, v3 e v4).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Avisa a pessoa quando: alguém comenta num post dela (ou num post em que ela também comentou),
-- curte um post dela, ou lhe manda mensagem privada. Cada pessoa só vê as próprias notificações.
-- As notificações são criadas pelo próprio banco (gatilhos): ninguém consegue criar aviso falso para outra pessoa.

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('comentario', 'curtida', 'dm')),
  de_nome text not null default '',
  post_id uuid references public.posts (id) on delete cascade,
  conversa_id uuid references public.dm_conversas (id) on delete cascade,
  resumo text not null default '',
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists notificacoes_user_idx on public.notificacoes (user_id, lida, criado_em desc);

-- Comentário novo: avisa o autor do post e quem já comentou nele (menos quem acabou de comentar)
create or replace function public.notif_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notificacoes (user_id, tipo, de_nome, post_id, resumo)
  select distinct u.id, 'comentario', new.nome, new.post_id, left(new.texto, 120)
  from (
    select p.user_id as id from public.posts p where p.id = new.post_id
    union
    select c.user_id from public.post_comentarios c where c.post_id = new.post_id
  ) u
  where u.id <> new.user_id;
  return new;
end $$;
drop trigger if exists notif_comentario_t on public.post_comentarios;
create trigger notif_comentario_t after insert on public.post_comentarios for each row execute function public.notif_comentario();

-- Curtida: avisa o autor do post (uma vez por pessoa enquanto o aviso não for lido)
create or replace function public.notif_curtida()
returns trigger language plpgsql security definer set search_path = public as $$
declare autor uuid; nome text;
begin
  select user_id into autor from public.posts where id = new.post_id;
  if autor is null or autor = new.user_id then return new; end if;
  nome := public.primeiro_nome(new.user_id);
  if not exists (select 1 from public.notificacoes where user_id = autor and post_id = new.post_id and tipo = 'curtida' and de_nome = nome and not lida) then
    insert into public.notificacoes (user_id, tipo, de_nome, post_id) values (autor, 'curtida', nome, new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists notif_curtida_t on public.post_curtidas;
create trigger notif_curtida_t after insert on public.post_curtidas for each row execute function public.notif_curtida();

-- Mensagem privada: avisa a outra pessoa (um aviso por conversa enquanto não for lido)
create or replace function public.notif_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare outro uuid;
begin
  select case when c.a = new.de then c.b else c.a end into outro from public.dm_conversas c where c.id = new.conversa_id;
  if outro is null then return new; end if;
  if not exists (select 1 from public.notificacoes where user_id = outro and conversa_id = new.conversa_id and tipo = 'dm' and not lida) then
    insert into public.notificacoes (user_id, tipo, de_nome, conversa_id, resumo)
    values (outro, 'dm', public.primeiro_nome(new.de), new.conversa_id, left(new.texto, 120));
  end if;
  return new;
end $$;
drop trigger if exists notif_dm_t on public.dm_mensagens;
create trigger notif_dm_t after insert on public.dm_mensagens for each row execute function public.notif_dm();

-- Regras de acesso: cada pessoa lê, marca como lida e apaga só as próprias. Ninguém cria aviso direto.
alter table public.notificacoes enable row level security;
drop policy if exists "notif: ler" on public.notificacoes;
drop policy if exists "notif: marcar" on public.notificacoes;
drop policy if exists "notif: apagar" on public.notificacoes;
create policy "notif: ler" on public.notificacoes for select to authenticated using (user_id = auth.uid());
create policy "notif: marcar" on public.notificacoes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif: apagar" on public.notificacoes for delete to authenticated using (user_id = auth.uid());

revoke all on public.notificacoes from anon, authenticated;
grant select on public.notificacoes to authenticated;
grant update (lida) on public.notificacoes to authenticated;
grant delete on public.notificacoes to authenticated;

-- ===== Mensagens privadas: fotos (JPEG) e áudios, até 5 MB, com tempo real =====
-- Segurança: bucket PRIVADO; só os dois participantes da conversa enviam e abrem (link temporário);
-- quem foi bloqueado não consegue enviar; só foto JPEG e áudio (sem vídeo); o caminho do arquivo precisa ser da própria conversa.
alter table public.dm_mensagens add column if not exists arquivo text;
alter table public.dm_mensagens add column if not exists arquivo_nome text;
alter table public.dm_mensagens add column if not exists arquivo_tipo text;
alter table public.dm_mensagens drop constraint if exists dm_mensagens_texto_check;
alter table public.dm_mensagens drop constraint if exists dm_texto_ok;
alter table public.dm_mensagens add constraint dm_texto_ok check (char_length(texto) <= 1000 and (char_length(texto) >= 1 or arquivo is not null));
alter table public.dm_mensagens drop constraint if exists dm_arquivo_ok;
alter table public.dm_mensagens add constraint dm_arquivo_ok check (
  (arquivo is null and arquivo_nome is null and arquivo_tipo is null)
  or (arquivo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webm|ogg|m4a|mp3)$' and arquivo_tipo in ('image', 'audio') and char_length(coalesce(arquivo_nome, '')) between 1 and 120));

-- A pessoa participa da conversa? (security definer para valer também dentro das regras do armazenamento)
create or replace function public.dm_participante(p_conversa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dm_conversas c where c.id = p_conversa and auth.uid() in (c.a, c.b));
$$;
revoke all on function public.dm_participante(uuid) from public, anon;
grant execute on function public.dm_participante(uuid) to authenticated;

-- O arquivo anexado tem que estar na pasta da própria conversa
drop policy if exists "dm: escrever" on public.dm_mensagens;
create policy "dm: escrever" on public.dm_mensagens for insert to authenticated with check (
  de = auth.uid() and public.dm_pode_enviar(conversa_id)
  and (arquivo is null or split_part(arquivo, '/', 1) = conversa_id::text));

-- Aviso do sininho para mensagem só com arquivo
create or replace function public.notif_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare outro uuid;
begin
  select case when c.a = new.de then c.b else c.a end into outro from public.dm_conversas c where c.id = new.conversa_id;
  if outro is null then return new; end if;
  if not exists (select 1 from public.notificacoes where user_id = outro and conversa_id = new.conversa_id and tipo = 'dm' and not lida) then
    insert into public.notificacoes (user_id, tipo, de_nome, conversa_id, resumo)
    values (outro, 'dm', public.primeiro_nome(new.de), new.conversa_id, case when new.texto = '' then (case when new.arquivo_tipo = 'audio' then 'Enviou um áudio' else 'Enviou uma foto' end) else left(new.texto, 120) end);
  end if;
  return new;
end $$;

-- Bucket privado e regras de acesso aos arquivos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('privado', 'privado', false, 5242880, array['image/jpeg', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

drop policy if exists "privado arquivos: ver" on storage.objects;
drop policy if exists "privado arquivos: enviar" on storage.objects;
create policy "privado arquivos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'privado' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.dm_participante(((storage.foldername(name))[1])::uuid));
create policy "privado arquivos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'privado' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.dm_pode_enviar(((storage.foldername(name))[1])::uuid));

-- Tempo real: o site recebe mensagens e avisos na hora (o Realtime respeita as regras de acesso acima)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.dm_mensagens; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notificacoes; exception when duplicate_object then null; end;
  end if;
end $$;

-- ======== v7-prateleira ========
-- Café, Graça & Fralda · banco de dados v7: Prateleira (publicações da comunidade: foto, vídeo, PDF, link do YouTube, texto).
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2 ... v6).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Quem lê: qualquer pessoa (a Prateleira é aberta). Quem publica, curte e comenta: quem entrou com o Google.
-- Segurança: arquivos só dos tipos aceitos (JPEG, PDF, MP4/WebM até 30 MB), limite de 10 publicações por hora,
-- 3 denúncias escondem a publicação, cada pessoa apaga as próprias e a administração apaga qualquer uma.
-- Só a administração cria publicação "oficial" (com selo) e fixa no topo; ninguém consegue se passar por oficial.

create table if not exists public.pubs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autor text not null default '',
  oficial boolean not null default false,
  tipo text not null default 'texto' check (tipo in ('texto', 'foto', 'video', 'pdf', 'youtube', 'link', 'aviso', 'devocional', 'evento', 'parceiro')),
  titulo text check (titulo is null or char_length(titulo) between 1 and 120),
  texto text not null default '' check (char_length(texto) <= 2000),
  arquivo text check (arquivo is null or arquivo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|pdf|mp4|webm)$'),
  arquivo_nome text check (arquivo_nome is null or char_length(arquivo_nome) between 1 and 120),
  youtube text check (youtube is null or youtube ~ '^[A-Za-z0-9_-]{11}$'),
  link text check (link is null or (link ~ '^https?://' and char_length(link) <= 300)),
  link_texto text check (link_texto is null or char_length(link_texto) <= 40),
  fixado boolean not null default false,
  aprovado boolean not null default true,
  criado_em timestamptz not null default now(),
  check (titulo is not null or char_length(texto) >= 1 or arquivo is not null or youtube is not null or link is not null)
);
create index if not exists pubs_idx on public.pubs (aprovado, fixado desc, criado_em desc);

create table if not exists public.pub_curtidas (
  pub_id uuid not null references public.pubs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (pub_id, user_id)
);
create table if not exists public.pub_comentarios (
  id uuid primary key default gen_random_uuid(),
  pub_id uuid not null references public.pubs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default '',
  texto text not null check (char_length(texto) between 1 and 600),
  criado_em timestamptz not null default now()
);
create index if not exists pub_comentarios_idx on public.pub_comentarios (pub_id, criado_em);
create table if not exists public.pub_denuncias (
  pub_id uuid not null references public.pubs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (pub_id, user_id)
);

-- Gatilhos
create or replace function public.pub_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.autor := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  if not public.eh_admin() then
    new.oficial := false; new.fixado := false;
    if new.tipo not in ('texto', 'foto', 'video', 'pdf', 'youtube', 'link') then raise exception 'dados_invalidos'; end if;
    if (select count(*) from public.pubs where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 10 then raise exception 'muito_rapido'; end if;
  end if;
  if new.arquivo is not null and split_part(new.arquivo, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  return new;
end $$;
drop trigger if exists pub_antes_t on public.pubs;
create trigger pub_antes_t before insert on public.pubs for each row execute function public.pub_antes();

create or replace function public.pub_comentario_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.nome := public.primeiro_nome(auth.uid());
  if not public.eh_admin() and (select count(*) from public.pub_comentarios where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 40 then raise exception 'muito_rapido'; end if;
  return new;
end $$;
drop trigger if exists pub_comentario_antes_t on public.pub_comentarios;
create trigger pub_comentario_antes_t before insert on public.pub_comentarios for each row execute function public.pub_comentario_antes();

create or replace function public.pub_denuncia_depois()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.pub_denuncias where pub_id = new.pub_id) >= 3 then
    update public.pubs set aprovado = false where id = new.pub_id and not oficial;
  end if;
  return new;
end $$;
drop trigger if exists pub_denuncia_depois_t on public.pub_denuncias;
create trigger pub_denuncia_depois_t after insert on public.pub_denuncias for each row execute function public.pub_denuncia_depois();

create or replace function public.pub_visivel(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pubs p where p.id = p_id and (p.aprovado or p.user_id = auth.uid() or public.eh_admin()));
$$;
revoke all on function public.pub_visivel(uuid) from public;
grant execute on function public.pub_visivel(uuid) to anon, authenticated;

-- Avisos do sininho (curtida e comentário em publicação)
alter table public.notificacoes add column if not exists pub_id uuid references public.pubs (id) on delete cascade;
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida'));

create or replace function public.notif_pub_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notificacoes (user_id, tipo, de_nome, pub_id, resumo)
  select distinct u.id, 'pub_comentario', new.nome, new.pub_id, left(new.texto, 120)
  from (select p.user_id as id from public.pubs p where p.id = new.pub_id
        union select c.user_id from public.pub_comentarios c where c.pub_id = new.pub_id) u
  where u.id <> new.user_id;
  return new;
end $$;
drop trigger if exists notif_pub_comentario_t on public.pub_comentarios;
create trigger notif_pub_comentario_t after insert on public.pub_comentarios for each row execute function public.notif_pub_comentario();

create or replace function public.notif_pub_curtida()
returns trigger language plpgsql security definer set search_path = public as $$
declare autor uuid; nome text;
begin
  select user_id into autor from public.pubs where id = new.pub_id;
  if autor is null or autor = new.user_id then return new; end if;
  nome := public.primeiro_nome(new.user_id);
  if not exists (select 1 from public.notificacoes where user_id = autor and pub_id = new.pub_id and tipo = 'pub_curtida' and de_nome = nome and not lida) then
    insert into public.notificacoes (user_id, tipo, de_nome, pub_id) values (autor, 'pub_curtida', nome, new.pub_id);
  end if;
  return new;
end $$;
drop trigger if exists notif_pub_curtida_t on public.pub_curtidas;
create trigger notif_pub_curtida_t after insert on public.pub_curtidas for each row execute function public.notif_pub_curtida();

-- Regras de acesso (RLS)
alter table public.pubs enable row level security;
alter table public.pub_curtidas enable row level security;
alter table public.pub_comentarios enable row level security;
alter table public.pub_denuncias enable row level security;

drop policy if exists "pubs: ler" on public.pubs;
drop policy if exists "pubs: publicar" on public.pubs;
drop policy if exists "pubs: apagar" on public.pubs;
drop policy if exists "pubs: moderar" on public.pubs;
create policy "pubs: ler" on public.pubs for select to anon, authenticated using (aprovado or user_id = auth.uid() or public.eh_admin());
create policy "pubs: publicar" on public.pubs for insert to authenticated with check (user_id = auth.uid());
create policy "pubs: apagar" on public.pubs for delete to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "pubs: moderar" on public.pubs for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "pub curtidas: ler" on public.pub_curtidas;
drop policy if exists "pub curtidas: dar" on public.pub_curtidas;
drop policy if exists "pub curtidas: tirar" on public.pub_curtidas;
create policy "pub curtidas: ler" on public.pub_curtidas for select to anon, authenticated using (public.pub_visivel(pub_id));
create policy "pub curtidas: dar" on public.pub_curtidas for insert to authenticated with check (user_id = auth.uid() and public.pub_visivel(pub_id));
create policy "pub curtidas: tirar" on public.pub_curtidas for delete to authenticated using (user_id = auth.uid());

drop policy if exists "pub comentarios: ler" on public.pub_comentarios;
drop policy if exists "pub comentarios: escrever" on public.pub_comentarios;
drop policy if exists "pub comentarios: apagar" on public.pub_comentarios;
create policy "pub comentarios: ler" on public.pub_comentarios for select to anon, authenticated using (public.pub_visivel(pub_id));
create policy "pub comentarios: escrever" on public.pub_comentarios for insert to authenticated with check (user_id = auth.uid() and public.pub_visivel(pub_id));
create policy "pub comentarios: apagar" on public.pub_comentarios for delete to authenticated using (user_id = auth.uid() or public.eh_admin());

drop policy if exists "pub denuncias: enviar" on public.pub_denuncias;
drop policy if exists "pub denuncias: admin le" on public.pub_denuncias;
create policy "pub denuncias: enviar" on public.pub_denuncias for insert to authenticated with check (user_id = auth.uid() and public.pub_visivel(pub_id));
create policy "pub denuncias: admin le" on public.pub_denuncias for select to authenticated using (public.eh_admin());

-- Permissões das tabelas (o público lê sem ver quem é o dono; membros preenchem só os campos do formulário)
revoke all on public.pubs, public.pub_curtidas, public.pub_comentarios, public.pub_denuncias from anon, authenticated;
grant select (id, autor, oficial, tipo, titulo, texto, arquivo, arquivo_nome, youtube, link, link_texto, fixado, aprovado, criado_em) on public.pubs to anon;
grant select on public.pubs to authenticated;
grant insert (tipo, titulo, texto, arquivo, arquivo_nome, youtube, link, link_texto, oficial, fixado) on public.pubs to authenticated;
grant update (aprovado, fixado) on public.pubs to authenticated;
grant delete on public.pubs to authenticated;
grant select (pub_id) on public.pub_curtidas to anon;
grant select, insert, delete on public.pub_curtidas to authenticated;
grant select (id, pub_id, nome, texto, criado_em) on public.pub_comentarios to anon;
grant select on public.pub_comentarios to authenticated;
grant insert (pub_id, texto) on public.pub_comentarios to authenticated;
grant delete on public.pub_comentarios to authenticated;
grant select, insert on public.pub_denuncias to authenticated;

-- Arquivos: bucket aberto para leitura (a Prateleira é pública); cada pessoa envia só para a própria pasta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prateleira', 'prateleira', true, 31457280, array['image/jpeg', 'application/pdf', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = true, file_size_limit = 31457280, allowed_mime_types = array['image/jpeg', 'application/pdf', 'video/mp4', 'video/webm'];

drop policy if exists "prateleira arquivos: ver" on storage.objects;
drop policy if exists "prateleira arquivos: enviar" on storage.objects;
drop policy if exists "prateleira arquivos: apagar" on storage.objects;
create policy "prateleira arquivos: ver" on storage.objects for select to anon, authenticated using (bucket_id = 'prateleira');
create policy "prateleira arquivos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'prateleira' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prateleira arquivos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'prateleira' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

-- ======== v8-stories-lazer ========
-- Café, Graça & Fralda · banco de dados v8: Stories (fotos que somem em 24 horas) e Lazer em família (indicação de lugares por cidade).
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2 ... v7).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Segurança: só quem entrou com o Google vê e publica; só o primeiro nome aparece; as fotos ficam no bucket privado "mural"
-- (link temporário); stories somem da tela depois de 24 horas; lazer tem limite diário e 3 denúncias escondem a indicação.

-- 1. Stories
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default '',
  foto text not null check (foto ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  legenda text check (legenda is null or char_length(legenda) <= 140),
  criado_em timestamptz not null default now()
);
create index if not exists stories_idx on public.stories (criado_em desc);

create or replace function public.story_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.nome := public.primeiro_nome(auth.uid());
  if split_part(new.foto, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  if (select count(*) from public.stories where user_id = new.user_id and criado_em > now() - interval '1 day') >= 10 then raise exception 'muito_rapido'; end if;
  return new;
end $$;
drop trigger if exists story_antes_t on public.stories;
create trigger story_antes_t before insert on public.stories for each row execute function public.story_antes();

alter table public.stories enable row level security;
drop policy if exists "stories: ler" on public.stories;
drop policy if exists "stories: publicar" on public.stories;
drop policy if exists "stories: apagar" on public.stories;
create policy "stories: ler" on public.stories for select to authenticated using (criado_em > now() - interval '24 hours');
create policy "stories: publicar" on public.stories for insert to authenticated with check (user_id = auth.uid());
create policy "stories: apagar" on public.stories for delete to authenticated using (user_id = auth.uid() or public.eh_admin());
revoke all on public.stories from anon, authenticated;
grant select on public.stories to authenticated;
grant insert (foto, legenda) on public.stories to authenticated;
grant delete on public.stories to authenticated;

-- 2. Lazer em família
create table if not exists public.lazer (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autor text not null default '',
  nome_local text not null check (char_length(nome_local) between 2 and 100),
  cidade text not null check (char_length(cidade) between 2 and 60),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  categoria text not null default 'Outro' check (categoria in ('Parque e natureza', 'Restaurante e café', 'Espaço kids', 'Passeio e cultura', 'Esporte', 'Evento', 'Outro')),
  idades text not null default 'Todas as idades' check (idades in ('Bebês', '1 a 3 anos', '4 a 7 anos', '8 anos ou mais', 'Todas as idades')),
  custo text not null default 'Grátis' check (custo in ('Grátis', 'Barato', 'Médio', 'Caro')),
  endereco text check (endereco is null or char_length(endereco) <= 140),
  porque text not null check (char_length(porque) between 2 and 500),
  foto text check (foto is null or foto ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  aprovado boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists lazer_idx on public.lazer (aprovado, uf, cidade, criado_em desc);

create table if not exists public.lazer_curtidas (
  lazer_id uuid not null references public.lazer (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (lazer_id, user_id)
);
create table if not exists public.lazer_denuncias (
  lazer_id uuid not null references public.lazer (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (lazer_id, user_id)
);

create or replace function public.lazer_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.autor := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  new.uf := upper(new.uf);
  if new.foto is not null and split_part(new.foto, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  if not public.eh_admin() and (select count(*) from public.lazer where user_id = new.user_id and criado_em > now() - interval '1 day') >= 10 then raise exception 'muito_rapido'; end if;
  return new;
end $$;
drop trigger if exists lazer_antes_t on public.lazer;
create trigger lazer_antes_t before insert on public.lazer for each row execute function public.lazer_antes();

create or replace function public.lazer_denuncia_depois()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.lazer_denuncias where lazer_id = new.lazer_id) >= 3 then
    update public.lazer set aprovado = false where id = new.lazer_id;
  end if;
  return new;
end $$;
drop trigger if exists lazer_denuncia_t on public.lazer_denuncias;
create trigger lazer_denuncia_t after insert on public.lazer_denuncias for each row execute function public.lazer_denuncia_depois();

create or replace function public.lazer_visivel(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lazer l where l.id = p_id and (l.aprovado or l.user_id = auth.uid() or public.eh_admin()));
$$;
revoke all on function public.lazer_visivel(uuid) from public, anon;
grant execute on function public.lazer_visivel(uuid) to authenticated;

alter table public.lazer enable row level security;
alter table public.lazer_curtidas enable row level security;
alter table public.lazer_denuncias enable row level security;
drop policy if exists "lazer: ler" on public.lazer;
drop policy if exists "lazer: publicar" on public.lazer;
drop policy if exists "lazer: apagar" on public.lazer;
drop policy if exists "lazer: moderar" on public.lazer;
create policy "lazer: ler" on public.lazer for select to authenticated using (aprovado or user_id = auth.uid() or public.eh_admin());
create policy "lazer: publicar" on public.lazer for insert to authenticated with check (user_id = auth.uid());
create policy "lazer: apagar" on public.lazer for delete to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "lazer: moderar" on public.lazer for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "lazer curtidas: ler" on public.lazer_curtidas;
drop policy if exists "lazer curtidas: dar" on public.lazer_curtidas;
drop policy if exists "lazer curtidas: tirar" on public.lazer_curtidas;
create policy "lazer curtidas: ler" on public.lazer_curtidas for select to authenticated using (public.lazer_visivel(lazer_id));
create policy "lazer curtidas: dar" on public.lazer_curtidas for insert to authenticated with check (user_id = auth.uid() and public.lazer_visivel(lazer_id));
create policy "lazer curtidas: tirar" on public.lazer_curtidas for delete to authenticated using (user_id = auth.uid());
drop policy if exists "lazer denuncias: enviar" on public.lazer_denuncias;
drop policy if exists "lazer denuncias: admin le" on public.lazer_denuncias;
create policy "lazer denuncias: enviar" on public.lazer_denuncias for insert to authenticated with check (user_id = auth.uid() and public.lazer_visivel(lazer_id));
create policy "lazer denuncias: admin le" on public.lazer_denuncias for select to authenticated using (public.eh_admin());

revoke all on public.lazer, public.lazer_curtidas, public.lazer_denuncias from anon, authenticated;
grant select on public.lazer to authenticated;
grant insert (nome_local, cidade, uf, categoria, idades, custo, endereco, porque, foto) on public.lazer to authenticated;
grant update (aprovado) on public.lazer to authenticated;
grant delete on public.lazer to authenticated;
grant select, insert, delete on public.lazer_curtidas to authenticated;
grant select, insert on public.lazer_denuncias to authenticated;

-- ======== v9-contatos ========
-- Café, Graça & Fralda · banco de dados v9: WhatsApp de quem entra no site (contato da comunidade).
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2.sql).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Privacidade (LGPD): o WhatsApp é pedido no primeiro login, com aceite claro. NÃO aparece para outros membros:
-- cada pessoa vê só o próprio número; só a administração vê a lista (nome, e-mail, WhatsApp) pelo Painel.

create table if not exists public.contatos (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  consentimento boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table public.contatos enable row level security;
drop policy if exists "contatos: ler o proprio" on public.contatos;
drop policy if exists "contatos: criar o proprio" on public.contatos;
drop policy if exists "contatos: editar o proprio" on public.contatos;
create policy "contatos: ler o proprio" on public.contatos for select to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "contatos: criar o proprio" on public.contatos for insert to authenticated with check (user_id = auth.uid());
create policy "contatos: editar o proprio" on public.contatos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.contatos_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.whatsapp := regexp_replace(new.whatsapp, '[^0-9]', '', 'g');
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists contatos_antes_t on public.contatos;
create trigger contatos_antes_t before insert or update on public.contatos for each row execute function public.contatos_antes();

revoke all on public.contatos from anon, authenticated;
grant select on public.contatos to authenticated;
grant insert (whatsapp, consentimento) on public.contatos to authenticated;
grant update (whatsapp, consentimento) on public.contatos to authenticated;

-- Lista para a administração: nome, e-mail e WhatsApp de quem entrou
create or replace function public.membros_contatos()
returns table (nome text, email text, whatsapp text, desde timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  return query
    select coalesce(nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ''), '(sem nome)')::text,
           u.email::text, c.whatsapp, u.created_at
    from auth.users u left join public.contatos c on c.user_id = u.id
    order by u.created_at desc;
end $$;
revoke all on function public.membros_contatos() from public, anon;
grant execute on function public.membros_contatos() to authenticated;

-- ======== v10-audio-video ========
-- Café, Graça & Fralda · banco v10: áudio na Prateleira e vídeo só para a Casa (administração).
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v7). Pode rodar mais de uma vez.
-- Membros comuns: texto, foto, áudio (até 10 MB), PDF, link e YouTube. Vídeo próprio (MP4/WebM): só administração.

alter table public.pubs drop constraint if exists pubs_tipo_check;
alter table public.pubs add constraint pubs_tipo_check check (tipo in ('texto', 'foto', 'video', 'audio', 'pdf', 'youtube', 'link', 'aviso', 'devocional', 'evento', 'parceiro'));

create or replace function public.pub_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.autor := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  if not public.eh_admin() then
    new.oficial := false; new.fixado := false;
    if new.tipo not in ('texto', 'foto', 'audio', 'pdf', 'youtube', 'link') then raise exception 'dados_invalidos'; end if;
    if new.arquivo ~* '\.(mp4|webm|mov)$' and new.tipo <> 'audio' then raise exception 'dados_invalidos'; end if;
    if (select count(*) from public.pubs where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 10 then raise exception 'muito_rapido'; end if;
  end if;
  if new.arquivo is not null and split_part(new.arquivo, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  return new;
end $$;

update storage.buckets set allowed_mime_types = array['image/jpeg', 'application/pdf', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
where id = 'prateleira';

-- Indicações dos membros: novas categorias (hotéis, restaurantes, praças e mais)
alter table public.indicacoes_membros drop constraint if exists indicacoes_membros_categoria_check;
alter table public.indicacoes_membros add constraint indicacoes_membros_categoria_check check (categoria in ('Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques', 'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Outro'));

-- ======== v11-perfil ========
-- Café, Graça & Fralda · banco v11: perfil pessoal (nome escolhido, bio, cidade e foto).
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v3 e v4). Pode rodar mais de uma vez.
-- O nome que a pessoa escolhe passa a valer em tudo que ela publicar daqui para frente (posts, comentários, Prateleira, Quintal, mensagens).
-- Privacidade: só o apelido, a cidade, a bio e a foto aparecem para os outros membros (e-mail e WhatsApp continuam privados).

alter table public.perfis add column if not exists apelido text;
alter table public.perfis add column if not exists bio text;
alter table public.perfis add column if not exists cidade text;
alter table public.perfis add column if not exists avatar text;
alter table public.perfis drop constraint if exists perfis_apelido_check;
alter table public.perfis add constraint perfis_apelido_check check (apelido is null or char_length(btrim(apelido)) between 2 and 30);
alter table public.perfis drop constraint if exists perfis_bio_check;
alter table public.perfis add constraint perfis_bio_check check (bio is null or char_length(bio) <= 160);
alter table public.perfis drop constraint if exists perfis_cidade_check;
alter table public.perfis add constraint perfis_cidade_check check (cidade is null or char_length(cidade) <= 60);

-- Todos os gatilhos que gravam "autor"/"nome" usam esta função: agora ela prefere o apelido escolhido.
create or replace function public.primeiro_nome(uid uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select nullif(btrim(p.apelido), '') from public.perfis p where p.user_id = uid),
    nullif(split_part(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ' ', 1), ''),
    'Visitante')
  from auth.users u where u.id = uid;
$$;
revoke all on function public.primeiro_nome(uuid) from public, anon, authenticated;

-- Mantém "nome" (usado na lista de conversas) igual ao apelido; avatar só dentro da pasta da própria pessoa.
create or replace function public.perfis_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.apelido is not null then new.apelido := btrim(new.apelido); new.nome := new.apelido; end if;
  if new.avatar is not null and split_part(new.avatar, '/', 1) <> new.user_id::text then raise exception 'dados_invalidos'; end if;
  return new;
end $$;
drop trigger if exists perfis_antes_t on public.perfis;
create trigger perfis_antes_t before insert or update on public.perfis for each row execute function public.perfis_antes();

grant select on public.perfis to authenticated;
grant update (aceita_dm, apelido, bio, cidade, avatar) on public.perfis to authenticated;
