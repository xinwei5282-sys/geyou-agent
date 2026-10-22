import {isCurrentQuote} from './quoteValidity';
import {saleScope,serviceHasPayments} from './saleScope';
import type {AppState,Quote,Staff} from './types';
import {calculateTotal,canAccessSalesRecord,consultationRootId,finalizeQuote,id,now,setServiceDeal} from './model';

export type SalePayment={requestId?:string;id:string;scopeKey:string;amount:number;date:string;method:'微信'|'支付宝'|'现金';kind:'订金'|'增补款'|'尾款';note:string;recordedAt:string;recordedBy:string};
export type SaleSettlement={id:string;scopeKey:string;number:string;version:number;quoteIds:string[];total:number;paid:number;balance:number;confirmedAt:string;confirmedBy:string;lines:{quoteNumber:string;quoteVersion:number;name:string;quantity:number;unit:string;price:number;spec?:string;note?:string}[]};

function accessibleQuote(state:AppState,staff:Staff,quoteId:string){
 const quote=state.quotes.find(q=>q.id===quoteId);
 if(!quote||!canAccessSalesRecord(state,staff,quote))throw Error('无权限查看本次成交与结算');
 return quote;
}
const scopeFor=saleScope;
function sumAmounts(amounts:number[]){return amounts.reduce((sum,amount)=>{if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(sum+amount))throw Error('金额记录异常，请核对');return sum+amount},0)}

// Explicit confirmation creates one deal quotation, never a payment or a forced service-stage transition.
export function confirmQuoteDeal(state:AppState,staff:Staff,quoteId:string,confirmed:boolean):AppState{
 const quote=accessibleQuote(state,staff,quoteId);
 if(!confirmed)throw Error('请先与家属确认本次成交项目和金额');
 if(!isCurrentQuote(state,quote))throw Error('请使用最新有效报价确认成交');
 if(quote.dealConfirmedAt)return state;
 if(calculateTotal(quote.lines)!==quote.total)throw Error('报价金额与项目不一致，请重新核对');
 const at=now();
 let next:AppState={...state,quotes:state.quotes.map(q=>q.id===quote.id?{...q,dealConfirmedAt:at,dealConfirmedBy:staff.id}:q)};
 const customer=next.customers.find(c=>c.id===quote.customerId);
 if(customer&&quote.deceasedId){next=setServiceDeal(next,customer.id,quote.deceasedId,staff,'已成交')}
 else if(customer){next={...next,customers:next.customers.map(c=>c.id===customer.id?{...c,stage:'已成交',dealtAt:c.dealtAt||at,dealtBy:c.dealtBy||staff.id,followups:[...c.followups,{id:id('deal-note'),at,staffId:staff.id,text:`本次成交已确认：${quote.number} · V${quote.version}，报价 ${quote.total/100} 元。`}]}:c)}}
 return next;
}
export function confirmSaleAndQuote(state:AppState,proposalId:string,staff:Staff,confirmed:boolean){
 if(!confirmed)throw Error('请先与家属确认本次成交');
 const generated=finalizeQuote(state,proposalId,staff,true);
 const next=confirmQuoteDeal(generated.state,staff,generated.quote.id,true);
 return {state:next,quote:next.quotes.find(q=>q.id===generated.quote.id)!};
}

export function getSaleSummary(state:AppState,staff:Staff,anchorQuoteId:string){
 const anchor=accessibleQuote(state,staff,anchorQuoteId),scopeKey=scopeFor(state,anchor);
 const orders=new Map<string,Quote>();
 for(const quote of state.quotes){
  if(!quote.dealConfirmedAt||!isCurrentQuote(state,quote)||scopeFor(state,quote)!==scopeKey||!canAccessSalesRecord(state,staff,quote))continue;
  const previous=orders.get(quote.proposalId);if(!previous||quote.version>previous.version)orders.set(quote.proposalId,quote);
 }
 const quotes=[...orders.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const total=sumAmounts(quotes.map(q=>q.total));
 const payments=(state.salePayments||[]).filter(p=>p.scopeKey===scopeKey);
 const receipts=new Map<string,Quote>();
 for(const q of state.quotes.filter(q=>scopeFor(state,q)===scopeKey&&canAccessSalesRecord(state,staff,q)&&q.receipt)){const old=receipts.get(q.proposalId);if(!old||q.version>old.version)receipts.set(q.proposalId,q);}
 const paid=sumAmounts([...[...receipts.values()].map(q=>q.receipt!.amount),...payments.map(p=>p.amount)]);
 const settlements=(state.saleSettlements||[]).filter(s=>s.scopeKey===scopeKey).sort((a,b)=>b.version-a.version);
 const latest=settlements[0];
 const changed=!!latest&&(latest.total!==total||latest.paid!==paid||JSON.stringify([...latest.quoteIds].sort())!==JSON.stringify(quotes.map(q=>q.id).sort()));
 return {quotes,total,paid,paymentCount:receipts.size+payments.length,overpaid:Math.max(0,paid-total),balance:Math.max(0,total-paid),customerName:anchor.customerName,subjectName:anchor.deceasedName||anchor.subjectName||'',settlements,changed,payments,scopeKey};
}

export function createSettlementSnapshot(state:AppState,staff:Staff,anchorQuoteId:string,confirmed:boolean):AppState{
 if(!confirmed)throw Error('请先与家属核对全部成交项目和金额');
 const summary=getSaleSummary(state,staff,anchorQuoteId);
 if(!summary.quotes.length)throw Error('尚无已成交项目');
 if(summary.paid>summary.total)throw Error('已登记收款超过成交金额，请先核对调整记录');
 if(summary.settlements.length&&!summary.changed)return state;
 const first=summary.settlements.at(-1);
 const record:SaleSettlement={id:id('settlement'),scopeKey:summary.scopeKey,number:first?.number||`JS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String((state.saleSettlements?.length||0)+1).padStart(3,'0')}`,version:(summary.settlements[0]?.version||0)+1,quoteIds:summary.quotes.map(q=>q.id),total:summary.total,paid:summary.paid,balance:summary.balance,confirmedAt:now(),confirmedBy:staff.id,lines:summary.quotes.flatMap(q=>q.lines.map(line=>({quoteNumber:q.number,quoteVersion:q.version,name:line.name,quantity:line.quantity,unit:line.unit,price:line.price,spec:line.spec,note:line.note})))};
 return {...state,saleSettlements:[...(state.saleSettlements||[]),record]};
}

export function recordSalePayment(state:AppState,staff:Staff,anchorQuoteId:string,input:{amount:number;date:string;method:SalePayment['method'];kind:SalePayment['kind'];note:string;confirmed:boolean;requestId?:string}):AppState{
 const summary=getSaleSummary(state,staff,anchorQuoteId);
 if(!input.confirmed)throw Error('请先人工核实实际收款');
 if(input.requestId){const previous=summary.payments.find(p=>p.requestId===input.requestId);if(previous){if(previous.amount!==input.amount||previous.date!==input.date||previous.method!==input.method||previous.kind!==input.kind)throw Error('此收款记录已经保存，请重新核对');return state;}}
 if(!summary.quotes.length)throw Error('请先确认成交，再登记收款');
 if(!Number.isSafeInteger(input.amount)||input.amount<=0||input.amount>summary.balance)throw Error('收款金额须大于零且不超过待结算金额');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)throw Error('请填写有效收款日期');
 if(!['微信','支付宝','现金'].includes(input.method)||!['订金','增补款','尾款'].includes(input.kind))throw Error('请选择有效收款方式与类型');
 if(input.note.trim().length>500)throw Error('收款备注不超过500字');
 const payment:SalePayment={requestId:input.requestId,amount:input.amount,date:input.date,method:input.method,kind:input.kind,note:input.note.trim(),id:id('sale-payment'),scopeKey:summary.scopeKey,recordedAt:now(),recordedBy:staff.id};
 return {...state,salePayments:[...(state.salePayments||[]),payment]};
}

export function withdrawSaleQuote(state:AppState,staff:Staff,quoteId:string):AppState{
 const quote=accessibleQuote(state,staff,quoteId);
 if(quote.revoked)return state;
 if(serviceHasPayments(state,quote))throw Error('本次服务已有收款登记，不能直接撤回报价，请先线下核对处理');
 return {...state,quotes:state.quotes.map(q=>q.id===quoteId?{...q,revoked:true}:q)};
}
