-- Add files column to agent_skills table
alter table agent_skills add column if not exists files jsonb default '[]'::jsonb;
