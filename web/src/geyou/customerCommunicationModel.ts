import {associateSalesCustomer} from './salesCustomerModel';
import type {AppState,Consultation,Staff} from './types';
import {canAccessSalesRecord,visibleCustomers,now} from './model';
import {createGuidedSale} from './guidedSalesModel';

export function customerConversations(state:AppState,staff:Staff,customerId:string){
 return (state.consultations||[]).filter(c=>c.customerId===customerId&&c.guided&&!c.ai?.simulation&&canAccessSalesRecord(state,staff,c)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.createdAt.localeCompare(a.createdAt));
}
// undefined means latest service; null explicitly selects customer matters without a deceased.
export function findCustomerConversation(state:AppState,staff:Staff,customerId:string,deceasedId?:string|null){
 return customerConversations(state,staff,customerId).find(c=>deceasedId===undefined||c.deceasedId===(deceasedId||undefined));
}
export function openCustomerConversation(state:AppState,staff:Staff,customerId:string,deceasedId?:string|null){
 const customer=visibleCustomers(state,staff).find(c=>c.id===customerId);if(!customer)throw Error('无权限访问该客户沟通');
 if(deceasedId&&!customer.deceased?.some(d=>d.id===deceasedId))throw Error('当前服务对象不存在，请重新选择');
 const existing=findCustomerConversation(state,staff,customerId,deceasedId);
 if(existing)return {state,session:existing};
 const person=customer.deceased?.find(d=>d.id===deceasedId);
 return createGuidedSale(state,staff,{customerId,deceasedId:deceasedId||undefined,nickname:customer.name,phone:customer.phone,scenario:customer.receptionProfile?.scenario||'advance',subjectName:person?.name||'',occupation:'',interests:'',faith:'待确认',region:customer.region,budget:0,notes:''});
}
export function communicationMessages(state:AppState,staff:Staff,session:Consultation){
 if(!canAccessSalesRecord(state,staff,session))return [];
 const saved=session.customerId&&!session.ai?.simulation?(state.consultations||[]).filter(c=>c.customerId===session.customerId&&!c.ai?.simulation&&canAccessSalesRecord(state,staff,c)):[session];
 const records=saved.some(c=>c.id===session.id)?saved.map(c=>c.id===session.id?session:c):[...saved,session];
 return records.flatMap(c=>c.messages.map((message,index)=>({message,index,sessionId:c.id,deceasedId:c.deceasedId,label:state.customers.find(customer=>customer.id===c.customerId)?.deceased?.find(d=>d.id===c.deceasedId)?.name||c.guided?.subjectName||'客户事项',time:message.at||new Date(new Date(c.createdAt).getTime()+index).toISOString()}))).sort((a,b)=>a.time.localeCompare(b.time)||a.sessionId.localeCompare(b.sessionId)||a.index-b.index);
}
export function appendConfirmedConversation(state:AppState,staff:Staff,sessionId:string,messages:Consultation['messages'],reply:{reply:string;scope?:string;quickReplies?:string[];todos?:string[];upsellTips?:string[]}){
 const record=state.consultations?.find(c=>c.id===sessionId&&canAccessSalesRecord(state,staff,c));if(!record?.guided||record.guided.plan?.outcome!=='confirmed')throw Error('当前沟通不是已确认清单');
 return {...state,consultations:state.consultations!.map(c=>c.id===record.id?{...c,messages:[...messages,{role:'assistant' as const,text:reply.reply.slice(0,2000),at:now(),replyScope:reply.scope==='reference'?'reference' as const:'current' as const,quickReplies:reply.quickReplies,todos:reply.todos,upsellTips:reply.upsellTips}],updatedAt:now()}:c)};
}

export function selectCustomerConversation(state:AppState,staff:Staff,customerId:string,current?:Consultation){
 if(current&&!current.customerId&&current.messages.length&&!current.ai?.simulation){
  const next=associateSalesCustomer(state,staff,current.id,{customerId});
  return {state:next,session:next.consultations!.find(c=>c.id===current.id)!};
 }
 return openCustomerConversation(state,staff,customerId);
}
