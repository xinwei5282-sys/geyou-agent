import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from './model';
import { buildCustomerFuneralPlan } from './customerFuneralPlan';
import type { Consultation } from './types';

function fixture(scenario:'hospital'|'home'|'advance'='hospital') {
  const state=seedState(), staff=state.staff.find(x=>x.id==='staff-lin')!;
  const session:Consultation={id:'session-process',agencyId:staff.agencyId,staffId:staff.id,customerId:'c1',mode:'general',answers:{},messages:[],step:1,createdAt:'',updatedAt:'',guided:{scenario,subjectName:'',occupation:'',interests:'',faith:'待确认',region:'',budget:0,notes:'',step:0,selectedProductIds:[]}};
  state.consultations=[session];
  return {state,staff,session};
}

test('hospital plan handles immediate hospital coordination without claiming unconfirmed purchases',()=>{
  const {state,staff}=fixture('hospital');
  const result=buildCustomerFuneralPlan(state,staff,'session-process');
  assert.equal(result.scenario,'医院');
  assert.ok(result.steps.some(step=>/医院/.test(step.detail)));
  assert.ok(result.steps.some(step=>/殡仪馆办理/.test(step.detail)));
  assert.ok(result.pending.some(item=>/时间/.test(item)));
  assert.ok(!result.steps.some(step=>/已购买|已购/.test(step.detail)));
});

test('home plan respects explicit no-hall choice and avoids a home hall branch',()=>{
  const {state,staff,session}=fixture('home');
  session.guided!.notes='家属明确不设灵堂，在殡仪馆告别。';
  const result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.ok(result.steps.some(step=>/不安排居家灵堂/.test(step.detail)));
  assert.ok(!result.steps.some(step=>/居家灵堂布置|在家设灵堂/.test(step.detail)));
  assert.ok(!result.pending.some(item=>/灵堂/.test(item)));
  assert.ok(!result.familyPrepared.some(item=>/门板|供桌/.test(item)));
});

test('advance plan keeps unknown time and place pending without inventing arrangements',()=>{
  const {state,staff}=fixture('advance');
  const result=buildCustomerFuneralPlan(state,staff,'session-process');
  assert.equal(result.scenario,'提前咨询');
  assert.ok(result.pending.some(item=>/时间/.test(item)));
  assert.ok(result.pending.some(item=>/地点/.test(item)));
  assert.ok(!result.steps.some(step=>/202\d-|\d{1,2}点/.test(step.detail)));
});

test('prepared clothes are marked prepared and not presented as a purchase need',()=>{
  const {state,staff,session}=fixture('home');
  session.guided!.plan={phase:'scope',processPosition:'immediate',needs:{clothes:'prepared'},scopeConfirmed:false,packages:[],continuation:'undecided'};
  const result=buildCustomerFuneralPlan(state,staff,session.id);
  const clothes=result.steps.find(step=>step.id==='clothes')!;
  assert.equal(clothes.status,'已准备');
  assert.match(clothes.detail,/不重复购买/);
  assert.ok(!clothes.detail.includes('需购买寿衣'));
});

test('unconfirmed selected lines stay out of confirmed sale details and unknown faith adds no rites',()=>{
  const {state,staff,session}=fixture('advance');
  const line={productId:'p2',name:'寿衣意向',unit:'套',kind:'商品' as const,price:1,quantity:1};
  session.guided!.faith='待确认';
  session.guided!.plan={phase:'result',processPosition:'advance',needs:{clothes:'needed'},scopeConfirmed:true,packages:[],selectedLines:[line],continuation:'continue'};
  const result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.ok(!result.steps.some(step=>step.detail.includes('寿衣意向')));
  assert.ok(!result.steps.some(step=>/佛教|基督教|举行宗教仪式|安排佛事/.test(step.detail)));
  assert.ok(result.pending.some(item=>/信仰/.test(item)));
});

test('only settled quote lines appear as confirmed items; proposal status alone is not proof',()=>{
  const {state,staff,session}=fixture('hospital');
  const proposal={id:'proposal-process',agencyId:staff.agencyId,customerId:session.customerId,consultationId:session.id,staffId:staff.id,region:'',budget:0,preference:'',lines:[],status:'已确认' as const,warnings:[],createdAt:'',updatedAt:''};
  state.proposals.push(proposal);
  state.quotes.push({id:'quote-process',agencyId:staff.agencyId,customerId:session.customerId,proposalId:proposal.id,staffId:staff.id,number:'Q1',version:1,lines:[{productId:'p2',name:'确认寿衣',unit:'套',price:1,quantity:1,kind:'商品'}],total:1,createdAt:'',customerName:'',agencyName:'',phone:'',region:'',revoked:false,note:'',dealConfirmedAt:'2026-10-14T00:00:00Z'});
  let result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.ok(result.steps.find(step=>step.id==='confirmed-items')?.detail.includes('确认寿衣'));
  assert.ok(result.agencyPrepared.some(item=>item.includes('确认寿衣')));
  state.proposals[state.proposals.length-1]={...proposal,status:'已确认'};
  const settledQuoteIndex=state.quotes.findIndex(quote=>quote.id==='quote-process');
  state.quotes[settledQuoteIndex]={...state.quotes[settledQuoteIndex],dealConfirmedAt:undefined};
  result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.equal(result.steps.some(step=>step.id==='confirmed-items'),false);
  assert.deepEqual(result.agencyPrepared,[]);
});

test('amendments count only after their own confirmation, and prior-round purchases remain',()=>{
  const {state,staff,session}=fixture('home');
  session.deceasedId='deceased-1';
  session.guided!.plan={phase:'result',processPosition:'advance',needs:{},scopeConfirmed:true,packages:[],continuation:'continue',continuedFrom:'session-root'};
  const previous={...session,id:'session-root',guided:{...session.guided!,plan:{...session.guided!.plan,continuedFrom:undefined}}};
  state.consultations!.push(previous);
  const oldProposal={...state.proposals[0],id:'proposal-root',customerId:session.customerId,deceasedId:session.deceasedId,consultationId:previous.id,status:'待客户确认' as const};
  const currentProposal={...oldProposal,id:'proposal-current',consultationId:session.id,status:'待客户确认' as const};
  state.proposals.push(oldProposal,currentProposal);
  const quote=(id:string,proposalId:string,version:number,name:string,dealConfirmedAt?:string)=>({id,agencyId:staff.agencyId,customerId:session.customerId,proposalId,staffId:staff.id,number:'Q',version,lines:[{productId:`p-${id}`,name,unit:'件',price:1,quantity:1,kind:'商品' as const}],total:1,createdAt:'',customerName:'',agencyName:'',phone:'',region:'',revoked:false,note:'',dealConfirmedAt});
  state.quotes.push(quote('old-v1','proposal-root',1,'首轮骨灰盒','2026-10-14T00:00:00Z'),{...quote('current-v1','proposal-current',1,'旧寿衣款'),receipt:{amount:1,recordedAt:'',recordedBy:staff.id,recorderName:'',payeeName:'',note:''}},quote('current-v2','proposal-current',2,'修订后寿衣款'));
  const result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.ok(result.agencyPrepared.some(item=>item.includes('首轮骨灰盒')));
  assert.ok(result.agencyPrepared.some(item=>item.includes('旧寿衣款')));
  assert.ok(!result.agencyPrepared.some(item=>item.includes('修订后寿衣款')));
  const revised=state.quotes.findIndex(item=>item.id==='current-v2');
  state.quotes[revised]={...state.quotes[revised],dealConfirmedAt:'2026-10-14T01:00:00Z'};
  const confirmedRevision=buildCustomerFuneralPlan(state,staff,session.id);
  assert.ok(confirmedRevision.agencyPrepared.some(item=>item.includes('修订后寿衣款')));
  assert.ok(!confirmedRevision.agencyPrepared.some(item=>item.includes('旧寿衣款')));
});

test('saved address, reservation time, contact, and family supplies appear without false missing prompts',()=>{
  const {state,staff,session}=fixture('home');
  session.guided!.serviceAddress='服务地址示例';
  session.guided!.reservationTime='家属约定时间示例';
  session.guided!.familySupplies='靠背椅、供桌';
  session.contact={name:'测试联系人',phone:'13800000000'};
  const result=buildCustomerFuneralPlan(state,staff,session.id);
  const reservation=result.steps.find(step=>step.id==='reservation')!;
  assert.ok(reservation.detail.includes('服务地址示例'));
  assert.ok(reservation.detail.includes('家属约定时间示例'));
  assert.ok(reservation.detail.includes('测试联系人'));
  assert.ok(reservation.detail.includes('13800000000'));
  assert.ok(!result.pending.includes('确认服务地址'));
  assert.ok(!result.pending.includes('确认家属与联系人'));
  assert.ok(!result.pending.includes('确认治丧或告别时间'));
  assert.ok(result.familyPrepared.includes('靠背椅'));
  assert.ok(result.familyPrepared.includes('供桌'));
});

test('saved appointment details continue to appear when opened from a later linked consultation',()=>{
  const {state,staff,session}=fixture('home');
  const previous={...session,id:'session-root',updatedAt:'2026-10-13T00:00:00Z',contact:{name:'之前联系人',phone:'13900000000'},guided:{...session.guided!,serviceAddress:'已保存服务地址',reservationTime:'已保存预定时间',familySupplies:'家属自备雨伞'}};
  session.updatedAt='2026-10-14T00:00:00Z';
  session.guided!.plan={phase:'result',processPosition:'advance',needs:{},scopeConfirmed:true,packages:[],continuation:'continue',continuedFrom:previous.id};
  state.consultations!.push(previous);
  const result=buildCustomerFuneralPlan(state,staff,session.id);
  const reservation=result.steps.find(step=>step.id==='reservation')!;
  assert.ok(reservation.detail.includes('已保存服务地址'));
  assert.ok(reservation.detail.includes('已保存预定时间'));
  assert.ok(reservation.detail.includes('之前联系人'));
  assert.ok(result.familyPrepared.includes('家属自备雨伞'));
});

test('local household checklist appears only when a home hall is selected; later rites are opt-in',()=>{
  const {state,staff,session}=fixture('home');
  session.guided!.plan={phase:'scope',processPosition:'immediate',needs:{decoration:'needed'},scopeConfirmed:true,packages:[],continuation:'continue'};
  let result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.ok(result.familyPrepared.some(item=>/门板、方凳、靠背椅、供桌/.test(item)));
  assert.equal(result.steps.some(step=>step.id==='later-rites'),false);
  session.guided!.notes='家属希望安排五七，日期待定。';
  result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.ok(result.steps.some(step=>step.id==='later-rites'));
  session.guided!.notes='家属暂时不需要五七。';
  result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.equal(result.steps.some(step=>step.id==='later-rites'),false);
});

test('negative or undecided no-hall wording is not treated as a confirmed choice',()=>{
  const {state,staff,session}=fixture('home');
  session.guided!.notes='家属还没决定是否不设灵堂，也不要不设灵堂。';
  const result=buildCustomerFuneralPlan(state,staff,session.id);
  assert.equal(result.steps.some(step=>step.title==='告别地点衔接'),false);
  assert.ok(result.pending.some(item=>/告别地点/.test(item)));
});

test('unrelated agency staff cannot read another consultation plan',()=>{
  const {state,session}=fixture();
  assert.throws(()=>buildCustomerFuneralPlan(state,state.staff.find(x=>x.id==='boss-b')!,session.id),/权限/);
});
