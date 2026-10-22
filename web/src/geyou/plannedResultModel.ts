import type { AppState, Staff, ServiceTask } from './types';
import { now, id, consultationRootId, canAccessSalesRecord, saveServiceTask, serviceRecordFor } from './model';
import { createGuidedSale, guidedSaleProposal, saveGuidedSale } from './guidedSalesModel';

// Save an optional reminder and the selection together, so a failed confirmation
// cannot leave a partial reminder or a duplicate proposal behind.
export function savePlannedResult(state:AppState,staff:Staff,sessionId:string,confirm:boolean):AppState {
  let next=saveGuidedSale(state,staff,sessionId,{});
  const session=next.consultations!.find(c=>c.id===sessionId)!;
  const plan=session.guided?.plan;
  if(!plan)throw Error('未找到本次咨询方案');
  if(plan.outcome==='confirmed')return next;
  if(plan.continuation!=='none'&&plan.followupDate!==undefined&&!plan.followupTaskId){
    if(!plan.followupDate||!plan.followupNote?.trim())throw Error('请补充跟进日期和事项，或取消添加待办');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(plan.followupDate)||!Number.isFinite(Date.parse(plan.followupDate))||new Date(plan.followupDate).toISOString().slice(0,10)!==plan.followupDate)throw Error('请填写有效跟进日期');
    if(session.customerId){
      next=saveServiceTask(next,session.customerId,staff,{title:'咨询后续跟进',date:plan.followupDate,items:plan.followupNote,message:plan.followupNote,internal:true},session.deceasedId);
      const customer=next.customers.find(c=>c.id===session.customerId)!;
      const task=serviceRecordFor(customer,session.deceasedId).tasks.at(-1)!;
      next=saveGuidedSale(next,staff,sessionId,{plan:{...plan,followupTaskId:task.id}});
    }else{
      const task:ServiceTask={id:id('talk-followup'),title:'谈单后续跟进',date:plan.followupDate,items:plan.followupNote.trim(),message:'',internal:true,status:'待确认',createdAt:now(),updatedAt:now()};
      next=saveGuidedSale(next,staff,sessionId,{plan:{...plan,followupTaskId:task.id,followupTask:task}});
    }
  }
  if(confirm)next=guidedSaleProposal(next,staff,sessionId).state;
  return {...next,customers:next.customers.map(c=>c.id===session.customerId?{...c,contactFollowupDoneAt:now()}:c)};
}

export function continuePlannedSale(state:AppState,staff:Staff,sessionId:string){
  const checked=saveGuidedSale(state,staff,sessionId,{});
  const previous=checked.consultations!.find(c=>c.id===sessionId)!;
  const guided=previous.guided!;
  if(guided.plan?.outcome!=='confirmed')throw Error('请先完成本次选择，未确认的谈单可直接继续');
  const unfinished=checked.consultations!.find(c=>canAccessSalesRecord(checked,staff,c)&&c.customerId===previous.customerId&&c.deceasedId===previous.deceasedId&&c.guided?.plan?.continuedFrom===sessionId&&c.guided.plan.outcome!=='confirmed');
  if(unfinished)return {state:checked,session:unfinished};
  const created=createGuidedSale(checked,staff,{scenario:guided.scenario,subjectName:guided.subjectName,subjectGender:guided.subjectGender,subjectAge:guided.subjectAge,customs:guided.customs,occupation:guided.occupation,interests:guided.interests,faith:guided.faith,region:guided.region,budget:0,notes:'',serviceAddress:guided.serviceAddress,reservationTime:guided.reservationTime,familySupplies:guided.familySupplies,nickname:previous.contact?.name||'',phone:previous.contact?.phone,customerId:previous.customerId,deceasedId:previous.deceasedId});
  const prepared={...created.session.guided!.plan!.needs};
  if(!previous.customerId)for(const record of checked.consultations!.filter(c=>consultationRootId(checked,c)===consultationRootId(checked,previous)&&c.guided?.plan?.outcome==='confirmed'))for(const [key,value] of Object.entries(record.guided!.plan!.needs))if(value==='needed'||value==='prepared')prepared[key as keyof typeof prepared]='prepared';
  const plan={...created.session.guided!.plan!,needs:prepared,phase:'packages' as const,processPosition:guided.plan.processPosition,continuedFrom:sessionId};
  const next=saveGuidedSale(created.state,staff,created.session.id,{plan});
  return {state:next,session:next.consultations!.find(c=>c.id===created.session.id)!};
}
