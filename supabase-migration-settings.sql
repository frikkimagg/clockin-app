-- Migration: app settings table, for admin-configurable options like the
-- clock-in IP restriction. Run this once in your Supabase SQL Editor.

create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Seed the one setting this app currently uses. Leaving the value blank/null
-- means "no restriction -- clock-in works from anywhere", which matches the
-- app's behavior before this setting existed.
insert into app_settings (key, value)
values ('allowed_clock_in_ip', null)
on conflict (key) do nothing;
