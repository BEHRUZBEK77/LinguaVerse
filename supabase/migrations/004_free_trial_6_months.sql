-- BEPUL TARIF 6 OY: users/{uid}.freeUntil — bepul muddat tugash sanasi.
-- Server (trigger) qo'yadi; foydalanuvchi (authenticated) o'zgartira yoki o'chira olmaydi.
create or replace function lv_private.lv_free_until_guard() returns trigger
language plpgsql set search_path = public, lv_private as $$
declare dflt jsonb := jsonb_build_object('$t', to_char((now() + interval '180 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
begin
  if new.col <> 'users' or new.parent <> '' then return new; end if;
  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' or not (new.data ? 'freeUntil') then
      new.data := jsonb_set(new.data, '{freeUntil}', coalesce(case when auth.role() = 'service_role' then new.data->'freeUntil' end, dflt), true);
    end if;
  elsif auth.role() = 'authenticated' then
    new.data := jsonb_set(new.data, '{freeUntil}', coalesce(old.data->'freeUntil', dflt), true);
  end if;
  return new;
end $$;

drop trigger if exists lv_free_until on public.docs;
create trigger lv_free_until before insert or update on public.docs
  for each row execute function lv_private.lv_free_until_guard();

-- Mavjud foydalanuvchilar: qo'llangan kundan boshlab 6 oy
update public.docs
   set data = jsonb_set(data, '{freeUntil}', jsonb_build_object('$t', to_char((now() + interval '180 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true)
 where col = 'users' and parent = '' and not (data ? 'freeUntil');
