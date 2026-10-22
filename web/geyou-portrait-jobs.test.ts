import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PortraitJobs} from './geyou-portrait-jobs';
test('portrait jobs return immediately, persist results and survive a fresh query store',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-jobs-test-'));try{const jobs=new PortraitJobs(dir);let finish!:(image:string)=>void;const work=new Promise<string>(resolve=>finish=resolve);const job=await jobs.submit('test',()=>work,()=> 'failed');assert.equal(job.status,'processing');assert.equal((await new PortraitJobs(dir).get(job.jobId))?.status,'processing');finish('data:image/png;base64,result');for(let i=0;i<50;i++){if((await jobs.get(job.jobId))?.status==='completed')break;await new Promise(resolve=>setTimeout(resolve,10));}assert.equal((await new PortraitJobs(dir).get(job.jobId))?.image,'data:image/png;base64,result');assert.equal(await jobs.get('../../secret'),undefined);}finally{await rm(dir,{recursive:true,force:true});}
});
test('explicit cancellation prevents late work replacing cancellation',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-jobs-test-'));try{const jobs=new PortraitJobs(dir);let finish!:(image:string)=>void;const job=await jobs.submit('test',()=>new Promise(resolve=>finish=resolve),()=> 'failed');assert.equal((await jobs.cancel(job.jobId))?.status,'cancelled');finish('late');await new Promise(resolve=>setTimeout(resolve,30));assert.equal((await jobs.get(job.jobId))?.status,'cancelled');}finally{await rm(dir,{recursive:true,force:true});}
});
test('failed background work persists a reviewable error',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-jobs-test-'));try{const jobs=new PortraitJobs(dir);const job=await jobs.submit('test',async()=>{throw Error('timeout');},()=> '生成等待超时');for(let i=0;i<50;i++){if((await jobs.get(job.jobId))?.status==='failed')break;await new Promise(resolve=>setTimeout(resolve,10));}assert.equal((await new PortraitJobs(dir).get(job.jobId))?.message,'生成等待超时');}finally{await rm(dir,{recursive:true,force:true});}
});
