import type {AppState,Staff,Quote} from './types';
import {canAccessSalesRecord,now} from './model';
export function quotePaymentBlock(s:AppState,q:Quote):string{
 if(q.revoked)return '此报价已撤回，停止收款';
 if(s.agencies.find(a=>a.id===q.agencyId)?.access?.enabled===false)return '代理账号已停用，暂不展示收款信息';
 if(s.quotes.some(x=>x.proposalId===q.proposalId&&x.id!==q.id&&x.receipt))return '此谈单其他报价版本已登记收款，请勿重复付款';
 if(s.quotes.some(x=>x.proposalId===q.proposalId&&x.version>q.version))return '已有新版报价，请使用最新确认版本收款';
 if(q.total<=0)return '报价金额为零，无需收款';
 return '';
}
export function registerManualReceipt(s:AppState,quoteId:string,staff:Staff,confirmed:boolean,note:string,details?:{receivedDate:string;method:'微信转账'}):AppState{
 const quote=s.quotes.find(q=>q.id===quoteId);
 if(!quote||!canAccessSalesRecord(s,staff,quote))throw Error('无权登记此报价收款');
 if(quote.receipt)throw Error('此报价已登记收款，请勿重复登记');
 const block=quotePaymentBlock(s,quote);if(block)throw Error(block);
 if(!confirmed)throw Error('请先核实微信已收到全额款项并勾选确认');
 const agency=s.agencies.find(a=>a.id===quote.agencyId)!;
 if(!agency.paymentQr||!agency.payeeName?.trim())throw Error('请先由老板完善企业收款码和收款人');
 if(note.trim().length>300)throw Error('收款备注请控制在300字以内');
 if(details){const date=details.receivedDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('请填写有效收款日期');if(details.method!=='微信转账')throw Error('当前仅支持微信转账登记');}
 const receipt={...details,amount:quote.total,recordedAt:now(),recordedBy:staff.id,recorderName:staff.name,payeeName:agency.payeeName.trim(),note:note.trim()};
 return {...s,quotes:s.quotes.map(q=>q.id===quoteId?{...q,receipt}:q)};
}
