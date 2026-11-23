-- Café, Graça & Fralda · banco de dados v3: conversas privadas entre pais.
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2.sql).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Privacidade: só os dois participantes leem uma conversa. Nem o painel do Denny lê conversas privadas.
-- Segurança: dá para bloquear alguém, desligar o recebimento de mensagens e há limite de envio por minuto.

-- 1. Perfis (só o primeiro nome aparece para os outros)
create table if not exists public.perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  aceita_dm boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function public.garantir_perfil()
returns public.perfis language plpgsql security definer set search_path = public, auth as $$
declare r public.perfis;
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  insert into public.perfis (user_id, nome) values (auth.uid(), public.primeiro_nome(auth.uid()))
  on conflict (user_id) do nothing;
  select * into r from public.perfis where user_id = auth.uid();
  return r;
end $$;

-- 2. Conversas e mensagens privadas
create table if not exists public.dm_conversas (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  check (a < b),
  unique (a, b)
);

create table if not exists public.dm_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.dm_conversas (id) on delete cascade,
  de uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists dm_mensagens_conversa_idx on public.dm_mensagens (conversa_id, criado_em desc);

create table if not exists public.dm_bloqueios (
  quem uuid not null references auth.users (id) on delete cascade,
  bloqueado uuid not null references auth.users (id) on delete cascade,
  primary key (quem, bloqueado),
  check (quem <> bloqueado)
);

-- Abre (ou encontra) a conversa entre quem chama e outra pessoa.
create or replace function public.abrir_conversa(p_outro uuid)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); lo uuid; hi uuid; cid uuid;
begin
  if me is null then raise exception 'login_necessario'; end if;
  if p_outro is null or p_outro = me then raise exception 'dados_invalidos'; end if;
  insert into public.perfis (user_id, nome)
    select id, public.primeiro_nome(id) from auth.users where id = p_outro
  on conflict (user_id) do nothing;
  if not exists (select 1 from public.perfis where user_id = p_outro) then raise exception 'nao_encontrado'; end if;
  if exists (select 1 from public.perfis where user_id = p_outro and not aceita_dm) then raise exception 'dm_desativado'; end if;
  if exists (select 1 from public.dm_bloqueios where quem = p_outro and bloqueado = me) then raise exception 'indisponivel'; end if;
  lo := least(me, p_outro); hi := greatest(me, p_outro);
  insert into public.dm_conversas (a, b) values (lo, hi) on conflict (a, b) do nothing;
  select id into cid from public.dm_conversas where a = lo and b = hi;
  return cid;
end $$;

-- Marca como lidas as mensagens recebidas numa conversa.
create or replace function public.marcar_lidas(p_conversa uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.dm_mensagens m set lida = true
   where m.conversa_id = p_conversa and m.de <> auth.uid() and not m.lida
     and exists (select 1 from public.dm_conversas c where c.id = p_conversa and auth.uid() in (c.a, c.b));
end $$;

-- Pode enviar? Participante da conversa e não bloqueado pela outra pessoa.
-- (security definer: quem foi bloqueado não enxerga a lista de bloqueios, mas a regra precisa valer.)
create or replace function public.dm_pode_enviar(p_conversa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dm_conversas c
    where c.id = p_conversa and auth.uid() in (c.a, c.b)
      and not exists (
        select 1 from public.dm_bloqueios bl
        where bl.quem = (case when c.a = auth.uid() then c.b else c.a end) and bl.bloqueado = auth.uid()));
$$;
revoke all on function public.dm_pode_enviar(uuid) from public, anon;
grant execute on function public.dm_pode_enviar(uuid) to authenticated;

-- Limite de envio e atualização da conversa
create or replace function public.dm_antes_de_enviar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.de := auth.uid();
  new.lida := false;
  if (select count(*) from public.dm_mensagens where de = new.de and criado_em > now() - interval '1 minute') >= 20 then
    raise exception 'muito_rapido';
  end if;
  return new;
end $$;
drop trigger if exists dm_antes on public.dm_mensagens;
create trigger dm_antes before insert on public.dm_mensagens for each row execute function public.dm_antes_de_enviar();

create or replace function public.dm_depois_de_enviar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.dm_conversas set ultima_em = now() where id = new.conversa_id;
  return new;
end $$;
drop trigger if exists dm_depois on public.dm_mensagens;
create trigger dm_depois after insert on public.dm_mensagens for each row execute function public.dm_depois_de_enviar();

revoke all on function public.garantir_perfil() from public, anon;
revoke all on function public.abrir_conversa(uuid) from public, anon;
revoke all on function public.marcar_lidas(uuid) from public, anon;
grant execute on function public.garantir_perfil() to authenticated;
grant execute on function public.abrir_conversa(uuid) to authenticated;
grant execute on function public.marcar_lidas(uuid) to authenticated;

-- 3. Regras de acesso (RLS)
alter table public.perfis enable row level security;
alter table public.dm_conversas enable row level security;
alter table public.dm_mensagens enable row level security;
alter table public.dm_bloqueios enable row level security;

drop policy if exists "perfis: ler" on public.perfis;
drop policy if exists "perfis: editar o proprio" on public.perfis;
create policy "perfis: ler" on public.perfis for select to authenticated using (true);
create policy "perfis: editar o proprio" on public.perfis for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "dm conversas: ler" on public.dm_conversas;
create policy "dm conversas: ler" on public.dm_conversas for select to authenticated using (auth.uid() in (a, b));

drop policy if exists "dm: ler" on public.dm_mensagens;
drop policy if exists "dm: escrever" on public.dm_mensagens;
create policy "dm: ler" on public.dm_mensagens for select to authenticated using (
  exists (select 1 from public.dm_conversas c where c.id = conversa_id and auth.uid() in (c.a, c.b)));
create policy "dm: escrever" on public.dm_mensagens for insert to authenticated with check (
  de = auth.uid() and public.dm_pode_enviar(conversa_id));

drop policy if exists "bloqueios dm: meus" on public.dm_bloqueios;
create policy "bloqueios dm: meus" on public.dm_bloqueios for all to authenticated
  using (quem = auth.uid()) with check (quem = auth.uid() and bloqueado <> auth.uid());

-- 4. Permissões das tabelas
grant select on public.perfis to authenticated;
grant update (aceita_dm) on public.perfis to authenticated;
grant select on public.dm_conversas to authenticated;
grant select, insert on public.dm_mensagens to authenticated;
grant select, insert, delete on public.dm_bloqueios to authenticated;
