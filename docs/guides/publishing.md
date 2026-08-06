# Publishing Guide — Soupz CLI

How a release owner can distribute Soupz CLI. Do not publish as part of normal development or verification work.

---

## 1. npm / npx (Recommended — Easiest)

### Setup

Ensure `package.json` has these fields:

```json
{
  "name": "soupz-cli",
  "version": "0.2.0",
  "bin": {
    "soupz-cli": "./bin/soupz.js"
  },
  "repository": { "type": "git", "url": "git+https://github.com/soupz/cli.git" },
  "bugs": { "url": "https://github.com/soupz/cli/issues" },
  "homepage": "https://github.com/soupz/cli#readme",
  "files": ["bin/", "src/", "defaults/", "scripts/", "docs/", "README.md", "LICENSE"],
  "engines": { "node": ">=18" }
}
```

### Publish

```bash
# Login to npm (one-time)
npm login

# Publish (first time)
npm publish --access public

# Update
npm version patch  # bumps version
npm publish
```

### Users Install With

```bash
# Global install
npm install -g soupz-cli

# Or run without installing
npx soupz-cli
```

---

## 2. Homebrew

There is no supported Homebrew formula. Install with `npm install -g soupz-cli` or run `npx soupz-cli`.

---

## 3. GitHub Releases

```bash
# Tag and push
git tag v0.1.0-alpha
git push origin v0.1.0-alpha

# Create release on GitHub
gh release create v0.1.0-alpha --title "v0.1.0-alpha" --notes "Initial alpha release"
```

Users can then:
```bash
# Clone and install
git clone https://github.com/soupz/cli.git
cd cli && npm install && npm link
```

---

## 4. Pre-Publish Checklist

- [ ] `bin/soupz.js` has shebang: `#!/usr/bin/env node`
- [ ] `package.json` has correct `bin` field
- [ ] `package.json` `files` array includes all needed dirs
- [ ] All dependencies listed in `dependencies` (not devDependencies)
- [ ] README.md has install instructions
- [ ] `npm pack --dry-run` shows correct file list
- [ ] `.npmignore` or `files` field excludes: `_soupz-output/`, `_soupz/`, `node_modules/`, `.env`
- [ ] Version in `bin/soupz.js` matches `package.json`
- [ ] License file exists

### Test Before Publishing

```bash
# Create a tarball and test it
npm pack
# Install the tarball globally
npm install -g soupz-cli-0.2.0.tgz
# Test it works
soupz-cli --help
# Clean up
npm uninstall -g soupz-cli
rm soupz-cli-0.2.0.tgz
```

---

## 5. Browser Extension (Chrome Web Store)

When the browser extension is ready:

```bash
cd packages/browser-extension
# Create a zip of the extension
zip -r soupz-bridge.zip manifest.json src/ icons/
```

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 registration fee
3. Upload `soupz-bridge.zip`
4. Fill in listing details, screenshots
5. Submit for review (takes 1-3 days)

---

## 6. Mobile App (Expo / App Store)

When the mobile IDE is ready:

```bash
cd packages/mobile-ide
npx expo install  # install dependencies
npx eas build     # build for iOS/Android
npx eas submit    # submit to stores
```

For testing without app stores:
```bash
npx expo start    # generates QR code
# Scan with Expo Go app on phone
```
