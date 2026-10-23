import type {Plugin} from 'vite';
import {codexAvailable,runCodexReply} from './geyou-codex';
import {buildCemeteryPrompt,CEMETERY_PROMPT_VERSION} from './geyou-cemetery-prompt';
import {calculateAgentBazi,emptyAgentProfile} from './src/geyou/agentModel';
import {validateAuspiciousProfile} from './src/geyou/auspiciousProfile';
import {recommendCemeteries,type CemeteryNeeds} from './src/geyou/cemeteryModel';
import {validateCemeteryAdvice} from './src/geyou/cemeteryAdvice';
export function cemeteryAdviceSchema(ids:string[]){return {type:'object',additionalProperties:false,required:['analysis','recommendations'],properties:{analysis:{type:'string'},recommendations:{type:'array',minItems:Math.min(2,ids.length),maxItems:Math.min(2,ids.length),items:{type:'object',additionalProperties:false,required:['cemeteryId','reason','missing','evidence'],properties:{evidence:{type:'object',additionalProperties:false,required:['chartBasis','ruleBasis','siteBasis','conclusion'],properties:{chartBasis:{type:'string'},ruleBasis:{type:'string'},siteBasis:{type:'string'},conclusion:{type:'string'}}},cemeteryId:{type:'string',enum:ids},reason:{type:'string'},missing:{type:'array',maxItems:4,items:{type:'string'}}}}}}};}
export function geyouCemeteryPlugin(env:Record<string,string|undefined>):Plugin{
 const apiKey=env.GEYOU_AI_API_KEY||env.OPENAI_API_KEY||'',provider=env.GEYOU_AI_PROVIDER||(apiKey?'api':'codex'),binary=env.GEYOU_CODEX_BIN||'/usr/local/bin/codex';let busy=false;
 return {name:'geyou-independent-cemetery-advice',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.url?.split('?')[0]!=='/api/geyou/cemetery/recommend')return next();
  const send=(status:number,body:unknown)=>{if(res.destroyed)return;res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
  if(req.method!=='POST')return send(405,{message:'请使用正确的推荐请求'});
  void(async()=>{
   const abort=new AbortController(),disconnect=()=>{if(!res.writableEnded)abort.abort()};res.on('close',disconnect);let ownsLock=false;
   try{
    let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>8192)return send(413,{message:'资料内容过多，请精简后重试'})}
    let body;try{body=JSON.parse(raw)}catch{return send(400,{message:'资料格式有误，请核对后重试'})}
    const p=body?.profile,n=body?.needs;
    if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['birthDate','birthTime','deathDate','calendar','leap','sect'].includes(k))||['birthDate','birthTime','deathDate'].some(k=>typeof p[k]!=='string'||p[k].length>16)||!['solar','lunar'].includes(p.calendar)||typeof p.leap!=='boolean'||![1,2].includes(p.sect)||!n||typeof n!=='object'||Object.keys(n).some(k=>!['city','district','burialType','maxBudget'].includes(k))||['city','district','burialType','maxBudget'].some(k=>typeof n[k]!=='string'||n[k].length>50))return send(400,{message:'请核对出生资料和公墓需求'});
    const profile={...emptyAgentProfile(),...p,name:'服务对象'},needs=n as CemeteryNeeds;
    try{validateAuspiciousProfile(profile)}catch(e){return send(400,{message:(e as Error).message})}
    let matches;try{matches=recommendCemeteries(needs)}catch(e){return send(400,{message:(e as Error).message})}
    if(!matches.length)return send(400,{message:'当前地区暂无已收录公墓，请修改需求'});
    if(busy)return send(429,{message:'正在生成另一份公墓建议，请稍后重试'});busy=true;ownsLock=true;
    const prompt=buildCemeteryPrompt(calculateAgentBazi({...profile,birthplace:'北京时间（UTC+8）'}),needs,matches);let result:unknown;
    if(provider==='codex'){
     if(!await codexAvailable(binary))return send(503,{message:'公墓智能推荐暂未连接，请稍后重试'});
     result=await runCodexReply(binary,prompt,[],abort.signal,cemeteryAdviceSchema(matches.map(m=>m.cemetery.id)));
    }else{
     if(!apiKey)return send(503,{message:'公墓智能推荐暂未连接，请稍后重试'});
     const timeout=AbortSignal.timeout(45000),signal=AbortSignal.any([timeout,abort.signal]);
     const response=await fetch((env.GEYOU_AI_BASE_URL||'https://api.openai.com/v1').replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:env.GEYOU_AI_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:prompt}],response_format:{type:'json_object'}}),signal});
     if(!response.ok)throw Error('upstream');const value=await response.json();result=JSON.parse(value.choices?.[0]?.message?.content||'null');
    }
    const answer={...(result&&typeof result==='object'?result:{}),promptVersion:CEMETERY_PROMPT_VERSION};
    if(!validateCemeteryAdvice(answer,matches.map(m=>m.cemetery.id)))return send(502,{message:'公墓建议资料不完整，请重新生成'});send(200,answer);
   }catch{send(502,{message:'公墓建议暂时未能生成，请稍后重试'})}finally{if(ownsLock)busy=false;res.removeListener('close',disconnect)}
  })();
 })}};
}
