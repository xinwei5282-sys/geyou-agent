import {noticeMatchesSchedule} from './noticeSchedule';
import type {AppState, Customer, Notice, ServiceRecord, ServiceTask, ServiceTaskKey} from './types';
const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const iso=()=>new Date().toISOString();
const noticeReady=(n:Notice)=>[n.name,n.age,n.date,n.ceremonyDate,n.location,n.text].every(v=>v.trim());
const titles:Record<ServiceTaskKey,string>={'verify-profile':'核对逝者资料','prepare-portrait':'准备遗照','draft-notice':'制作讣告','confirm-notice':'家属确认讣告','publish-notice':'发布讣告',farewell:'告别仪式安排'};
export function reconcileService(s:AppState,customer:Customer,deceasedId:string,service:ServiceRecord):ServiceRecord {
 const deceased=customer.deceased?.find(d=>d.id===deceasedId);if(!deceased)return service;
 const tasks=service.tasks.map(t=>({...t}));
 const keys:ServiceTaskKey[]=[];
 if(service.phase==='治丧筹备')keys.push('verify-profile','prepare-portrait','draft-notice');
 if(service.dates.farewell&&service.phase!=='服务结束')keys.push('confirm-notice','publish-notice','farewell');
 for(const key of keys){if(tasks.some(t=>t.autoKey===key))continue;
 const date=['confirm-notice','publish-notice','farewell'].includes(key)?service.dates.farewell!:localDay();
 tasks.push({id:`service-${crypto.randomUUID()}`,deceasedId,autoKey:key,internal:key!=='farewell',title:titles[key],date,items:`${deceased.name}：${titles[key]}。请核对具体时间及内容。`,message:key==='farewell'?`您好，${deceased.name}的告别安排请与服务人员核对时间、地点及流程。`:'内部工作待办，不向家属自动发送。',status:'待确认',createdAt:iso(),updatedAt:iso()});
 }
 const notices=s.notices.filter(n=>n.customerId===customer.id&&n.deceasedId===deceasedId&&n.agencyId===customer.agencyId);
 const activeId=service.activeNoticeId;
 const active=activeId?notices.find(n=>n.id===activeId):notices.at(-1);
 const draft=active&&active.status!=='已撤回'&&noticeReady(active)?active:undefined;
 const published=active&&active.status==='已发布'&&active.familyConfirmedAt&&!active.scheduleReview&&noticeMatchesSchedule(active,service)?active:undefined;
 const adopted=deceased.portraits.some(r=>r.id===deceased.selectedPortraitId&&r.confirmedAt&&(r.selectedSource==='original'||(r.selectedSource==='result'&&r.result&&r.status==='已完成')));
 for(const task of tasks){
  if(task.flowStageId==='notice'){
   if(published){task.status='已完成';task.progress='已完成';task.completedAt ||= published.familyConfirmedAt||iso();task.completedBy ||= published.familyConfirmedBy;task.needsReview=undefined;task.noticeId=published.id;}
   else if(task.status==='已完成'){task.status='待确认';task.progress='进行中';task.needsReview='讣告已撤回或安排有变化，请重新核对';task.updatedAt=iso();}
   continue;
  }
  if(!task.autoKey||task.status==='已取消'||!['prepare-portrait','draft-notice','confirm-notice','publish-notice'].includes(task.autoKey))continue;
  if(['draft-notice','confirm-notice','publish-notice'].includes(task.autoKey))task.noticeId=active?.id;
  const evidence=task.autoKey==='prepare-portrait'?adopted:task.autoKey==='draft-notice'?draft:published;
  if(evidence){task.status='已完成';task.completedAt ||= iso();if(typeof evidence==='object')task.noticeId=evidence.id;if(published&&['confirm-notice','publish-notice'].includes(task.autoKey))task.needsReview=undefined;}
  else if(task.status==='已完成'){task.status='待确认';task.completedAt=undefined;task.updatedAt=iso();}
 }
 return {...service,activeNoticeId:activeId||active?.id,tasks};
}
export function validateNoticePublication(s:AppState,n:Notice){
 if(!n.familyConfirmedAt||!n.familyConfirmedBy)throw Error('请先确认已向家属核对本次讣告内容');
 const customer=s.customers.find(c=>c.id===n.customerId&&c.agencyId===n.agencyId),deceased=customer?.deceased?.find(d=>d.id===n.deceasedId);
 if(!deceased)throw Error('请先关联客户及逝者');
 const farewell=deceased.service?.dates.farewell;
 if(!farewell)throw Error('请先确认同步告别日期到服务安排，再发布讣告');
 if(farewell&&!noticeMatchesSchedule(n,deceased!.service!))throw Error('讣告与服务档案的告别日期或时间不一致，请先核对修改');
}
export function syncNoticeWorkflow(s:AppState,n:Notice,makeActive=false):AppState {
 const customer=s.customers.find(c=>c.id===n.customerId&&c.agencyId===n.agencyId),person=customer?.deceased?.find(d=>d.id===n.deceasedId);
 if(!customer||!person)return s;
 let service:ServiceRecord=person.service||{phase:'接洽登记',dates:{},tasks:[]};
 if(makeActive&&n.status!=='已撤回'&&s.notices.some(x=>x.id===n.id&&x.customerId===customer.id&&x.deceasedId===person.id))service={...service,activeNoticeId:n.id};
 service=reconcileService(s,customer,person.id,service);
 return {...s,customers:s.customers.map(c=>c.id===customer.id?{...c,deceased:c.deceased!.map(d=>d.id===person.id?{...d,service}:d)}:c)};
}
