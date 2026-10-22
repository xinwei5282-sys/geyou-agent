import {confirmQuoteDeal,recordSalePayment,getSaleSummary,createSettlementSnapshot} from './saleSettlementModel';
import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,finalizeQuote,canAccessSalesRecord,serviceRecordFor,metrics} from './model';
import {createGuidedSale,saveGuidedSale,saveConsultationDetails,setConsultationNeeds} from './guidedSalesModel';
import {savePlannedResult,continuePlannedSale} from './plannedResultModel';
import {associateSalesCustomer} from './salesCustomerModel';
import {visibleConsultations} from './consultationModel';
import {talkReminderEntries} from './talkReminders';
const input={scenario:'hospital' as const,subjectName:'',nickname:'',occupation:'',interests:'',faith:'待确认',region:'杭州',budget:0,notes:''};
function setup(){const state=seedState(),staff=state.staff[0];return {...createGuidedSale(state,staff,input),staff,seed:state};}
function confirm(){const x=setup();let s=setConsultationNeeds(x.state,x.staff,x.session.id,{clothes:'needed'});const plan=s.consultations!.at(-1)!.guided!.plan!;s=saveGuidedSale(s,x.staff,x.session.id,{plan:{...plan,phase:'result',selectedLines:plan.packages[0].lines,followupDate:'2026-10-20',followupNote:'继续沟通',continuation:'continue'}});s=savePlannedResult(s,x.staff,x.session.id,true);const result=finalizeQuote(s,s.consultations!.at(-1)!.proposalId!,x.staff,true);return {...x,state:result.state,quote:result.quote};}
test('empty customer list can start, save, select and quote without creating a customer',()=>{
 const seed=seedState();seed.customers=[];seed.proposals=[];seed.quotes=[];const staff=seed.staff[0];const x=createGuidedSale(seed,staff,input);
 assert.equal(x.session.customerId,undefined);assert.equal(x.state.customers.length,0);
 let state=savePlannedResult(x.state,staff,x.session.id,false);state=JSON.parse(JSON.stringify(state));
 assert.equal(visibleConsultations(state,staff)[0].id,x.session.id);
 state=setConsultationNeeds(state,staff,x.session.id,{clothes:'needed'});const plan=state.consultations![0].guided!.plan!;
 state=saveGuidedSale(state,staff,x.session.id,{plan:{...plan,phase:'result',selectedLines:plan.packages[0].lines}});
 state=savePlannedResult(state,staff,x.session.id,true);const quoted=finalizeQuote(state,state.consultations![0].proposalId!,staff,true);
 assert.equal(quoted.quote.total,98000);assert.equal(quoted.quote.customerId,undefined);assert.equal(quoted.state.customers.length,0);assert.equal(metrics(quoted.state,staff.agencyId).quoteCustomers,0);
});
test('optional contact data stays on consultation and independent starts never share selections',()=>{
 const x=setup();const state=saveConsultationDetails(x.state,x.staff,x.session.id,{...input,nickname:'王女士',phone:'139 1234 5678'});
 assert.deepEqual(state.customers,x.seed.customers);assert.deepEqual(state.consultations!.at(-1)!.contact,{name:'王女士',phone:'13912345678'});
 const other=createGuidedSale(state,x.staff,input);assert.notEqual(other.session.id,x.session.id);assert.deepEqual(other.session.guided!.plan!.needs,{});
});
test('unlinked access is creator or same agency owner, disabled/foreign/staff peers excluded',()=>{
 const state=seedState(),staff=state.staff.find(s=>s.id==='staff-lin')!,x=createGuidedSale(state,staff,input);
 assert.equal(canAccessSalesRecord(x.state,staff,x.session),true);assert.equal(canAccessSalesRecord(x.state,state.staff[0],x.session),true);
 assert.equal(canAccessSalesRecord(x.state,state.staff.find(s=>s.id==='staff-zhou')!,x.session),false);
 assert.equal(canAccessSalesRecord(x.state,state.staff.find(s=>s.agencyId!==staff.agencyId)!,x.session),false);
 const disabled={...x.state,staff:x.state.staff.map(s=>s.id===staff.id?{...s,enabled:false}:s)};assert.equal(canAccessSalesRecord(disabled,staff,x.session),false);
});
test('quote then continue retains standalone ownership, prepared scope and original snapshot',()=>{
 const x=confirm(),snapshot=structuredClone(x.quote),continued=continuePlannedSale(x.state,x.staff,x.session.id);
 assert.equal(continued.session.customerId,undefined);assert.equal(continued.session.guided!.plan!.needs.clothes,'prepared');assert.equal(continued.session.guided!.plan!.selectedLines,undefined);
 assert.equal(continuePlannedSale(continued.state,x.staff,x.session.id).session.id,continued.session.id);assert.deepEqual(continued.state.quotes.at(-1),snapshot);
 const newVisit=createGuidedSale(continued.state,x.staff,input);assert.deepEqual(newVisit.session.guided!.plan!.needs,{});
});
test('explicit association after quoting reuses existing customer, migrates reminder once and keeps quote snapshot',()=>{
 const x=confirm(),continued=continuePlannedSale(x.state,x.staff,x.session.id),before=JSON.stringify(continued.state);
 assert.equal(talkReminderEntries(x.state,x.staff).length,1);
 const next=associateSalesCustomer(continued.state,x.staff,continued.session.id,{customerId:'c1'});
 assert.equal(JSON.stringify(continued.state),before);assert.equal(next.customers.length,x.seed.customers.length);
 assert.ok(next.consultations!.filter(c=>[x.session.id,continued.session.id].includes(c.id)).every(c=>c.customerId==='c1'));
 assert.deepEqual(next.quotes.at(-1),{...x.quote,customerId:'c1'});assert.equal(talkReminderEntries(next,x.staff).length,0);
 assert.equal(serviceRecordFor(next.customers.find(c=>c.id==='c1')!).tasks.length,1);assert.throws(()=>associateSalesCustomer(next,x.staff,x.session.id,{newCustomer:{name:'王女士',phone:''}}),/已关联/);
});
test('new customer requires explicit name, phone remains optional and duplicate phones cannot create another file',()=>{
 const x=setup();assert.throws(()=>associateSalesCustomer(x.state,x.staff,x.session.id,{newCustomer:{name:'',phone:''}}),/称呼/);
 assert.throws(()=>associateSalesCustomer(x.state,x.staff,x.session.id,{newCustomer:{name:'重名测试',phone:x.state.customers[0].phone}}),/已有客户/);
 assert.throws(()=>associateSalesCustomer(x.state,x.staff,x.session.id,{customerId:'c6'}),/权限/);
 const next=associateSalesCustomer(x.state,x.staff,x.session.id,{newCustomer:{name:'只登记称呼',phone:''}});
 assert.equal(next.customers.length,x.seed.customers.length+1);assert.equal(next.customers.at(-1)!.phone,'');assert.equal(next.consultations!.at(-1)!.customerId,next.customers.at(-1)!.id);
});
test('unlinked reminder save is idempotent and invalid dates do not partially save',()=>{
 const x=setup(),plan=x.session.guided!.plan!;let state=saveGuidedSale(x.state,x.staff,x.session.id,{plan:{...plan,followupDate:'2026-02-30',followupNote:'联系'}});
 assert.throws(()=>savePlannedResult(state,x.staff,x.session.id,false),/有效跟进日期/);assert.equal(talkReminderEntries(state,x.staff).length,0);
 state=saveGuidedSale(state,x.staff,x.session.id,{plan:{...plan,followupDate:'2026-10-20',followupNote:'联系'}});state=savePlannedResult(state,x.staff,x.session.id,false);const again=savePlannedResult(state,x.staff,x.session.id,false);
 assert.equal(talkReminderEntries(again,x.staff).length,1);assert.deepEqual(again.customers,x.seed.customers);
});

test('associating an already paid consultation retains payments and settlement scope',()=>{
 const x=confirm();let state=confirmQuoteDeal(x.state,x.staff,x.quote.id,true);state=recordSalePayment(state,x.staff,x.quote.id,{amount:10000,date:'2026-10-21',method:'微信',kind:'订金',note:'未建档前订金',confirmed:true});state=createSettlementSnapshot(state,x.staff,x.quote.id,true);
 const before=getSaleSummary(state,x.staff,x.quote.id);state=associateSalesCustomer(state,x.staff,x.session.id,{customerId:'c1'});const after=getSaleSummary(state,x.staff,x.quote.id);assert.equal(after.paid,before.paid);assert.equal(after.balance,before.balance);assert.equal(after.payments[0].note,'未建档前订金');assert.equal(after.settlements.length,1);assert.notEqual(after.scopeKey,before.scopeKey);
});
