import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quotationAdvice,addAdvisedExtra,shouldGenerateQuoteAdvice} from './agentQuoteAdvice';
import {PAPER_PACKAGE,paperPlanTotal} from './agentPackageSource';
test('advice remains separate; only explicit addition changes draft and resets pricing',()=>{
 const plan={basePrice:PAPER_PACKAGE.price,extras:[],pricesChecked:true,updatedAt:'test'};
 const advice=quotationAdvice({reply:'核对花圈需求',recommendations:[{productId:'invented',reason:'x'},{productId:'paper-wreath100',reason:'明确需求'}]});
 assert.deepEqual(advice.items,[{id:'wreath100',reason:'明确需求'}]);assert.equal(paperPlanTotal(plan),458000);
 const next=addAdvisedExtra(plan,advice.items[0].id);assert.equal(paperPlanTotal(next),468000);assert.equal(next.pricesChecked,false);assert.equal(addAdvisedExtra(next,'wreath100'),next);assert.throws(()=>addAdvisedExtra({...plan,confirmedAt:'test'},'wreath100'));assert.throws(()=>addAdvisedExtra(plan,'invented'));
 assert.equal(shouldGenerateQuoteAdvice(true),false);assert.equal(shouldGenerateQuoteAdvice(false),true);
});
