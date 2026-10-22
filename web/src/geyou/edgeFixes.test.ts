import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,setServiceDeal,updateServiceInfo} from './model';
import {saveDeceased} from './memorialModel';
import {beginQuoteRevision} from './quoteJourneyModel';
import {confirmSaleAndQuote,confirmQuoteDeal,getSaleSummary,withdrawSaleQuote} from './saleSettlementModel';
import {isCurrentQuote,isPublicQuote} from './quoteValidity';
import {saveServiceStage,readServiceWorkflow} from './serviceWorkflow';
import {syncNoticeWorkflow} from './serviceAutomation';
import {isPublicNotice,prepareNoticePublication} from './noticePublication';
import {noticeTaskEntry} from './noticeTaskNavigation';
import type {Notice} from './types';

test('latest revoked quote never revives old order, public link or revision',()=>{
 const base=seedState(),staff=base.staff[0];const first=confirmSaleAndQuote(base,base.proposals[0].id,staff,true);
 const revision=beginQuoteRevision(first.state,staff,first.quote.id);const second=confirmSaleAndQuote(revision.state,revision.proposal.id,staff,true);
 assert.equal(isPublicQuote(second.state,first.quote),false);
 const state=withdrawSaleQuote(second.state,staff,second.quote.id);
 assert.equal(getSaleSummary(state,staff,first.quote.id).total,0);
 assert.equal(isCurrentQuote(state,first.quote),false);assert.equal(isPublicQuote(state,first.quote),false);
 assert.throws(()=>beginQuoteRevision(state,staff,first.quote.id),/撤回|替代/);
 assert.throws(()=>confirmQuoteDeal(state,staff,first.quote.id,true),/最新/);
 assert.equal(JSON.parse(JSON.stringify(state)).quotes.length,state.quotes.length);
});

test('disabled agency invalidates public quotation regardless of staff session',()=>{
 const base=seedState(),staff=base.staff[0],sold=confirmSaleAndQuote(base,base.proposals[0].id,staff,true);
 assert.equal(isPublicQuote(sold.state,sold.quote),true);
 sold.state.agencies.find(a=>a.id===staff.agencyId)!.access!.enabled=false;
 assert.equal(isPublicQuote(sold.state,sold.quote),false);
});

function schedule(){let s=seedState();const staff=s.staff[0];s=saveDeceased(s,staff,'c1',{id:'time-person',name:'时间测试',age:'80',relationship:'父亲'});s=setServiceDeal(s,'c1','time-person',staff,'已成交');s=updateServiceInfo(s,'c1',staff,{phase:'治丧筹备',dates:{farewell:'2026-10-23'}},'time-person');const notice:Notice={...s.notices[0],id:'time-notice',agencyId:staff.agencyId,customerId:'c1',deceasedId:'time-person',name:'时间测试',age:'80',date:'2026-10-21',ceremonyDate:'2026-10-23T09:00',location:'测试厅',text:'隔离测试',status:'已发布',familyConfirmedAt:'2026-10-21',familyConfirmedBy:staff.id,scheduleReview:undefined};s=syncNoticeWorkflow({...s,notices:[notice]},notice,true);return {s,staff,notice};}

test('same-day appointment change hides old notice and reopens notice todo for review',()=>{
 let {s,staff}=schedule();s=saveServiceStage(s,staff,'c1','time-person','farewell',{progress:'进行中',assigneeId:staff.id,scheduledAt:'2026-10-23T10:00'});
 const view=readServiceWorkflow(s,staff,'c1','time-person');assert.equal(view.noticeReady,false);assert.ok(view.notice!.scheduleReview);assert.equal(isPublicNotice(s,view.notice!),false);
 const task=view.service.tasks.find(t=>t.autoKey==='publish-notice')!;assert.equal(task.status,'待确认');
 assert.equal(noticeTaskEntry(s,view.customer,'time-person',task).label,'重新核对讣告');
 assert.equal(view.stages.find(t=>t.id==='farewell')!.needsReview,false);
});

test('family reconfirmation aligns exact appointment time and retains organizer review',()=>{
 let {s,staff,notice}=schedule();s=saveServiceStage(s,staff,'c1','time-person','farewell',{progress:'进行中',assigneeId:staff.id,scheduledAt:'2026-10-23T10:00'});
 const published={...notice,ceremonyDate:'2026-10-23T11:00',scheduleReview:undefined};s=prepareNoticePublication(s,staff,published);s=syncNoticeWorkflow({...s,notices:[published]},published,true);
 const view=readServiceWorkflow(s,staff,'c1','time-person'),stage=view.stages.find(t=>t.id==='farewell')!;
 assert.equal(stage.task!.scheduledAt,'2026-10-23T11:00');assert.equal(stage.task!.remindAt,'2026-10-23T11:00');assert.equal(stage.needsReview,true);
 assert.equal(view.noticeReady,true);assert.equal(isPublicNotice(s,published),true);assert.equal(stage.progress,'进行中');
});
