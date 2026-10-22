import type {Plugin} from 'vite';
import {PORTRAIT_CLOTHES,portraitClothingPrompt,type PortraitClothing} from './src/geyou/portraitClothing';
import path from 'node:path';
import {PortraitJobs} from './geyou-portrait-jobs';
import {codexAvailable} from './geyou-codex';
import {runMediaCodex} from './geyou-media-codex';
import {NOTICE_SYSTEM_PROMPT,NOTICE_PROMPT_VERSION,PORTRAIT_SYSTEM_PROMPT,PORTRAIT_PROMPT_VERSION,BANNER_SYSTEM_PROMPT,BANNER_PROMPT_VERSION} from './geyou-media-prompts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function noticeInput(value:unknown){if(!object(value))return null;const result:Record<string,string>={};for(const key of ['name','age','date','ceremonyDate','location','faith','notes','text','phone']){const input=value[key];if(input!==undefined&&(typeof input!=='string'||input.length>(key==='notes'||key==='text'?1000:200)))return null;if(typeof input==='string')result[key]=input.trim()}return result.name?result:null}
export function portraitInput(value:unknown){if(!object(value)||typeof value.image!=='string'||value.image.length>1500000)return null;const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.image);if(!m)return null;const bytes=Buffer.from(m[2],'base64');const valid=m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?bytes[0]===255&&bytes[1]===216:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';return valid?{bytes,extension:m[1]==='jpeg'?'jpg':m[1]}:null}
export function portraitStyleInput(value:unknown):{clothing?:PortraitClothing}|null{if(!object(value))return null;if(value.clothing===undefined)return {};return typeof value.clothing==='string'&&Object.hasOwn(PORTRAIT_CLOTHES,value.clothing)?{clothing:value.clothing as PortraitClothing}:null}
function bannerInput(value:unknown){if(!object(value)||typeof value.name!=='string'||!value.name.trim()||value.name.length>100)return null;const result:{name:string;introduction:string;region:string;logo?:{bytes:Buffer;extension:string}}={name:value.name.trim(),introduction:'',region:''};for(const key of ['introduction','region'] as const){const input=value[key];if(input!==undefined&&(typeof input!=='string'||input.length>(key==='introduction'?500:100)))return null;if(typeof input==='string')result[key]=input.trim()}if(value.logo!==undefined){const logo=portraitInput({image:value.logo});if(!logo)return null;result.logo=logo}return result}
export const noticeSchema={type:'object',additionalProperties:false,required:['text','missingFields'],properties:{text:{type:'string'},missingFields:{type:'array',items:{type:'string',enum:['姓名','享年','离世日期','告别时间','告别地点']}}}};
const imageSchema={type:'object',additionalProperties:false,required:['imagePath'],properties:{imagePath:{type:'string'}}};
export function mediaFailure(error:unknown,portrait:boolean,banner:boolean){
 const code=error instanceof Error?error.message:'generation_failed';
 if(code==='timeout')return {status:504,message:'生成等待超时，请稍后重试；原图已保留。',code:'generation_timeout'};
 if(code==='codex_unavailable')return {status:502,message:'本地生成服务调用失败，请稍后重试；原图已保留。',code:'generation_unavailable'};
 return {status:502,message:portrait?'照片修复未完成，请重试或使用原图。':banner?'首页Banner生成失败，请稍后重试。':'讣告生成未完成，请重试或手动编辑。',code:'generation_failed'};
}
export function geyouMediaPlugin(env:Record<string,string>):Plugin{const binary=env.GEYOU_CODEX_BINARY||'/usr/local/bin/codex';const active=new Set<string>();const jobs=new PortraitJobs(path.join(import.meta.dirname,'.geyou-media-jobs'));return {name:'geyou-media-codex',configureServer(server){server.middlewares.use((req,res,next)=>{
 const route=req.url?.split('?')[0];const jobRoute=route?.match(/^\/api\/geyou\/portrait\/jobs\/([a-f0-9-]{36})$/);if(!jobRoute&&route!=='/api/geyou/notice'&&route!=='/api/geyou/portrait'&&route!=='/api/geyou/banner')return next();
 const send=(status:number,value:unknown)=>{if(res.writableEnded||res.destroyed)return;res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value))};
 if(jobRoute){if(req.method!=='GET'&&req.method!=='DELETE')return send(405,{message:'不支持此操作。'});void(req.method==='DELETE'?jobs.cancel(jobRoute[1]):jobs.get(jobRoute[1])).then(job=>{if(req.method==='DELETE'&&job&&job.status!=='cancelled')return send(409,{...job,message:job.message||(job.status==='completed'?'修复已完成，请查看结果。':'任务已结束，请刷新查看状态。')});send(job?200:404,job||{message:'修复任务不存在，请重新提交。'});}).catch(()=>send(500,{message:'暂时无法查询任务，请稍后重试。'}));return;}
 if(req.method!=='POST')return send(405,{message:'仅支持提交生成请求。'});
 req.setEncoding('utf8');let size=0,body='';const limit=route.endsWith('portrait')||route.endsWith('banner')?1600000:12000;req.on('data',chunk=>{size+=chunk.length;if(size<=limit)body+=chunk.toString()});req.on('end',()=>{void(async()=>{
  if(size>limit)return send(413,{message:'提交内容过大，请压缩照片后重试。'});let raw:unknown;try{raw=JSON.parse(body)}catch{return send(400,{message:'提交内容格式不正确。'})}
  const portrait=route.endsWith('portrait'),banner=route.endsWith('banner'),input=portrait?portraitInput(raw):banner?bannerInput(raw):noticeInput(raw);if(!input)return send(400,{message:portrait?'请上传有效的照片。':banner?'请补充有效的企业名称、简介或Logo。':'请填写姓名并核对输入内容。'});
  const style=portrait?portraitStyleInput(raw):{};if(!style)return send(400,{message:'请选择有效的服装款式。'});
  const generationKey=portrait||banner?'image':'notice';
  if(active.has(generationKey))return send(429,{message:portrait||banner?'已有图片正在生成，请稍后重试。':'讣告文案正在生成，请稍后重试。'});active.add(generationKey);
  if(portrait){try{if(!await codexAvailable(binary)){active.delete(generationKey);return send(503,{message:'本地 Codex 未登录，请联系门店工作人员。'});}const job=await jobs.submit(PORTRAIT_PROMPT_VERSION+(style.clothing?'-'+style.clothing:''),async signal=>{try{const result=await runMediaCodex(binary,PORTRAIT_SYSTEM_PROMPT+(style.clothing?portraitClothingPrompt(style.clothing):''),signal,{schema:imageSchema,timeoutMs:600000,image:input as NonNullable<ReturnType<typeof portraitInput>>,imageOutput:true});if(!object(result)||typeof result.image!=='string')throw Error('invalid_image_result');return result.image;}finally{active.delete(generationKey);}},error=>mediaFailure(error,true,false).message);send(202,job);}catch(error){active.delete(generationKey);const failure=mediaFailure(error,true,false);send(failure.status,{message:failure.message});}return;}
  const controller=new AbortController(),cancel=()=>{if(!res.writableEnded)controller.abort()};res.on('close',cancel);
  try{if(!await codexAvailable(binary))return send(503,{message:'本地 Codex 未登录，请联系门店工作人员。'});
   const bannerData=banner?input as NonNullable<ReturnType<typeof bannerInput>>:undefined;
   const result=await runMediaCodex(binary,portrait?PORTRAIT_SYSTEM_PROMPT:banner?BANNER_SYSTEM_PROMPT+'\n机构视觉资料JSON：'+JSON.stringify({公司名称:bannerData!.name,...(bannerData!.introduction?{企业简介:bannerData!.introduction}:{}),Logo:bannerData!.logo?'已上传，按原样展示':'未提供，省略'}):NOTICE_SYSTEM_PROMPT+'\n已确认资料JSON：'+JSON.stringify(input),controller.signal,{schema:portrait||banner?imageSchema:noticeSchema,timeoutMs:portrait||banner?600000:120000,...(portrait?{image:input as ReturnType<typeof portraitInput>&{},imageOutput:true}:banner?{image:bannerData!.logo,imageMode:'reference' as const,imageOutput:true}:{})});
   if(!object(result))throw Error('invalid_response');
   if(!portrait&&!banner&&(typeof result.text!=='string'||!result.text.trim()||result.text.length>500||!Array.isArray(result.missingFields)||result.missingFields.some(f=>!['姓名','享年','离世日期','告别时间','告别地点'].includes(String(f)))))throw Error('invalid_response');
   send(200,{...result,promptVersion:portrait?PORTRAIT_PROMPT_VERSION:banner?BANNER_PROMPT_VERSION:NOTICE_PROMPT_VERSION});
  }catch(error){const failure=mediaFailure(error,portrait,banner);console.warn('[geyou-media]',route,failure.code);send(failure.status,{message:failure.message,code:failure.code})}finally{active.delete(generationKey);res.removeListener('close',cancel)}
 })()});req.on('error',()=>send(400,{message:'上传中断，请重试。'}));
 })}}}
