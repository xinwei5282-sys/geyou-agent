import type {Plugin} from 'vite';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {portraitInput} from './geyou-media-plugin';
import {parseDocumentText} from './src/geyou/documentOcr';

export async function recognizeDocument(image:NonNullable<ReturnType<typeof portraitInput>>,signal:AbortSignal){
 if(process.platform!=='darwin')throw Error('unsupported_platform');
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-ocr-'));
 try{
  const file=path.join(dir,'document.'+image.extension);await writeFile(file,image.bytes,{mode:0o600});
  const output=await new Promise<string>((resolve,reject)=>{
   const child=spawn('/usr/bin/swift',[path.join(import.meta.dirname,'scripts/geyou-document-ocr.swift'),file],{stdio:['ignore','pipe','pipe']});
   let text='',settled=false;const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve(text)};
   const abort=()=>{child.kill('SIGTERM');finish(Error('cancelled'))};const timer=setTimeout(()=>{child.kill('SIGTERM');finish(Error('timeout'))},60000);
   signal.addEventListener('abort',abort,{once:true});child.stderr.resume();child.stdout.on('data',chunk=>{text+=chunk.toString();if(text.length>100000)abort()});
   child.on('error',()=>finish(Error('recognition_unavailable')));child.on('exit',code=>finish(code===0?undefined:Error('recognition_failed')));if(signal.aborted)abort();
  });
  const lines:unknown=JSON.parse(output);if(!Array.isArray(lines)||lines.some(x=>typeof x!=='string'))throw Error('invalid_result');
  return {...parseDocumentText(lines),provider:'本机文字识别',version:'local-vision-v1'};
 }finally{await rm(dir,{recursive:true,force:true})}
}
export function geyouDocumentPlugin():Plugin{let busy=false;return {name:'geyou-document-ocr',configureServer(server){server.middlewares.use((req,res,next)=>{
 if(req.url?.split('?')[0]!=='/api/geyou/documents/recognize')return next();
 const send=(status:number,body:unknown)=>{if(res.writableEnded||res.destroyed)return;res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
 if(req.method!=='POST')return send(405,{message:'请提交资料照片。'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return send(403,{message:'请从当前工作台提交资料。'});
 let body='',size=0;req.setEncoding('utf8');req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size<=1600000)body+=chunk});req.on('error',()=>send(400,{message:'上传中断，请重试。'}));
 req.on('end',()=>{void(async()=>{
  if(size>1600000)return send(413,{message:'照片过大，请压缩后重试。'});
  let input;try{input=portraitInput(JSON.parse(body))}catch{}if(!input)return send(400,{message:'请上传有效的JPG、PNG或WebP照片。'});
  if(busy)return send(429,{message:'正在识别另一份资料，请稍后重试。'});busy=true;
  const controller=new AbortController(),close=()=>controller.abort();res.on('close',close);
  try{send(200,await recognizeDocument(input,controller.signal))}catch{send(502,{message:'这次未能完成识别，请重拍或手动核对建档。'})}finally{busy=false;res.removeListener('close',close)}
 })()});
 })}}}
