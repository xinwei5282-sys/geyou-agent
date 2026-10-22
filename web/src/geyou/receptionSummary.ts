import type {Consultation,ReceptionSummary} from './types';
export const SUMMARY_KEYS=['confirmed','pending','prepared','nextActions'] as const;
export function validateReceptionSummary(value:unknown):ReceptionSummary|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const record=value as Record<string,unknown>;
 if(Object.keys(record).some(key=>!SUMMARY_KEYS.includes(key as typeof SUMMARY_KEYS[number])))return null;
 for(const key of SUMMARY_KEYS){const entries=record[key];if(!Array.isArray(entries)||entries.length>8||entries.some(entry=>typeof entry!=='string'||!entry.trim()||entry.length>200)||new Set(entries).size!==entries.length)return null}
 return Object.fromEntries(SUMMARY_KEYS.map(key=>[key,[...(record[key] as string[])]])) as ReceptionSummary;
}
export function currentReceptionMessages(messages:Consultation['messages']){return messages.filter(message=>message.replyScope!=='reference')}
export function referenceReceptionReply(record:Consultation,messages:Consultation['messages'],reply:{reply:string;todos?:string[];quickReplies?:string[];staffScript?:{title:string;advice?:string;text:string}[]}):Consultation{
 // Reference questions remain readable but never become the current customer's context.
 return {...record,messages:[...messages.map((message,index)=>index===messages.length-1&&message.role==='user'?{...message,replyScope:'reference' as const}:message),{role:'assistant',at:new Date().toISOString(),text:reply.reply,replyScope:'reference',staffScript:reply.staffScript,todos:reply.todos,quickReplies:reply.quickReplies}],updatedAt:new Date().toISOString()};
}

export function isReferenceContinuation(messages:Consultation['messages'],latestUser:string){
 const lastReply=messages.filter(message=>message.role==='assistant').at(-1);
 return lastReply?.replyScope==='reference'&&!/^\s*(?:现在|请|我们)?(?:回到|切回|继续)(?:当前|刚才的|原来的)客户/.test(latestUser);
}
