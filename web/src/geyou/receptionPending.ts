import type {Consultation} from './types';
export function receptionWithPending(saved:Consultation|undefined,pending:Consultation|null,sessionId:string|null):Consultation|undefined {
 if(!pending||(sessionId!==null&&sessionId!==pending.id))return saved;
 if(saved&&saved.messages.length>=pending.messages.length)return saved;
 return pending;
}
