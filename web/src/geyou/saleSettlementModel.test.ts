import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,finalizeQuote} from './model';
import {confirmSaleAndQuote,confirmQuoteDeal,getSaleSummary,createSettlementSnapshot} from './saleSettlementModel';

function setup(){const state=seedState(),staff=state.staff[0];state.proposals.push({...state.proposals[0],id:'first',customerId:'c1',staffId:staff.id,status:'待客户确认',lines:state.proposals[0].lines.slice(0,1)});return {state,staff};}
test('each confirmed purchase has a quotation; a repeated confirmation is not a second sale',()=>{
 const {state,staff}=setup();assert.throws(()=>confirmSaleAndQuote(state,'first',staff,false),/确认/);
 const first=confirmSaleAndQuote(state,'first',staff,true);assert.ok(first.quote.dealConfirmedAt);assert.equal(first.state.customers[0].stage,'已成交');assert.equal(first.quote.receipt,undefined);
 const repeated=confirmSaleAndQuote(first.state,'first',staff,true);assert.equal(repeated.quote.id,first.quote.id);assert.equal(repeated.state.quotes.length,first.state.quotes.length);
});
test('additional purchases are summed once per order; amendments replace only the same order version',()=>{
 const {state,staff}=setup();let result=confirmSaleAndQuote(state,'first',staff,true),next=result.state;
 next={...next,proposals:[...next.proposals,{...next.proposals.find(p=>p.id==='first')!,id:'additional',status:'待客户确认',confirmedAt:undefined,lines:[{...next.proposals[0].lines[1],quantity:2}]}]};
 const second=confirmSaleAndQuote(next,'additional',staff,true);next=second.state;
 assert.equal(getSaleSummary(next,staff,result.quote.id).total,result.quote.total+second.quote.total);
 const originalTotal=result.quote.total;
 next={...next,proposals:next.proposals.map(p=>p.id==='first'?{...p,status:'待客户确认',lines:p.lines.map(l=>({...l,quantity:2}))}:p)};
 const revised=confirmSaleAndQuote(next,'first',staff,true);const summary=getSaleSummary(revised.state,staff,result.quote.id);
 assert.equal(summary.quotes.length,2);assert.equal(summary.total,revised.quote.total+second.quote.total);assert.equal(revised.state.quotes.find(q=>q.id===result.quote.id)?.total,originalTotal);
 assert.equal(summary.balance,summary.total);
});
test('unconfirmed quotes, other customers and other deceased are excluded, and access is enforced',()=>{
 const {state,staff}=setup();const quoted=finalizeQuote(state,'first',staff,true);assert.equal(getSaleSummary(quoted.state,staff,quoted.quote.id).quotes.length,0);
 let next=confirmQuoteDeal(quoted.state,staff,quoted.quote.id,true);const sale=next.quotes.find(q=>q.id===quoted.quote.id)!;
 next={...next,quotes:[...next.quotes,{...sale,id:'foreign',agencyId:'agency-b',proposalId:'foreign',total:999},{...sale,id:'other-subject',deceasedId:'d2',proposalId:'another',total:999},{...sale,id:'other-family',customerId:'c2',proposalId:'another-family',total:999}]};
 assert.equal(getSaleSummary(next,staff,sale.id).quotes.length,1);assert.throws(()=>getSaleSummary(next,next.staff.find(s=>s.id==='boss-b')!,sale.id),/权限/);
});
test('settlement confirmation stores an immutable snapshot and requires a fresh check after an additional purchase',()=>{
 const {state,staff}=setup();const first=confirmSaleAndQuote(state,'first',staff,true);assert.throws(()=>createSettlementSnapshot(first.state,staff,first.quote.id,false),/核对/);
 const settled=createSettlementSnapshot(first.state,staff,first.quote.id,true),summary=getSaleSummary(settled,staff,first.quote.id);
 assert.equal(summary.settlements.length,1);assert.equal(summary.changed,false);assert.equal(createSettlementSnapshot(settled,staff,first.quote.id,true),settled);assert.equal(settled.quotes.find(q=>q.id===first.quote.id)?.receipt,undefined);
 const extra={...settled,proposals:[...settled.proposals,{...settled.proposals.find(p=>p.id==='first')!,id:'more',status:'待客户确认' as const,confirmedAt:undefined}]};const second=confirmSaleAndQuote(extra,'more',staff,true);
 assert.equal(getSaleSummary(second.state,staff,first.quote.id).changed,true);
 const final=createSettlementSnapshot(second.state,staff,first.quote.id,true);const records=getSaleSummary(final,staff,first.quote.id).settlements;
 assert.equal(records.length,2);assert.equal(records[0].version,2);assert.equal(records[1].total,first.quote.total);
});
test('recorded receipts reduce the remaining settlement without reporting automatic payment',()=>{
 const {state,staff}=setup();const first=confirmSaleAndQuote(state,'first',staff,true);const amount=first.quote.total;
 const next={...first.state,quotes:first.state.quotes.map(q=>q.id===first.quote.id?{...q,receipt:{amount,recordedAt:new Date().toISOString(),recordedBy:staff.id,recorderName:staff.name,payeeName:'测试',note:''}}:q)};
 const summary=getSaleSummary(next,staff,first.quote.id);assert.equal(summary.paid,amount);assert.equal(summary.balance,0);
});

test('deposit and final balance use integer cents, require manual confirmation and preserve settlement snapshots',async()=>{
 const {recordSalePayment}=await import('./saleSettlementModel');const {state,staff}=setup();const first=confirmSaleAndQuote(state,'first',staff,true);
 const input={amount:50000,date:'2026-10-14',method:'微信' as const,kind:'订金' as const,note:'已核实订金',confirmed:true,requestId:'deposit-1'};
 assert.throws(()=>recordSalePayment(first.state,staff,first.quote.id,{...input,confirmed:false}),/核实/);
 assert.throws(()=>recordSalePayment(first.state,staff,first.quote.id,{...input,amount:0.5}),/金额/);
 const deposited=recordSalePayment(first.state,staff,first.quote.id,input);assert.equal(getSaleSummary(deposited,staff,first.quote.id).paid,50000);
 assert.equal(recordSalePayment(deposited,staff,first.quote.id,input),deposited);
 const settled=createSettlementSnapshot(deposited,staff,first.quote.id,true);const balance=first.quote.total-50000;
 assert.throws(()=>recordSalePayment(settled,staff,first.quote.id,{...input,requestId:'balance-1',amount:balance+1}),/金额/);
 const paid=recordSalePayment(settled,staff,first.quote.id,{...input,requestId:'balance-1',kind:'尾款',method:'现金',amount:balance});
 const summary=getSaleSummary(paid,staff,first.quote.id);assert.equal(summary.balance,0);assert.equal(summary.changed,true);assert.equal(summary.settlements[0].paid,50000);
 assert.equal(paid.customers[0].stage,'已成交');assert.equal(paid.quotes.find(q=>q.id===first.quote.id)?.receipt,undefined);
});
