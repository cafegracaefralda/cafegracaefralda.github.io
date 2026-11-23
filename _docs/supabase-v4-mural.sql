-- Café, Graça & Fralda · banco de dados v4: Mural das famílias (feed com fotos, curtidas e comentários).
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2.sql).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Segurança de dados:
--  * Só quem entrou com o Google vê o mural (nada é público, nada é indexado pelo Google).
--  * Só o primeiro nome aparece. O autor vem do login e não dá para se passar por outra pessoa.
--  * Fotos ficam num bucket PRIVADO (só membros logados abrem, por link temporário), JPEG de até 3 MB.
--  * Limite de publicações (10/h), comentários (40/h) e curtidas; denúncias escondem o post sozinhas (3 pessoas).
--  * Cada pessoa apaga o que é dela. O Denny (admin) pode apagar e esconder qualquer coisa.

-- 1. Tabelas
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default '',
  tipo text not null default 'conversa' check (tipo in ('conversa', 'indicacao', 'desabafo', 'oracao', 'gratidao')),
  texto text not null check (char_length(texto) between 1 and 1500),
  foto text check (foto is null or foto ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  aprovado boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists posts_recentes_idx on public.posts (criado_em desc);

create table if not exists public.post_curtidas (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default '',
  texto text not null check (char_length(texto) between 1 and 600),
  criado_em timestamptz not null default now()
);
create index if not exists post_comentarios_idx on public.post_comentarios (post_id, criado_em);

create table if not exists public.post_denuncias (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 2. Gatilhos: autor vem do login, limites de envio, denúncias
create or replace function public.post_antes_de_inserir()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.nome := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  if new.foto is not null and split_part(new.foto, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  if not public.eh_admin() and (select count(*) from public.posts where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'muito_rapido';
  end if;
  return new;
end $$;
drop trigger if exists post_antes on public.posts;
create trigger post_antes before insert on public.posts for each row execute function public.post_antes_de_inserir();

create or replace function public.comentario_antes_de_inserir()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.nome := public.primeiro_nome(auth.uid());
  if not public.eh_admin() and (select count(*) from public.post_comentarios where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 40 then
    raise exception 'muito_rapido';
  end if;
  return new;
end $$;
drop trigger if exists post_comentario_antes on public.post_comentarios;
create trigger post_comentario_antes before insert on public.post_comentarios for each row execute function public.comentario_antes_de_inserir();

-- Três pessoas diferentes denunciando escondem o post até o Denny revisar.
create or replace function public.denuncia_depois()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.post_denuncias where post_id = new.post_id) >= 3 then
    update public.posts set aprovado = false where id = new.post_id;
  end if;
  return new;
end $$;
drop trigger if exists post_denuncia_depois on public.post_denuncias;
create trigger post_denuncia_depois after insert on public.post_denuncias for each row execute function public.denuncia_depois();

-- O post está visível para quem chama? (security definer: evita regras circulares)
create or replace function public.post_visivel(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.posts p where p.id = p_id and (p.aprovado or p.user_id = auth.uid() or public.eh_admin()));
$$;
revoke all on function public.post_visivel(uuid) from public, anon;
grant execute on function public.post_visivel(uuid) to authenticated;

-- 3. Regras de acesso (RLS): tudo exige login
alter table public.posts enable row level security;
alter table public.post_curtidas enable row level security;
alter table public.post_comentarios enable row level security;
alter table public.post_denuncias enable row level security;

drop policy if exists "posts: ler" on public.posts;
drop policy if exists "posts: escrever" on public.posts;
drop policy if exists "posts: apagar" on public.posts;
drop policy if exists "posts: moderar" on public.posts;
create policy "posts: ler" on public.posts for select to authenticated using (aprovado or user_id = auth.uid() or public.eh_admin());
create policy "posts: escrever" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts: apagar" on public.posts for delete to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "posts: moderar" on public.posts for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "curtidas: ler" on public.post_curtidas;
drop policy if exists "curtidas: dar" on public.post_curtidas;
drop policy if exists "curtidas: tirar" on public.post_curtidas;
create policy "curtidas: ler" on public.post_curtidas for select to authenticated using (public.post_visivel(post_id));
create policy "curtidas: dar" on public.post_curtidas for insert to authenticated with check (user_id = auth.uid() and public.post_visivel(post_id));
create policy "curtidas: tirar" on public.post_curtidas for delete to authenticated using (user_id = auth.uid());

drop policy if exists "post comentarios: ler" on public.post_comentarios;
drop policy if exists "post comentarios: escrever" on public.post_comentarios;
drop policy if exists "post comentarios: apagar" on public.post_comentarios;
create policy "post comentarios: ler" on public.post_comentarios for select to authenticated using (public.post_visivel(post_id));
create policy "post comentarios: escrever" on public.post_comentarios for insert to authenticated with check (user_id = auth.uid() and public.post_visivel(post_id));
create policy "post comentarios: apagar" on public.post_comentarios for delete to authenticated using (user_id = auth.uid() or public.eh_admin());

drop policy if exists "denuncias: enviar" on public.post_denuncias;
drop policy if exists "denuncias: admin le" on public.post_denuncias;
create policy "denuncias: enviar" on public.post_denuncias for insert to authenticated with check (user_id = auth.uid() and public.post_visivel(post_id));
create policy "denuncias: admin le" on public.post_denuncias for select to authenticated using (public.eh_admin());

-- 4. Permissões das tabelas (só as colunas que a pessoa pode preencher)
revoke all on public.posts, public.post_curtidas, public.post_comentarios, public.post_denuncias from anon;
grant select on public.posts to authenticated;
grant insert (tipo, texto, foto) on public.posts to authenticated;
grant update (aprovado) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant select, insert, delete on public.post_curtidas to authenticated;
grant insert (post_id) on public.post_curtidas to authenticated;
grant select on public.post_comentarios to authenticated;
grant insert (post_id, texto) on public.post_comentarios to authenticated;
grant delete on public.post_comentarios to authenticated;
grant select, insert on public.post_denuncias to authenticated;

-- 5. Fotos: bucket privado, JPEG até 3 MB, cada pessoa só envia para a própria pasta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mural', 'mural', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

drop policy if exists "mural fotos: ver" on storage.objects;
drop policy if exists "mural fotos: enviar" on storage.objects;
drop policy if exists "mural fotos: apagar" on storage.objects;
create policy "mural fotos: ver" on storage.objects for select to authenticated using (bucket_id = 'mural');
create policy "mural fotos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'mural' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "mural fotos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'mural' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));
