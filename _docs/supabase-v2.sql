-- Café, Graça & Fralda · banco de dados v2
-- Login com Google, chat entre pais, comentários públicos, agendamento com cancelamento e painel do Denny.
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- Pode rodar mais de uma vez sem problema. Não apaga os inscritos que já existem.
-- Depois, em uma consulta separada, cadastre o seu e-mail do Google como administrador (veja _docs/LOGIN-GOOGLE.md):
--   insert into public.admins (email) values ('SEU_EMAIL_DO_GOOGLE@gmail.com');

-- 0. Guarda as tabelas da versão 1 (sem apagar nada) e fecha o acesso público a elas.
do $$
begin
  if to_regclass('public.agendamentos') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'agendamentos' and column_name = 'user_id') then
    alter table public.agendamentos rename to agendamentos_v1;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['maos', 'respostas', 'agendamentos_v1'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 1. Administradores (só você). Ninguém lê essa tabela pelo site.
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.eh_admin() from public;
grant execute on function public.eh_admin() to anon, authenticated;

create or replace function public.primeiro_nome(uid uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    nullif(split_part(coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''), ' ', 1), ''),
    'Visitante')
  from auth.users where id = uid;
$$;
revoke all on function public.primeiro_nome(uuid) from public, anon, authenticated;

-- 2. Chat entre pais (precisa de login). Mostra só o primeiro nome.
create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  sala text not null check (sala in ('geral', 'sono', 'birra', 'casamento', 'cansaco', 'fe', 'duvidas')),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default '',
  texto text not null check (char_length(texto) between 1 and 1000),
  mao boolean not null default false,
  aprovado boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_sala_idx on public.mensagens (sala, criado_em desc);

create or replace function public.preencher_autor()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  new.user_id := auth.uid();
  new.nome := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  return new;
end $$;
drop trigger if exists mensagens_autor on public.mensagens;
create trigger mensagens_autor before insert on public.mensagens
  for each row execute function public.preencher_autor();

-- 3. Comentários públicos (qualquer pessoa lê e escreve; você pode ocultar pelo painel).
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  sobre text not null default 'Geral' check (char_length(sobre) between 1 and 80),
  nome text not null check (char_length(nome) between 1 and 60),
  texto text not null check (char_length(texto) between 1 and 800),
  user_id uuid default auth.uid(),
  aprovado boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists comentarios_data_idx on public.comentarios (criado_em desc);

-- 4. Inscritos (já existe da v1; garante a tabela e deixa só você ler).
create table if not exists public.inscritos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  email text not null check (char_length(email) between 3 and 120),
  whatsapp text not null check (char_length(whatsapp) between 10 and 20),
  criado_em timestamptz not null default now()
);

-- 5. Agenda: horários da semana, bloqueios pontuais e agendamentos.
create table if not exists public.horarios_semana (
  dia_semana smallint not null check (dia_semana between 1 and 7), -- 1 = segunda ... 7 = domingo
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  primary key (dia_semana, hora)
);
insert into public.horarios_semana (dia_semana, hora)
select d, h from generate_series(1, 5) as d, unnest(array['20:00', '20:30', '21:00', '21:30']) as h
on conflict do nothing;

create table if not exists public.bloqueios (
  data date not null,
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  primary key (data, hora)
);

create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data date not null,
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  formato text not null check (formato in ('whatsapp', 'video', 'presencial')),
  local text not null default '' check (char_length(local) <= 80),
  tema text not null check (char_length(tema) between 1 and 40),
  mensagem text not null check (char_length(mensagem) between 1 and 1500),
  nome text not null,
  email text,
  whatsapp text not null check (char_length(whatsapp) between 10 and 20),
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado')),
  cancelado_por text check (cancelado_por in ('cliente', 'denny')),
  criado_em timestamptz not null default now()
);
create unique index if not exists agendamentos_horario_ativo on public.agendamentos (data, hora) where status = 'confirmado';
create index if not exists agendamentos_user_idx on public.agendamentos (user_id, data);

-- O site só vê quais horários estão ocupados, nunca quem pediu.
create or replace view public.horarios_ocupados as
  select data, hora from public.agendamentos where status = 'confirmado' and data >= current_date
  union
  select data, hora from public.bloqueios where data >= current_date;

-- Agendar: valida tudo no servidor.
create or replace function public.agendar(
  p_data date, p_hora text, p_formato text, p_local text, p_tema text, p_mensagem text, p_whatsapp text)
returns public.agendamentos language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  v_nome text; v_email text;
  r public.agendamentos;
  agora timestamp := (now() at time zone 'America/Sao_Paulo');
begin
  if uid is null then raise exception 'login_necessario'; end if;
  if p_formato not in ('whatsapp', 'video', 'presencial')
     or char_length(coalesce(p_mensagem, '')) not between 1 and 1500
     or char_length(coalesce(p_tema, '')) not between 1 and 40
     or char_length(coalesce(p_local, '')) > 80
     or char_length(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g')) not between 10 and 15
     or (p_formato = 'presencial' and char_length(coalesce(p_local, '')) < 3) then
    raise exception 'dados_invalidos';
  end if;
  if p_data > agora::date + 60 then raise exception 'horario_indisponivel'; end if;
  if (p_data::text || ' ' || p_hora)::timestamp < agora + interval '1 hour' then raise exception 'horario_passado'; end if;
  if not exists (select 1 from public.horarios_semana h
                 where h.dia_semana = extract(isodow from p_data)::int and h.hora = p_hora)
     or exists (select 1 from public.bloqueios b where b.data = p_data and b.hora = p_hora) then
    raise exception 'horario_indisponivel';
  end if;
  if (select count(*) from public.agendamentos a
      where a.user_id = uid and a.status = 'confirmado' and a.data >= agora::date) >= 2 then
    raise exception 'limite_agendamentos';
  end if;

  select coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(email, '@', 1)), email
    into v_nome, v_email from auth.users where id = uid;

  insert into public.agendamentos (user_id, data, hora, formato, local, tema, mensagem, nome, email, whatsapp)
  values (uid, p_data, p_hora, p_formato, coalesce(p_local, ''), p_tema, p_mensagem, v_nome, v_email, p_whatsapp)
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'horario_ocupado';
end $$;

-- Desmarcar: a própria pessoa ou o Denny.
create or replace function public.cancelar_agendamento(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare adm boolean := public.eh_admin(); n int;
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  update public.agendamentos
     set status = 'cancelado', cancelado_por = case when adm then 'denny' else 'cliente' end
   where id = p_id and status = 'confirmado' and (user_id = auth.uid() or adm);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'nao_encontrado'; end if;
  return true;
end $$;

revoke all on function public.agendar(date, text, text, text, text, text, text) from public, anon;
revoke all on function public.cancelar_agendamento(uuid) from public, anon;
grant execute on function public.agendar(date, text, text, text, text, text, text) to authenticated;
grant execute on function public.cancelar_agendamento(uuid) to authenticated;

-- 6. Regras de acesso (RLS)
alter table public.mensagens enable row level security;
alter table public.comentarios enable row level security;
alter table public.inscritos enable row level security;
alter table public.horarios_semana enable row level security;
alter table public.bloqueios enable row level security;
alter table public.agendamentos enable row level security;

drop policy if exists "chat: ler" on public.mensagens;
drop policy if exists "chat: escrever" on public.mensagens;
drop policy if exists "chat: apagar" on public.mensagens;
drop policy if exists "chat: moderar" on public.mensagens;
create policy "chat: ler" on public.mensagens for select to authenticated using (aprovado or public.eh_admin());
create policy "chat: escrever" on public.mensagens for insert to authenticated with check (user_id = auth.uid());
create policy "chat: apagar" on public.mensagens for delete to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "chat: moderar" on public.mensagens for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "comentarios: ler" on public.comentarios;
drop policy if exists "comentarios: escrever" on public.comentarios;
drop policy if exists "comentarios: apagar" on public.comentarios;
drop policy if exists "comentarios: moderar" on public.comentarios;
create policy "comentarios: ler" on public.comentarios for select to anon, authenticated using (aprovado or public.eh_admin());
create policy "comentarios: escrever" on public.comentarios for insert to anon, authenticated with check (aprovado);
create policy "comentarios: apagar" on public.comentarios for delete to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "comentarios: moderar" on public.comentarios for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "cadastrar inscrito" on public.inscritos;
drop policy if exists "inscritos: cadastrar" on public.inscritos;
drop policy if exists "inscritos: admin le" on public.inscritos;
create policy "inscritos: cadastrar" on public.inscritos for insert to anon, authenticated with check (true);
create policy "inscritos: admin le" on public.inscritos for select to authenticated using (public.eh_admin());

drop policy if exists "horarios: ler" on public.horarios_semana;
drop policy if exists "horarios: admin" on public.horarios_semana;
create policy "horarios: ler" on public.horarios_semana for select to anon, authenticated using (true);
create policy "horarios: admin" on public.horarios_semana for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "bloqueios: admin" on public.bloqueios;
create policy "bloqueios: admin" on public.bloqueios for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "agendamentos: ler" on public.agendamentos;
create policy "agendamentos: ler" on public.agendamentos for select to authenticated using (user_id = auth.uid() or public.eh_admin());

-- 7. Permissões das tabelas (funcionam mesmo com "Expor automaticamente novas tabelas" desligado)
grant usage on schema public to anon, authenticated;
grant select on public.horarios_semana, public.horarios_ocupados to anon, authenticated;
grant select, insert, delete on public.horarios_semana, public.bloqueios to authenticated;
grant select on public.agendamentos to authenticated;
grant select, insert, delete on public.mensagens to authenticated;
grant update (aprovado) on public.mensagens to authenticated;
grant select, insert on public.comentarios to anon, authenticated;
grant delete on public.comentarios to authenticated;
grant update (aprovado) on public.comentarios to authenticated;
grant insert on public.inscritos to anon, authenticated;
grant select on public.inscritos to authenticated;
