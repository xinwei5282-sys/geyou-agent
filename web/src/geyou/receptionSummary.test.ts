import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReceptionSummary,referenceReceptionReply,currentReceptionMessages,isReferenceContinuation} from './receptionSummary';
import {backfillReceptionProfile} from './receptionArchiveModel';
import {seedState} from './model';
import {createGuidedSale} from './guidedSalesModel';
const summary={confirmed:['在医院，死亡证明已开具','姐姐负责协调'],pending:['宗教习俗待确认'],prepared:['寿衣已准备'],nextActions:['业务员明天下午联系姐姐核实告别时间']};
test('摘要有边界，不能把任意对象或超长数据入档',()=>{
 assert.deepEqual(validateReceptionSummary(summary),summary);
 assert.equal(validateReceptionSummary({...summary,pending:['x'.repeat(201)]}),null);
 assert.equal(validateReceptionSummary({...summary,confirmed:undefined}),null);
 assert.equal(validateReceptionSummary({...summary,extra:'未知字段'}),null);
});
test('摘要刷新后保留，整份新摘要替换过期事项，不改变整体预算',()=>{
 const seed=seedState(),staff=seed.staff[0];
 const created=createGuidedSale(seed,staff,{scenario:'advance',nickname:'新咨询',subjectName:'',occupation:'',interests:'',faith:'待确认',region:'',budget:0,notes:''});
 const first=backfillReceptionProfile(created.state,staff,created.session.id,{summary});
 const cid=first.consultations!.find(c=>c.id===created.session.id)!.customerId!;
 assert.deepEqual(first.customers.find(c=>c.id===cid)?.receptionProfile?.summary,summary);
 const refreshed=JSON.parse(JSON.stringify(first));
 const updated={...summary,pending:[],nextActions:['等家属主动联系']};
 const next=backfillReceptionProfile(refreshed,staff,created.session.id,{summary:updated});
 assert.deepEqual(next.customers.find(c=>c.id===cid)?.receptionProfile?.summary,updated);
 assert.equal(next.customers.find(c=>c.id===cid)?.budget,0);
 assert.equal(backfillReceptionProfile(created.state,seed.staff.find(s=>s.agencyId!==staff.agencyId)!,created.session.id,{summary}),created.state);
});
test('另一客户的参考回复不覆盖当前推荐、画像和摘要，后续请求排除参考历史',()=>{
 const seed=seedState(),staff=seed.staff[0],created=createGuidedSale(seed,staff,{scenario:'hospital',nickname:'甲客户',subjectName:'甲先生',occupation:'教师',interests:'棉质',faith:'佛教',region:'杭州',budget:150000,notes:''});
 const record={...created.session,ai:{category:'clothes' as const,recommendedProductIds:['p2'],summary}};
 const messages=[...record.messages,{role:'user' as const,text:'另外一位客户乙的情况'}];
 const next=referenceReceptionReply(record,messages,{reply:'请切换客户后接待',staffScript:[{title:'参考话术',text:'请慢慢说'}],todos:['【材料】备齐示例中的有效身份证件'],quickReplies:['暂不清楚']});
 assert.equal(next.ai,record.ai);assert.equal(next.guided,record.guided);assert.equal(next.customerId,record.customerId);
 assert.equal(next.messages.at(-1)?.replyScope,'reference');assert.equal(next.messages.at(-2)?.replyScope,'reference');
 assert.deepEqual(next.messages.at(-1)?.todos,['【材料】备齐示例中的有效身份证件']);assert.deepEqual(next.messages.at(-1)?.quickReplies,['暂不清楚']);
 assert.deepEqual(currentReceptionMessages(next.messages),record.messages);
 assert.equal(isReferenceContinuation(next.messages,'他是基督教'),true);
 assert.equal(isReferenceContinuation(next.messages,'回到当前客户，继续接待'),false);
 assert.equal(isReferenceContinuation(next.messages,'别回到当前客户，继续看乙'),true);
});
