# Contributing to Soupz

## Setup

```bash
npm install
npm run dev:web
```

## Validation checklist

- Backend syntax checks for touched daemon files
- Frontend build passes in `packages/dashboard`
- Root test suite passes

```bash
cd packages/dashboard && npm run build
cd ../.. && npm test
```

## Pull request expectations

- Clear scope and user impact
- Risks/rollback note
- Test evidence included in PR description

## Contribution focus

- Mobile-first UX reliability
- Provider readiness and fallback correctness
- Runtime observability and honest status reporting
