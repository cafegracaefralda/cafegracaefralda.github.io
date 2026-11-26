-- Café, Graça & Fralda · banco v19: Mensagens privadas com PDF e áudios que somem em 72 horas.
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v18). Pode rodar mais de uma vez. Não apaga dados.
-- Regras: foto (JPEG), PDF e áudio até 5 MB; o áudio some 72 horas depois de enviado (arquivo e mensagem).

-- 1. O bucket privado passa a aceitar PDF
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'application/pdf', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'], file_size_limit = 5242880
 where id = 'privado';

-- 2. A mensagem aceita foto, PDF ou áudio
alter table public.dm_mensagens drop constraint if exists dm_arquivo_ok;
alter table public.dm_mensagens add constraint dm_arquivo_ok check (
  (arquivo is null and arquivo_nome is null and arquivo_tipo is null)
  or (arquivo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webm|ogg|m4a|mp3|pdf)$' and arquivo_tipo in ('image', 'audio', 'pdf') and char_length(coalesce(arquivo_nome, '')) between 1 and 120));

-- 3. Aviso do sininho para mensagem só com arquivo
create or replace function public.notif_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare outro uuid;
begin
  select case when c.a = new.de then c.b else c.a end into outro from public.dm_conversas c where c.id = new.conversa_id;
  if outro is null then return new; end if;
  if not exists (select 1 from public.notificacoes where user_id = outro and conversa_id = new.conversa_id and tipo = 'dm' and not lida) then
    insert into public.notificacoes (user_id, tipo, de_nome, conversa_id, resumo)
    values (outro, 'dm', public.primeiro_nome(new.de), new.conversa_id,
      case when new.texto = '' then (case new.arquivo_tipo when 'audio' then 'Enviou um áudio' when 'pdf' then 'Enviou um PDF' else 'Enviou uma foto' end) else left(new.texto, 120) end);
  end if;
  return new;
end $$;

-- 4. Áudios vencidos (72 h): quem abre as mensagens limpa os arquivos e as mensagens da própria conversa
drop policy if exists "privado arquivos: apagar audio vencido" on storage.objects;
create policy "privado arquivos: apagar audio vencido" on storage.objects for delete to authenticated
  using (bucket_id = 'privado' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.dm_participante(((storage.foldername(name))[1])::uuid)
         and name ~ '\.(webm|ogg|m4a|mp3)$');
drop policy if exists "dm: apagar audio vencido" on public.dm_mensagens;
create policy "dm: apagar audio vencido" on public.dm_mensagens for delete to authenticated
  using (arquivo_tipo = 'audio' and criado_em < now() - interval '72 hours' and public.dm_participante(conversa_id));
grant delete on public.dm_mensagens to authenticated;

create or replace function public.dm_audios_vencidos()
returns setof text language sql stable security definer set search_path = public as $$
  select m.arquivo from public.dm_mensagens m
   where m.arquivo_tipo = 'audio' and m.arquivo is not null and m.criado_em < now() - interval '72 hours' and public.dm_participante(m.conversa_id)
   limit 200;
$$;
create or replace function public.dm_expirar_audios()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.dm_mensagens m
   where m.arquivo_tipo = 'audio' and m.criado_em < now() - interval '72 hours' and public.dm_participante(m.conversa_id);
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.dm_audios_vencidos() from public, anon;
revoke all on function public.dm_expirar_audios() from public, anon;
grant execute on function public.dm_audios_vencidos() to authenticated;
grant execute on function public.dm_expirar_audios() to authenticated;
