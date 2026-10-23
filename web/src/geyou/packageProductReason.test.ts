import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {packageProductRecommendationRequest} from './packageExplanationModel';
const state=seedState(),product=state.products[0],plan={basePrice:458000,extras:[],pricesChecked:false,updatedAt:'2026-10-23'};
test('recommendation compares actual products and includes computed pillars without inventing favorable elements',()=>{
 const current={...product,id:'current',name:'当前测试款',description:'当前款实物说明',spec:'已核实规格'};
 const req=packageProductRecommendationRequest(plan,'普通骨灰盒',product,{confirmedAt:'2026-10-23',birthDate:'1944-05-16',birthTime:'08:30',calendar:'solar'},current);
 const facts=req.staffContext.businessFacts.join('\n');assert.match(facts,/当前测试款/);assert.match(facts,/当前款实物说明/);assert.match(facts,/已核对出生资料排盘/);assert.match(facts,/未确认，不得自动判定喜用/);assert.match(req.messages[0].text,/两款|当前款/);
});
test('missing birth time or unconfirmed data never fabricates a chart or product advantage',()=>{
 for(const p of [{confirmedAt:'2026-10-23',birthDate:'1944-05-16'},{birthDate:'1944-05-16',birthTime:'08:30'}]){
 const facts=packageProductRecommendationRequest(plan,'普通骨灰盒',product,p).staffContext.businessFacts.join('\n');assert.doesNotMatch(facts,/已核对出生资料排盘/);assert.match(facts,/具体材质规格未核定/);assert.match(facts,/不能生成八字匹配结论/);
 }
});
test('comparison demo stays explicit and never mutates catalog or customer facts',async()=>{
 const {packageComparisonDemo}=await import('./packageComparisonDemo');const before=JSON.stringify(product),demo=packageComparisonDemo('普通寿衣全套',product);
 assert.equal(JSON.stringify(product),before);assert.equal(demo.preference.isDemo,true);assert.notEqual(demo.current.spec,demo.candidate.spec);
 const facts=packageProductRecommendationRequest(plan,'普通寿衣全套',demo.candidate,demo.preference,demo.current).staffContext.businessFacts.join('\n');assert.match(facts,/虚构演示对比/);assert.match(facts,/已核对出生资料排盘/);assert.match(facts,/测试假设/);
});
test('replacement updates saved quote once, clears confirmation and preserves frozen quotes',async()=>{
 const {applyPaperAdjustment}=await import('./packageExplanationModel');const {startAgentConversation,confirmAgentProfile,emptyAgentProfile,agentRecord,agentData,saveAgentPaperDraft}=await import('./agentModel');
 const staff=state.staff.find(s=>s.id==='boss-a')!,fresh=startAgentConversation(state,staff);let saved=confirmAgentProfile(fresh.state,staff,fresh.session.id,{...emptyAgentProfile(),name:'商品替换测试'},'测试家属','');
 const before=agentData(saved,agentRecord(saved,staff,fresh.session.id)).paperPlan!;
 const replacement=state.products.find(p=>p.category==='寿衣')!;const item={included:'普通寿衣全套',productId:replacement.id,name:replacement.name,need:'家属明确选用',delta:20000,priceChecked:true};
 const updated=applyPaperAdjustment(before,item);saved=saveAgentPaperDraft(saved,staff,fresh.session.id,updated);const restored=agentData(JSON.parse(JSON.stringify(saved)),agentRecord(saved,staff,fresh.session.id)).paperPlan!;
 assert.equal(restored.adjustments?.[0].name,replacement.name);assert.equal(restored.pricesChecked,false);assert.equal(restored.confirmedAt,undefined);
 assert.equal(applyPaperAdjustment(restored,{...item,delta:30000}).adjustments?.length,1);
 assert.throws(()=>applyPaperAdjustment({...restored,confirmedAt:'2026-10-23'},item),/已确认/);
});
