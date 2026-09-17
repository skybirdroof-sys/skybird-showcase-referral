/* Guard rail: the product is Talon, and the repo must contain zero references
   to the banned assistant name / Marvel-adjacent marks. Patterns are assembled
   at runtime so this checker is not itself a match. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.netlify', 'dist']);
const SELF = resolve(process.argv[1]);

const BANNED = [
  ['j', 'arvis'].join(''),
  ['j.a.r.v', '.i.s'].join(''),
  ['mar', 'vel'].join(''),
  ['iron ', 'man'].join(''),
].map((needle) => ({ needle, re: new RegExp(needle.replace(/\./g, '\\.'), 'i') }));

let hits = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (resolve(path) === SELF) continue;
    if (/\.(png|jpe?g|gif|webp|ico|woff2?|mp4)$/i.test(path)) continue;

    readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
      for (const { needle, re } of BANNED) {
        if (re.test(line)) {
          console.error(`${path}:${i + 1}: banned reference "${needle}" -> ${line.trim()}`);
          hits += 1;
        }
      }
    });
  }
}

walk(process.cwd());

if (hits) {
  console.error(`\n${hits} banned reference(s) found. Product name is Talon.`);
  process.exit(1);
}
console.log('clean — product name is Talon, no banned references');
