-- Ichki yordamchilar API orqali chaqirilmasin: alohida (ochiq bo'lmagan) sxemaga
-- (001_docs_store.sql dan KEYIN qo'llanadi)
create schema if not exists lv_private;
grant usage on schema lv_private to anon, authenticated;

alter function public.lv_doc(text) set schema lv_private;
alter function public.lv_is_admin() set schema lv_private;
alter function public.lv_can_read(text, jsonb) set schema lv_private;
alter function public.lv_can_write(text, text, jsonb, jsonb) set schema lv_private;
alter function public.lv_changed(jsonb, jsonb) set schema lv_private;
alter function public.lv_resolve(jsonb, jsonb, boolean) set schema lv_private;
alter function public.lv_apply(jsonb, jsonb, text) set schema lv_private;
alter function public.lv_split(text) set schema lv_private;
alter function public.lv_where_sql(jsonb) set schema lv_private;
alter function public.lv_order_sql(jsonb) set schema lv_private;

alter function lv_private.lv_doc(text) set search_path = public, lv_private;
alter function lv_private.lv_is_admin() set search_path = public, lv_private;
alter function lv_private.lv_can_read(text, jsonb) set search_path = public, lv_private;
alter function lv_private.lv_can_write(text, text, jsonb, jsonb) set search_path = public, lv_private;
alter function lv_private.lv_changed(jsonb, jsonb) set search_path = public, lv_private;
alter function lv_private.lv_resolve(jsonb, jsonb, boolean) set search_path = public, lv_private;
alter function lv_private.lv_apply(jsonb, jsonb, text) set search_path = public, lv_private;
alter function lv_private.lv_split(text) set search_path = public, lv_private;
alter function lv_private.lv_where_sql(jsonb) set search_path = public, lv_private;
alter function lv_private.lv_order_sql(jsonb) set search_path = public, lv_private;
alter function public.app_uid() set search_path = public;
alter function public.lv_val(jsonb) set search_path = public;

-- lv_resolve ichida public.lv_resolve ga rekursiv murojaat bor — yangilaymiz
create or replace function lv_private.lv_resolve(oldv jsonb, newv jsonb, deep boolean)
returns jsonb language plpgsql stable set search_path = public, lv_private as $$
declare
  op text; k text; v jsonb; res jsonb; r jsonb; elem jsonb;
begin
  if newv is null then return null; end if;
  if jsonb_typeof(newv) = 'object' and newv ? '$op' then
    op := newv ->> '$op';
    if op = 'ts' then
      return jsonb_build_object('$t', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    elsif op = 'inc' then
      return to_jsonb(coalesce(case when jsonb_typeof(oldv) = 'number' then (oldv)::text::numeric end, 0) + (newv ->> 'n')::numeric);
    elsif op = 'union' then
      res := case when jsonb_typeof(oldv) = 'array' then oldv else '[]'::jsonb end;
      for elem in select * from jsonb_array_elements(newv -> 'v') loop
        if not (res @> jsonb_build_array(elem)) then res := res || jsonb_build_array(elem); end if;
      end loop;
      return res;
    elsif op = 'remove' then
      if jsonb_typeof(oldv) is distinct from 'array' then return '[]'::jsonb; end if;
      select coalesce(jsonb_agg(e), '[]'::jsonb) into res
        from jsonb_array_elements(oldv) e where not ((newv -> 'v') @> jsonb_build_array(e));
      return res;
    elsif op = 'del' then
      return jsonb_build_object('$op', 'del');
    end if;
    return newv;
  end if;
  if jsonb_typeof(newv) = 'object' and not (newv ? '$t') then
    res := case when deep and jsonb_typeof(oldv) = 'object' and not (oldv ? '$t') then oldv else '{}'::jsonb end;
    for k, v in select * from jsonb_each(newv) loop
      r := lv_private.lv_resolve(res -> k, v, deep);
      if jsonb_typeof(r) = 'object' and r ->> '$op' = 'del' then res := res - k;
      else res := jsonb_set(res, array[k], r, true); end if;
    end loop;
    return res;
  end if;
  return newv;
end $$;

create or replace function lv_private.lv_apply(oldd jsonb, patch jsonb, mode text)
returns jsonb language plpgsql stable set search_path = public, lv_private as $$
declare res jsonb; k text; v jsonb; p text[]; r jsonb; i int; cur jsonb;
begin
  if mode = 'set' then return lv_private.lv_resolve(null, patch, false); end if;
  if mode = 'merge' then return lv_private.lv_resolve(coalesce(oldd, '{}'::jsonb), patch, true); end if;
  res := coalesce(oldd, '{}'::jsonb);
  for k, v in select * from jsonb_each(patch) loop
    p := string_to_array(k, '.');
    r := lv_private.lv_resolve(res #> p, v, false);
    for i in 1 .. coalesce(array_length(p, 1), 1) - 1 loop
      cur := res #> p[1:i];
      if cur is null or jsonb_typeof(cur) <> 'object' then res := jsonb_set(res, p[1:i], '{}'::jsonb, true); end if;
    end loop;
    if jsonb_typeof(r) = 'object' and r ->> '$op' = 'del' then res := res #- p;
    else res := jsonb_set(res, p, r, true); end if;
  end loop;
  return res;
end $$;

-- Siyosat va RPC'lar yangi joyga murojaat qilsin
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to anon, authenticated
  using (lv_private.lv_can_read(path, data));

create or replace function public.lv_write(p text, patch jsonb, mode text)
returns jsonb language plpgsql security definer set search_path = public, lv_private as $$
declare cur public.docs%rowtype; found_ boolean; nd jsonb; op text; sp record;
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'service_role' then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if p is null or array_length(string_to_array(p, '/'), 1) % 2 <> 0 or p ~ '(^/|/$|//)' then
    raise exception 'invalid-argument: noto''g''ri hujjat yo''li %', p using errcode = '22023';
  end if;
  select * into cur from public.docs where path = p for update;
  found_ := found;

  if mode = 'delete' then
    if not found_ then return null; end if;
    if not lv_private.lv_can_write('delete', p, cur.data, null) then
      raise exception 'permission-denied' using errcode = '42501';
    end if;
    delete from public.docs where path = p;
    return null;
  end if;

  if mode = 'update' and not found_ then
    raise exception 'not-found: %', p using errcode = 'P0002';
  end if;
  if mode = 'create' and found_ then
    raise exception 'already-exists: %', p using errcode = '23505';
  end if;

  nd := lv_private.lv_apply(case when found_ then cur.data else null end, patch, case when mode = 'create' then 'set' else mode end);
  op := case when found_ then 'update' else 'create' end;
  if not lv_private.lv_can_write(op, p, case when found_ then cur.data else null end, nd) then
    raise exception 'permission-denied' using errcode = '42501';
  end if;

  sp := lv_private.lv_split(p);
  insert into public.docs as d (path, col, parent, data)
    values (p, sp.col, sp.parent, nd)
  on conflict (path) do update set data = excluded.data, version = d.version + 1, updated_at = now();
  return nd;
end $$;

create or replace function public.lv_commit(reads jsonb, writes jsonb)
returns boolean language plpgsql security definer set search_path = public, lv_private as $$
declare r jsonb; w jsonb; v bigint;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(coalesce(reads, '[]'::jsonb)) loop
    select version into v from public.docs where path = r ->> 'path' for update;
    if coalesce(v, 0) <> coalesce((r ->> 'version')::bigint, 0) then
      return false;
    end if;
  end loop;
  for w in select * from jsonb_array_elements(coalesce(writes, '[]'::jsonb)) loop
    perform public.lv_write(w ->> 'path', coalesce(w -> 'data', '{}'::jsonb), w ->> 'mode');
  end loop;
  return true;
end $$;

create or replace function public.lv_query(c text, par text, filters jsonb, orders jsonb, lim int)
returns setof public.docs language plpgsql stable security invoker set search_path = public, lv_private as $$
begin
  return query execute format(
    'select * from public.docs where col = %L %s %s order by %s limit %s',
    c,
    case when par is null then '' else format('and parent = %L', par) end,
    lv_private.lv_where_sql(filters),
    lv_private.lv_order_sql(orders),
    least(greatest(coalesce(lim, 1000), 1), 5000)
  );
end $$;

create or replace function public.lv_count(c text, par text, filters jsonb)
returns bigint language plpgsql stable security invoker set search_path = public, lv_private as $$
declare n bigint;
begin
  execute format('select count(*) from public.docs where col = %L %s %s', c,
    case when par is null then '' else format('and parent = %L', par) end,
    lv_private.lv_where_sql(filters)) into n;
  return n;
end $$;

revoke all on function public.lv_write(text, jsonb, text) from public, anon;
revoke all on function public.lv_commit(jsonb, jsonb) from public, anon;
grant execute on function public.lv_write(text, jsonb, text) to authenticated, service_role;
grant execute on function public.lv_commit(jsonb, jsonb) to authenticated, service_role;
grant execute on all functions in schema lv_private to anon, authenticated, service_role;
