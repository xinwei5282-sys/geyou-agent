import type { AppState, PageProps } from './types';
import { persistPrototype } from './auth';
import { readProfileImage } from './profileImage';

export type PortraitJobSnapshot={jobId:string;status:'processing'|'completed'|'failed'|'cancelled';image?:string;promptVersion?:string;message?:string};
export const pendingPortraitPosts=new Set<string>();

function waitForJobPoll(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{const timer=window.setTimeout(done,3000);function done(){signal.removeEventListener('abort',cancel);resolve();}function cancel(){window.clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new DOMException('已停止轮询','AbortError'));}signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();});}

export async function pollPortraitJob(jobId:string,signal:AbortSignal,onRetry?:()=>void):Promise<{image:string;promptVersion:string}>{
 while(!signal.aborted){let response:Response;try{response=await fetch(`/api/geyou/portrait/jobs/${encodeURIComponent(jobId)}`,{signal});}catch{if(signal.aborted)break;onRetry?.();await waitForJobPoll(signal);continue;}let payload:PortraitJobSnapshot|undefined;try{payload=await response.json() as PortraitJobSnapshot;}catch{if(response.status>=500){onRetry?.();await waitForJobPoll(signal);continue;}throw new Error(`查询修复任务失败（${response.status}）`);}if(!response.ok){if(response.status>=500){onRetry?.();await waitForJobPoll(signal);continue;}throw new Error(payload.message||`查询修复任务失败（${response.status}）`);}if(payload.status==='completed'){if(typeof payload.image!=='string'||typeof payload.promptVersion!=='string')throw new Error('修复服务返回内容不完整，请稍后重试');return {image:payload.image,promptVersion:payload.promptVersion};}if(payload.status==='failed'||payload.status==='cancelled')throw new Error(payload.message||(payload.status==='cancelled'?'修复任务已取消':'照片修复失败，可稍后重试'));if(payload.status!=='processing')throw new Error(payload.message||'修复服务返回未知任务状态');await waitForJobPoll(signal);}
 throw new DOMException('已停止轮询','AbortError');
}

export async function imageResult(value:string,signal?:AbortSignal){const blob=await(await fetch(value,signal?{signal}:undefined)).blob();return readProfileImage(new File([blob],`portrait-result.${blob.type.split('/')[1]||'png'}`,{type:blob.type}),{allowLargeInput:true,portrait:true});}

export function updatePersistedState(ref:{current:PageProps},change:(state:AppState)=>AppState):Promise<AppState>{return new Promise((resolve,reject)=>{try{ref.current.update(current=>{try{const next=change(current);if(ref.current.localPersistence!==false)persistPrototype(next);ref.current={...ref.current,state:next};resolve(next);return next;}catch(error){reject(error);return current;}});}catch(error){reject(error);}});}
