-- ─── EXTENSIONS ARCHITECTURE ──────────────────────────────────────────────────
create table if not exists public.soupz_extensions (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    description text,
    author      text default 'Soupz Team',
    version     text default '1.0.0',
    category    text default 'agents',
    icon_name   text default 'Package',
    color       text default '#8B5CF6',
    stars       numeric default 4.5,
    installs    text default '0',
    tags        text[] default '{}',
    agents      jsonb default '[]',
    created_at  timestamptz default now()
);

-- Enable RLS
alter table public.soupz_extensions enable row level security;
create policy "extensions: public read" on public.soupz_extensions for select using (true);

-- Insert Initial Seed Data
insert into public.soupz_extensions (name, description, category, icon_name, color, stars, installs, tags, agents)
values 
('Full-Stack Mastery', 'Complete toolkit for React, Node.js, and DB design.', 'agents', 'Code2', '#3B82F6', 4.9, '12k', ARRAY['react', 'node'], '[{"name": "Frontend Dev", "description": "Expert in UI/UX and CSS"}, {"name": "Backend Dev", "description": "Expert in APIs and DBs"}]'::jsonb),
('AI & RAG Engine', 'Build intelligent retrieval systems and LLM pipelines.', 'agents', 'Bot', '#6366F1', 4.8, '8.3k', ARRAY['ai', 'rag'], '[{"name": "RAG Builder", "description": "Vector DB specialist"}]'::jsonb),
('Security Hardening', 'Audit your code for OWASP vulnerabilities and leaks.', 'tools', 'Shield', '#EF4444', 4.7, '5.1k', ARRAY['security', 'audit'], '[{"name": "Sec-Auditor", "description": "Code vulnerability scanner"}]'::jsonb);
