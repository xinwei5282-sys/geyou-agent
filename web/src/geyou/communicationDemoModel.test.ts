import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {ensureCommunicationDemo,communicationDemoId} from './communicationDemoModel';
import {getSaleSummary} from './saleSettlementModel';
import {isPublicNotice} from './noticePublication';
import {receptionBusinessFacts} from './receptionBusinessContext';
test('explicit demo is isolated, idempotent, persistent, paid and still needs photo adoption and notice review',()=>{
 const base=seedState(),staff=base.staff[0],before=JSON.stringify({customers:base.customers,quotes:base.quotes});const created=ensureCommunicationDemo(base,staff);assert.equal(JSON.stringify({customers:base.customers,quotes:base.quotes}),before);
 const customer=created.state.customers.find(c=>c.id===communicationDemoId(staff))!;assert.equal(customer.ownerId,staff.id);assert.equal(created.session.customerId,customer.id);assert.equal(created.session.guided!.plan!.outcome,'confirmed');
 const quote=created.state.quotes.find(q=>q.proposalId===created.session.proposalId)!;const summary=getSaleSummary(created.state,staff,quote.id);assert.equal(summary.total,218000);assert.equal(summary.paid,100000);assert.equal(summary.balance,118000);assert.equal(summary.quotes.length,2);
 const person=customer.deceased![0];assert.equal(person.portraits[0].status,'已完成');assert.equal(person.selectedPortraitId,undefined);assert.equal(person.service!.tasks.find(t=>t.autoKey==='prepare-portrait')!.status,'待确认');assert.equal(isPublicNotice(created.state,created.state.notices.find(n=>n.customerId===customer.id)!),false);
 const restored=JSON.parse(JSON.stringify(created.state));assert.equal(ensureCommunicationDemo(restored,staff).session.id,created.session.id);assert.equal(ensureCommunicationDemo(restored,staff).state,restored);assert.match(receptionBusinessFacts(restored,staff,created.session).join(''),/系统登记收款1000元/);
});
test('case migration embeds real responses in customer history once and keeps later staff messages',()=>{
 const base=seedState(),staff=base.staff[0],created=ensureCommunicationDemo(base,staff);const id=created.session.id;
 assert.equal(created.session.messages.length,8);assert.equal(created.session.messages[0].role,'user');assert.equal(created.session.messages[1].role,'assistant');assert.match(created.session.messages[1].text,/增购/);
 const old={...created.session,communicationHistoryVersion:undefined,messages:[{role:'assistant' as const,text:'这是独立测试案例：同一客户已确认两笔清单，旧引导。'},{role:'user' as const,text:'业务员已经追加的原有消息'}]};
 const state={...created.state,consultations:created.state.consultations!.map(c=>c.id===id?old:c)};const migrated=ensureCommunicationDemo(state,staff);assert.equal(migrated.session.messages.length,9);assert.equal(migrated.session.messages.at(-1)!.text,'业务员已经追加的原有消息');assert.equal(ensureCommunicationDemo(migrated.state,staff).state,migrated.state);assert.equal(migrated.state.quotes,state.quotes);assert.equal(migrated.state.salePayments,state.salePayments);
});
