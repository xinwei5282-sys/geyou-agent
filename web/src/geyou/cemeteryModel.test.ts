import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CEMETERIES,defaultCemeteryNeeds,recommendCemeteries,canFinishSelection,toggleSelectionMode} from './cemeteryModel';
test('recommendations respect city and district; uncovered regions remain empty',()=>{
 const needs=defaultCemeteryNeeds();assert.equal(recommendCemeteries(needs).length,CEMETERIES.length);
 assert.equal(recommendCemeteries({...needs,city:'杭州市',district:'西湖区'}).length,2);
 assert.deepEqual(recommendCemeteries({...needs,city:'上海'}),[]);
 assert.deepEqual(recommendCemeteries({...needs,district:'萧山区'}),[]);
});
test('unknown price and burial type remain pending; known mismatches are excluded',()=>{
 const needs={...defaultCemeteryNeeds(),maxBudget:'10000',burialType:'双穴／合葬'};
 const rows=recommendCemeteries(needs);assert.equal(rows.length,CEMETERIES.length);assert.ok(rows.every(r=>r.pending.some(p=>p.includes('预算'))&&r.pending.some(p=>p.includes('合葬'))));
 const base=CEMETERIES[0];assert.deepEqual(recommendCemeteries(needs,[{...base,priceFrom:20000}]),[]);
 assert.deepEqual(recommendCemeteries(needs,[{...base,burialTypes:['单穴'],burialTypesComplete:true}]),[]);
 assert.throws(()=>recommendCemeteries({...needs,maxBudget:'-1'}));assert.throws(()=>recommendCemeteries({...needs,maxBudget:'abc'}));assert.throws(()=>recommendCemeteries({...needs,city:' '}));
});
test('one combined record requires exactly the selections requested by its mode',()=>{
 assert.equal(canFinishSelection('burial','2026-11-01 09:00'),true);
 assert.equal(canFinishSelection('cemetery',undefined,'hz-second'),true);
 assert.equal(canFinishSelection('both','2026-11-01 09:00'),false);
 assert.equal(canFinishSelection('both',undefined,'hz-second'),false);
 assert.equal(canFinishSelection('both','2026-11-01 09:00','hz-second'),true);
});

test('two service buttons support either or both while retaining at least one service',()=>{
 assert.equal(toggleSelectionMode('burial','cemetery'),'both');
 assert.equal(toggleSelectionMode('both','burial'),'cemetery');
 assert.equal(toggleSelectionMode('cemetery','burial'),'both');
 assert.equal(toggleSelectionMode('both','cemetery'),'burial');
 assert.equal(toggleSelectionMode('burial','burial'),'burial');
 assert.equal(toggleSelectionMode('cemetery','cemetery'),'cemetery');
});
