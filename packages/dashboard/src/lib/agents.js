import {
  Crosshair, Code2, Palette, FlaskConical, Briefcase, Rocket,
  BarChart2, Bot, Shield, Building2, TestTube2, FileText,
  Sparkles, BrainCircuit, Github, Zap, Cpu,
  TrendingUp, Search, Users, Scale, DollarSign,
  Pen, Presentation, PieChart, Globe, Layers,
  Microscope, LayoutTemplate, Wrench, Target,
} from 'lucide-react';

export const CLI_AGENTS = [
  { id: 'gemini',      name: 'Gemini',      icon: Sparkles,    color: '#4285F4', binary: 'gemini',   description: 'Google Gemini CLI',            freeModel: 'Gemini 2.0 Flash',    tier: 'free'     },
  { id: 'claude-code', name: 'Claude Code', icon: BrainCircuit,color: '#D97706', binary: 'claude',   description: 'Anthropic Claude CLI',         freeModel: null,                  tier: 'premium'  },
  { id: 'copilot',     name: 'Copilot',     icon: Github,      color: '#6E40C9', binary: 'gh',       description: 'GitHub Copilot CLI',           freeModel: 'gpt-5.1-codex-mini',  tier: 'freemium' },
  { id: 'kiro',        name: 'Kiro',        icon: Zap,         color: '#F59E0B', binary: 'kiro-cli', description: 'AWS Kiro AI agent',            freeModel: null,                  tier: 'premium'  },
  { id: 'ollama',      name: 'Ollama',      icon: Cpu,         color: '#888',    binary: 'ollama',   description: 'Local models (free, offline)', freeModel: 'any local model',     tier: 'free'     },
];

export const SPECIALISTS = [
  { id: 'auto',            name: 'Auto',          icon: Crosshair,     color: '#A855F7', desc: 'AI picks the best agent',          category: 'all'      },
  { id: 'dev',             name: 'Developer',     icon: Code2,         color: '#3B82F6', desc: 'Code, debug, APIs',                category: 'dev'      },
  { id: 'architect',       name: 'Architect',     icon: Building2,     color: '#F59E0B', desc: 'System design & architecture',     category: 'dev'      },
  { id: 'ai-engineer',     name: 'AI Engineer',   icon: Bot,           color: '#6366F1', desc: 'LLMs, RAG, agent pipelines',       category: 'dev'      },
  { id: 'devops',          name: 'DevOps',        icon: Rocket,        color: '#F97316', desc: 'Deploy, infra, CI/CD',             category: 'dev'      },
  { id: 'security',        name: 'Security',      icon: Shield,        color: '#EF4444', desc: 'Threat models, auth, CVEs',        category: 'dev'      },
  { id: 'mobile-dev',      name: 'Mobile Dev',    icon: Layers,        color: '#14B8A6', desc: 'React Native, Swift, Flutter',     category: 'dev'      },
  { id: 'qa',              name: 'QA',            icon: TestTube2,     color: '#84CC16', desc: 'Testing, coverage, e2e',           category: 'dev'      },
  { id: 'designer',        name: 'Designer',      icon: Palette,       color: '#8B5CF6', desc: 'UI/UX, brand, visual design',      category: 'design'   },
  { id: 'ux-designer',     name: 'UX',            icon: LayoutTemplate,color: '#EC4899', desc: 'User research, flows, wireframes', category: 'design'   },
  { id: 'brand-chef',      name: 'Brand',         icon: Pen,           color: '#F43F5E', desc: 'Brand identity & voice',           category: 'design'   },
  { id: 'ui-builder',      name: 'UI Builder',    icon: Layers,        color: '#7C3AED', desc: 'Components, design systems',       category: 'design'   },
  { id: 'researcher',      name: 'Researcher',    icon: FlaskConical,  color: '#06B6D4', desc: 'Market research, data, insights',  category: 'research' },
  { id: 'analyst',         name: 'Analyst',       icon: BarChart2,     color: '#3B82F6', desc: 'Data analysis, metrics',           category: 'research' },
  { id: 'datascientist',   name: 'Data Scientist',icon: PieChart,      color: '#10B981', desc: 'ML, stats, visualizations',        category: 'research' },
  { id: 'product-analyst', name: 'Product Analyst',icon: Microscope,   color: '#F59E0B', desc: 'Product metrics, funnels',         category: 'research' },
  { id: 'domain-scout',    name: 'Domain Scout',  icon: Globe,         color: '#6366F1', desc: 'Competitive landscape research',   category: 'research' },
  { id: 'strategist',      name: 'Strategist',    icon: Briefcase,     color: '#0EA5E9', desc: 'Business, GTM, roadmap',           category: 'strategy' },
  { id: 'pm',              name: 'Product Manager',icon: Target,       color: '#A855F7', desc: 'Specs, backlogs, roadmaps',        category: 'strategy' },
  { id: 'innovator',       name: 'Innovator',     icon: Sparkles,      color: '#F59E0B', desc: 'Ideas, brainstorming, pivots',     category: 'strategy' },
  { id: 'planner',         name: 'Planner',       icon: FileText,      color: '#64748B', desc: 'Sprint planning, milestones',      category: 'strategy' },
  { id: 'growth-hacker',   name: 'Growth',        icon: TrendingUp,    color: '#22C55E', desc: 'Growth loops, acquisition, SEO',  category: 'strategy' },
  { id: 'contentwriter',   name: 'Content Writer',icon: Pen,           color: '#F43F5E', desc: 'Blog, copy, social media',         category: 'content'  },
  { id: 'techwriter',      name: 'Tech Writer',   icon: FileText,      color: '#8B5CF6', desc: 'Docs, READMEs, changelogs',        category: 'content'  },
  { id: 'presenter',       name: 'Presenter',     icon: Presentation,  color: '#0EA5E9', desc: 'Decks, pitches, demos',            category: 'content'  },
  { id: 'storyteller',     name: 'Storyteller',   icon: Pen,           color: '#EC4899', desc: 'Narrative, brand story',           category: 'content'  },
  { id: 'finance',         name: 'Finance',       icon: DollarSign,    color: '#10B981', desc: 'Unit economics, modeling, P&L',    category: 'business' },
  { id: 'legal',           name: 'Legal',         icon: Scale,         color: '#64748B', desc: 'Contracts, compliance, ToS',       category: 'business' },
  { id: 'cost-optimizer',  name: 'Cost Optimizer',icon: TrendingUp,    color: '#F97316', desc: 'Reduce cloud + AI spend',          category: 'business' },
  { id: 'orchestrator',    name: 'Orchestrator',  icon: Wrench,        color: '#8B5CF6', desc: 'Multi-agent workflows',            category: 'all'      },
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
  'claude-code': { cmd: 'npm install -g @anthropic-ai/claude-code', note: 'Requires Anthropic API key', url: 'https://github.com/anthropics/claude-code' },
  'copilot':     { cmd: 'npm install -g @github/copilot', note: 'Requires GitHub Copilot subscription', url: 'https://github.com/github/copilot-cli' },
  'kiro':        { cmd: 'brew install --cask kiro-cli', note: 'macOS/Linux — or: curl -fsSL https://cli.kiro.dev/install | bash', url: 'https://kiro.dev/cli/' },
  'ollama':      { cmd: 'curl -fsSL https://ollama.com/install.sh | sh', note: 'Free, runs locally. macOS: brew install ollama', url: 'https://ollama.com' },
};
