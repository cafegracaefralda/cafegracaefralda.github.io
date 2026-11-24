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
