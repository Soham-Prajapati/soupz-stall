#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const AGENTS_DIR = './defaults/agents';
const remaining = ['analyst', 'brainstorm', 'contentwriter', 'evaluator', 'innovator', 'planner', 'presenter', 'problemsolver', 'scrum', 'storyteller', 'techwriter', 'tester'];

const enhancements = {
    analyst: 'Requirements gathering, user stories, market sizing, SWOT analysis',
    brainstorm: 'SCAMPER, Six Thinking Hats, Mind Mapping, Crazy 8s ideation',
    contentwriter: 'Marketing copy, blog posts, social media, SEO optimization',
    evaluator: 'Hackathon judging, feasibility scoring, competitive analysis',
    innovator: 'Blue Ocean Strategy, disruption, business model innovation',
    planner: 'Sprint planning, task breakdown, dependency mapping, Gantt charts',
    presenter: 'Pitch decks, demo scripts, Q&A prep, storytelling',
    problemsolver: '5 Whys, root cause analysis, First Principles thinking',
    scrum: 'Sprint ceremonies, velocity tracking, retrospectives, blockers',
    storyteller: 'Hero\'s Journey, narrative arcs, brand voice, copywriting',
    techwriter: 'READMEs, API docs, tutorials, changelogs, migration guides',
    tester: 'Test strategy, automation frameworks, quality gates, CI/CD'
};

for (const id of remaining) {
    const filepath = join(AGENTS_DIR, `${id}.md`);
    try {
        let content = readFileSync(filepath, 'utf8');
        const desc = enhancements[id];
        if (desc && !content.includes('## Frameworks')) {
            content = content.replace(
                /description: "([^"]+)"/,
                `description: "${desc}"`
            );
            writeFileSync(filepath, content);
            console.log(`✅ Enhanced: ${id}.md`);
        }
    } catch (err) {
        console.log(`❌ Error: ${id}.md - ${err.message}`);
    }
}
console.log('\n✨ Done! All remaining personas polished.');
