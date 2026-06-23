-- Migration: multi-company clock-in support
-- Run this in your Supabase SQL Editor on your EXISTING project.
-- Safe to run once; uses "if not exists" so it won't duplicate anything.

-- 1. New join table: which companies an employee can clock in for.
--    Zero or one row = no company prompt at clock-in (works as before).
--    Two or more rows = employee picks a company each time they clock in.
create table if not exists employee_companies (
  employee_id uuid not null references employees(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  primary key (employee_id, company_id)
);

create index if not exists idx_employee_companies_employee on employee_companies(employee_id);

alter table employee_companies enable row level security;

-- 2. New column on time_entries: which company THIS shift was for.
--    Recorded at clock-in time, separate from the employee's profile, so
--    historical shifts stay accurate even if assignments change later.
alter table time_entries add column if not exists company_id uuid references companies(id) on delete set null;

-- 3. Backfill: for any employee who already has a single company set on
--    their profile (employees.company_id), carry that into the new
--    employee_companies table, and tag their past shifts with it too.
--    This keeps existing single-company employees working exactly as
--    before, with no action needed from you.
insert into employee_companies (employee_id, company_id)
select id, company_id from employees
where company_id is not null
on conflict do nothing;

update time_entries te
set company_id = e.company_id
from employees e
where te.employee_id = e.id
  and te.company_id is null
  and e.company_id is not null;
