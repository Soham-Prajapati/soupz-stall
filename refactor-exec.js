import fs from 'fs';

let content = fs.readFileSync('packages/remote-server/src/git-endpoints.js', 'utf8');

content = content.replace(/import \{ execSync \} from 'child_process';/, `import { execFileSync } from 'child_process';`);

content = content.replace(/execSync\('git rev-parse --abbrev-ref HEAD'/g, `execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD']`);
content = content.replace(/execSync\('git branch --list'/g, `execFileSync('git', ['branch', '--list']`);
content = content.replace(/execSync\(`git checkout "\$\{sanitized\}"`/g, `execFileSync('git', ['checkout', sanitized]`);
content = content.replace(/execSync\('git status --porcelain'/g, `execFileSync('git', ['status', '--porcelain']`);
content = content.replace(/execSync\('git branch --show-current'/g, `execFileSync('git', ['branch', '--show-current']`);
content = content.replace(/const cmd = file \? `git --no-pager diff -- "\$\{escaped\}"` : 'git --no-pager diff';\s*const diff = execSync\(cmd, \{ cwd, timeout: 4000 \}\)\.toString\(\);/g, `const diff = file ? execFileSync('git', ['--no-pager', 'diff', '--', file], { cwd, timeout: 4000 }).toString() : execFileSync('git', ['--no-pager', 'diff'], { cwd, timeout: 4000 }).toString();`);
content = content.replace(/execSync\(`git --no-pager show "\$\{safeRef\}:\$\{safeFile\}"`/g, `execFileSync('git', ['--no-pager', 'show', \`\${ref}:\${file}\`]`);
content = content.replace(/execSync\(`git add -- "\$\{filePath\}"`/g, `execFileSync('git', ['add', '--', filePath]`);
content = content.replace(/execSync\(`git commit -m \$\{JSON\.stringify\(message\)\}`/g, `execFileSync('git', ['commit', '-m', message]`);
content = content.replace(/execSync\('git push'/g, `execFileSync('git', ['push']`);
content = content.replace(/execSync\('git stash list'/g, `execFileSync('git', ['stash', 'list']`);
content = content.replace(/const cmd = message \? `git stash push -m "\$\{message\}"` : 'git stash push';\s*execSync\(cmd, \{ cwd, encoding: 'utf8', timeout: 10000 \}\);/g, `if (message) { execFileSync('git', ['stash', 'push', '-m', message], { cwd, encoding: 'utf8', timeout: 10000 }); } else { execFileSync('git', ['stash', 'push'], { cwd, encoding: 'utf8', timeout: 10000 }); }`);
content = content.replace(/execSync\('git stash pop'/g, `execFileSync('git', ['stash', 'pop']`);
content = content.replace(/execSync\(`git log --oneline --format="%H\|\|\|%s\|\|\|%an\|\|\|%ai" -\$\{limit\}`/g, `execFileSync('git', ['log', '--oneline', '--format=%H|||%s|||%an|||%ai', \`-\${limit}\`]`);
content = content.replace(/execSync\('git remote get-url origin'/g, `execFileSync('git', ['remote', 'get-url', 'origin']`);
content = content.replace(/const cmd = `gh api repos\/\$\{info\.owner\}\/\$\{info\.repo\}\/git\/trees\/\$\{branch\}\?recursive=1`;\s*const tree = JSON\.parse\(execSync\(cmd, \{ timeout: 10000 \}\)\.toString\(\)\);/g, `const tree = JSON.parse(execFileSync('gh', ['api', \`repos/\${info.owner}/\${info.repo}/git/trees/\${branch}?recursive=1\`], { timeout: 10000 }).toString());`);
content = content.replace(/const cmd = `gh api repos\/\$\{info\.owner\}\/\$\{info\.repo\}\/contents\/\$\{filePath\}`;\s*const data = JSON\.parse\(execSync\(cmd, \{ timeout: 10000 \}\)\.toString\(\)\);/g, `const data = JSON.parse(execFileSync('gh', ['api', \`repos/\${info.owner}/\${info.repo}/contents/\${filePath}\`], { timeout: 10000 }).toString());`);

fs.writeFileSync('packages/remote-server/src/git-endpoints.js', content);
