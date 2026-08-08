# Publishing Soupz CLI to npm

This guide describes how a release owner can publish the `soupz-cli` package so users can run `npx soupz-cli` globally. Do not publish from an ordinary development or verification run.

## Prerequisites

- npm account at [npmjs.com](https://npmjs.com)
- Logged in locally: `npm login`
- Verify with: `npm whoami`

## Step 1: Verify package.json

Ensure the root `package.json` is configured correctly:

```json
{
  "name": "soupz-cli",
  "version": "X.Y.Z",
  "description": "Code from anywhere — AI coding IDE that bridges your phone to your laptop",
  "type": "module",
  "bin": {
    "soupz-cli": "./bin/soupz.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/soupz/cli.git"
  },
  "bugs": { "url": "https://github.com/soupz/cli/issues" },
  "homepage": "https://github.com/soupz/cli#readme",
  "main": "bin/soupz.js",
  "engines": {
    "node": ">=18"
  }
}
```

Key fields:
- **name**: Must be `soupz-cli`
- **version**: Semantic versioning (e.g., `0.1.0`, `1.0.0`)
- **bin**: Entry point for CLI (should point to `bin/soupz.js`)
- **repository / bugs / homepage**: Must point to `https://github.com/soupz/cli`
- **type**: "module" for ESM support
- **engines**: Node.js >=18 requirement

## Step 2: Create .npmignore

Create a `.npmignore` file in the repo root to exclude unnecessary files from the published package:

```
# Dependencies (users install their own)
node_modules/
packages/*/node_modules/

# Environment & secrets
.env
.env.local
.env.*.local

# Development
packages/dashboard/src/
packages/dashboard/vite.config.js
packages/dashboard/postcss.config.js
packages/dashboard/tailwind.config.js
packages/dashboard/index.html
packages/dashboard/.vite/
packages/dashboard/dist/

# Git
.git/
.gitignore

# Docs (optional: include if you want to ship docs)
docs/
README.md

# Other
.DS_Store
*.log
npm-debug.log*
yarn-debug.log*
*.tgz
.cache/
.vscode/
.idea/

# Build artifacts
dist/
build/
.next/

# Test files
tests/
*.test.js
*.spec.js

# CI/CD
.github/
.gitlab-ci.yml

# Config files (optional: exclude if these shouldn't ship)
*.config.js
jest.config.js
```

This ensures the published package is small and contains only runtime dependencies.

## Step 3: Test locally with npm pack

Before publishing, create a local tarball to verify contents:

```bash
npm pack
```

This creates a `soupz-cli-X.Y.Z.tgz` file. Extract and inspect:

```bash
tar tzf soupz-cli-0.2.0.tgz | head -30
```

Verify:
- `package/bin/soupz.js` exists
- `package/package.json` is correct
- `package/node_modules/` is NOT included
- Large dev dependencies (`packages/dashboard/node_modules/`) are excluded

You can also test the tarball installation locally:

```bash
mkdir test-install && cd test-install
npm install ../soupz-cli-0.2.0.tgz
npx soupz-cli --version
```

Clean up:

```bash
rm soupz-cli-X.Y.Z.tgz
rm -rf test-install
```

## Step 4: Bump version (if needed)

Update the version in `package.json`:

```bash
npm version patch    # 0.1.0 -> 0.1.1 (bug fixes)
npm version minor    # 0.1.0 -> 0.2.0 (new features)
npm version major    # 0.1.0 -> 1.0.0 (breaking changes)
```

This automatically commits and tags the version.

## Step 5: Publish to npm

For the unscoped `soupz-cli` package, publish only after the release owner approves the exact tarball:

```bash
npm publish
```

Do not publish from this repository unless the release owner has explicitly authorized it.

## Step 6: Verify publication

Wait 10-30 seconds, then verify the package is live:

```bash
npm view soupz-cli
```

Check the package page at `https://www.npmjs.com/package/soupz-cli`

Install globally and test:

```bash
npm install -g soupz-cli
soupz-cli --version
```

Or test with npx (no global install):

```bash
npx soupz-cli --version
```

## Troubleshooting

### "Package name already taken"

The canonical package name is `soupz-cli`. Only a release owner may publish it:
```bash
npm publish
```

### "Not logged in"

```bash
npm login
npm whoami
```

### "You do not have permission to publish"

- Ensure you own the package or are a collaborator
- Scoped packages must be in an org you manage
- Check npm account permissions at `https://www.npmjs.com/settings/~/packages`

### "Tag already exists"

If `npm version` fails due to git tag:

```bash
git tag -d v0.1.0           # Delete local tag
git push origin :refs/tags/v0.1.0  # Delete remote tag
npm version patch           # Try again
```

### File size too large

If `npm publish` fails with size warnings:

1. Check what's being published:
   ```bash
   npm pack
   tar tzf soupz-cli-X.Y.Z.tgz | wc -l
   ```

2. Verify `.npmignore` is excluding `packages/dashboard/node_modules/` and other large directories

3. Consider excluding large docs or assets

### Users can't run `npx soupz-cli`

Verify the `bin` field in `package.json`:

```json
"bin": {
  "soupz-cli": "./bin/soupz.js"
}
```

And that `bin/soupz.js` has the shebang:

```javascript
#!/usr/bin/env node
```

Make it executable:

```bash
chmod +x bin/soupz.js
```

## Publishing Updates

When releasing a new version:

1. Make changes to code
2. Update version:
   ```bash
   npm version patch
   ```
3. Push and tag:
   ```bash
   git push origin main --tags
   ```
4. Publish:
   ```bash
npm publish
   ```

## Deprecating old versions

If needed, deprecate a version:

```bash
npm deprecate soupz-cli@0.1.0 "Use soupz-cli@0.2.0 instead"
```

Users will see a warning when installing the deprecated version.

## Unpublishing (not recommended)

Unpublish a version within 72 hours of publication:

```bash
npm unpublish soupz-cli@0.1.0
```

After 72 hours, versions are permanent (npm prevents breakage).

## References

- [npm publish docs](https://docs.npmjs.com/cli/publish)
- [npm package.json docs](https://docs.npmjs.com/cli/configuring-npm/package-json)
- [.npmignore docs](https://docs.npmjs.com/cli/v8/configuring-npm/npmignore)
