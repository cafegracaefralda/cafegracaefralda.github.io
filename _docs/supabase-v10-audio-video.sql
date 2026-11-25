-- Café, Graça & Fralda · banco v10: áudio na Prateleira e vídeo só para a Casa (administração).
-- Como usar: Supabase > SQL Editor > cole tudo > Run (depois do v7). Pode rodar mais de uma vez.
-- Membros comuns: texto, foto, áudio (até 10 MB), PDF, link e YouTube. Vídeo próprio (MP4/WebM): só administração.

alter table public.pubs drop constraint if exists pubs_tipo_check;
alter table public.pubs add constraint pubs_tipo_check check (tipo in ('texto', 'foto', 'video', 'audio', 'pdf', 'youtube', 'link', 'aviso', 'devocional', 'evento', 'parceiro'));

create or replace function public.pub_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_necessario'; end if;
  new.user_id := auth.uid();
  new.autor := public.primeiro_nome(auth.uid());
  new.aprovado := true;
  if not public.eh_admin() then
    new.oficial := false; new.fixado := false;
    if new.tipo not in ('texto', 'foto', 'audio', 'pdf', 'youtube', 'link') then raise exception 'dados_invalidos'; end if;
    if new.arquivo ~* '\.(mp4|webm|mov)$' and new.tipo <> 'audio' then raise exception 'dados_invalidos'; end if;
    if (select count(*) from public.pubs where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 10 then raise exception 'muito_rapido'; end if;
  end if;
  if new.arquivo is not null and split_part(new.arquivo, '/', 1) <> auth.uid()::text then raise exception 'dados_invalidos'; end if;
  return new;
end $$;

update storage.buckets set allowed_mime_types = array['image/jpeg', 'application/pdf', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
where id = 'prateleira';

-- Indicações dos membros: novas categorias (hotéis, restaurantes, praças e mais)
-- Linhas antigas com categoria fora da lista viram "Outro" (evita erro ao criar a regra).
update public.indicacoes_membros set categoria = 'Outro' where categoria not in ('Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques', 'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Saúde', 'Fé e religião', 'Educação', 'Família', 'Casa', 'Outro');
alter table public.indicacoes_membros drop constraint if exists indicacoes_membros_categoria_check;
alter table public.indicacoes_membros add constraint indicacoes_membros_categoria_check check (categoria in ('Saúde dos pequenos', 'Gestação e bebê', 'Mente e emoções', 'Desenvolvimento', 'Casamento', 'Hotéis e pousadas', 'Restaurantes e cafés', 'Praças e parques', 'Passeios e lazer', 'Serviços para a casa', 'Escolas e creches', 'Saúde', 'Fé e religião', 'Educação', 'Família', 'Casa', 'Outro'));
