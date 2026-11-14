create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  name varchar(120) not null,
  attendance text not null check (attendance in ('yes', 'no')),
  song varchar(200) not null default '',
  drinks text[] not null default '{}',
  ip_hash char(64) not null,
  submitted_at timestamptz not null default now(),
  constraint valid_drinks check (
    drinks <@ array[
      'no_preference',
      'sparkling',
      'white_wine',
      'red_wine',
      'spirits',
      'non_alcoholic'
    ]::text[]
  )
);

create index if not exists rsvps_ip_hash_submitted_at_idx
  on public.rsvps (ip_hash, submitted_at desc);

alter table public.rsvps enable row level security;

comment on table public.rsvps is 'Ответы гостей на свадебное приглашение';
