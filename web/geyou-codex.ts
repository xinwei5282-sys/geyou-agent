import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const execFileAsync=promisify(execFile);
const nullable=(definition:Record<string,unknown>)=>({anyOf:[definition,{type:'null'}]});
export function codexReplySchema(productIds:string[]){
 const profile={subjectGender:nullable({type:'string',maxLength:20}),subjectAge:nullable({type:'string',maxLength:30}),customs:nullable({type:'string',maxLength:300}),occupation:nullable({type:'string',maxLength:100}),interests:nullable({type:'string',maxLength:300}),subjectName:nullable({type:'string',maxLength:100}),budgetYuan:nullable({type:'number',minimum:0,maximum:100000000}),region:nullable({type:'string'}),faith:nullable({type:'string',enum:['待确认','无特定信仰','佛教','道教','基督教','天主教','伊斯兰教','其他宗教']}),scenario:nullable({type:'string',enum:['advance','hospital','home']}),category:nullable({type:'string',enum:['clothes','urn','ceremony','burial']})};
 return {
  type:'object',additionalProperties:false,required:['reply','profile','productIds','staffScript','quickReplies','todos','recommendations','upsellTips','scope','receptionSummary'],
  properties:{
   reply:{type:'string'},
   scope:{type:'string',enum:['current','reference']},
   receptionSummary:nullable({type:'object',additionalProperties:false,required:['confirmed','pending','prepared','nextActions'],properties:Object.fromEntries(['confirmed','pending','prepared','nextActions'].map(key=>[key,{type:'array',maxItems:8,items:{type:'string',minLength:1,maxLength:200}}]))}),
   upsellTips:{type:'array',maxItems:3,items:{type:'string',minLength:1,maxLength:300}},
   recommendations:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['productId','tier','reason'],properties:{productId:productIds.length?{type:'string',enum:productIds}:{type:'string'},tier:{type:'string',enum:['low','mid','high']},reason:{type:'string',minLength:1,maxLength:300}}}},
   todos:{type:'array',maxItems:4,items:{type:'string',minLength:1,maxLength:300}},
   quickReplies:{type:'array',maxItems:5,items:{type:'string',minLength:1,maxLength:60}},
   profile:{type:'object',additionalProperties:false,required:Object.keys(profile),properties:profile},
   productIds:{type:'array',items:productIds.length?{type:'string',enum:productIds}:{type:'string'},maxItems:productIds.length?3:0},
   staffScript:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['title','advice','text'],properties:{title:{type:'string'},advice:{type:'string'},text:{type:'string'}}}},
  },
 };
}
export async function codexAvailable(binary:string){
 try{const {stdout,stderr}=await execFileAsync(binary,['login','status'],{timeout:8000,maxBuffer:8192});return /Logged in/i.test(stdout+stderr)}catch{return false}
}
export async function runCodexReply(binary:string,prompt:string,productIds:string[],signal:AbortSignal){
 const directory=await mkdtemp(path.join(tmpdir(),'geyou-ai-'));
 const schemaFile=path.join(directory,'schema.json'),outputFile=path.join(directory,'reply.json');
 await writeFile(schemaFile,JSON.stringify(codexReplySchema(productIds)));
 // Model/provider/effort inherit the user's Codex configuration; this invocation only restricts tools and writes.
 const args=['exec','--ephemeral','--sandbox','read-only','--skip-git-repo-check','--cd',directory,'--color','never','--json','--output-schema',schemaFile,'-o',outputFile,'-c','mcp_servers.figma.enabled=false','-c','mcp_servers.pencil.enabled=false','-c','mcp_servers.node_repl.enabled=false','-c','features.memories=false','-c','features.chronicle=false','-c','features.js_repl=false','-'];
 try{
  await new Promise<void>((resolve,reject)=>{
   const child=spawn(binary,args,{cwd:directory,stdio:['pipe','pipe','pipe'],detached:true});let settled=false;
   const stop=()=>{if(child.pid){try{process.kill(-child.pid,'SIGTERM')}catch{child.kill('SIGTERM')}}};
   const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve()};
   const abort=()=>{stop();finish(new Error('codex_cancelled'))};
   const timer=setTimeout(()=>{stop();finish(new Error('codex_timeout'))},90000);
   signal.addEventListener('abort',abort,{once:true});
   // Discard event/progress streams: no credentials or customer prompts are logged or sent to the client.
   child.stdout.resume();child.stderr.resume();child.on('error',()=>finish(new Error('codex_unavailable')));child.on('exit',code=>finish(code===0?undefined:new Error('codex_unavailable')));child.stdin.on('error',()=>{});
   if(signal.aborted){abort();return}child.stdin.end(prompt);
  });
  const result=JSON.parse(await readFile(outputFile,'utf8'));
  if(result.profile&&typeof result.profile==='object')result.profile=Object.fromEntries(Object.entries(result.profile).filter(([,value])=>value!==null));
  return result as unknown;
 }finally{await rm(directory,{recursive:true,force:true})}
}
