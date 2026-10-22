import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,realpath,stat,readdir} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
async function recentGeneratedImage(root:string,started:number):Promise<string|undefined>{
 const found:{path:string;mtime:number}[]=[];
 const visit=async(dir:string,rootDir=false):Promise<void>=>{let entries;try{entries=await readdir(dir,{withFileTypes:true})}catch{return}for(const entry of entries){const file=path.join(dir,entry.name);let info;try{info=await stat(file)}catch{continue}if(entry.isDirectory()){if(rootDir||info.mtimeMs>=started-2000)await visit(file)}else if(info.mtimeMs>=started-2000&&info.size>=100&&info.size<=12000000&&/\.(png|jpe?g|webp)$/i.test(entry.name))found.push({path:file,mtime:info.mtimeMs})}};
 await visit(root,true);return found.sort((a,b)=>b.mtime-a.mtime)[0]?.path;
}
export type CodexTaskOptions={schema:Record<string,unknown>;timeoutMs?:number;image?:{bytes:Buffer;extension:string};imageMode?:'edit'|'reference';imageOutput?:boolean};
export async function runMediaCodex(binary:string,prompt:string,signal:AbortSignal,options:CodexTaskOptions):Promise<unknown>{
 const directory=await mkdtemp(path.join(tmpdir(),'geyou-media-'));
 const started=Date.now(),schemaFile=path.join(directory,'schema.json'),outputFile=path.join(directory,'reply.json');
 try{
  await writeFile(schemaFile,JSON.stringify(options.schema));
  const args=['exec','--ephemeral','--sandbox','read-only','--skip-git-repo-check','--cd',directory,'--color','never','--json','--output-schema',schemaFile,'-o',outputFile,'-c','mcp_servers.figma.enabled=false','-c','mcp_servers.pencil.enabled=false','-c','mcp_servers.node_repl.enabled=false','-c','features.memories=false','-c','features.chronicle=false','-c','features.js_repl=false'];
  if(options.image){const input=path.join(directory,'original.'+options.image.extension);await writeFile(input,options.image.bytes);args.push('--image',input);prompt+=options.imageMode==='reference'?'\n参考素材路径：'+input+'。上传素材为企业Logo，严格保持原始比例、颜色和形状，按主提示词放入完整品牌Banner。使用内置 image_gen.imagegen 生成最终Banner。referenced_image_paths 必须包含此路径。':'\n编辑目标原图路径：'+input+'。先查看输入图，仅通过 image_gen.imagegen 编辑该原图，referenced_image_paths 必须包含此路径。使用生成图像工具，不用Python、Canvas、滤镜或复制原图冒充修复。';prompt+=' 最终 JSON imagePath 必须是实际生成工具返回的本地输出文件路径，不返回输入路径。';}
  else if(options.imageOutput){prompt+='\n使用内置 image_gen.imagegen 按主提示词直接生成一张完整品牌Banner，仅包含用户提供的企业信息。不要编写代码或用绘图脚本代替图像生成。最终 JSON imagePath 必须是实际生成工具返回的本地输出文件绝对路径。';}
  args.push('-');
  let processError:Error|undefined;let threadId:string|undefined;
  try{await new Promise<void>((resolve,reject)=>{
   const child=spawn(binary,args,{cwd:directory,stdio:['pipe','pipe','pipe'],detached:true});let done=false;
   const stop=()=>{if(child.pid){try{process.kill(-child.pid,'SIGTERM')}catch{child.kill('SIGTERM')}}};
   const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve()};
   const abort=()=>{stop();finish(new Error('cancelled'))};const timer=setTimeout(()=>{stop();finish(new Error('timeout'))},options.timeoutMs||120000);
   let startup='';child.stdout.on('data',chunk=>{if(threadId||startup.length>65536)return;startup+=chunk.toString();const match=/"type"\s*:\s*"thread.started"[^\n]*"thread_id"\s*:\s*"([a-f0-9-]{36})"/.exec(startup);if(match){threadId=match[1];startup='';}});
   signal.addEventListener('abort',abort,{once:true});child.stderr.resume();child.on('error',()=>finish(new Error('codex_unavailable')));child.on('exit',code=>finish(code===0?undefined:new Error('codex_unavailable')));child.stdin.on('error',()=>{});if(signal.aborted){abort();return}child.stdin.end(prompt);
  });}catch(error){if(!options.imageOutput)throw error;processError=error as Error}
  let result:Record<string,unknown>={};try{result=JSON.parse(await readFile(outputFile,'utf8')) as Record<string,unknown>}catch{if(!options.imageOutput)throw Error('invalid_codex_response')}
  if(!options.imageOutput)return result;
  const generated=path.resolve(process.env.CODEX_HOME||path.join(homedir(),'.codex'),'generated_images');
  // Never recover a different user's concurrent generation from the global folder.
  const imagePath=typeof result.imagePath==='string'?result.imagePath:threadId?await recentGeneratedImage(path.join(generated,threadId),started):undefined;if(!imagePath)throw processError||Error('invalid_image_result');
  const output=await realpath(imagePath);
  if(!output.startsWith(generated+path.sep)&&!output.startsWith(directory+path.sep))throw Error('invalid_image_path');
  const info=await stat(output);if(info.size>12000000||info.size<100||info.mtimeMs<started-2000)throw Error('invalid_image_file');
  const bytes=await readFile(output);const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!mime||options.image&&createHash('sha256').update(bytes).digest('hex')===createHash('sha256').update(options.image.bytes).digest('hex'))throw Error('invalid_image_result');
  return {image:`data:${mime};base64,${bytes.toString('base64')}`};
 }finally{await rm(directory,{recursive:true,force:true})}
}
