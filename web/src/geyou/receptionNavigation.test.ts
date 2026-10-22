import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {createGuidedSale,saveGuidedSale} from './guidedSalesModel';
import {receptionDestination} from './receptionNavigation';

test('AI 转入流程后续谈返回保存的流程步骤，刷新仍有效',()=>{
 const seed=seedState(),staff=seed.staff[0];
 const created=createGuidedSale(seed,staff,{nickname:'测试',scenario:'advance',subjectName:'',occupation:'',interests:'',faith:'待确认',region:'',budget:0,notes:''});
 const ai={...created.session,ai:{category:'clothes' as const,recommendedProductIds:[]}};
 assert.equal(receptionDestination(ai),`/talk-ai?session=${ai.id}`);
 const state=saveGuidedSale({...created.state,consultations:[{...ai,receptionView:'flow'}]},staff,ai.id,{plan:{...ai.guided!.plan!,phase:'packages'}});
 const restored=JSON.parse(JSON.stringify(state)).consultations[0];
 assert.equal(receptionDestination(restored),`/talk?session=${ai.id}`);
 assert.equal(restored.guided.plan.phase,'packages');
 assert.equal(receptionDestination({...restored,receptionView:'ai'}),`/talk-ai?session=${ai.id}`);
 assert.equal(receptionDestination({...restored,receptionView:'ai',guided:{...restored.guided,plan:{...restored.guided.plan,outcome:'confirmed'}}}),`/talk-ai?session=${ai.id}`);
 assert.equal(receptionDestination(created.session),`/talk?session=${ai.id}`);
});
