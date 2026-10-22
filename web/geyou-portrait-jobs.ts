import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
export type PortraitJob={jobId:string;status:'processing'|'completed'|'failed'|'cancelled';promptVersion:string;createdAt:number;image?:string;message?:string};
const validId=(id:string)=>/^[a-f0-9-]{36}$/.test(id);
export class PortraitJobs {
 private running=new Map<string,AbortController>();
 constructor(private directory:string){}
 private async save(job:PortraitJob){await mkdir(this.directory,{recursive:true,mode:0o700});const file=path.join(this.directory,job.jobId+'.json');const staging=file+'.'+randomUUID();await writeFile(staging,JSON.stringify(job),{mode:0o600});await rename(staging,file);}
 async get(id:string):Promise<PortraitJob|undefined>{if(!validId(id))return;let job:PortraitJob;try{job=JSON.parse(await readFile(path.join(this.directory,id+'.json'),'utf8'))}catch{return;}if(job.status==='processing'&&Date.now()-job.createdAt>660000){job={...job,status:'failed',message:'任务等待超时，请重新提交；原图已保留。'};await this.save(job);}return job;}
 async submit(version:string,work:(signal:AbortSignal)=>Promise<string>,failure:(error:unknown)=>string):Promise<PortraitJob>{
  const job:PortraitJob={jobId:randomUUID(),status:'processing',promptVersion:version,createdAt:Date.now()};const controller=new AbortController();this.running.set(job.jobId,controller);
  try{await this.save(job);}catch(error){this.running.delete(job.jobId);throw error;}
  void(async()=>{try{const image=await work(controller.signal);if(!controller.signal.aborted)await this.save({...job,status:'completed',image});}catch(error){if(!controller.signal.aborted)await this.save({...job,status:'failed',message:failure(error)});}finally{this.running.delete(job.jobId);}})().catch(()=>console.warn('[geyou-media] job_persistence_failed'));
  return job;
 }
 async cancel(id:string){const job=await this.get(id);if(!job)return;if(job.status!=='processing')return job;const controller=this.running.get(id);if(!controller)return {...job,message:'任务服务已重新加载，请等待结果或超时后重试。'};controller.abort();const cancelled:PortraitJob={...job,status:'cancelled',message:'已取消修复，原图已保留。'};await this.save(cancelled);return cancelled;}
}
