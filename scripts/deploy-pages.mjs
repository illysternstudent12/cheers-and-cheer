// Builds the GitHub Pages version and publishes dist/ to the gh-pages branch.
// Usage: npm run deploy
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })
const remote = execSync('git remote get-url origin').toString().trim()

run('npm run build:pages')
writeFileSync('dist/.nojekyll', '')
run('git init -q -b gh-pages', { cwd: 'dist' })
run('git add -A', { cwd: 'dist' })
run('git -c user.name=deploy -c user.email=deploy@users.noreply.github.com commit -q -m "Deploy site"', { cwd: 'dist' })
run(`git push -q -f ${remote} gh-pages`, { cwd: 'dist' })
console.log('\nPublished: https://illysternstudent12.github.io/cheers-and-cheer/')
