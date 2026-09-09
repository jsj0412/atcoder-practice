-- 기존 Supabase 설정에 삭제 기능을 추가할 때 SQL Editor에서 한 번 실행하세요.
alter table public.practices add column if not exists delete_token_hash text;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.delete_practice(target_id uuid, deletion_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.practices
  where id = target_id
    and delete_token_hash = encode(digest(deletion_token, 'sha256'), 'hex');
  return found;
end;
$$;

revoke all on function public.delete_practice(uuid, text) from public;
grant execute on function public.delete_practice(uuid, text) to anon;
