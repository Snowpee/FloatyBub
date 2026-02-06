-- Create agent_skills table
create table if not exists agent_skills (
  id uuid primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  description text,
  content text not null,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add indexes
create index if not exists agent_skills_user_id_idx on agent_skills(user_id);

-- Enable RLS
alter table agent_skills enable row level security;

-- Policies
create policy "Users can view their own skills" on agent_skills
  for select using (auth.uid() = user_id);

create policy "Users can insert their own skills" on agent_skills
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own skills" on agent_skills
  for update using (auth.uid() = user_id);

create policy "Users can delete their own skills" on agent_skills
  for delete using (auth.uid() = user_id);

-- Update ai_roles table
alter table ai_roles add column if not exists skill_ids text[];
