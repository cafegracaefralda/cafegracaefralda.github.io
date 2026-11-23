-- Café, Graça & Fralda · banco de dados v5: indicações enviadas pelos membros ("Da nossa mesa para a sua").
--
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run (depois do supabase-v2.sql).
-- Pode rodar mais de uma vez sem problema. Não apaga nada.
--
-- Como funciona: quem entrou com o Google envia a indicação (nome, especialidade, onde fica, como conheceu,
-- plano de saúde ou particular, por que indica). Ela só aparece no site DEPOIS que o Denny aprova no Painel > Moderação.
-- Quem enviou vê a própria indicação "em análise". Limite: 5 indicações por dia por pessoa.

create table if not exists public.indicacoes_membros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autor text not null default '',
  nome text not null check (char_length(nome) between 2 and 80),
  categoria text not null default 'Outro' check (categoria in ('Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Outro')),
  especialidade text not null check (char_length(especialidade) between 2 and 80),
  onde text not null check (char_length(onde) between 2 and 140),
  atendimento text not null default 'Presencial' check (atendimento in ('Presencial', 'Online', 'Online e presencial')),
  plano text not null check (plano in ('particular', 'plano')),
  planos text check (planos is null or char_length(planos) between 2 and 120),
  como_conheceu text not null check (char_length(como_conheceu) between 2 and 300),
  porque text not null check (char_length(porque) between 2 and 500),
  contato text check (contato is null or char_length(contato) <= 60),
  aprovado boolean not null default false,
  criado_em timestamptz not null default now(),
  check ((plano = 'plano' and planos is not null) or (plano = 'particular' and planos is null))
);
create index if not exists indicacoes_membros_idx on public.indicacoes_membros (aprovado, criado_em desc);

create or replace function public.indicacao_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.autor := public.primeiro_nome(auth.uid());
  new.aprovado := false;
  if not public.eh_admin() and (select count(*) from public.indicacoes_membros where user_id = new.user_id and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'muito_rapido';
  end if;
  return new;
end $$;
drop trigger if exists indicacao_antes on public.indicacoes_membros;
create trigger indicacao_antes before insert on public.indicacoes_membros for each row execute function public.indicacao_antes();

alter table public.indicacoes_membros enable row level security;
drop policy if exists "indicacoes: ler aprovadas" on public.indicacoes_membros;
drop policy if exists "indicacoes: enviar" on public.indicacoes_membros;
drop policy if exists "indicacoes: apagar" on public.indicacoes_membros;
drop policy if exists "indicacoes: moderar" on public.indicacoes_membros;
create policy "indicacoes: ler aprovadas" on public.indicacoes_membros for select to anon, authenticated
  using (aprovado or user_id = auth.uid() or public.eh_admin());
create policy "indicacoes: enviar" on public.indicacoes_membros for insert to authenticated with check (user_id = auth.uid());
create policy "indicacoes: apagar" on public.indicacoes_membros for delete to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "indicacoes: moderar" on public.indicacoes_membros for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Permissões: o público lê só as colunas que aparecem no site (sem user_id); membros preenchem só os campos do formulário.
revoke all on public.indicacoes_membros from anon, authenticated;
grant select (id, autor, nome, categoria, especialidade, onde, atendimento, plano, planos, como_conheceu, porque, contato, aprovado, criado_em) on public.indicacoes_membros to anon, authenticated;
grant select (user_id) on public.indicacoes_membros to authenticated;
grant insert (nome, categoria, especialidade, onde, atendimento, plano, planos, como_conheceu, porque, contato) on public.indicacoes_membros to authenticated;
grant update (aprovado) on public.indicacoes_membros to authenticated;
grant delete on public.indicacoes_membros to authenticated;
