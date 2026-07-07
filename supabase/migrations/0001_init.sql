-- v2 §12.2 — countries table (server is source of truth)
create table if not exists countries (
  code       text primary key,
  name       text not null,
  flag       text not null,
  win_count  bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Reads are public; there are NO write policies — all writes go through the
-- submit-win edge function using the service role key (bypasses RLS).
alter table countries enable row level security;

create policy "public read" on countries
  for select using (true);

-- v2 §12.2 — atomic increment + rank, called by the submit-win edge function.
-- Returns empty set for an unknown code (server validates against known list).
create or replace function submit_win(p_code text)
returns table (win_count bigint, rank bigint)
language plpgsql
as $$
declare
  new_count bigint;
begin
  update countries c
     set win_count  = c.win_count + 1,
         updated_at = now()
   where c.code = p_code
   returning c.win_count into new_count;

  if new_count is null then
    return;
  end if;

  return query
    select new_count,
           (select count(*) + 1 from countries c2
             where c2.win_count > new_count)::bigint;
end;
$$;

-- v2 §11 — seed all 24 countries at 0
insert into countries (code, name, flag) values
  ('BR', 'Brazil',       '🇧🇷'),
  ('AR', 'Argentina',    '🇦🇷'),
  ('FR', 'France',       '🇫🇷'),
  ('ES', 'Spain',        '🇪🇸'),
  ('DE', 'Germany',      '🇩🇪'),
  ('PT', 'Portugal',     '🇵🇹'),
  ('GB', 'England',      '🇬🇧'),
  ('IN', 'India',        '🇮🇳'),
  ('JP', 'Japan',        '🇯🇵'),
  ('KR', 'South Korea',  '🇰🇷'),
  ('MX', 'Mexico',       '🇲🇽'),
  ('NG', 'Nigeria',      '🇳🇬'),
  ('IT', 'Italy',        '🇮🇹'),
  ('NL', 'Netherlands',  '🇳🇱'),
  ('MA', 'Morocco',      '🇲🇦'),
  ('US', 'USA',          '🇺🇸'),
  ('BE', 'Belgium',      '🇧🇪'),
  ('HR', 'Croatia',      '🇭🇷'),
  ('SA', 'Saudi Arabia', '🇸🇦'),
  ('AU', 'Australia',    '🇦🇺'),
  ('SN', 'Senegal',      '🇸🇳'),
  ('UY', 'Uruguay',      '🇺🇾'),
  ('CO', 'Colombia',     '🇨🇴'),
  ('CH', 'Switzerland',  '🇨🇭')
on conflict (code) do nothing;
