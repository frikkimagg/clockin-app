export type Employee = {
  id: string;
  name: string;
  company_id: string | null;
  is_admin: boolean;
  active: boolean;
  companies?: string[]; // company ids this employee can clock in for
};

export type Company = {
  id: string;
  name: string;
};

export type TimeEntry = {
  id: string;
  employee_id: string;
  company_id: string | null;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
};
