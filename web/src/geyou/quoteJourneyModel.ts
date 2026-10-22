import {latestQuoteVersion} from './quoteValidity';
import {serviceHasPayments} from './saleScope';
import { canAccessSalesRecord, id, now } from './model';
import type { AppState, Proposal, Quote, QuoteFeedback, QuoteFeedbackKind, Staff } from './types';

export type { QuoteFeedbackKind } from './types';

function requireQuote(state:AppState,quoteId:string):Quote {
  const quote=state.quotes.find(item=>item.id===quoteId);
  if(!quote)throw new Error('未找到该报价');
  return quote;
}

function latestEffectiveQuote(state:AppState,quote:Quote):Quote|undefined {
  const latest=latestQuoteVersion(state,quote);return latest&&!latest.revoked?latest:undefined;
}

function requireLatestEffectiveQuote(state:AppState,quote:Quote):void {
  if(quote.revoked||latestEffectiveQuote(state,quote)?.id!==quote.id)throw new Error('该报价已撤回或已被新版本替代，请查看最新报价');
}

export function submitQuoteFeedback(state:AppState,quoteId:string,input:{kind:QuoteFeedbackKind;text:string}):AppState {
  const quote=requireQuote(state,quoteId);
  requireLatestEffectiveQuote(state,quote);
  if(!['认可清单','希望调整','需要联系'].includes(input.kind))throw new Error('请选择有效的反馈类型');
  const text=input.text.trim();
  if(input.kind==='希望调整'&&!text)throw new Error('请填写希望调整的内容');
  if(text.length>1000)throw new Error('反馈内容不能超过1000字');
  const existing=quote.feedback||[];
  if(existing.some(item=>item.status==='待处理'&&item.kind===input.kind&&item.text===text))return state;
  const feedback:QuoteFeedback={id:id('quote-feedback'),kind:input.kind,text,at:now(),status:'待处理'};
  return {...state,quotes:state.quotes.map(item=>item.id===quote.id?{...item,feedback:[...existing,feedback]}:item)};
}

export function markQuoteShared(state:AppState,staff:Staff,quoteId:string):AppState {
  const quote=requireQuote(state,quoteId);
  if(!canAccessSalesRecord(state,staff,quote))throw new Error('无权限操作该报价');
  const at=now();
  return {...state,quotes:state.quotes.map(item=>item.id===quote.id?{...item,sharedAt:at,sharedBy:staff.id}:item)};
}

export function resolveQuoteFeedback(state:AppState,staff:Staff,quoteId:string,feedbackId:string,resolution:string):AppState {
  const quote=requireQuote(state,quoteId);
  if(!canAccessSalesRecord(state,staff,quote))throw new Error('无权限操作该报价');
  const note=resolution.trim();
  if(!note)throw new Error('请填写处理说明');
  if(note.length>1000)throw new Error('处理说明不能超过1000字');
  const feedback=quote.feedback||[];
  const target=feedback.find(item=>item.id===feedbackId);
  if(!target)throw new Error('未找到该条客户反馈');
  if(target.status==='已处理')return state;
  const at=now();
  return {...state,quotes:state.quotes.map(item=>item.id===quote.id?{...item,feedback:feedback.map(entry=>entry.id===feedbackId?{...entry,status:'已处理' as const,handledAt:at,handledBy:staff.id,resolution:note}:entry)}:item)};
}

export function beginQuoteRevision(state:AppState,staff:Staff,quoteId:string):{state:AppState;proposal:Proposal} {
  const quote=requireQuote(state,quoteId);
  if(!canAccessSalesRecord(state,staff,quote))throw new Error('无权限修改该报价');
  requireLatestEffectiveQuote(state,quote);
  if(serviceHasPayments(state,quote))throw new Error('此谈单已有收款登记，报价变更请先线下核对处理');
  const original=state.proposals.find(item=>item.id===quote.proposalId);
  if(!original)throw new Error('未找到报价对应的方案');

  // Reopening an active revision must preserve edits already made in the generic proposal editor.
  if(original.status==='待客户确认'&&original.revisionOf===quote.id)return {state,proposal:original};

  const proposal:Proposal={...original,staffId:staff.id,lines:structuredClone(quote.lines),status:'待客户确认',updatedAt:now(),confirmedAt:undefined,revisionOf:quote.id};
  return {state:{...state,proposals:state.proposals.map(item=>item.id===proposal.id?proposal:item)},proposal};
}
