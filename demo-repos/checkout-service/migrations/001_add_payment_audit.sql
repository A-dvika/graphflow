create table if not exists payment_audit_events (
  id text primary key,
  checkout_id text not null,
  risk_score integer not null,
  decision text not null,
  created_at timestamp not null default current_timestamp
);
