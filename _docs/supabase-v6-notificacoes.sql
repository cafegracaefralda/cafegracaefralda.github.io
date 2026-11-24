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
