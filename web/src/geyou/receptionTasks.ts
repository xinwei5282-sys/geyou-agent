import type {AppState,Consultation,Staff} from './types';
import {canAccessSalesRecord,saveServiceTask,serviceRecordFor,visibleCustomers,validReminderTime} from './model';
import {backfillReceptionProfile} from './receptionArchiveModel';
export type ReceptionTaskDraft={suggestion:string;source:'reply'|'summary';title:string;assigneeId:string;remindAt:string};
export function receptionTaskFor(state:AppState,session:Consultation,suggestion:string){
 const customer=state.customers.find(c=>c.id===session.customerId&&c.agencyId===session.agencyId);if(!customer||(session.deceasedId&&!customer.deceased?.some(d=>d.id===session.deceasedId)))return undefined;
 const tasks=serviceRecordFor(customer,session.deceasedId).tasks;
 return tasks.find(t=>t.receptionSource?.sessionId===session.id&&t.receptionSource.suggestion===suggestion)||tasks.filter(t=>!['已完成','已取消'].includes(t.status)&&t.title.trim().length>=4&&suggestion.includes(t.title.trim())).sort((a,b)=>b.title.length-a.title.length)[0];
}
export function receptionTaskAssignees(state:AppState,staff:Staff,customerId?:string){return state.staff.filter(member=>member.agencyId===staff.agencyId&&member.enabled!==false&&(staff.role==='老板'||member.id===staff.id)&&(customerId?visibleCustomers(state,member).some(c=>c.id===customerId):member.role==='老板'||member.id===staff.id));}
export function saveReceptionTask(state:AppState,staff:Staff,sessionId:string,input:ReceptionTaskDraft):AppState{
 const session=state.consultations?.find(c=>c.id===sessionId);if(!session||!canAccessSalesRecord(state,staff,session))throw Error('无权限处理本次接待');
 if(session.ai?.simulation)throw Error('预设案例不能创建真实待办');
 const last=session.messages.filter(m=>m.role==='assistant').at(-1);
 if(last?.replyScope==='reference')throw Error('参考咨询不能加入当前客户待办，请先切换客户');
 const suggestions=input.source==='summary'?session.ai?.summary?.nextActions:last?.todos;
 if(!suggestions?.includes(input.suggestion))throw Error('接待建议已更新，请重新选择');
 if(!input.title.trim()||input.title.trim().length>200)throw Error('请填写待办事项，最多200字');
 if(!validReminderTime(input.remindAt))throw Error('请确认有效的提醒时间');
 if(!receptionTaskAssignees(state,staff,session.customerId).some(m=>m.id===input.assigneeId))throw Error('请选择有权访问客户的负责人');
 if(receptionTaskFor(state,session,input.suggestion))return state;
 // Manual confirmation also links an unfiled lead; it never writes reference advice.
 const linked=session.customerId?state:backfillReceptionProfile(state,staff,sessionId,{scenario:session.guided?.scenario||'advance'});
 const record=linked.consultations!.find(c=>c.id===sessionId)!;if(!record.customerId)throw Error('请先关联客户档案');
 return saveServiceTask(linked,record.customerId,staff,{title:input.title,date:input.remindAt.slice(0,10),items:input.suggestion,message:'内部待办，由业务员人工确认；联系家属前核对当前安排和方便联系的时间。',internal:true,assigneeId:input.assigneeId,remindAt:input.remindAt,receptionSource:{sessionId,suggestion:input.suggestion}},record.deceasedId);
}
