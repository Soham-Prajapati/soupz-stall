/**
 * Global Skills Manifest
 * Similar to <available_skills> in Copilot CLI — agents registered as discoverable skills.
 * Skills are globally available once soupz-agents is installed.
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SKILLS_DIR = join(homedir(), '.soupz-agents');
const SKILLS_FILE = join(SKILLS_DIR, 'skills.json');

/** Built-in skill definitions (from persona agents) */
const BUILTIN_SKILLS = [
    {
        name: 'designer',
        icon: '🎨',
        description: 'World-class design agency AI — award-worthy HTML/CSS prototypes, brand identity, SVG assets, design systems',
        location: 'global',
        category: 'design',
        invoke: '@designer',
        capabilities: ['brand-identity', 'html-prototype', 'svg-assets', 'design-system', 'competitive-research'],
    },
    {
        name: 'svgart',
        icon: '🖼️',
        description: 'SVG & CSS art generator — creates ready-to-import SVG logos, icons, illustrations, and UI assets',
        location: 'global',
        category: 'design',
        invoke: '@svgart',
        capabilities: ['svg-logos', 'svg-icons', 'css-art', 'illustrations', 'animated-svg'],
    },
    {
        name: 'orchestrator',
        icon: '🎯',
        description: 'BMAD-style master orchestrator — breaks down complex tasks, coordinates multi-agent workflows',
        location: 'global',
        category: 'orchestration',
        invoke: '@orchestrator',
        capabilities: ['task-breakdown', 'agent-coordination', 'multi-agent', 'delegation'],
    },
    {
        name: 'architect',
        icon: '🏗️',
        description: 'System architect — technical design, API design, database schemas, scalable architectures',
        location: 'global',
        category: 'engineering',
        invoke: '@architect',
        capabilities: ['system-design', 'api-design', 'database', 'microservices'],
    },
    {
        name: 'researcher',
        icon: '🔍',
        description: 'Deep research agent — market analysis, competitive intelligence, technical research',
        location: 'global',
        category: 'research',
        invoke: '@researcher',
        capabilities: ['market-research', 'competitive-analysis', 'technical-research'],
    },
    {
        name: 'planner',
        icon: '📋',
        description: 'Project planner — roadmaps, sprint planning, epic/story breakdown, timelines',
        location: 'global',
        category: 'planning',
        invoke: '@planner',
        capabilities: ['roadmap', 'sprint-planning', 'task-breakdown', 'milestones'],
    },
    {
        name: 'strategist',
        icon: '🧠',
        description: 'Business strategist — positioning, competitive advantage, go-to-market, investor narrative',
        location: 'global',
        category: 'strategy',
        invoke: '@strategist',
        capabilities: ['positioning', 'go-to-market', 'competitive-strategy', 'investor-pitch'],
    },
    {
        name: 'presenter',
        icon: '🎤',
        description: 'Pitch and presentation expert — hackathon pitches, demo scripts, investor decks',
        location: 'global',
        category: 'communication',
        invoke: '@presenter',
        capabilities: ['hackathon-pitch', 'investor-deck', 'demo-script', 'storytelling'],
    },
    {
        name: 'contentwriter',
        icon: '✍️',
        description: 'Content and copywriter — landing page copy, marketing content, brand voice',
        location: 'global',
        category: 'content',
        invoke: '@contentwriter',
        capabilities: ['copywriting', 'marketing-content', 'brand-voice', 'landing-page-copy'],
    },
    {
        name: 'techwriter',
        icon: '📝',
        description: 'Technical writer — READMEs, API docs, developer guides, changelogs',
        location: 'global',
        category: 'documentation',
        invoke: '@techwriter',
        capabilities: ['readme', 'api-docs', 'developer-guides', 'changelogs'],
    },
    {
        name: 'devops',
        icon: '🔧',
        description: 'DevOps engineer — Docker, CI/CD, Kubernetes, cloud infrastructure, deployment',
        location: 'global',
        category: 'engineering',
        invoke: '@devops',
        capabilities: ['docker', 'ci-cd', 'kubernetes', 'cloud', 'deployment'],
    },
    {
        name: 'security',
        icon: '🛡️',
        description: 'Security engineer — vulnerability analysis, auth flows, OWASP, security review',
        location: 'global',
        category: 'engineering',
        invoke: '@security',
        capabilities: ['vulnerability-analysis', 'auth', 'owasp', 'security-review'],
    },
    {
        name: 'analyst',
        icon: '📊',
        description: 'Data analyst — metrics, dashboards, SQL, data pipelines, product analytics',
        location: 'global',
        category: 'data',
        invoke: '@analyst',
        capabilities: ['metrics', 'dashboards', 'sql', 'product-analytics'],
    },
    {
        name: 'tester',
        icon: '🧪',
        description: 'QA engineer — test strategies, unit/e2e tests, edge cases, test automation',
        location: 'global',
        category: 'engineering',
        invoke: '@tester',
        capabilities: ['unit-tests', 'e2e-tests', 'test-strategy', 'edge-cases'],
    },
    {
        name: 'innovator',
        icon: '💡',
        description: 'Innovation catalyst — blue-sky thinking, novel approaches, creative problem-solving',
        location: 'global',
        category: 'ideation',
        invoke: '@innovator',
        capabilities: ['ideation', 'creative-problem-solving', 'blue-sky-thinking'],
    },
    {
        name: 'brainstorm',
        icon: '🌪️',
        description: 'Brainstorming facilitator — rapid ideation, mind mapping, divergent thinking',
        location: 'global',
        category: 'ideation',
        invoke: '@brainstorm',
        capabilities: ['brainstorming', 'mind-mapping', 'divergent-thinking'],
    },
    {
        name: 'pm',
        icon: '🎯',
        description: 'Product Manager — PRDs, user personas, RICE/MoSCoW prioritization, MVP scope, OKRs, roadmaps',
        location: 'global',
        category: 'planning',
        invoke: '@pm',
        capabilities: ['prd', 'roadmap', 'prioritization', 'user-research', 'mvp-scope'],
    },
    {
        name: 'hackathon',
        icon: '🏆',
        description: 'Hackathon Mode — coordinates all specialists in parallel with 30-second judge-test mindset. Visual impact first, demo-able features, unforgettable differentiator.',
        location: 'global',
        category: 'orchestration',
        invoke: '@hackathon',
        capabilities: ['multi-agent', 'parallel-dispatch', 'hackathon', 'full-project'],
    },
    {
        name: 'bmad',
        icon: '⚡',
        description: 'BMAD orchestration — party mode (fan-out to all agents) or quick-dev (architect→dev→qa pipeline). Auto-delegation via @DELEGATE[agent]: task tokens.',
        location: 'global',
        category: 'orchestration',
        invoke: '@bmad',
        capabilities: ['party-mode', 'quick-dev', 'fan-out', 'pipeline', 'auto-delegation'],
    },
    {
        name: 'scrum',
        icon: '🏃',
        description: 'Scrum Master — sprint planning, standups, retros, velocity tracking, blocker removal',
        location: 'global',
        category: 'planning',
        invoke: '@scrum',
        capabilities: ['sprint-planning', 'standups', 'retrospectives', 'velocity'],
    },
    {
        name: 'qa',
        icon: '🧪',
        description: 'QA Engineer — test plans, edge cases, unit/e2e/integration tests, quality gates, test automation',
        location: 'global',
        category: 'engineering',
        invoke: '@qa',
        capabilities: ['test-plans', 'edge-cases', 'unit-tests', 'e2e-tests', 'quality-gates'],
    },
    {
        name: 'evaluator',
        icon: '⚖️',
        description: 'Hackathon evaluator — problem statement analysis, feasibility scoring, impact assessment, judge criteria mapping',
        location: 'global',
        category: 'strategy',
        invoke: '@evaluator',
        capabilities: ['feasibility', 'impact-scoring', 'judge-criteria', 'ps-analysis'],
    },
    {
        name: 'master',
        icon: '👑',
        description: 'Team Lead — master coordinator that breaks complex projects into parallel streams and delegates to all personas simultaneously',
        location: 'global',
        category: 'orchestration',
        invoke: '@master',
        capabilities: ['team-coordination', 'parallel-streams', 'delegation', 'synthesis'],
    },
];

/** Get all skills (built-in + user-defined) */
export function getSkills() {
    const skills = [...BUILTIN_SKILLS];
    
    // Load user-defined skills from file
    if (existsSync(SKILLS_FILE)) {
        try {
            const userSkills = JSON.parse(readFileSync(SKILLS_FILE, 'utf8'));
            if (Array.isArray(userSkills.custom)) {
                skills.push(...userSkills.custom);
            }
        } catch { /* ignore parse errors */ }
    }
    
    return skills;
}

/** Get skill by name */
export function getSkill(name) {
    return getSkills().find(s => s.name === name);
}

/** Add a custom skill */
export function addCustomSkill(skill) {
    mkdirSync(SKILLS_DIR, { recursive: true });
    let data = { custom: [] };
    if (existsSync(SKILLS_FILE)) {
        try { data = JSON.parse(readFileSync(SKILLS_FILE, 'utf8')); } catch { /* ignore */ }
    }
    if (!Array.isArray(data.custom)) data.custom = [];
    // Replace if exists
    const idx = data.custom.findIndex(s => s.name === skill.name);
    if (idx >= 0) data.custom[idx] = skill;
    else data.custom.push(skill);
    writeFileSync(SKILLS_FILE, JSON.stringify(data, null, 2));
}

/** Format skills as XML (like Copilot CLI's <available_skills>) */
export function formatSkillsXml(skills = null) {
    const list = skills || getSkills();
    const items = list.map(s => 
        `<skill>\n  <name>${s.name}</name>\n  <description>${s.description}</description>\n  <location>${s.location}</location>\n</skill>`
    ).join('\n');
    return `<available_skills>\n${items}\n</available_skills>`;
}

/** Register all skills globally (postinstall hook) */
export function registerGlobalSkills() {
    mkdirSync(SKILLS_DIR, { recursive: true });
    const manifest = {
        version: '1.0.0',
        registered_at: new Date().toISOString(),
        skills: BUILTIN_SKILLS.map(s => ({ name: s.name, icon: s.icon, description: s.description, invoke: s.invoke, category: s.category })),
        custom: [],
    };
    writeFileSync(SKILLS_FILE, JSON.stringify(manifest, null, 2));
    return manifest.skills.length;
}

export { BUILTIN_SKILLS };
