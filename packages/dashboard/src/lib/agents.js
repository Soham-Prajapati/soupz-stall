import {
  Crosshair, Code2, Palette, FlaskConical, Briefcase, Rocket,
  BarChart2, Bot, Shield, Building2, TestTube2, FileText,
  Sparkles, BrainCircuit, Github, Zap, Cpu,
  TrendingUp, Search, Users, Scale, DollarSign,
  Pen, Presentation, PieChart, Globe, Layers,
  Microscope, LayoutTemplate, Wrench, Target,
} from 'lucide-react';

export const CLI_AGENTS = [
  { 
    id: 'gemini',      
    name: 'Gemini',      
    icon: Sparkles,    
    color: '#4285F4', 
    binary: 'gemini',   
    description: 'Google Gemini CLI',            
    freeModel: 'Gemini 2.0 Flash',    
    tier: 'free',
    usagePolicy: 'free-tier-quota',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', usage: 40 },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', usage: 9 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', usage: 83 },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', usage: 40 },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', usage: 9 },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', usage: 83 },
    ]
  },
  {
    id: 'codex',
    name: 'Codex',
    icon: Code2,
    color: '#10B981',
    binary: 'gh',
    description: 'Dedicated Codex reasoning lane (separate from Copilot workflow lane)',
    freeModel: 'gpt-5.1-codex-mini',
    tier: 'freemium',
    usagePolicy: 'plan-quota',
    models: [
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
      { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex' },
      { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini' },
    ]
  },
  { 
    id: 'copilot',     
    name: 'Copilot',     
    icon: Github,      
    color: '#6E40C9', 
    binary: 'gh',       
    description: 'GitHub workflow lane (PRs, issues, shell and repo actions)',           
    freeModel: 'gpt-5.1-codex-mini',  
    tier: 'freemium',
    usagePolicy: 'plan-quota',
    models: [
      { id: 'copilot-chat', name: 'Copilot Chat' },
      { id: 'copilot-suggest', name: 'Copilot Suggest' },
    ]
  },
  { 
    id: 'ollama',      
    name: 'Ollama',      
    icon: Cpu,         
    color: '#888',    
    binary: 'ollama',   
    description: 'Local models (free, offline, no hosted usage limits)', 
    freeModel: 'any local model',     
    tier: 'free',
    usagePolicy: 'local-unlimited',
    models: [
      { id: 'qwen2.5:0.5b', name: 'Qwen 2.5 0.5B' },
      { id: 'llama3:8b', name: 'Llama 3 8B' },
      { id: 'mistral', name: 'Mistral' },
    ]
  },
  { id: 'claude-code', name: 'Claude Code', icon: BrainCircuit,color: '#D97706', binary: 'claude',   description: 'Anthropic Claude CLI',         freeModel: null,                  tier: 'premium'  },
  { id: 'kiro',        name: 'Kiro',        icon: Zap,         color: '#F59E0B', binary: 'kiro-cli', description: 'AWS Kiro AI agent',            freeModel: null,                  tier: 'premium'  },
];

export const SPECIALISTS = [
  { id: 'auto',            name: 'Auto',          icon: Crosshair,     color: '#A855F7', desc: 'AI picks the best agent',          category: 'all',      temperature: 0.7, maxTokens: 4096 },
  { id: 'dev',             name: 'Developer',     icon: Code2,         color: '#3B82F6', desc: 'Code, debug, APIs',                category: 'dev',      temperature: 0.3, maxTokens: 8192 },
  { id: 'architect',       name: 'Architect',     icon: Building2,     color: '#F59E0B', desc: 'System design & architecture',     category: 'dev',      temperature: 0.4, maxTokens: 8192 },
  { id: 'ai-engineer',     name: 'AI Engineer',   icon: Bot,           color: '#6366F1', desc: 'LLMs, RAG, agent pipelines',       category: 'dev',      temperature: 0.3, maxTokens: 8192 },
  { id: 'devops',          name: 'DevOps',        icon: Rocket,        color: '#F97316', desc: 'Deploy, infra, CI/CD',             category: 'dev',      temperature: 0.3, maxTokens: 8192 },
  { id: 'security',        name: 'Security',      icon: Shield,        color: '#EF4444', desc: 'Threat models, auth, CVEs',        category: 'dev',      temperature: 0.3, maxTokens: 8192 },
  { id: 'mobile-dev',      name: 'Mobile Dev',    icon: Layers,        color: '#14B8A6', desc: 'React Native, Swift, Flutter',     category: 'dev',      temperature: 0.3, maxTokens: 8192 },
  { id: 'qa',              name: 'QA',            icon: TestTube2,     color: '#84CC16', desc: 'Testing, coverage, e2e',           category: 'dev',      temperature: 0.3, maxTokens: 8192 },
  { id: 'designer',        name: 'Designer',      icon: Palette,       color: '#8B5CF6', desc: 'UI/UX, brand, visual design',      category: 'design',   temperature: 0.7, maxTokens: 4096 },
  { id: 'ux-designer',     name: 'UX',            icon: LayoutTemplate,color: '#EC4899', desc: 'User research, flows, wireframes', category: 'design',   temperature: 0.7, maxTokens: 4096 },
  { id: 'design-thinking-coach', name: 'Nidhi (Design)', icon: BrainCircuit, color: '#EC4899', desc: 'Human-centered design expert', category: 'design',   temperature: 0.7, maxTokens: 4096 },
  { id: 'brand-chef',      name: 'Brand',         icon: Pen,           color: '#F43F5E', desc: 'Brand identity & voice',           category: 'design',   temperature: 0.7, maxTokens: 4096 },
  { id: 'ui-builder',      name: 'UI Builder',    icon: Layers,        color: '#7C3AED', desc: 'Components, design systems',       category: 'design',   temperature: 0.7, maxTokens: 4096 },
  { id: 'svgart',          name: 'SVG Artist',    icon: Palette,       color: '#8B5CF6', desc: 'SVG & CSS art generator',          category: 'design',   temperature: 0.8, maxTokens: 4096 },
  { id: 'researcher',      name: 'Researcher',    icon: FlaskConical,  color: '#06B6D4', desc: 'Market research, data, insights',  category: 'research', temperature: 0.5, maxTokens: 6144 },
  { id: 'analyst',         name: 'Analyst',       icon: BarChart2,     color: '#3B82F6', desc: 'Data analysis, metrics',           category: 'research', temperature: 0.3, maxTokens: 6144 },
  { id: 'datascientist',   name: 'Data Scientist',icon: PieChart,      color: '#10B981', desc: 'ML, stats, visualizations',        category: 'research', temperature: 0.3, maxTokens: 6144 },
  { id: 'product-analyst', name: 'Product Analyst',icon: Microscope,   color: '#F59E0B', desc: 'Product metrics, funnels',         category: 'research', temperature: 0.5, maxTokens: 6144 },
  { id: 'domain-scout',    name: 'Domain Scout',  icon: Globe,         color: '#6366F1', desc: 'Competitive landscape research',   category: 'research', temperature: 0.5, maxTokens: 6144 },
  { id: 'review-miner',    name: 'Review Miner',  icon: Search,        color: '#3B82F6', desc: 'Extract pain points from reviews', category: 'research', temperature: 0.4, maxTokens: 6144 },
  { id: 'strategist',      name: 'Strategist',    icon: Briefcase,     color: '#0EA5E9', desc: 'Business, GTM, roadmap',           category: 'strategy', temperature: 0.6, maxTokens: 6144 },
  { id: 'pm',              name: 'Product Manager',icon: Target,       color: '#A855F7', desc: 'Specs, backlogs, roadmaps',        category: 'strategy', temperature: 0.5, maxTokens: 6144 },
  { id: 'innovator',       name: 'Innovator',     icon: Sparkles,      color: '#F59E0B', desc: 'Ideas, brainstorming, pivots',     category: 'strategy', temperature: 0.9, maxTokens: 4096 },
  { id: 'brainstorm',      name: 'Brainstormer',  icon: Zap,           color: '#F59E0B', desc: 'Ideation facilitator',            category: 'strategy', temperature: 0.9, maxTokens: 4096 },
  { id: 'planner',         name: 'Planner',       icon: FileText,      color: '#64748B', desc: 'Sprint planning, milestones',      category: 'strategy', temperature: 0.4, maxTokens: 6144 },
  { id: 'scrum',           name: 'Scrum Master',  icon: Users,         color: '#64748B', desc: 'Certified Scrum Master',           category: 'strategy', temperature: 0.5, maxTokens: 6144 },
  { id: 'growth-hacker',   name: 'Growth',        icon: TrendingUp,    color: '#22C55E', desc: 'Growth loops, acquisition, SEO',  category: 'strategy', temperature: 0.7, maxTokens: 6144 },
  { id: 'contentwriter',   name: 'Content Writer',icon: Pen,           color: '#F43F5E', desc: 'Blog, copy, social media',         category: 'content',  temperature: 0.8, maxTokens: 4096 },
  { id: 'techwriter',      name: 'Tech Writer',   icon: FileText,      color: '#8B5CF6', desc: 'Docs, READMEs, changelogs',        category: 'content',  temperature: 0.4, maxTokens: 6144 },
  { id: 'presenter',       name: 'Presenter',     icon: Presentation,  color: '#0EA5E9', desc: 'Decks, pitches, demos',            category: 'content',  temperature: 0.7, maxTokens: 4096 },
  { id: 'storyteller',     name: 'Storyteller',   icon: Pen,           color: '#EC4899', desc: 'Narrative, brand story',           category: 'content',  temperature: 0.8, maxTokens: 4096 },
  { id: 'teacher',         name: 'Teacher',       icon: Microscope,    color: '#10B981', desc: 'Patient expert educator',          category: 'content',  temperature: 0.6, maxTokens: 6144 },
  { id: 'finance',         name: 'Finance',       icon: DollarSign,    color: '#10B981', desc: 'Unit economics, modeling, P&L',    category: 'business', temperature: 0.2, maxTokens: 6144 },
  { id: 'legal',           name: 'Legal',         icon: Scale,         color: '#64748B', desc: 'Contracts, compliance, ToS',       category: 'business', temperature: 0.2, maxTokens: 6144 },
  { id: 'cost-optimizer',  name: 'Cost Optimizer',icon: TrendingUp,    color: '#F97316', desc: 'Reduce cloud + AI spend',          category: 'business', temperature: 0.3, maxTokens: 6144 },
  { id: 'master',          name: 'Team Lead',     icon: Target,        color: '#F59E0B', desc: 'Master orchestrator',              category: 'all',      temperature: 0.5, maxTokens: 8192 },
  { id: 'orchestrator',    name: 'Orchestrator',  icon: Wrench,        color: '#8B5CF6', desc: 'Multi-agent workflows',            category: 'all',      temperature: 0.5, maxTokens: 8192 },
  { id: 'agent-builder',   name: 'Agent Builder', icon: Wrench,        color: '#6366F1', desc: 'Agent architecture specialist',    category: 'all',      temperature: 0.3, maxTokens: 8192 },
  { id: 'module-builder',  name: 'Module Builder',icon: Layers,        color: '#3B82F6', desc: 'Module architecture specialist',   category: 'all',      temperature: 0.3, maxTokens: 8192 },
  { id: 'workflow-builder',name: 'Workflow Builder',icon: TrendingUp,  color: '#22C55E', desc: 'Workflow design expert',           category: 'all',      temperature: 0.5, maxTokens: 8192 },
  { id: 'quick-flow',      name: 'Quick Flow',    icon: Zap,           color: '#F59E0B', desc: 'Rapid lean implementation',        category: 'all',      temperature: 0.6, maxTokens: 4096 },
  { id: 'admin',           name: 'Admin',         icon: Shield,        color: '#EF4444', desc: 'System management & analytics',    category: 'all',      temperature: 0.2, maxTokens: 8192 },
];

export const SPECIALIST_CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'dev',      label: 'Dev' },
  { id: 'design',   label: 'Design' },
  { id: 'research', label: 'Research' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'content',  label: 'Content' },
  { id: 'business', label: 'Business' },
];

export const BUILD_MODES = [
  { id: 'quick',   label: 'Quick Build',   desc: 'Straight to code' },
  { id: 'planned', label: 'Planned Build', desc: 'Plan first, then code' },
  { id: 'chat',    label: 'Chat',          desc: 'Ask questions, brainstorm' },
];

export function getAgentById(id) {
  return CLI_AGENTS.find(a => a.id === id) || SPECIALISTS.find(a => a.id === id) || null;
}

// Agent capability descriptions for the UI
export const AGENT_INSTALL_GUIDES = {
  'gemini':      { cmd: 'npm install -g @google/gemini-cli', note: 'Free tier: 60 req/min, 1k req/day with Google account', url: 'https://github.com/google-gemini/gemini-cli' },
  'codex':       { cmd: 'gh extension install github/gh-copilot', note: 'Codex is routed as a separate lane from Copilot; run gh auth login first and ensure a Codex-capable model is available.', url: 'https://github.com/github/gh-copilot' },
  'claude-code': { cmd: 'npm install -g @anthropic-ai/claude-code', note: 'Requires Anthropic API key', url: 'https://github.com/anthropics/claude-code' },
  'copilot':     { cmd: 'npm install -g @github/copilot', note: 'Separate workflow lane from Codex; requires GitHub Copilot subscription', url: 'https://github.com/github/copilot-cli' },
  'kiro':        { cmd: 'brew install --cask kiro-cli', note: 'macOS/Linux - or: curl -fsSL https://cli.kiro.dev/install | bash', url: 'https://kiro.dev/cli/' },
  'ollama':      { cmd: 'curl -fsSL https://ollama.com/install.sh | sh', note: 'Free local runtime with no hosted usage caps. macOS: brew install ollama', url: 'https://ollama.com' },
};
