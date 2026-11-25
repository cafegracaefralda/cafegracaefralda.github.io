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
-- Linhas antigas com categoria fora da lista viram "Outro" (evita erro ao criar a regra).
update public.indicacoes_membros set categoria = 'Outro' where categoria not in ('Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques', 'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Outro');
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

-- ======== v12-ofertas-moderacao ========
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
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso'));

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

-- ======== v13-mencoes ========
-- Café, Graça & Fralda · banco v13: menções (@nome) em posts e comentários, com notificação para a pessoa mencionada.
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v11). Pode rodar mais de uma vez. Não apaga dados.
-- Quem escreve "@Nome" (o nome que a pessoa escolheu no perfil) avisa essa pessoa pelo sininho. Não avisa a si mesma.

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao'));

create or replace function public.notif_mencao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new); txt text := coalesce(j ->> 'texto', ''); autor uuid := (j ->> 'user_id')::uuid;
  de text := coalesce(nullif(j ->> 'nome', ''), nullif(j ->> 'autor', ''), 'Alguém');
  r record; pid uuid; pubid uuid;
begin
  if position('@' in txt) = 0 then return new; end if;
  if tg_table_name = 'posts' and coalesce((j ->> 'aprovado')::boolean, true) = false then return new; end if;
  if public.esta_banido(autor) then return new; end if;
  if tg_table_name = 'posts' then pid := (j ->> 'id')::uuid;
  elsif tg_table_name = 'post_comentarios' then pid := (j ->> 'post_id')::uuid;
  elsif tg_table_name = 'pub_comentarios' then pubid := (j ->> 'pub_id')::uuid; end if;
  for r in
    select p.user_id from public.perfis p
    where p.user_id <> autor and btrim(coalesce(p.apelido, p.nome, '')) <> ''
      and lower(txt) ~ ('@' || regexp_replace(lower(btrim(coalesce(p.apelido, p.nome))), '([][\\.()*+?^${}|])', '\\\1', 'g') || '($|[^[:alnum:]_])')
    limit 10
  loop
    insert into public.notificacoes (user_id, tipo, de_nome, post_id, pub_id, resumo)
    values (r.user_id, 'mencao', de, pid, pubid, left(txt, 120));
  end loop;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts', 'post_comentarios', 'pub_comentarios'] loop
    execute format('drop trigger if exists notif_mencao_t on public.%I', t);
    execute format('create trigger notif_mencao_t after insert on public.%I for each row execute function public.notif_mencao()', t);
  end loop;
end $$;

-- ======== v14-stories-48h-e-pedidos ========
-- Café, Graça & Fralda · banco v14: stories somem em 48 horas (antes eram 24).
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez. Não apaga dados.
drop policy if exists "stories: ler" on public.stories;
create policy "stories: ler" on public.stories for select to authenticated using (criado_em > now() - interval '48 hours');

-- Avisa a administração (sininho) quando alguém pede para anunciar ou envia uma oferta para revisão.
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao', 'pedido'));

create or replace function public.notif_pedido_anuncio()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare adm record; txt text;
begin
  if tg_table_name = 'anunciantes' then txt := 'Pedido para anunciar: ' || new.marca;
  elsif new.status = 'pendente' then txt := 'Oferta para revisar: ' || new.titulo;
  else return new; end if;
  for adm in select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) loop
    insert into public.notificacoes (user_id, tipo, de_nome, resumo) values (adm.id, 'pedido', coalesce(nullif(new.marca, ''), 'Parceiro'), left(txt, 120));
  end loop;
  return new;
end $$;
drop trigger if exists notif_pedido_anunciantes_t on public.anunciantes;
create trigger notif_pedido_anunciantes_t after insert on public.anunciantes for each row execute function public.notif_pedido_anuncio();
drop trigger if exists notif_pedido_ofertas_t on public.ofertas;
create trigger notif_pedido_ofertas_t after insert on public.ofertas for each row execute function public.notif_pedido_anuncio();

-- ======== v15-categorias ========
-- Café, Graça & Fralda · banco v15: Vizinhança com categorias livres (saúde, fé, lazer, esporte, cultura, filmes e séries, comer, hospedagem...).
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez. Não apaga dados.
-- Linhas antigas com categoria fora da lista viram "Outro" (evita erro ao criar a regra).
update public.indicacoes_membros set categoria = 'Outro' where categoria not in ('Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques', 'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Saúde', 'Fé e religião', 'Educação', 'Família', 'Casa', 'Outro');
alter table public.indicacoes_membros drop constraint if exists indicacoes_membros_categoria_check;
alter table public.indicacoes_membros add constraint indicacoes_membros_categoria_check check (categoria in (
  'Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques',
  'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Saúde', 'Fé e religião', 'Educação', 'Família', 'Casa', 'Outro'));
update public.lazer set categoria = 'Outro' where categoria not in ('Parque e natureza', 'Restaurante e café', 'Espaço kids', 'Passeio e cultura', 'Esporte', 'Evento', 'Lazer', 'Praças e parques', 'Cultura', 'Filmes e séries', 'Comer', 'Hospedagem', 'Outro');
alter table public.lazer drop constraint if exists lazer_categoria_check;
alter table public.lazer add constraint lazer_categoria_check check (categoria in (
  'Parque e natureza', 'Restaurante e café', 'Espaço kids', 'Passeio e cultura', 'Esporte', 'Evento',
  'Lazer', 'Praças e parques', 'Cultura', 'Filmes e séries', 'Comer', 'Hospedagem', 'Outro'));

-- ======== v16-stories-24h-e-posts ========
-- Café, Graça & Fralda · banco v16: stories voltam a durar 24 horas (e não ficam guardados) + 5 postagens oficiais do livro "Entre a Fralda e a Bíblia".
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez (não duplica as postagens). Não apaga dados de ninguém.
--
-- Stories: depois de 24 horas ninguém mais vê. O dono ainda "enxerga" o vencido só para o site apagar a foto e o registro (sem histórico).
drop policy if exists "stories: ler" on public.stories;
create policy "stories: ler" on public.stories for select to authenticated using (criado_em > now() - interval '24 hours' or user_id = auth.uid());

-- Remove do banco os stories vencidos sempre que alguém publica um novo (as fotos são apagadas pelo site quando o dono volta).
create or replace function public.limpar_stories_vencidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.stories where criado_em < now() - interval '24 hours';
  return new;
end $$;
drop trigger if exists zz_limpar_stories_t on public.stories;
create trigger zz_limpar_stories_t after insert on public.stories for each statement execute function public.limpar_stories_vencidos();

-- Postagens oficiais (aparecem em A Casa, com o selo, e a comunidade pode curtir e comentar).
-- Entram em nome do primeiro administrador cadastrado. Os gatilhos ficam desligados só durante a inserção.
alter table public.pubs disable trigger user;
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Deus cria. Os pais formam. Somente Deus salva.', 'Se a Bíblia não funcionar na terça-feira (na hora do banho, no trânsito travado ou diante do prato de brócolis rejeitado), ela não funciona no domingo. E a boa notícia é que ela funciona.

Deus cria. Os pais formam. Somente Deus salva.

Quem entende a primeira respeita o filho como obra única de Deus. Quem entende a segunda assume a responsabilidade diária de ensinar e corrigir sem terceirizar. Quem entende a terceira consegue encostar a cabeça no travesseiro e dormir em paz.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '7 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Deus cria. Os pais formam. Somente Deus salva.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'O "nada" nunca é nada.', 'Quando seu filho chorar "do nada", a frustração de sentir algo grande por dentro e não ter palavras para explicar costuma virar grito.

Antes da bronca, passe por três perguntas:

1. Ele está com fome, sono ou cansaço?
2. Está tentando me comunicar algo que não sabe dizer?
3. Precisa de colo antes de precisar de regra?

Primeiro acolha o sentimento. Depois ajude a pensar e firme o limite.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '14 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'O "nada" nunca é nada.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Seu filho não é um adulto pequeno.', 'Quando estamos cansados, cobramos maturidade executiva de quem acabou de sair das fraldas: "Você já tem três anos, já devia saber!"

Mas o freio do cérebro ainda está amadurecendo. Isso não é maldade: é um "eu" aprendendo a existir dentro de limites seguros.

Um passo para hoje: escolha uma situação em que você se frustra (hora de dormir, guardar brinquedos, esperar a vez), divida em passos pequenos e avise antes da transição. A previsibilidade diminui a ansiedade.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '21 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Seu filho não é um adulto pequeno.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Parar um comportamento à força é fácil.', 'Parar um comportamento à força é fácil. Formar o coração exige diálogo.

Quando a correção vira luta física, o cérebro da criança fica preso no modo de defesa e não reflete sobre nada.

Um termômetro para hoje, antes de dormir: "Minha última correção produziu medo, conformidade mecânica ou compreensão?" Se foi só medo, amanhã comece pedindo perdão e conversando de novo.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '28 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Parar um comportamento à força é fácil.');
insert into public.pubs (user_id, autor, oficial, tipo, titulo, texto, fixado, aprovado, criado_em)
select (select u.id from auth.users u join public.admins a on lower(a.email) = lower(u.email) order by u.created_at limit 1),
  'Café, Graça & Fralda', true, 'devocional', 'Disciplina é reforma de casa, não demolição.', 'Corrigir demais costuma ensinar de menos.

A regra das duas frases: respire fundo e use, no máximo, duas frases curtas. Uma sobre o fato ("Você jogou o brinquedo") e outra sobre a reparação ("Vamos pegar e guardar").

Quando o erro gera reparação, a criança aprende. Quando só gera humilhação, ela aprende a esconder.

Do livro "Entre a Fralda e a Bíblia".', false, true, now() - interval '35 minutes'
where exists (select 1 from auth.users u join public.admins a on lower(a.email) = lower(u.email))
  and not exists (select 1 from public.pubs where oficial and titulo = 'Disciplina é reforma de casa, não demolição.');
alter table public.pubs enable trigger user;

-- Anunciantes: campo "o que quer anunciar" e aviso dentro do site quando a conta é ativada ou recusada.
alter table public.anunciantes add column if not exists sobre text check (sobre is null or char_length(sobre) <= 300);
grant insert (sobre) on public.anunciantes to authenticated;
grant update (sobre) on public.anunciantes to authenticated;

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao', 'pedido'));

create or replace function public.notif_status_anunciante()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('ativo', 'recusado', 'suspenso') then
    insert into public.notificacoes (user_id, tipo, de_nome, resumo) values (new.user_id, 'aviso', 'Administração',
      case new.status when 'ativo' then 'Sua conta de parceiro foi ativada. Já dá para publicar ofertas em A Casa > Ofertas.'
                      when 'recusado' then 'Seu pedido para anunciar não foi aprovado agora.' else 'Sua conta de parceiro foi suspensa.' end);
  end if;
  return new;
end $$;
drop trigger if exists notif_status_anunciante_t on public.anunciantes;
create trigger notif_status_anunciante_t after update on public.anunciantes for each row execute function public.notif_status_anunciante();
