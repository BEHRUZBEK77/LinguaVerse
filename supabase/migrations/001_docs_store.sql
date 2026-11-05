-- ═══════════════════════════════════════════════════════════════════════════
-- LinguaVerse — Firebase Firestore'dan Supabase'ga ko'chish
--
-- Firestore hujjatlari aynan o'sha yo'l bilan saqlanadi:
--   users/{uid}, users/{uid}/events/{id}, orders/{id} ...
-- Shu sababli sayt kodi (js/fb/* moslik qatlami orqali) deyarli o'zgarmaydi.
--
-- XAVFSIZLIK: brauzer jadvalga to'g'ridan-to'g'ri YOZA OLMAYDI. Hamma yozish
-- lv_write() / lv_commit() orqali o'tadi, ular firestore.rules dagi
-- qoidalarni aynan takrorlaydigan lv_can_write() bilan tekshiradi.
-- O'qish RLS siyosati (lv_can_read) orqali. Server (Netlify functions)
-- service_role kaliti bilan ishlaydi va qoidalarni chetlab o'tadi —
-- xuddi Firebase Admin SDK kabi.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.docs (
  path        text primary key,
  col         text not null,
  parent      text not null default '',
  data        jsonb not null default '{}'::jsonb,
  version     bigint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists docs_col_idx on public.docs (col);
create index if not exists docs_parent_col_idx on public.docs (parent, col);
create index if not exists docs_data_gin on public.docs using gin (data jsonb_path_ops);

alter table public.docs enable row level security;
alter table public.docs replica identity full;   -- realtime o'chirishlarda eski qatorni ham beradi

-- ── Yordamchilar ────────────────────────────────────────────────────────
-- Firebase'dan ko'chgan foydalanuvchining ESKI uid'i saqlanadi (app_metadata),
-- shuning uchun users/{eski_uid} yo'llari o'zgarmaydi.
create or replace function public.app_uid() returns text
language sql stable as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'legacy_uid', ''),
    (auth.uid())::text
  )
$$;

create or replace function public.lv_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select app_uid() is not null
     and exists (select 1 from public.docs where path = 'admins/' || app_uid())
$$;

create or replace function public.lv_doc(p text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.docs where path = p
$$;

-- Vaqt belgisi {"$t":"ISO"} — taqqoslashda ISO matn sifatida
create or replace function public.lv_val(j jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(j) = 'object' and j ? '$t' then to_jsonb(j ->> '$t') else j end
$$;

-- ── Yozish sentinel'lari: serverTimestamp, increment, arrayUnion/Remove, deleteField ──
create or replace function public.lv_resolve(oldv jsonb, newv jsonb, deep boolean)
returns jsonb language plpgsql stable as $$
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
      r := public.lv_resolve(res -> k, v, deep);
      if jsonb_typeof(r) = 'object' and r ->> '$op' = 'del' then res := res - k;
      else res := jsonb_set(res, array[k], r, true); end if;
    end loop;
    return res;
  end if;
  return newv;
end $$;

-- mode: 'set' (to'liq almashtirish), 'merge' (setDoc merge — chuqur), 'update' (updateDoc — nuqtali yo'llar)
create or replace function public.lv_apply(oldd jsonb, patch jsonb, mode text)
returns jsonb language plpgsql stable as $$
declare res jsonb; k text; v jsonb; p text[]; r jsonb; i int; cur jsonb;
begin
  if mode = 'set' then return public.lv_resolve(null, patch, false); end if;
  if mode = 'merge' then return public.lv_resolve(coalesce(oldd, '{}'::jsonb), patch, true); end if;
  -- update: "a.b.c" kalitlari ichki maydonni yangilaydi
  res := coalesce(oldd, '{}'::jsonb);
  for k, v in select * from jsonb_each(patch) loop
    p := string_to_array(k, '.');
    r := public.lv_resolve(res #> p, v, false);
    -- oraliq obyektlarni yaratamiz
    for i in 1 .. coalesce(array_length(p, 1), 1) - 1 loop
      cur := res #> p[1:i];
      if cur is null or jsonb_typeof(cur) <> 'object' then res := jsonb_set(res, p[1:i], '{}'::jsonb, true); end if;
    end loop;
    if jsonb_typeof(r) = 'object' and r ->> '$op' = 'del' then res := res #- p;
    else res := jsonb_set(res, p, r, true); end if;
  end loop;
  return res;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- O'QISH QOIDALARI (firestore.rules bilan bir xil)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.lv_can_read(p text, d jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s text[] := string_to_array(p, '/'); n int := array_length(s, 1); uid text := app_uid(); c text := s[1];
begin
  if lv_is_admin() then
    return c not in ('voiceRoomSecrets', 'voiceRoomMembers', 'rate_limits', 'apiConfig');
  end if;
  if c in ('voiceRooms', 'content', 'community_vocab', 'community_units', 'community_flashcards', 'certificates') then
    return n = 2;
  end if;
  if uid is null then return false; end if;
  if c = 'users' then
    if s[2] <> uid then return false; end if;
    if n = 2 then return true; end if;
    return s[3] not in ('billing');                 -- karta tokeni faqat serverda
  end if;
  if c in ('announcements', 'leaderboard', 'rooms') then return true; end if;
  if c = 'speakQuota' then return n = 2 and s[2] = uid; end if;
  if c in ('orders', 'payouts', 'purchaseRequests', 'ieltsResults') then return n = 2 and d ->> 'uid' = uid; end if;
  if c = 'referrals' then return n = 2 and (d ->> 'inviterUid' = uid or d ->> 'invitedUid' = uid); end if;
  return false;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- YOZISH QOIDALARI. op: create | update | delete. olddata — mavjud, newdata — natija.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.lv_changed(o jsonb, nw jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(k), '{}') from (
    select k from jsonb_object_keys(coalesce(o, '{}'::jsonb) || coalesce(nw, '{}'::jsonb)) k
    where (coalesce(o, '{}'::jsonb) -> k) is distinct from (coalesce(nw, '{}'::jsonb) -> k)
  ) x
$$;

create or replace function public.lv_can_write(op text, p text, o jsonb, nw jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  s text[] := string_to_array(p, '/'); n int := array_length(s, 1); uid text := app_uid(); c text := s[1];
  protected text[] := array['plan','planExpiry','role','balance','payoutTotal','referralEarnings','referralCount',
    'verified','banned','usage','subscription','payment','paymentStatus','paymentId','paymentMethod',
    'paymentHistory','payout','payoutStatus','courses','ieltsBand'];
  owner_sub text[] := array['onboarding','progress','vocabulary','flashcards','lessons','sessions','coachSessions',
    'writing','inventory','learner_profiles','ai_lessons','daily_plans','roadmaps','skill_history','lesson_counts','world'];
  ch text[];
begin
  if uid is null then return false; end if;
  if c in ('admins', 'voiceRoomSecrets', 'voiceRoomMembers', 'rate_limits', 'apiConfig', 'courseLessons',
           'courseAudio', 'videoFactory', 'speakQuota', 'ieltsResults', 'certificates') then
    return false;                                   -- faqat server
  end if;
  if lv_is_admin() then return true; end if;

  if c = 'users' then
    if s[2] <> uid then return false; end if;
    if n = 2 then
      if op = 'create' then
        return coalesce(nw ->> 'plan', '') = 'free'
          and coalesce((nw ->> 'coins')::numeric, 0) between 0 and 50
          and coalesce((nw ->> 'balance')::numeric, 0) = 0
          and coalesce((nw ->> 'xp')::numeric, 0) = 0
          and not (nw ? 'role')
          and coalesce(nw ->> 'uid', uid) = uid;
      elsif op = 'update' then
        ch := lv_changed(o, nw);
        return not (ch && protected);
      end if;
      return false;
    end if;
    if s[3] = 'usage' and n = 4 then
      return op <> 'delete' and nw ->> 'plan' = coalesce(lv_doc('users/' || uid) ->> 'plan', 'free');
    end if;
    if s[3] = any(owner_sub) then return true; end if;
    if s[3] in ('events', 'token_logs') then return op = 'create'; end if;
    return false;
  end if;

  if c = 'referrals' and n = 2 then
    return op = 'create' and s[2] = uid and nw ->> 'invitedUid' = uid
      and jsonb_typeof(nw -> 'inviterUid') = 'string' and nw ->> 'inviterUid' <> uid
      and (nw -> 'rewarded') = 'false'::jsonb;
  end if;

  if c = 'purchaseRequests' and n = 2 then
    return op = 'create' and nw ->> 'uid' = uid;
  end if;

  if c = 'rooms' then
    if n = 2 then
      if op = 'create' then return nw ->> 'hostUid' = uid; end if;
      return o ->> 'hostUid' = uid;
    end if;
    if n = 4 and s[3] = 'messages' then
      if op = 'create' then return nw ->> 'uid' = uid; end if;
      if op = 'delete' then return o ->> 'uid' = uid; end if;
      return false;
    end if;
    return false;
  end if;

  if c = 'voiceRooms' and n = 2 then
    if op = 'create' then
      return jsonb_typeof(nw -> 'name') = 'string' and length(nw ->> 'name') <= 60
        and nw ->> 'hostUid' = uid
        and jsonb_typeof(nw -> 'hostPeerId') = 'string' and length(nw ->> 'hostPeerId') <= 100
        and jsonb_typeof(nw -> 'hostName') = 'string' and length(nw ->> 'hostName') <= 40
        and jsonb_typeof(nw -> 'peers') = 'array' and jsonb_array_length(nw -> 'peers') = 1
        and nw -> 'peers' -> 0 ->> 'uid' = uid
        and not (nw ? 'password');
    elsif op = 'update' then
      ch := lv_changed(o, nw);
      return ch <@ array['topic', 'topicHint', 'topicHistory']
        and (o ->> 'hostUid' = uid or exists (select 1 from docs where path = 'voiceRoomMembers/' || s[2] || '_' || uid))
        and coalesce(length(nw ->> 'topic'), 0) <= 300
        and coalesce(length(nw ->> 'topicHint'), 0) <= 300
        and (not (nw ? 'topicHistory') or (jsonb_typeof(nw -> 'topicHistory') = 'array' and jsonb_array_length(nw -> 'topicHistory') <= 12));
    elsif op = 'delete' then
      return o ->> 'hostUid' = uid;
    end if;
  end if;

  return false;
end $$;

-- RLS: o'qish — qoidaga ko'ra; to'g'ridan-to'g'ri yozish — hech kimga
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to anon, authenticated
  using (public.lv_can_read(path, data));

-- ═══════════════════════════════════════════════════════════════════════════
-- YOZISH RPC — brauzer faqat shular orqali yozadi
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.lv_split(p text, out col text, out parent text)
language sql immutable as $$
  select (string_to_array(p, '/'))[array_length(string_to_array(p, '/'), 1) - 1],
         coalesce(array_to_string((string_to_array(p, '/'))[1:array_length(string_to_array(p, '/'), 1) - 2], '/'), '')
$$;

-- Bitta yozish. mode: set | merge | update | create | delete
create or replace function public.lv_write(p text, patch jsonb, mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur public.docs%rowtype; found_ boolean; nd jsonb; op text; sp record;
begin
  if p is null or array_length(string_to_array(p, '/'), 1) % 2 <> 0 or p ~ '(^/|/$|//)' then
    raise exception 'invalid-argument: noto''g''ri hujjat yo''li %', p using errcode = '22023';
  end if;
  select * into cur from public.docs where path = p for update;
  found_ := found;

  if mode = 'delete' then
    if not found_ then return null; end if;
    if not lv_can_write('delete', p, cur.data, null) then
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

  nd := lv_apply(case when found_ then cur.data else null end, patch, case when mode = 'create' then 'set' else mode end);
  op := case when found_ then 'update' else 'create' end;
  if not lv_can_write(op, p, case when found_ then cur.data else null end, nd) then
    raise exception 'permission-denied' using errcode = '42501';
  end if;

  sp := lv_split(p);
  insert into public.docs as d (path, col, parent, data)
    values (p, sp.col, sp.parent, nd)
  on conflict (path) do update set data = excluded.data, version = d.version + 1, updated_at = now();
  return nd;
end $$;

-- Tranzaksiya: o'qilgan hujjatlar o'zgarmagan bo'lsa barcha yozishlar birga.
-- reads: [{path, version}] (version 0 = yo'q edi), writes: [{path, data, mode}]
create or replace function public.lv_commit(reads jsonb, writes jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare r jsonb; w jsonb; v bigint;
begin
  for r in select * from jsonb_array_elements(coalesce(reads, '[]'::jsonb)) loop
    select version into v from public.docs where path = r ->> 'path' for update;
    if coalesce(v, 0) <> coalesce((r ->> 'version')::bigint, 0) then
      return false;                                 -- boshqa yozish bo'ldi — klient qayta uradi
    end if;
  end loop;
  for w in select * from jsonb_array_elements(coalesce(writes, '[]'::jsonb)) loop
    perform lv_write(w ->> 'path', coalesce(w -> 'data', '{}'::jsonb), w ->> 'mode');
  end loop;
  return true;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SO'ROVLAR: where / orderBy / limit (Firestore query bilan bir xil)
-- filters: [{f:"a.b", op:"==", v:...}], orders: [{f:"createdAt", dir:"desc"}]
-- parent=null bo'lsa — collectionGroup
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.lv_where_sql(filters jsonb) returns text
language plpgsql immutable as $$
declare f jsonb; sql text := ''; fp text; fa text; op text; v jsonb; x text;
begin
  for f in select * from jsonb_array_elements(coalesce(filters, '[]'::jsonb)) loop
    fa := '{' || replace(f ->> 'f', '.', ',') || '}';
    fp := format('public.lv_val(data #> %L::text[])', fa);
    op := f ->> 'op';
    v := public.lv_val(f -> 'v');
    x := case op
      when '==' then format('%s = %L::jsonb', fp, v)
      when '!=' then format('(%s is distinct from %L::jsonb and %s is not null)', fp, v, fp)
      when '<'  then format('%s < %L::jsonb', fp, v)
      when '<=' then format('%s <= %L::jsonb', fp, v)
      when '>'  then format('%s > %L::jsonb', fp, v)
      when '>=' then format('%s >= %L::jsonb', fp, v)
      when 'array-contains' then format('(data #> %L::text[]) @> %L::jsonb', fa, jsonb_build_array(f -> 'v'))
      when 'array-contains-any' then format('exists (select 1 from jsonb_array_elements(%L::jsonb) e where (data #> %L::text[]) @> jsonb_build_array(e))', f -> 'v', fa)
      when 'in' then format('%s in (select public.lv_val(e) from jsonb_array_elements(%L::jsonb) e)', fp, f -> 'v')
      when 'not-in' then format('%s not in (select public.lv_val(e) from jsonb_array_elements(%L::jsonb) e)', fp, f -> 'v')
      else null end;
    if x is null then raise exception 'invalid-argument: noma''lum operator %', op; end if;
    sql := sql || ' and ' || x;
  end loop;
  return sql;
end $$;

create or replace function public.lv_order_sql(orders jsonb) returns text
language plpgsql immutable as $$
declare o jsonb; parts text[] := '{}';
begin
  for o in select * from jsonb_array_elements(coalesce(orders, '[]'::jsonb)) loop
    parts := parts || format('public.lv_val(data #> %L::text[]) %s nulls last',
      '{' || replace(o ->> 'f', '.', ',') || '}', case when lower(o ->> 'dir') = 'desc' then 'desc' else 'asc' end);
  end loop;
  parts := parts || 'path asc'::text;
  return array_to_string(parts, ', ');
end $$;

create or replace function public.lv_query(c text, par text, filters jsonb, orders jsonb, lim int)
returns setof public.docs language plpgsql stable security invoker set search_path = public as $$
begin
  return query execute format(
    'select * from public.docs where col = %L %s %s order by %s limit %s',
    c,
    case when par is null then '' else format('and parent = %L', par) end,
    public.lv_where_sql(filters),
    public.lv_order_sql(orders),
    least(greatest(coalesce(lim, 1000), 1), 5000)
  );
end $$;

create or replace function public.lv_count(c text, par text, filters jsonb)
returns bigint language plpgsql stable security invoker set search_path = public as $$
declare n bigint;
begin
  execute format('select count(*) from public.docs where col = %L %s %s', c,
    case when par is null then '' else format('and parent = %L', par) end,
    public.lv_where_sql(filters)) into n;
  return n;
end $$;

-- Ruxsatlar: brauzer faqat RPC orqali yozadi; o'qish RLS bilan
revoke all on public.docs from anon, authenticated;
grant select on public.docs to anon, authenticated;
revoke all on function public.lv_write(text, jsonb, text) from public;
revoke all on function public.lv_commit(jsonb, jsonb) from public;
grant execute on function public.lv_write(text, jsonb, text) to authenticated;
grant execute on function public.lv_commit(jsonb, jsonb) to authenticated;
grant execute on function public.lv_query(text, text, jsonb, jsonb, int) to anon, authenticated;
grant execute on function public.lv_count(text, text, jsonb) to anon, authenticated;

-- Realtime (onSnapshot)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
