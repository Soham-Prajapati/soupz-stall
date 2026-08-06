# Recipes

## What a recipe is

A **recipe** is a predefined, named preset for a multi-agent chain in the
Soupz CLI REPL. Under the hood, everything a recipe does is really the
`/chain` command — a recipe is just a saved `/chain` value plus a short
description and a display name, so you don't have to remember or retype the
specialist chain yourself.

`/chain` runs specialists ("chefs" — `researcher`, `dev`, `designer`, etc.,
defined as prompt-wrapper definitions under `defaults/agents/`) one after
another, piping each stage's output into the next:

```
/chain researcher→contentwriter→storyteller→designer "your prompt"
```

A recipe wraps one of these chains under a short id:

```
/recipe content-marketing "your prompt"
```

is exactly equivalent to running the `/chain` command above with that
recipe's fixed chef sequence. Recipe invocation resolves the id, looks up its
chain string, and calls the same chain-execution path (`handleChain`)
internally — it does not do anything a hand-written `/chain` call couldn't do.

## Where recipes are defined (and a note on duplication)

Recipes are defined once in `src/session/recipes.js`. `RECIPES` supplies the
display metadata and `RECIPE_CHAINS` is the derived `id → chain string` lookup.
Both session mixins consume that shared catalog, so the recipes menu and the
execution path cannot drift apart.

## Current recipes

| id | name | chef chain | what it's for |
| --- | --- | --- | --- |
| `product-launch` | Full Product Launch | researcher→strategist→pm→designer→dev→tester→devops | End-to-end product from research to deployment |
| `brand-identity` | Brand Identity | domain-scout→researcher→brand-chef→designer→svgart→contentwriter | Complete brand from market research to visual identity |
| `mvp-sprint` | MVP Sprint | planner→dev→tester→devops | Rapid prototype to deployed MVP |
| `ux-audit` | UX Audit | ux-designer→analyst→qa→presenter | Evaluate and present UX improvements |
| `pitch-deck` | Pitch Deck | strategist→storyteller→presenter→svgart | Investor-ready pitch with narrative and visuals |
| `code-quality` | Code Quality | architect→dev→tester→qa | Architecture review, refactoring, test coverage |
| `content-marketing` | Content Marketing | researcher→contentwriter→storyteller→designer | Research-backed content with visual assets |
| `security-review` | Security Review | security→tester→devops | Security audit, test coverage, deployment hardening |
| `landing-page` | Landing Page | researcher→ux-designer→designer→dev | Research → wireframe → design → code a landing page |
| `api-design` | API Design | architect→dev→tester→qa→devops | Complete API from schema to deployment |

(`content-marketing` was previously named `content-campaign`; it was renamed
for naming-consistency reasons — see `_memory/NAMING-REGISTRY.yaml`'s
prohibited-legacy-names list. The CLI is unpublished, so no saved
session/state referenced the old id and no compatibility alias was needed.)

## Running a recipe

Inside the REPL:

```
/recipe list                          # same as showRecipes() — prints the table above
/recipe content-marketing "launch copy for the new pricing page"
```

## Adding a new recipe

1. Pick a kebab-case `id` and make sure its chef chain only references
   specialist ids that actually exist under `defaults/agents/` (or the
   built-in provider lanes) — an unknown chef id will fail at chain-run time,
   not at recipe-definition time.
2. In `src/session/recipes.js`, add an entry to `RECIPES`:
   `{ id, name, chefs: 'a→b→c', desc: 'one-liner' }`.
3. Test it: `/recipe <id> "test prompt"` in the REPL, and confirm `/recipe
   list` shows the new entry with the right description.
