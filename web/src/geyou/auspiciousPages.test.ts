import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AgentAuspicious,type Saved} from './AgentAuspicious';
import {emptyAgentProfile} from './agentModel';
import {CEMETERY_ADVICE_VERSION} from './cemeteryAdvice';
import {recommendCemeteries,defaultCemeteryNeeds} from './cemeteryModel';
const evidence={chartBasis:'系统四柱',ruleBasis:'传统规则待坐向核对',siteBasis:'真实公墓地区',conclusion:'待核实匹配'};
const saved:Saved={mode:'both',profile:{...emptyAgentProfile(),name:'两页流程（测试）',birthDate:'1944-05-16',birthTime:'08:30',deathDate:'2026-10-21'},from:'2026-10-21',to:'2026-10-27',candidates:[{date:'2026-10-23',start:'09:00',end:'10:59',day:'庚午',hour:'辛巳',reasons:[]}],cemeteryMatches:recommendCemeteries(defaultCemeteryNeeds()).slice(0,1).map(m=>({...m,baziEvidence:evidence})),cemeteryAdvice:{analysis:'传统参考',promptVersion:CEMETERY_ADVICE_VERSION,recommendations:[{cemeteryId:'hz-anxian',reason:'真实地区',missing:[],evidence}]}};
test('needs and result pages are separate, retain the same record and keep actions outside scroll content',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify(saved)}});
 try{
  const render=(view:string)=>renderToStaticMarkup(createElement(AgentAuspicious,{storageKey:'qa',customers:[],onBack:()=>{},view,onViewChange:()=>{}}));
  const needs=render('needs'),result=render('results');
  assert.ok(needs.includes('服务选择'));assert.ok(needs.includes('公墓需求'));assert.ok(needs.includes('生成择吉方案'));assert.ok(!needs.includes('aria-label="候选下葬时间"'));assert.ok(!needs.includes('公墓推荐结果'));
  assert.ok(result.includes('候选下葬时间'));assert.ok(result.includes('公墓推荐结果'));assert.ok(!result.includes('服务选择'));assert.ok(!result.includes('<span>意向城市</span>'));assert.ok(result.includes('修改需求'));assert.ok(result.includes('保存选择并返回'));
  assert.ok(needs.indexOf('auspicious-actions')>needs.indexOf('</main>'));assert.ok(result.indexOf('auspicious-actions')>result.indexOf('</main>'));
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify({...saved,cemeteryMatches:recommendCemeteries(defaultCemeteryNeeds()),cemeteryAdvice:{...saved.cemeteryAdvice,promptVersion:'old-three-recommendations'}})}});
  const stale=render('results');assert.ok(stale.includes('服务选择'));assert.ok(!stale.includes('公墓推荐结果'));
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage')}
});
