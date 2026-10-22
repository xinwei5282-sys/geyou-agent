import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {withDemoAccount} from './demoAccount';
import {agentRecord,ensureAgentDemo,startAgentConversation,putAgentData,agentData} from './agentModel';
import {agentChatRequest} from './agentChat';
test('代理AI读取纸单参考价而非旧商城价格，并使用真实未生成状态',()=>{
 const state=withDemoAccount(seedState()),staff=state.staff[0],created=startAgentConversation(state,staff),request=agentChatRequest(created.state,staff,created.session);
 assert.ok(request.catalog.some(p=>p.name==='花圈 · 200元档'&&p.price===200));assert.ok(request.catalog.some(p=>p.name==='简朴套餐'&&p.price===4580));assert.ok(request.staffContext.businessFacts.some(x=>x.includes('尚未人工核对')));assert.ok(request.staffContext.businessFacts.some(x=>x.includes('尚未生成或无权访问')));assert.ok(request.staffContext.businessFacts.length<=16);assert.ok(request.staffContext.businessFacts.every(x=>x.length<=300));assert.equal(request.staffContext.stage,'consulting');
});
test('已确认清单发送冻结状态及拟定告别时间，不带另一客户资料',()=>{
 const state=withDemoAccount(seedState()),staff=state.staff[0],demo=ensureAgentDemo(state,staff),c=demo.consultations!.find(x=>x.agent?.isDemo)!,data=agentData(demo,c);
 const next=putAgentData(demo,staff,c.id,{...data,paperPlan:{basePrice:458000,extras:[],pricesChecked:true,confirmedAt:'2026-10-22',updatedAt:'2026-10-22'}});
 const request=agentChatRequest(next,staff,agentRecord(next,staff,c.id));assert.equal(request.staffContext.stage,'confirmed');assert.ok(request.staffContext.businessFacts.some(x=>x.includes('2026-10-23T10:00')));assert.ok(request.staffContext.businessFacts.some(x=>x.includes('已记录家属确认')));assert.equal(request.profile.subjectName,'陈明德（演示）');
});
