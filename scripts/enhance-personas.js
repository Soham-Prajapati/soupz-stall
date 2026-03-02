#!/usr/bin/env node

/**
 * Persona Enhancement Script
 * 
 * This script helps enhance all persona files with better frameworks,
 * deliverables, and communication styles.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const AGENTS_DIR = './defaults/agents';

const PERSONA_TEMPLATES = {
    strategist: {
        frameworks: ['Blue Ocean Strategy', 'Business Model Canvas', 'Porter\'s 5 Forces', 'SWOT Analysis', 'Value Proposition Canvas'],
        deliverables: ['Feasibility Score (1-10)', 'Market Analysis', 'Competitive Landscape', 'Go-to-Market Strategy', 'Financial Projections'],
        questions: ['What problem are you solving?', 'Who is the target customer?', 'What\'s your unfair advantage?', 'How will you make money?']
    },
    
    researcher: {
        frameworks: ['Systematic Literature Review', 'Comparison Matrix', 'SWOT Analysis', 'Cost-Benefit Analysis', 'Decision Trees'],
        deliverables: ['Comparison Table (Top 3 options)', 'Quick Start Guide', 'Pricing Breakdown', 'Gotchas List', 'Alternative Options'],
        questions: ['What exactly are you looking for?', 'What\'s your budget?', 'What\'s your timeline?', 'What are your constraints?']
    },
    
    teacher: {
        frameworks: ['Bloom\'s Taxonomy', 'Socratic Method', 'Scaffolding', 'Spaced Repetition', 'Active Learning'],
        deliverables: ['ELI5 Explanation', 'Technical Deep-Dive', 'Key Takeaways', 'Common Mistakes', 'Practice Exercises', 'Further Reading'],
        questions: ['What\'s your current level?', 'What\'s your learning goal?', 'How do you learn best?', 'What\'s your timeline?']
    },
    
    presenter: {
        frameworks: ['Problem-Agitation-Solution', 'Hero\'s Journey', 'AIDA (Attention-Interest-Desire-Action)', 'Storytelling Arcs', 'Pitch Deck Structure'],
        deliverables: ['Slide-by-Slide Outline', 'Demo Script with Timestamps', 'Judge Q&A Prep (Top 20 questions)', 'Killer One-Liners', 'Red Flags to Avoid'],
        questions: ['Who is your audience?', 'What\'s the time limit?', 'What\'s the goal? (funding, partnership, awareness)', 'What\'s your unique angle?']
    },
    
    pm: {
        frameworks: ['RICE Prioritization', 'MoSCoW Method', 'Kano Model', 'OKRs', 'North Star Metric', 'Jobs-to-be-Done'],
        deliverables: ['PRD (Problem, Solution, Success Metrics)', 'User Personas', 'Prioritization Matrix', 'MVP Scope', 'Roadmap (Phases)', 'Success Metrics'],
        questions: ['What problem are we solving?', 'Who is the user?', 'What does success look like?', 'What\'s the timeline?', 'What are the constraints?']
    },
    
    devops: {
        frameworks: ['SRE Principles', 'Observability (Metrics, Logs, Traces)', 'Incident Response', 'Chaos Engineering', 'GitOps'],
        deliverables: ['Dockerfile', 'docker-compose.yml', 'CI/CD Pipeline Config', 'Infrastructure as Code', 'Monitoring Setup', 'Disaster Recovery Plan'],
        questions: ['What\'s your deployment frequency?', 'What\'s your uptime SLA?', 'What\'s your budget?', 'What cloud provider?', 'What\'s your team size?']
    },
    
    qa: {
        frameworks: ['Test Pyramid', 'Risk-Based Testing', 'Boundary Value Analysis', 'Equivalence Partitioning', 'State Transition Testing'],
        deliverables: ['Test Plan', 'Test Cases (Happy Path, Edge Cases, Error Cases)', 'Bug Report Template', 'Quality Gates', 'Acceptance Criteria'],
        questions: ['What are we testing?', 'What\'s the risk level?', 'What\'s the timeline?', 'What\'s the test environment?', 'What\'s the automation strategy?']
    },
    
    datascientist: {
        frameworks: ['CRISP-DM', 'Experiment Design', 'A/B Testing', 'Statistical Hypothesis Testing', 'ML Pipeline (Data → Model → Deploy)'],
        deliverables: ['Hypothesis Definition', 'Data Pipeline Design', 'Model Selection Justification', 'A/B Test Plan', 'Dashboard Design', 'Performance Metrics'],
        questions: ['What\'s the business question?', 'What data do we have?', 'What\'s the success metric?', 'What\'s the baseline?', 'What\'s the timeline?']
    },
    
    security: {
        frameworks: ['STRIDE Threat Modeling', 'DREAD Risk Assessment', 'Attack Trees', 'OWASP Top 10', 'Zero Trust Architecture'],
        deliverables: ['Threat Model', 'Security Checklist', 'Penetration Test Plan', 'Compliance Requirements', 'Incident Response Plan'],
        questions: ['What are we protecting?', 'Who are the threat actors?', 'What\'s the impact of a breach?', 'What compliance requirements?', 'What\'s the budget?']
    }
};

function enhancePersona(agentId, content) {
    const template = PERSONA_TEMPLATES[agentId];
    if (!template) return content;
    
    // Add frameworks section if not present
    if (!content.includes('## Frameworks')) {
        const frameworksSection = `
## Frameworks You Use

${template.frameworks.map(f => `- **${f}**`).join('\n')}
`;
        content = content.replace('## Your Deliverables', `${frameworksSection}\n## Your Deliverables`);
    }
    
    // Add questions section if not present
    if (!content.includes('Always ask:')) {
        const questionsSection = `
## Always Ask

${template.questions.map(q => `- ${q}`).join('\n')}
`;
        content += questionsSection;
    }
    
    return content;
}

function main() {
    console.log('🚀 Enhancing persona files...\n');
    
    const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
        const agentId = file.replace('.md', '');
        const filePath = join(AGENTS_DIR, file);
        
        try {
            let content = readFileSync(filePath, 'utf8');
            const enhanced = enhancePersona(agentId, content);
            
            if (enhanced !== content) {
                writeFileSync(filePath, enhanced);
                console.log(`✅ Enhanced: ${file}`);
            } else {
                console.log(`⏭️  Skipped: ${file} (no template or already enhanced)`);
            }
        } catch (err) {
            console.error(`❌ Error processing ${file}:`, err.message);
        }
    }
    
    console.log('\n✨ Done!');
}

main();
