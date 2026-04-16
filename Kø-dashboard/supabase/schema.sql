create extension if not exists pgcrypto;

create table if not exists public.route_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  route_name text not null default 'kokstad_odfjell_to_kokstadvegen',
  origin_label text not null,
  destination_label text not null,
  distance_m integer not null,
  duration_sec integer not null,
  static_duration_sec integer not null,
  delay_sec integer not null,
  queue_length_m integer not null,
  traffic_severity text not null,
  speed_intervals jsonb not null default '[]'::jsonb,
  route_polyline text,
  raw_response jsonb not null
);

create index if not exists route_snapshots_captured_at_idx
  on public.route_snapshots (captured_at desc);

create or replace view public.latest_route_snapshot as
select *
from public.route_snapshots
order by captured_at desc
limit 1;

create or replace view public.queue_status as
select
  id,
  captured_at,
  origin_label,
  destination_label,
  distance_m,
  duration_sec,
  static_duration_sec,
  delay_sec,
  queue_length_m,
  traffic_severity,
  speed_intervals,
  route_polyline,
  case
    when delay_sec >= 300 or queue_length_m >= 300 then true
    else false
  end as is_queueing
from public.route_snapshots;

create or replace view public.queue_episodes as
with tagged as (
  select
    *,
    lag(captured_at) over (order by captured_at) as prev_captured_at,
    lag(is_queueing) over (order by captured_at) as prev_is_queueing
  from public.queue_status
),
starts as (
  select
    *,
    case
      when is_queueing = true
        and (
          prev_is_queueing is distinct from true
          or prev_captured_at is null
          or captured_at - prev_captured_at > interval '10 minutes'
        )
      then 1
      else 0
    end as is_new_episode
  from tagged
),
grouped as (
  select
    *,
    sum(is_new_episode) over (order by captured_at) as episode_id
  from starts
  where is_queueing = true
)
select
  min(captured_at)::date as queue_date,
  episode_id,
  min(captured_at) as started_at,
  max(captured_at) as last_seen_at,
  extract(epoch from max(captured_at) - min(captured_at)) / 60 as duration_minutes,
  max(delay_sec) as max_delay_sec,
  avg(delay_sec)::numeric(10, 1) as avg_delay_sec,
  max(queue_length_m) as max_queue_length_m
from grouped
group by episode_id
order by started_at desc;

create or replace view public.dashboard_summary as
with latest as (
  select * from public.latest_route_snapshot
),
today_episodes as (
  select *
  from public.queue_episodes
  where queue_date = current_date
),
weekday_profile as (
  select
    extract(isodow from captured_at)::int as weekday_iso,
    to_char(date_trunc('hour', captured_at), 'HH24:MI') as hour_bucket,
    avg(delay_sec) as avg_delay_sec
  from public.route_snapshots
  where captured_at >= now() - interval '28 days'
  group by 1, 2
)
select
  latest.captured_at,
  latest.delay_sec,
  latest.duration_sec,
  latest.static_duration_sec,
  latest.queue_length_m,
  latest.distance_m,
  latest.traffic_severity,
  latest.speed_intervals,
  (
    select min(started_at)
    from today_episodes
  ) as today_queue_started_at,
  (
    select max(last_seen_at)
    from today_episodes
  ) as today_queue_last_seen_at,
  (
    select coalesce(sum(duration_minutes), 0)
    from today_episodes
  ) as today_total_queue_minutes,
  (
    select coalesce(max(max_delay_sec), 0)
    from today_episodes
  ) as today_peak_delay_sec,
  (
    select jsonb_agg(
      jsonb_build_object(
        'weekdayIso', weekday_iso,
        'time', hour_bucket,
        'avgDelaySec', round(avg_delay_sec)
      )
      order by hour_bucket, weekday_iso
    )
    from weekday_profile
  ) as weekday_profile
from latest;
