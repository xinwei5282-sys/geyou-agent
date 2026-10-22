import {saleScope} from './saleScope';
import type { AppState, Customer, Staff } from './types';
import { canAccessSalesRecord, consultationRootId, hasStaffModule, id, normalizePhone, now, serviceRecordFor, visibleCustomers } from './model';

export type SalesCustomerTarget={customerId:string}|{newCustomer:{name:string;phone:string;region?:string}};
/** Association is explicit, including after confirmation. Quote contents stay unchanged. */
export function associateSalesCustomer(state:AppState,staff:Staff,sessionId:string,target:SalesCustomerTarget):AppState{
 const session=state.consultations?.find(c=>c.id===sessionId&&canAccessSalesRecord(state,staff,c));
 if(!session?.guided||!hasStaffModule(state,staff,'customers'))throw Error('无权限关联客户');
 if(session.customerId)throw Error('本次谈单已关联客户，请使用现有档案');
 const root=consultationRootId(state,session);
 const related=state.consultations!.filter(c=>consultationRootId(state,c)===root);
 if(related.some(c=>!canAccessSalesRecord(state,staff,c)))throw Error('无权限关联续谈记录');
 let customer:Customer|undefined;
 if('customerId' in target){
  customer=visibleCustomers(state,staff).find(c=>c.id===target.customerId);
  if(!customer)throw Error('请选择有权限的已有客户');
 }else{
  const name=target.newCustomer.name.trim(),phone=normalizePhone(target.newCustomer.phone);
  if(!name)throw Error('新建客户请填写称呼；也可以取消，保持未关联');
  if(phone&&!/^\+?[0-9]{6,20}$/.test(phone))throw Error('请填写有效手机号，或留空');
  if(phone&&state.customers.some(c=>c.agencyId===staff.agencyId&&normalizePhone(c.phone)===phone))throw Error('此电话已有客户档案，请选择已有客户；无查看权限时联系负责人');
  customer={id:id('customer'),agencyId:staff.agencyId,ownerId:staff.id,name,phone,region:target.newCustomer.region?.trim()||session.guided.region||state.agencies.find(a=>a.id===staff.agencyId)?.region||'',budget:session.guided.budget,source:'谈单建档',stage:'跟进中',note:session.guided.notes,createdAt:now(),followups:[]};
 }
 if(related.some(c=>c.customerId&&c.customerId!==customer!.id))throw Error('续谈记录已关联另一客户，请先核对');
 const ids=new Set(related.map(c=>c.id));
 const tasks=related.flatMap(c=>c.guided?.plan?.followupTask?[c.guided.plan.followupTask]:[]);
 if(tasks.length){const service=serviceRecordFor(customer);customer={...customer,service:{...service,tasks:[...service.tasks,...tasks.filter(t=>!service.tasks.some(x=>x.id===t.id))]}};}
 const linked=customer;
 const proposalIds=new Set(state.proposals.filter(p=>p.consultationId&&ids.has(p.consultationId)).map(p=>p.id));
 const next:AppState={...state,
  customers:state.customers.some(c=>c.id===linked.id)?state.customers.map(c=>c.id===linked.id?linked:c):[...state.customers,linked],
  consultations:state.consultations!.map(c=>ids.has(c.id)?{...c,customerId:linked.id,updatedAt:now(),guided:c.guided?.plan?{...c.guided,plan:{...c.guided.plan,followupTask:undefined}}:c.guided}:c),
  proposals:state.proposals.map(p=>proposalIds.has(p.id)?{...p,customerId:linked.id}:p),
  quotes:state.quotes.map(q=>proposalIds.has(q.proposalId)?{...q,customerId:linked.id}:q),
 };
 const scopes=new Map(state.quotes.filter(q=>proposalIds.has(q.proposalId)).map(q=>[saleScope(state,q),saleScope(next,next.quotes.find(n=>n.id===q.id)!)]));
 return {...next,salePayments:next.salePayments?.map(p=>({...p,scopeKey:scopes.get(p.scopeKey)||p.scopeKey})),saleSettlements:next.saleSettlements?.map(s=>({...s,scopeKey:scopes.get(s.scopeKey)||s.scopeKey}))};
}
