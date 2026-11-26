-- Café, Graça & Fralda · banco v18: seguir pessoas e curtir stories.
-- Como usar: Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez. Não apaga dados.

create table if not exists public.seguidores (
  seguidor uuid not null default auth.uid() references auth.users (id) on delete cascade,
  seguido uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (seguidor, seguido),
  check (seguidor <> seguido)
);
create index if not exists seguidores_seguido_idx on public.seguidores (seguido);
alter table public.seguidores enable row level security;
drop policy if exists "seguidores: ler" on public.seguidores;
drop policy if exists "seguidores: seguir" on public.seguidores;
drop policy if exists "seguidores: deixar de seguir" on public.seguidores;
create policy "seguidores: ler" on public.seguidores for select to authenticated using (true);
create policy "seguidores: seguir" on public.seguidores for insert to authenticated with check (seguidor = auth.uid() and not public.esta_banido(auth.uid()));
create policy "seguidores: deixar de seguir" on public.seguidores for delete to authenticated using (seguidor = auth.uid());
revoke all on public.seguidores from anon, authenticated;
grant select, delete on public.seguidores to authenticated;
grant insert (seguido) on public.seguidores to authenticated;

create table if not exists public.stories_curtidas (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.stories_curtidas enable row level security;
drop policy if exists "stories_curtidas: ler" on public.stories_curtidas;
drop policy if exists "stories_curtidas: curtir" on public.stories_curtidas;
drop policy if exists "stories_curtidas: descurtir" on public.stories_curtidas;
create policy "stories_curtidas: ler" on public.stories_curtidas for select to authenticated using (true);
create policy "stories_curtidas: curtir" on public.stories_curtidas for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.stories s where s.id = story_id));
create policy "stories_curtidas: descurtir" on public.stories_curtidas for delete to authenticated using (user_id = auth.uid());
revoke all on public.stories_curtidas from anon, authenticated;
grant select, delete on public.stories_curtidas to authenticated;
grant insert (story_id) on public.stories_curtidas to authenticated;

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in ('comentario', 'curtida', 'dm', 'pub_comentario', 'pub_curtida', 'alerta', 'aviso', 'mencao', 'pedido', 'casa', 'seguir', 'story_curtida'));

create or replace function public.notif_seguir()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notificacoes (user_id, tipo, de_nome, resumo) values (new.seguido, 'seguir', public.primeiro_nome(new.seguidor), 'começou a seguir você');
  return new;
end $$;
drop trigger if exists notif_seguir_t on public.seguidores;
create trigger notif_seguir_t after insert on public.seguidores for each row execute function public.notif_seguir();

create or replace function public.notif_story_curtida()
returns trigger language plpgsql security definer set search_path = public as $$
declare dono uuid;
begin
  select user_id into dono from public.stories where id = new.story_id;
  if dono is not null and dono <> new.user_id then
    insert into public.notificacoes (user_id, tipo, de_nome, resumo) values (dono, 'story_curtida', public.primeiro_nome(new.user_id), 'curtiu o seu story');
  end if;
  return new;
end $$;
drop trigger if exists notif_story_curtida_t on public.stories_curtidas;
create trigger notif_story_curtida_t after insert on public.stories_curtidas for each row execute function public.notif_story_curtida();
