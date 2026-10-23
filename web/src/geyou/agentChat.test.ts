import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {withDemoAccount} from './demoAccount';
import {agentRecord,ensureAgentDemo,startAgentConversation,putAgentData,agentData} from './agentModel';
import {agentChatRequest} from './agentChat';
test('代理AI读取纸单参考价而非旧商城价格，并使用真实未生成状态',()=>{
 const state=withDemoAccount(seedState()),staff=state.staff[0],created=startAgentConversation(state,staff),request=agentChatRequest(created.state,staff,created.session);
 assert.ok(request.catalog.some(p=>p.name==='花圈 · 200元档'&&p.price===200));assert.ok(request.catalog.some(p=>p.name==='简朴套餐'&&p.price===4580));assert.ok(request.staffContext.businessFacts.some(x=>x.includes('尚未人工核对')));assert.ok(request.staffContext.businessFacts.some(x=>x.includes('尚未生成或无权访问')));assert.ok(request.staffContext.businessFacts.length<=15);assert.ok(request.staffContext.businessFacts.some(x=>x.startsWith('遗照实际记录：')));assert.ok(request.staffContext.businessFacts.some(x=>x.startsWith('日期统一读取')));assert.ok(request.staffContext.businessFacts.some(x=>x.startsWith('服务进度：')));assert.ok(request.staffContext.businessFacts.every(x=>x.length<=300));assert.equal(request.staffContext.stage,'consulting');
});
test('已确认清单发送冻结状态及拟定告别时间，不带另一客户资料',()=>{
 const state=withDemoAccount(seedState()),staff=state.staff[0],demo=ensureAgentDemo(state,staff),c=demo.consultations!.find(x=>x.agent?.isDemo)!,data=agentData(demo,c);
 const next=putAgentData(demo,staff,c.id,{...data,paperPlan:{basePrice:458000,extras:[],pricesChecked:true,confirmedAt:'2026-10-22',updatedAt:'2026-10-22'}});
 const request=agentChatRequest(next,staff,agentRecord(next,staff,c.id));assert.equal(request.staffContext.stage,'confirmed');assert.ok(request.staffContext.businessFacts.some(x=>x.includes('2026-10-23T10:00')));assert.ok(request.staffContext.businessFacts.some(x=>x.includes('已记录家属确认')));assert.equal(request.profile.subjectName,'陈明德（演示）');
});

test('reception stage separates material checklist, identity review, profile confirmation and quote confirmation',async()=>{
 const {emptyAgentProfile,confirmAgentProfile,saveAgentPaperPlan}=await import('./agentModel');
 const state=withDemoAccount(seedState()),staff=state.staff[0],fresh=startAgentConversation(state,staff),sid=fresh.session.id;
 const stage=(s:typeof state)=>agentChatRequest(s,staff,agentRecord(s,staff,sid)).staffContext.businessFacts[0];
 assert.match(stage(fresh.state),/identity-upload/);
 const profile={...emptyAgentProfile(),name:'阶段测试',gender:'男',birthDate:'1940-01-01',deathDate:'2026-10-20',relationship:'父亲',occupation:'教师',faith:'无特定信仰',interests:'书画'};
 let s=putAgentData(fresh.state,staff,sid,{profile,materials:[]});assert.match(stage(s),/profile-review/);
 s=confirmAgentProfile(s,staff,sid,profile,'测试家属','');assert.match(stage(s),/quote-review/);
 const d=agentData(s,agentRecord(s,staff,sid));s=saveAgentPaperPlan(s,staff,sid,{...d.paperPlan!,pricesChecked:true,confirmedAt:'2026-10-23'});assert.match(stage(s),/content/);
 const facts=agentChatRequest(s,staff,agentRecord(s,staff,sid)).staffContext.businessFacts.join('');assert.match(facts,/本轮只追问：先制作遗照，再制作电子讣告/);
});

test('reception excludes metaphysics and sales prompt; quotation generation explicitly loads them',async()=>{
 const {buildAgentSystemPrompt}=await import('../../geyou-agent-prompt');
 const state=withDemoAccount(seedState()),staff=state.staff[0],s=ensureAgentDemo(state,staff),c=s.consultations!.find(x=>x.agent?.isDemo)!;
 for(const mode of ['reception','quotation'] as const){
 const request=agentChatRequest(s,staff,c,mode),prompt=buildAgentSystemPrompt(request);
 assert.ok(request.staffContext.businessFacts.length<=16);
 assert.equal(prompt.includes('套餐推荐与温和升单：'),mode==='quotation');
 assert.equal(prompt.includes('八字仅引用系统已计算'),mode==='quotation');
 assert.equal(request.staffContext.businessFacts.some(x=>x.startsWith('已计算四柱：')),mode==='quotation');
 assert.ok(request.staffContext.businessFacts.some(x=>x.startsWith('遗照实际记录：')));
 assert.ok(request.staffContext.businessFacts.some(x=>x.startsWith('当前讣告记录：')));
 }
});
