import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculatedAgentAge} from './agentAge';
import {emptyAgentProfile} from './agentModel';
import {fillRecognitionBlanks} from './documentOcr';
test('age uses birth and saved death dates, including birthday boundaries',()=>{
 const p={...emptyAgentProfile(),birthDate:'1940-10-21',deathDate:'2026-10-20'};assert.equal(calculatedAgentAge(p),'85');assert.equal(calculatedAgentAge({...p,deathDate:'2026-10-21'}),'86');assert.equal(calculatedAgentAge({...p,birthDate:'2026-10-01'}),'0');assert.equal(calculatedAgentAge({...p,deathDate:''}),'');assert.equal(calculatedAgentAge({...p,birthDate:'1941-02-29'}),'');assert.equal(calculatedAgentAge({...p,calendar:'lunar'}),'');
 const filled=fillRecognitionBlanks({...emptyAgentProfile(),deathDate:'2026-10-20'},{documentType:'身份证',fields:{name:'测试',birthDate:'1940-01-01'},warnings:[]});assert.equal(filled.age,'86');
});

test('cleared dates invalidate computed age and invalid chronology cannot be confirmed',async()=>{
 const {withCalculatedAgentAge}=await import('./agentAge');
 const {confirmAgentProfile,startAgentConversation,agentData,agentRecord,agentServiceReminder,putAgentData,saveAgentPaperPlan}=await import('./agentModel');
 const {seedState}=await import('./model');const {withDemoAccount}=await import('./demoAccount');
 const p=withCalculatedAgentAge({...emptyAgentProfile(),name:'日期回归测试',birthDate:'1940-01-01',deathDate:'2026-10-20'});
 assert.equal(p.age,'86');assert.equal(withCalculatedAgentAge({...p,deathDate:''}).age,'');assert.equal(withCalculatedAgentAge({...p,birthDate:'',deathDate:''}).age,'');
 const state=withDemoAccount(seedState()),staff=state.staff[0],fresh=startAgentConversation(state,staff),sid=fresh.session.id;
 assert.throws(()=>confirmAgentProfile(fresh.state,staff,sid,{...p,deathDate:'1930-01-01'},'测试家属',''),/逝世日期不能早于/);
 assert.throws(()=>confirmAgentProfile(fresh.state,staff,sid,{...p,deathDate:'2026-02-30'},'测试家属',''),/逝世日期/);
 let s=confirmAgentProfile(fresh.state,staff,sid,p,'测试家属','');let d=agentData(s,agentRecord(s,staff,sid));s=saveAgentPaperPlan(s,staff,sid,{...d.paperPlan!,pricesChecked:true,confirmedAt:'test'});d=agentData(s,agentRecord(s,staff,sid));s=putAgentData(s,staff,sid,{...d,serviceReminderAt:undefined,serviceReminderDismissedAt:'old'});assert.equal(agentServiceReminder(s,staff,sid),true);
});
