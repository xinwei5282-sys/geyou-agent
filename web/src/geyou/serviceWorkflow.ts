import {isCurrentQuote} from './quoteValidity';
import {noticeMatchesSchedule} from './noticeSchedule';
import {syncNoticeWorkflow} from './serviceAutomation';
import type {AppState,Staff,ServiceTask,Quote} from './types';
import {visibleCustomers,hasStaffModule,canAccessSalesRecord,localDate,serviceRecordFor,updateServiceInfo} from './model';
import {selectedPortrait} from './memorialModel';
import {serviceStages,type ServiceStageId} from './serviceStages';
export type StageProgress=NonNullable<ServiceTask['progress']>;
export type StageInput={progress:StageProgress;assigneeId?:string;scheduledAt?:string;handoverNote?:string};
function subject(s:AppState,staff:Staff,customerId:string,deceasedId:string){
 const actor=s.staff.find(x=>x.id===staff.id&&x.agencyId===staff.agencyId);
 const customer=actor&&actor.enabled!==false?visibleCustomers(s,actor).find(c=>c.id===customerId):undefined;
 if(!customer)throw Error('无权限查看或管理本次服务');
 const deceased=customer.deceased?.find(d=>d.id===deceasedId);if(!deceased)throw Error('请先关联本次服务逝者');
 return {actor:actor!,customer,deceased,service:serviceRecordFor(customer,deceasedId)};
}
export function readServiceWorkflow(s:AppState,staff:Staff,customerId:string,deceasedId:string){
 const {actor,customer,deceased,service}=subject(s,staff,customerId,deceasedId);
 const notices=hasStaffModule(s,actor,'content')?s.notices.filter(n=>n.agencyId===customer.agencyId&&n.customerId===customerId&&n.deceasedId===deceasedId):[];
 const notice=service.activeNoticeId?notices.find(n=>n.id===service.activeNoticeId):notices.at(-1);
 const noticeReady=!!notice&&notice.status==='已发布'&&!!notice.familyConfirmedAt&&!!notice.familyConfirmedBy&&!notice.scheduleReview&&[notice.name,notice.age,notice.date,notice.ceremonyDate,notice.location,notice.text].every(v=>v.trim())&&noticeMatchesSchedule(notice,service);
 const portrait=hasStaffModule(s,actor,'restoration')?selectedPortrait(deceased):undefined;
 const orders=new Map<string,Quote>();
 for(const q of s.quotes){
  if(!isCurrentQuote(s,q)||(!q.dealConfirmedAt&&!q.receipt)||q.customerId!==customerId||q.deceasedId!==deceasedId||q.agencyId!==customer.agencyId||!canAccessSalesRecord(s,actor,q))continue;
  const old=orders.get(q.proposalId);if(!old||q.version>old.version)orders.set(q.proposalId,q);
 }
 const quotes=[...orders.values()];
 const stages=serviceStages.map(stage=>{
  const task=service.tasks.find(t=>t.flowStageId===stage.id)||(stage.id==='notice'?service.tasks.find(t=>t.autoKey==='publish-notice'&&t.status!=='已取消'):undefined);
  let progress:StageProgress=task?.status==='已取消'?'无需办理':task?.status==='已完成'?'已完成':task?.progress||'未开始';
  let needsReview=!!task?.needsReview;
  if(stage.id==='notice'&&hasStaffModule(s,actor,'content')){
   if(noticeReady)progress='已完成';
   else if(progress==='已完成'){progress='进行中';needsReview=true;}
  }
  return {...stage,task,progress,needsReview};
 });
 return {customer,deceased,service,stages,notice,noticeReady,portrait,portraitReady:!!portrait,quotes};
}
const validTime=(v:string)=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))return false;const d=new Date(v);return Number.isFinite(d.getTime())&&localDate(d)===v.slice(0,10)&&d.getHours()===Number(v.slice(11,13))&&d.getMinutes()===Number(v.slice(14,16));};
export function saveServiceStage(s:AppState,staff:Staff,customerId:string,deceasedId:string,stageId:ServiceStageId,input:StageInput):AppState{
 const {actor,customer,deceased,service}=subject(s,staff,customerId,deceasedId),stage=serviceStages.find(x=>x.id===stageId);
 if(!stage)throw Error('服务环节不存在');
 if(!['未开始','进行中','已完成','无需办理'].includes(input.progress))throw Error('环节状态无效');
 if(service.phase==='服务结束')throw Error('请先在档案中恢复服务阶段，再调整环节');
 const assigneeId=input.assigneeId||undefined,scheduledAt=input.scheduledAt||undefined,handoverNote=(input.handoverNote||'').trim();
 if(assigneeId){const member=s.staff.find(x=>x.id===assigneeId&&x.agencyId===actor.agencyId&&x.enabled!==false);if(!member||!visibleCustomers(s,member).some(c=>c.id===customerId))throw Error('负责人无权限访问该客户');}
 if(scheduledAt&&!validTime(scheduledAt))throw Error('请填写有效预约时间');
 if(handoverNote.length>1000)throw Error('交接记录请控制在1000字以内');
 if(['已完成','无需办理'].includes(input.progress)&&!assigneeId)throw Error('请指定本店负责人');
 if(['已完成','无需办理'].includes(input.progress)&&!handoverNote)throw Error('请填写完成情况或无需办理的交接说明');
 if(stageId==='notice'&&readServiceWorkflow(s,actor,customerId,deceasedId).noticeReady&&input.progress!=='已完成')throw Error('讣告已发布，环节状态以实际发布记录为准');
 if(stageId==='notice'&&input.progress==='已完成'&&!readServiceWorkflow(s,actor,customerId,deceasedId).noticeReady)throw Error('请先完成家属确认并发布对应讣告');
 const previous=service.tasks.find(x=>x.flowStageId===stageId)||(stageId==='notice'?service.tasks.find(t=>t.autoKey==='publish-notice'&&t.status!=='已取消'):undefined),now=new Date().toISOString();
 if(previous&&previous.progress===input.progress&&previous.assigneeId===assigneeId&&previous.scheduledAt===scheduledAt&&previous.handoverNote===handoverNote&&!previous.needsReview)return s;
 const complete=input.progress==='已完成';
 const task:ServiceTask={...previous,id:previous?.id||`flow-${crypto.randomUUID()}`,flowStageId:stageId,deceasedId,progress:input.progress,assigneeId,scheduledAt,remindAt:scheduledAt,date:scheduledAt?.slice(0,10)||'',title:stage.title,items:handoverNote||stage.brief,message:'内部服务进度，请核对后交接。',internal:true,handoverNote,status:complete?'已完成':input.progress==='无需办理'?'已取消':'待确认',completedAt:complete?(previous?.completedAt||now):undefined,completedBy:complete?actor.id:undefined,needsReview:undefined,createdAt:previous?.createdAt||now,updatedAt:now};
 const nextService={...service,tasks:previous?service.tasks.map(x=>x.id===previous.id?task:x):[...service.tasks,task]};
 let next:AppState={...s,customers:s.customers.map(c=>c.id===customerId?{...c,deceased:c.deceased!.map(d=>d.id===deceased.id?{...d,service:nextService}:d),followups:[...c.followups,{id:`flow-log-${crypto.randomUUID()}`,at:now,staffId:actor.id,text:`${deceased.name} · ${stage.title}：${input.progress}${scheduledAt?`，预约 ${scheduledAt.replace('T',' ')}`:''}${handoverNote?`；${handoverNote}`:''}`}]} :c)};
 if(scheduledAt&&(stageId==='farewell'||stageId==='burial')){
  next=updateServiceInfo(next,customerId,actor,{dates:{[stageId==='farewell'?'farewell':'burial']:scheduledAt.slice(0,10)}},deceasedId);
  // This appointment was explicitly checked in this save; other arrangements still need review.
  next={...next,customers:next.customers.map(c=>c.id===customerId?{...c,deceased:c.deceased!.map(d=>d.id===deceasedId?{...d,service:{...d.service!,tasks:d.service!.tasks.map(t=>t.id===task.id?{...t,needsReview:undefined}:t)}}:d)}:c)};
 }
 if(stageId==='farewell'&&scheduledAt){
  const serviceNow=next.customers.find(c=>c.id===customerId)!.deceased!.find(d=>d.id===deceasedId)!.service!;
  for(const notice of next.notices.filter(n=>n.agencyId===customer.agencyId&&n.customerId===customerId&&n.deceasedId===deceasedId&&n.status==='已发布'&&!noticeMatchesSchedule(n,serviceNow))){
   const changed={...notice,scheduleReview:'告别预约时间已调整，请与家属重新核对讣告时间后发布。'};
   next={...next,notices:next.notices.map(n=>n.id===notice.id?changed:n)};
   next=syncNoticeWorkflow(next,changed);
  }
 }
 return next;
}
