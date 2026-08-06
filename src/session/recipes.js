export const RECIPES = [
    { id: 'product-launch', name: 'Full Product Launch', chefs: 'researcher→strategist→pm→designer→dev→tester→devops', desc: 'End-to-end product from research to deployment' },
    { id: 'brand-identity', name: 'Brand Identity', chefs: 'domain-scout→researcher→brand-chef→designer→svgart→contentwriter', desc: 'Complete brand from market research to visual identity' },
    { id: 'mvp-sprint', name: 'MVP Sprint', chefs: 'planner→dev→tester→devops', desc: 'Rapid prototype to deployed MVP' },
    { id: 'ux-audit', name: 'UX Audit', chefs: 'ux-designer→analyst→qa→presenter', desc: 'Evaluate and present UX improvements' },
    { id: 'pitch-deck', name: 'Pitch Deck', chefs: 'strategist→storyteller→presenter→svgart', desc: 'Investor-ready pitch with narrative and visuals' },
    { id: 'code-quality', name: 'Code Quality', chefs: 'architect→dev→tester→qa', desc: 'Architecture review, refactoring, test coverage' },
    { id: 'content-marketing', name: 'Content Marketing', chefs: 'researcher→contentwriter→storyteller→designer', desc: 'Research-backed content with visual assets' },
    { id: 'security-review', name: 'Security Review', chefs: 'security→tester→devops', desc: 'Security audit, test coverage, deployment hardening' },
    { id: 'landing-page', name: 'Landing Page', chefs: 'researcher→ux-designer→designer→dev', desc: 'Research → wireframe → design → code a landing page' },
    { id: 'api-design', name: 'API Design', chefs: 'architect→dev→tester→qa→devops', desc: 'Complete API from schema to deployment' },
];

export const RECIPE_CHAINS = Object.freeze(
    Object.fromEntries(RECIPES.map(({ id, chefs }) => [id, chefs])),
);
