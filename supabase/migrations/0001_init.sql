-- v2 §12.2 — teams table: countries AND clubs, server is source of truth.
-- `kind` partitions the two leaderboards — a club's rank is computed only
-- among other clubs, a country's only among other countries (see submit_win
-- and the scoreboard edge function's ?kind= param).
create table if not exists teams (
  code       text primary key,
  kind       text not null check (kind in ('country', 'club')),
  name       text not null,
  flag       text,                              -- emoji flag; null for clubs
  win_count  bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Reads are public; there are NO write policies — all writes go through the
-- submit-win edge function using the service role key (bypasses RLS).
alter table teams enable row level security;

create policy "public read" on teams
  for select using (true);

-- v2 §12.2 — atomic increment + rank (scoped to the team's own kind), called
-- by the submit-win edge function. Returns empty set for an unknown code
-- (server validates against known codes further up, in the edge function).
create or replace function submit_win(p_code text)
returns table (win_count bigint, rank bigint)
language plpgsql
as $$
declare
  new_count bigint;
  team_kind text;
begin
  update teams t
     set win_count  = t.win_count + 1,
         updated_at = now()
   where t.code = p_code
   returning t.win_count, t.kind into new_count, team_kind;

  if new_count is null then
    return;
  end if;

  return query
    select new_count,
           (select count(*) + 1 from teams t2
             where t2.kind = team_kind
               and t2.win_count > new_count)::bigint;
end;
$$;

-- v2 §11 — seed all 24 countries + 16 clubs at 0
insert into teams (code, kind, name, flag) values
  ('BR', 'country', 'Brazil',       '🇧🇷'),
  ('AR', 'country', 'Argentina',    '🇦🇷'),
  ('FR', 'country', 'France',       '🇫🇷'),
  ('ES', 'country', 'Spain',        '🇪🇸'),
  ('DE', 'country', 'Germany',      '🇩🇪'),
  ('PT', 'country', 'Portugal',     '🇵🇹'),
  ('GB', 'country', 'England',      '🇬🇧'),
  ('IN', 'country', 'India',        '🇮🇳'),
  ('JP', 'country', 'Japan',        '🇯🇵'),
  ('KR', 'country', 'South Korea',  '🇰🇷'),
  ('MX', 'country', 'Mexico',       '🇲🇽'),
  ('NG', 'country', 'Nigeria',      '🇳🇬'),
  ('IT', 'country', 'Italy',        '🇮🇹'),
  ('NL', 'country', 'Netherlands',  '🇳🇱'),
  ('MA', 'country', 'Morocco',      '🇲🇦'),
  ('US', 'country', 'USA',          '🇺🇸'),
  ('BE', 'country', 'Belgium',      '🇧🇪'),
  ('HR', 'country', 'Croatia',      '🇭🇷'),
  ('SA', 'country', 'Saudi Arabia', '🇸🇦'),
  ('AU', 'country', 'Australia',    '🇦🇺'),
  ('SN', 'country', 'Senegal',      '🇸🇳'),
  ('UY', 'country', 'Uruguay',      '🇺🇾'),
  ('CO', 'country', 'Colombia',     '🇨🇴'),
  ('CH', 'country', 'Switzerland',  '🇨🇭'),
  ('BAR', 'club', 'Barcelona',      null),
  ('RMA', 'club', 'Real Madrid',    null),
  ('MUN', 'club', 'Man United',     null),
  ('LIV', 'club', 'Liverpool',      null),
  ('BAY', 'club', 'Bayern Munich',  null),
  ('JUV', 'club', 'Juventus',       null),
  ('MIL', 'club', 'AC Milan',       null),
  ('INT', 'club', 'Inter Milan',    null),
  ('CHE', 'club', 'Chelsea',        null),
  ('ARS', 'club', 'Arsenal',        null),
  ('PSG', 'club', 'PSG',            null),
  ('MCI', 'club', 'Man City',       null),
  ('DOR', 'club', 'Dortmund',       null),
  ('ATM', 'club', 'Atlético',       null),
  ('TOT', 'club', 'Tottenham',      null),
  ('AJA', 'club', 'Ajax',           null)
on conflict (code) do nothing;
