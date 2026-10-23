import {readdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
// Public image URLs in seeded records and JSX are rooted at / in local mode.
// Scope these known asset directories to the project Pages URL in built JS only.
for(const name of await readdir('dist/assets')){
 if(!name.endsWith('.js'))continue;
 const path=`dist/assets/${name}`;
 const source=await readFile(path,'utf8');
 await writeFile(path,source.replace(/(["'`])\/(agent-home|agent-products|demo-products|process-guide|reference-art)\//g,'$1/geyou-agent/$2/'));
}
await writeFile('dist/version.json',JSON.stringify({commit:process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode:'static-preview'},null,2));
