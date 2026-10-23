import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as intake from './agentIntake';
import {emptyAgentProfile,startAgentConversation,agentData,agentRecord,putAgentData,applyAgentReplyProfile,agentMessage} from './agentModel';
import {seedState} from './model';
import {withDemoAccount} from './demoAccount';
import {agentChatRequest} from './agentChat';
import {buildAgentSystemPrompt} from '../../geyou-agent-prompt';
import {codexReplySchema} from '../../geyou-codex';
const fixture=()=>{const s=withDemoAccount(seedState()),staff=s.staff[0],fresh=startAgentConversation(s,staff);return {...fresh,staff}};
test('new reception creates a separate session and preserves earlier drafts',()=>{
 const f=fixture(),old=agentMessage(f.state,f.staff,f.session.id,'之前的接待资料','user');
 const next=startAgentConversation(old,f.staff);
 assert.notEqual(next.session.id,f.session.id);assert.equal(next.session.messages.length,0);
 assert.equal(agentRecord(next.state,f.staff,f.session.id).messages[0].text,'之前的接待资料');
});
test('fresh intake explicitly requests deceased identity files; never requests budget',()=>{
 const guide=intake.agentIntake({profile:emptyAgentProfile(),materials:[]});
 assert.equal(guide.complete,false);assert.equal(guide.question.field,'name');
 assert.match(intake.INTAKE_GREETING,/身份证、死亡证明或户口本/);assert.doesNotMatch(JSON.stringify(guide),/budget|预算/);
});
test('recognized identity skips existing fields, uses explicit relationship options and then dates',()=>{
 const p={...emptyAgentProfile(),name:'测试逝者',gender:'男',birthDate:'1940-01-01'};
 const d={profile:p,materials:[]};const g=intake.agentIntake(d);
 assert.equal(g.question.field,'relationship');assert.ok(g.question.options.some(x=>x.value==='父亲'));
 const f=fixture(),s=putAgentData(f.state,f.staff,f.session.id,d);
 const next=intake.chooseIntakeOption(s,f.staff,f.session.id,'relationship','父亲');
 const data=agentData(next,agentRecord(next,f.staff,f.session.id));
 assert.equal(data.profile.relationship,'父亲');assert.equal(data.profile.confirmedAt,undefined);
 assert.equal(intake.agentIntake(data).question.field,'deathDate');
 assert.throws(()=>intake.chooseIntakeOption(s,f.staff,f.session.id,'relationship','已付款'));
 assert.throws(()=>intake.chooseIntakeOption(s,{...f.staff,agencyId:'other'},f.session.id,'relationship','父亲'));
});
test('complete facts require review, and confirmed facts are not overwritten by stale choices',()=>{
 const p={...emptyAgentProfile(),name:'测试逝者',gender:'男',birthDate:'1940-01-01',relationship:'父亲',deathDate:'2026-10-20'};
 assert.equal(intake.agentIntake({profile:p,materials:[]}).complete,false);
 assert.equal(intake.agentIntake({profile:p,materials:[]}).question?.field,'occupation');
 assert.equal(intake.agentIntake({profile:{...p,confirmedAt:'2026-10-23'},materials:[]}).complete,true);
 const f=fixture(),s=putAgentData(f.state,f.staff,f.session.id,{profile:{...p,confirmedAt:'2026-10-23'},materials:[]});
 assert.throws(()=>intake.chooseIntakeOption(s,f.staff,f.session.id,'gender','女'));
});
test('legacy budget is preserved but not sent or extracted in AI reception',()=>{
 const f=fixture(),d=agentData(f.state,f.session);const s=putAgentData(f.state,f.staff,f.session.id,{...d,profile:{...d.profile,budget:'5000'}});
 const req=agentChatRequest(s,f.staff,agentRecord(s,f.staff,f.session.id));
 assert.equal('budgetYuan' in req.profile,false);assert.ok(!req.staffContext.businessFacts.some(x=>x.includes('家属预算')));
 const next=applyAgentReplyProfile(s,f.staff,f.session.id,{budgetYuan:10000});
 assert.equal(agentData(next,agentRecord(next,f.staff,f.session.id)).profile.budget,'5000');
});
test('runtime prompt and schema support document-led follow-ups and actual profile fields',()=>{
 const f=fixture(),req=agentChatRequest(f.state,f.staff,f.session),prompt=buildAgentSystemPrompt(req);
 assert.match(prompt,/身份证、死亡证明或户口本/);assert.match(prompt,/不询问、不采集客户预算/);assert.match(prompt,/个人信息完善/);
 assert.doesNotMatch(prompt,/本次服务中的电子讣告/);
 const schema=codexReplySchema([]);for(const key of ['contactName','contactPhone','relationship','birthDate','deathDate','farewell','location'])assert.ok(key in schema.properties.profile.properties,key);
});
test('recommended chat choices are bounded, unique and do not ask for budget',()=>{
 assert.deepEqual(intake.receptionQuickReplies(['上传身份证','预算5000元','上传身份证','手动完善信息','资料已经核对','查看遗照']),['上传身份证','手动完善信息','查看遗照']);
});

test('selection follow-ups persist explicit choices and skip unknown without inventing faith',()=>{
 const f=fixture(),p={...emptyAgentProfile(),name:'测试',gender:'男',birthDate:'1940-01-01',relationship:'父亲',deathDate:'2026-10-20'};
 let s=putAgentData(f.state,f.staff,f.session.id,{profile:p,materials:[]});
 s=intake.chooseIntakeOption(s,f.staff,f.session.id,'occupation','教师');
 s=intake.chooseIntakeOption(s,f.staff,f.session.id,'faith','__unknown__');
 let d=agentData(s,agentRecord(s,f.staff,f.session.id));assert.equal(d.profile.faith,'待确认');assert.equal(d.profile.occupation,'教师');assert.equal(intake.agentIntake(d).question?.field,'interests');
 s=intake.chooseIntakeOption(s,f.staff,f.session.id,'interests','书画');d=agentData(s,agentRecord(s,f.staff,f.session.id));assert.equal(intake.agentIntake(d).question,undefined);assert.equal(d.profile.confirmedAt,undefined);
 assert.deepEqual(intake.agentIntake(JSON.parse(JSON.stringify(d))).missing,[]);
});
test('OCR review precedes follow-ups, persists on refresh and never confirms the full profile or quote',()=>{
 const f=fixture(),profile={...emptyAgentProfile(),name:'测试逝者',gender:'男',birthDate:'1940-01-01',deathDate:'2026-10-20'};
 const materials=[{id:'ocr-test',name:'死亡证明',kind:'证件资料' as const,at:'2026-10-23',recognition:{documentType:'死亡证明' as const,fields:{name:'测试逝者',gender:'男',birthDate:'1940-01-01',deathDate:'2026-10-20'},warnings:[]}}];
 let s=putAgentData(f.state,f.staff,f.session.id,{profile,materials,identityReviewPending:true});let d=agentData(s,agentRecord(s,f.staff,f.session.id));
 assert.equal(intake.agentIntake(JSON.parse(JSON.stringify(d))).identity.pending,true);assert.equal(intake.agentIntake(d).question,undefined);
 assert.throws(()=>intake.chooseIntakeOption(s,f.staff,f.session.id,'relationship','父亲'));
 s=intake.reviewAgentIdentity(s,f.staff,f.session.id);d=agentData(s,agentRecord(s,f.staff,f.session.id));assert.equal(intake.agentIntake(d).identity.pending,false);assert.ok(d.materials[0].recognition?.reviewedAt);assert.equal(intake.agentIntake(d).question?.field,'relationship');assert.equal(d.profile.confirmedAt,undefined);assert.equal(d.paperPlan,undefined);
 s=putAgentData(s,f.staff,f.session.id,{...d,identityReviewPending:true});s=intake.reviewAgentIdentity(s,f.staff,f.session.id,{...profile,name:'人工更正姓名'});d=agentData(s,agentRecord(s,f.staff,f.session.id));assert.equal(d.profile.name,'人工更正姓名');assert.equal(d.paperPlan,undefined);
});
test('custom choices retain actual occupation, interests and faith details through the gateway',async()=>{
 const f=fixture(),profile={...emptyAgentProfile(),name:'测试',gender:'男',birthDate:'1940-01-01',deathDate:'2026-10-20',relationship:'父亲'};
 let s=putAgentData(f.state,f.staff,f.session.id,{profile,materials:[]});assert.throws(()=>intake.chooseIntakeOption(s,f.staff,f.session.id,'occupation','__custom__'));assert.throws(()=>intake.chooseIntakeOption(s,f.staff,f.session.id,'occupation','',true));
 s=intake.chooseIntakeOption(s,f.staff,f.session.id,'occupation','木工',true);s=intake.chooseIntakeOption(s,f.staff,f.session.id,'faith','民间信仰',true);s=intake.chooseIntakeOption(s,f.staff,f.session.id,'interests','钓鱼',true);
 const d=agentData(s,agentRecord(s,f.staff,f.session.id));assert.equal(d.profile.occupation,'木工');assert.equal(d.profile.faith,'其他宗教');assert.equal(d.profile.faithDetail,'民间信仰');assert.equal(d.profile.interests,'钓鱼');assert.equal(intake.agentIntake(d).question,undefined);
 const {validateChatRequest,validateChatResponse}=await import('../../geyou-ai-plugin');const req=agentChatRequest(s,f.staff,agentRecord(s,f.staff,f.session.id));assert.equal(validateChatRequest(req)?.profile.faithDetail,'民间信仰');assert.equal(validateChatResponse({reply:'请核对资料',profile:{faith:'其他宗教',faithDetail:'民间信仰'},productIds:[]},[])?.profile.faithDetail,'民间信仰');
});
