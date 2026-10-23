import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyAgentProfile} from './agentModel';
import {validateAuspiciousProfile} from './auspiciousProfile';
const complete={...emptyAgentProfile(),name:'资料校验（测试）',birthDate:'1944-05-16',birthTime:'08:30',deathDate:'2026-10-21'};
test('customer save requires all date fields, including birth time, in every service mode',()=>{
 for(const field of ['birthDate','birthTime','deathDate'] as const){assert.throws(()=>validateAuspiciousProfile({...complete,[field]:''}),/请补充.*安葬择吉需要根据逝者的出生时间推算/)}
 assert.throws(()=>validateAuspiciousProfile({...emptyAgentProfile(),name:'缺资料'}),/出生日期、出生时间、逝世日期/);
 assert.doesNotThrow(()=>validateAuspiciousProfile(complete));
});
test('save rejects invalid dates and times rather than inventing chart input',()=>{
 assert.throws(()=>validateAuspiciousProfile({...complete,birthDate:'1944-02-30'}));
 assert.throws(()=>validateAuspiciousProfile({...complete,birthTime:'25:00'}));
 assert.throws(()=>validateAuspiciousProfile({...complete,deathDate:'1940-01-01'}),/逝世日期不能早于出生日期/);
});
