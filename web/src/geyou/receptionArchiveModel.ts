import type {AppState, Staff, ReceptionProfile, Customer} from './types';
import {validateReceptionSummary} from './receptionSummary';
import {canAccessSalesRecord, hasStaffModule, visibleCustomers, id, now} from './model';

// Archive only structured facts returned by the model, never raw dialogue or defaults.
export function backfillReceptionProfile(state:AppState,staff:Staff,sessionId:string,patch:Record<string,unknown>):AppState {
 const session=state.consultations?.find(c=>c.id===sessionId);
 if(!session||session.ai?.simulation||!canAccessSalesRecord(state,staff,session)||!hasStaffModule(state,staff,'customers'))return state;
 const facts:Partial<ReceptionProfile>={};
 const summary=validateReceptionSummary(patch.summary);if(summary)facts.summary=summary;
 for(const key of ['subjectName','subjectGender','subjectAge','customs','occupation','interests','faith','region','category'] as const){
  const value=patch[key];if(typeof value!=='string')continue;const trimmed=value.trim();if(trimmed&&!/^(待确认|未知|不清楚|未了解)$/.test(trimmed))facts[key]=trimmed.slice(0,300);else if(session.customerId&&state.customers.find(c=>c.id===session.customerId)?.receptionProfile?.[key]!==undefined&&(trimmed===''||(key==='faith'&&trimmed==='待确认')))facts[key]=trimmed;
 }
 if(typeof patch.budget==='number'&&Number.isSafeInteger(patch.budget)&&patch.budget>=0&&patch.budget<=10000000000)facts.budget=patch.budget;
 if(['advance','hospital','home'].includes(String(patch.scenario)))facts.scenario=patch.scenario as ReceptionProfile['scenario'];
 if(!Object.keys(facts).length)return state;
 let customer=session.customerId?visibleCustomers(state,staff).find(c=>c.id===session.customerId):undefined;
 if(session.customerId&&!customer)return state;
 if(!customer)customer={id:id('customer'),agencyId:session.agencyId,ownerId:session.staffId,name:session.contact?.name&&session.contact.name!=='新咨询'?session.contact.name:'新线索 · 待补充',phone:session.contact?.phone||'',region:'',budget:0,stage:'待跟进',source:'智能接待',note:'',createdAt:now(),followups:[]};
 const updated:Customer={...customer,...(facts.region?{region:facts.region}:{}),receptionProfile:{...customer.receptionProfile,...facts,updatedAt:now(),consultationId:session.id}};
 // A product-specific budget stays in receptionProfile; never overwrite an overall budget.
 return {...state,customers:state.customers.some(c=>c.id===customer.id)?state.customers.map(c=>c.id===customer.id?updated:c):[...state.customers,updated],consultations:state.consultations!.map(c=>c.id===session.id?{...c,customerId:customer.id}:c)};
}
