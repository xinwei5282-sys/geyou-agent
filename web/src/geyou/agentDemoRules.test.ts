import test from 'node:test';
import assert from 'node:assert/strict';
import {demoMaterialAdvice} from './agentDemoRules';
import {emptyAgentProfile} from './agentModel';
test('simulation rules require demo client and explicit family preference, never infer from chart',()=>{
 const p={...emptyAgentProfile(),birthDate:'1944-05-16',birthTime:'08:30',birthplace:'杭州',confirmedAt:'2026-10-22'};
 assert.equal(demoMaterialAdvice(p,false).length,0);assert.equal(demoMaterialAdvice(p,true).length,0);
 assert.equal(demoMaterialAdvice({...p,preferredElement:'木'},false).length,0);
 assert.equal(demoMaterialAdvice({...p,preferredElement:'木'},true)[0].element,'木');
});
test('material examples carry simulated source and cannot price or modify an order',()=>{
 const result=demoMaterialAdvice({...emptyAgentProfile(),confirmedAt:'today',preferredElement:'木'},true)[0];
 assert.match(result.source,/模拟/);assert.match(result.script,/家属|您/);assert.match(result.script,/样品/);assert.equal('price' in result,false);assert.match(result.note,/不.*真实/);
});
