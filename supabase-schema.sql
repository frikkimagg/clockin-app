-- Clock-In App Schema
-- Run this in your Supabase project's SQL editor

-- Companies (so hours roll up correctly across your entities)
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Employees, identified by a PIN (hashed, never stored in plain text)
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  company_id uuid references companies(id) on delete set null,
  is_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Which companies an employee is allowed to clock in for. An employee with
-- zero or one row here just clocks in normally (no company prompt). An
-- employee with two or more rows is asked to pick which company at clock-in.
create table if not exists employee_companies (
  employee_id uuid not null references employees(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  primary key (employee_id, company_id)
);

-- One row per clock-in, closed out by clock_out. company_id records which
-- company THIS SPECIFIC SHIFT was worked for -- set at clock-in time, not
-- inferred from the employee's profile, so historical shifts stay accurate
-- even if an employee's company assignments change later.
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_entries_employee on time_entries(employee_id);
create index if not exists idx_time_entries_open on time_entries(employee_id) where clock_out is null;
create index if not exists idx_employee_companies_employee on employee_companies(employee_id);

-- App-wide settings the admin dashboard can edit, e.g. the office IP used
-- to restrict staff clock-in. A blank/null value means no restriction.
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table companies enable row level security;
alter table employees enable row level security;
alter table employee_companies enable row level security;
alter table time_entries enable row level security;
alter table app_settings enable row level security;

-- This app authenticates via PIN through a server-side API route (using the
-- Supabase service role key), not through Supabase Auth sessions. So we lock
-- the anon key out entirely and only allow the service role (server-side) to
-- read/write. No public/anon policies are created on purpose.

-- Seed a couple of companies to start (edit/add as needed)
insert into companies (name) values
  ('Greenland Craftworks ApS'),
  ('Hotel Narsaq ApS')
on conflict do nothing;

-- Seed the clock-in IP restriction setting, left blank (no restriction)
insert into app_settings (key, value) values ('allowed_clock_in_ip', null)
on conflict (key) do nothing;
