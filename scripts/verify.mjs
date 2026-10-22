import {spawnSync} from 'node:child_process';
import path from 'node:path';
const cwd=path.resolve(import.meta.dirname,'..');
for(const name of ['test','typecheck','build']){
 const run=spawnSync('npm',['run',name],{cwd,stdio:'inherit'});if(run.status!==0)process.exit(run.status||1);
}
