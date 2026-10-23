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

test('personalized draft regenerates only generated extras, preserves manual replacements and requires fresh pricing',async()=>{
 const {personalizedPaperPlan}=await import('./agentQuoteAdvice');
 const plan={basePrice:PAPER_PACKAGE.price,extras:[{id:'accompany',quantity:2},{id:'wreath100',quantity:1}],autoExtraIds:['wreath100'],pricesChecked:true,updatedAt:'old',omitted:['佛经10包']};
 const next=personalizedPaperPlan(plan,{text:'根据园艺喜好采用花圈方案',items:[{id:'wreath200',reason:'园艺喜好'}]});
 assert.deepEqual(next.extras,[{id:'accompany',quantity:2},{id:'wreath200',quantity:1}]);assert.deepEqual(next.omitted,plan.omitted);assert.equal(next.pricesChecked,false);assert.equal(next.confirmedAt,undefined);assert.ok(next.personalizedAt);assert.equal(next.personalizationSummary,'根据园艺喜好采用花圈方案');
 assert.deepEqual(personalizedPaperPlan(next,{text:'从简，不增加项目',items:[]}).extras,[{id:'accompany',quantity:2}]);
 assert.throws(()=>personalizedPaperPlan({...plan,confirmedAt:'confirmed'},{text:'x',items:[]}));
 assert.throws(()=>personalizedPaperPlan(plan,{text:'x',items:[{id:'invented',reason:'x'}]}));
});
