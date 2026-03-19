-- Feedback table
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid,
  user_email text,
  user_name text,
  message text not null,
  attachment_url text,
  attachment_name text,
  created_at timestamptz default now()
);

-- RLS
alter table feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can insert feedback"
  on feedback for insert
  to authenticated
  with check (auth.uid() = user_id);
