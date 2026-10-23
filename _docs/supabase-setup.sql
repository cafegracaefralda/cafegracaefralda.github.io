-- Café, Graça & Fralda: banco de dados da mesa "Levante a mão", dos inscritos e dos agendamentos.
-- Como usar:
--   1. Crie uma conta grátis em https://supabase.com e um projeto novo.
--   2. Abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
--   3. Em "Project Settings > API", copie a "Project URL" e a chave "anon public".
--   4. No index.html, preencha SUPABASE_URL e SUPABASE_KEY com esses dois valores.
-- Para esconder uma mensagem: Table Editor > maos (ou respostas) > aprovado = false.
-- Para ver os pedidos de café: Table Editor > agendamentos.

create table if not exists public.maos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  tema text not null check (char_length(tema) between 1 and 40),
  texto text not null check (char_length(texto) between 1 and 1500),
  aprovado boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.respostas (
  id uuid primary key default gen_random_uuid(),
  mao_id uuid not null references public.maos(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  texto text not null check (char_length(texto) between 1 and 1000),
  aprovado boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.inscritos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  email text not null check (char_length(email) between 3 and 120),
  whatsapp text not null check (char_length(whatsapp) between 10 and 20),
  criado_em timestamptz not null default now()
);

-- Um café na sua mesa: um pedido por horário (a regra "unique" impede dois pedidos no mesmo horário).
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  hora text not null check (hora in ('20:00','20:30','21:00','21:30')),
  formato text not null check (char_length(formato) between 1 and 40),
  local text not null default '' check (char_length(local) <= 80),
  tema text not null check (char_length(tema) between 1 and 40),
  mensagem text not null check (char_length(mensagem) between 1 and 1500),
  nome text not null check (char_length(nome) between 1 and 60),
  whatsapp text not null check (char_length(whatsapp) between 10 and 20),
  criado_em timestamptz not null default now(),
  unique (data, hora),
  check (extract(isodow from data) between 1 and 5)
);

-- Mostra ao site só quais horários estão ocupados, nunca quem pediu.
create or replace view public.horarios_ocupados as
  select data, hora from public.agendamentos where data >= current_date;

alter table public.maos enable row level security;
alter table public.respostas enable row level security;
alter table public.inscritos enable row level security;
alter table public.agendamentos enable row level security;

-- Visitantes leem as conversas aprovadas e podem participar.
create policy "ler maos" on public.maos for select to anon using (aprovado = true);
create policy "levantar a mao" on public.maos for insert to anon with check (aprovado = true);
create policy "ler respostas" on public.respostas for select to anon using (aprovado = true);
create policy "responder" on public.respostas for insert to anon with check (aprovado = true);

-- Visitantes só podem se cadastrar e pedir horário. Os dados ficam visíveis
-- apenas para você, no painel do Supabase.
create policy "cadastrar inscrito" on public.inscritos for insert to anon with check (true);
create policy "pedir horario" on public.agendamentos for insert to anon with check (data >= current_date);
grant select on public.horarios_ocupados to anon;
