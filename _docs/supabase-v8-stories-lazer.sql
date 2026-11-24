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
