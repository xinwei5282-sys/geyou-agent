import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, finalizeQuote, migrateState, setServiceDeal, updateServiceInfo, serviceRecordFor } from './model';
import { createGuidedSale, saveGuidedSale } from './guidedSalesModel';
import { savePlannedResult } from './plannedResultModel';
import {
  addPortrait,
  bindNotice,
  confirmPortrait,
  finishPortraitRepair,
  saveDeceased,
  setPortraitJob,
  startPortraitRepair,
  selectedPortrait,
} from './memorialModel';
import { syncNoticeWorkflow } from './serviceAutomation';
import {prepareNoticePublication} from './noticePublication';
import type { AppState, Customer, Notice } from './types';

const customerId = 'journey-customer';
const deceasedId = 'journey-deceased-a';
const otherDeceasedId = 'journey-deceased-b';
const original = 'data:image/png;base64,b3JpZ2luYWw=';
const repaired = 'data:image/png;base64,cmVzdG9yZWQ=';
const farewell = '2026-10-20';

function newCustomerState(): AppState {
  const state = seedState();
  const customer: Customer = {
    id: customerId,
    agencyId: 'agency-a',
    ownerId: 'boss-a',
    name: '流程回归新客户',
    phone: '13800009991',
    region: state.agencies[0].region,
    budget: 500000,
    stage: '待跟进',
    note: '由本测试独立创建',
    createdAt: new Date().toISOString(),
    followups: [],
  };
  return {
    ...state,
    customers: [customer],
    proposals: [],
    quotes: [],
    consultations: [],
    notices: [],
    visits: [],
  };
}

function assertJourneyLinks(state: AppState, quoteId: string, proposalId: string, consultationId: string, portraitId: string, noticeId: string) {
  const customer = state.customers.find(item => item.id === customerId)!;
  const person = customer.deceased!.find(item => item.id === deceasedId)!;
  const other = customer.deceased!.find(item => item.id === otherDeceasedId)!;
  const quote = state.quotes.find(item => item.id === quoteId)!;
  const proposal = state.proposals.find(item => item.id === proposalId)!;
  const consultation = state.consultations!.find(item => item.id === consultationId)!;
  const notice = state.notices.find(item => item.id === noticeId)!;
  const service = serviceRecordFor(customer, deceasedId);
  const portrait = person.portraits.find(item => item.id === portraitId)!;

  assert.equal(quote.customerId, customerId);
  assert.equal(quote.deceasedId, deceasedId);
  assert.equal(quote.serviceId, `${customerId}:${deceasedId}`);
  assert.equal(proposal.customerId, customerId);
  assert.equal(proposal.deceasedId, deceasedId);
  assert.equal(proposal.serviceId, `${customerId}:${deceasedId}`);
  assert.equal(proposal.consultationId, consultationId);
  assert.equal(consultation.customerId, customerId);
  assert.equal(consultation.deceasedId, deceasedId);
  assert.equal(consultation.serviceId, `${customerId}:${deceasedId}`);
  assert.equal(service.dealStage, '已成交');
  assert.equal(service.phase, '治丧筹备');
  assert.ok(service.tasks.length > 0);
  assert.ok(service.tasks.every(task => task.deceasedId === deceasedId));
  for (const key of ['prepare-portrait', 'draft-notice', 'confirm-notice', 'publish-notice'] as const) {
    const task = service.tasks.find(item => item.autoKey === key)!;
    assert.ok(task, `缺少阶段待办 ${key}`);
    assert.equal(task.status, '已完成');
    if (key !== 'prepare-portrait') assert.equal(task.noticeId, noticeId);
  }
  assert.equal(selectedPortrait(person)?.recordId, portraitId);
  assert.equal(selectedPortrait(person)?.image, repaired);
  assert.equal(portrait.status, '已完成');
  assert.equal(portrait.jobId, 'portrait-job-demo');
  assert.ok(portrait.confirmedAt);
  assert.equal(notice.customerId, customerId);
  assert.equal(notice.deceasedId, deceasedId);
  assert.equal(notice.status, '已发布');
  assert.equal(notice.familyConfirmedBy, 'boss-a');
  assert.equal(notice.portraitRecordId, portraitId);
  assert.equal(notice.portrait, repaired);
  assert.equal(other.portraits.length, 0);
  assert.equal(other.service, undefined);
  assert.equal(state.quotes.some(item => item.deceasedId === otherDeceasedId), false);
}

test('new customer flows through guided sale, service tasks, portrait, notice, and JSON migration without crossing deceased records', () => {
  const staff = seedState().staff[0];
  let state = newCustomerState();
  state = saveDeceased(state, staff, customerId, { id: deceasedId, name: '流程测试逝者甲', age: '81', relationship: '父亲' });
  state = saveDeceased(state, staff, customerId, { id: otherDeceasedId, name: '流程测试逝者乙', age: '79', relationship: '母亲' });

  const sale = createGuidedSale(state, staff, {
    scenario: 'advance', subjectName: '流程测试逝者甲', occupation: '', interests: '', faith: '待确认',
    region: state.customers[0].region, budget: 500000, notes: '', nickname: '流程回归新客户',
    customerId, deceasedId,
  });
  const plan = sale.session.guided!.plan!;
  const selectedLines = ['p2', 'p1'].map(id => {
    const product = state.products.find(item => item.id === id)!;
    return { productId: product.id, name: product.name, unit: product.unit, kind: product.kind, price: product.price, quantity: 1 };
  });
  state = saveGuidedSale(sale.state, staff, sale.session.id, {
    plan: { ...plan, phase: 'result', scopeConfirmed: true, needs: { ...plan.needs, clothes: 'needed', urn: 'needed' }, selectedLines },
  });
  state = savePlannedResult(state, staff, sale.session.id, true);
  const proposalId = state.consultations!.find(item => item.id === sale.session.id)!.proposalId!;
  const finalized = finalizeQuote(state, proposalId, staff, true);
  state = setServiceDeal(finalized.state, customerId, deceasedId, staff, '已成交');
  state = updateServiceInfo(state, customerId, staff, { phase: '治丧筹备' }, deceasedId);

  state = addPortrait(state, staff, customerId, deceasedId, original);
  const uploaded = state.customers[0].deceased!.find(item => item.id === deceasedId)!.portraits[0];
  const started = startPortraitRepair(state, staff, customerId, deceasedId, uploaded.id);
  state = setPortraitJob(started.state, staff, customerId, deceasedId, started.recordId, 'portrait-job-demo');
  assert.equal(state.customers[0].deceased!.find(item => item.id === deceasedId)!.portraits[0].status, '处理中');
  state = finishPortraitRepair(state, staff, customerId, deceasedId, started.recordId, repaired, 'demo-model-v1');
  state = confirmPortrait(state, staff, customerId, deceasedId, started.recordId, 'result');

  const baseNotice: Notice = {
    id: 'journey-notice', agencyId: staff.agencyId, name: '', age: '', date: '2026-10-09',
    ceremonyDate: `${farewell}T09:00`, location: '杭州示例告别厅', text: '家属谨此寄托哀思，具体安排以确认信息为准。',
    status: '草稿', createdAt: new Date().toISOString(),
  };
  const draft = bindNotice(state, staff, baseNotice, customerId, deceasedId);
  state = syncNoticeWorkflow({ ...state, notices: [...state.notices, draft] }, draft, true);
  const draftTasks = serviceRecordFor(state.customers[0], deceasedId).tasks;
  assert.equal(draftTasks.find(task => task.autoKey === 'draft-notice')?.status, '已完成');
  assert.equal(serviceRecordFor(state.customers[0], deceasedId).dates.farewell, undefined);
  assert.throws(()=>prepareNoticePublication(state,staff,draft),/家属确认|与家属确认/);

  const published: Notice = {
    ...draft, status: '已发布', familyConfirmedAt: new Date().toISOString(), familyConfirmedBy: staff.id,
  };
  state = prepareNoticePublication(state, staff, published);
  state = syncNoticeWorkflow({ ...state, notices: state.notices.map(item => item.id === published.id ? published : item) }, published);

  const restored = migrateState(JSON.parse(JSON.stringify(state)) as AppState);
  assertJourneyLinks(restored, finalized.quote.id, proposalId, sale.session.id, started.recordId, published.id);
});
