alter table public.clients
  add column if not exists contract_number text,
  add column if not exists contract_amount numeric(18,2),
  add column if not exists contract_amount_unit text not null default 'toman'
    check (contract_amount_unit in ('toman', 'rial'));
