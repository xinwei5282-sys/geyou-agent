import test from 'node:test';
import assert from 'node:assert/strict';
import type { Consultation, GuidedSale, Product } from './types';
import { seedState } from './model';
import { CASE_INITIAL_TEXT, CASE_REPLIES, simulateReceptionCase } from './receptionCase';

const initialGuided = (): GuidedSale => ({
  scenario: 'advance', subjectName: '', occupation: '', interests: '', faith: '待确认', region: '',
  budget: 0, notes: '', step: 0, selectedProductIds: [],
  plan: { phase: 'scope', processPosition: 'advance', needs: {}, scopeConfirmed: false, packages: [], continuation: 'undecided', selectedLines: [] },
});

function baseRecord(guided = initialGuided()): Consultation {
  return {
    id: 'reception-case-local', agencyId: 'agency-a', staffId: 'staff-lin', mode: 'general', answers: { retained: 'yes' },
    messages: [], step: 2, createdAt: '2026-10-09T00:00:00.000Z', updatedAt: '2026-10-09T00:00:00.000Z', guided,
    ai: { category: 'clothes', recommendedProductIds: [], staffScriptContext: 'existing-context', staffScript: [] },
  };
}

test('三轮案例先补资料，再按真实可售寿衣回应费用和选择，不自动加入清单', () => {
  const state = seedState();
  const staff = state.staff.find(item => item.id === 'staff-lin')!;
  const before = structuredClone(state);

  const first = simulateReceptionCase(state, staff, baseRecord(), CASE_INITIAL_TEXT);
  assert.equal(first.guided?.scenario, 'hospital');
  assert.notEqual(first.updatedAt, '2026-10-09T00:00:00.000Z');
  assert.equal(first.guided?.budget, 0);
  assert.equal(first.guided?.faith, '待确认');
  assert.deepEqual(first.ai?.recommendedProductIds, []);
  assert.equal(first.ai?.staffScript?.length, 3);
  assert.match(first.ai?.staffScript?.[1].advice || '', /预算或信仰信息尚未确认/);
  assert.match(first.messages.at(-1)?.text || '', /大致预算范围/);
  assert.doesNotMatch(first.messages.at(-1)?.text || '', /有需要遵循的信仰吗/);

  const details = simulateReceptionCase(state, staff, first, CASE_REPLIES[0]);
  assert.equal(details.guided?.budget, 150_000);
  assert.equal(details.guided?.faith, '无特定信仰');
  assert.match(details.guided?.interests || '', /棉质/);
  assert.match(details.guided?.interests || '', /素雅/);
  assert.equal(details.guided?.plan?.needs.urn, 'prepared');
  assert.ok(details.ai?.recommendedProductIds.length);
  assert.deepEqual(details.ai?.recommendedProductIds.map(id => state.products.find(product => product.id === id)?.category), ['寿衣']);
  assert.ok(details.ai?.recommendedProductIds.every(id => state.products.some(product => product.id === id && product.agencyId === staff.agencyId && product.enabled && !product.religion)));
  assert.match(details.ai?.staffScript?.[1].text || '', /安宁传统寿衣套装/);
  assert.match(details.ai?.staffScript?.[1].text || '', /980元/);
  assert.doesNotMatch(details.ai?.staffScript?.[1].text || '', /骨灰盒/);
  assert.equal(details.guided?.plan?.needs.urn, 'prepared', '原案例句“骨灰盒已经备好”必须识别为已准备');

  const concern = simulateReceptionCase(state, staff, details, CASE_REPLIES[1]);
  assert.equal(concern.guided?.budget, 150_000);
  assert.match(concern.guided?.notes || '', /费用偏高/);
  assert.match(concern.messages.at(-1)?.text || '', /按您已说明的预算和偏好/);
  assert.equal(concern.ai?.staffScript?.length, 3);
  assert.match(concern.ai?.staffScript?.[2].advice || '', /优先比较本店可售的低价款/);
  assert.match(concern.ai?.staffScript?.[2].text || '', /售价980元/);

  const selectedIntent = simulateReceptionCase(state, staff, concern, CASE_REPLIES[2]);
  assert.match(selectedIntent.messages.at(-1)?.text || '', /加入清单前请核对规格、数量和价格/);
  assert.deepEqual(selectedIntent.guided?.plan?.selectedLines, []);
  assert.deepEqual(selectedIntent.guided?.selectedProductIds, []);
  assert.equal(selectedIntent.ai?.staffScript?.length, 3);
  assert.deepEqual(state, before);
  assert.deepEqual(selectedIntent.answers, { retained: 'yes' });
  assert.equal(selectedIntent.ai?.staffScriptContext, 'existing-context');
  assert.equal(selectedIntent.messages.length, 8);
});

test('预算顾虑优先展示更低价商品且保留已有选择，不把意向自动加入清单', () => {
  const state = seedState();
  const cheaper: Product = {
    id: 'case-basic-cotton', agencyId: 'agency-a', name: '素朴基础棉质寿衣', category: '寿衣', kind: '商品', source: '自有商品',
    price: 68_000, unit: '套', enabled: true, description: '基础棉质款，素雅简洁。', spec: '素色基础款',
  };
  state.products.push(cheaper);
  const staff = state.staff.find(item => item.id === 'staff-lin')!;
  const p3 = state.products.find(product => product.id === 'p3')!;
  const preselected = { productId: p3.id, name: p3.name, unit: p3.unit, price: p3.price, quantity: 1, kind: p3.kind };
  const guided = initialGuided();
  guided.budget = 150_000;
  guided.faith = '无特定信仰';
  guided.selectedProductIds = [p3.id];
  guided.plan!.selectedLines = [preselected];

  const updated = simulateReceptionCase(state, staff, baseRecord(guided), CASE_REPLIES[1]);
  assert.equal(updated.ai?.recommendedProductIds[0], cheaper.id);
  assert.deepEqual(updated.guided?.plan?.selectedLines, [preselected]);
  assert.deepEqual(updated.guided?.selectedProductIds, [p3.id]);
  const next = simulateReceptionCase(state, staff, updated, CASE_REPLIES[2]);
  assert.deepEqual(next.guided?.plan?.selectedLines, [preselected]);
  assert.deepEqual(next.guided?.selectedProductIds, [p3.id]);
});

test('未确认信仰隐藏宗教专属商品，已明确信仰只推荐匹配且本店可售商品', () => {
  const state = seedState();
  const makeFaithProduct = (id: string, agencyId: string, religion: string, price: number): Product => ({
    id, agencyId, name: `${religion}棉质寿衣`, category: '寿衣', kind: '商品', source: '自有商品', price, unit: '套', enabled: true,
    religion, description: `${religion}专属用品`,
  });
  state.products.push(
    makeFaithProduct('christian-clothes', 'agency-a', '基督教', 50_000),
    makeFaithProduct('buddhist-clothes', 'agency-a', '佛教', 40_000),
    makeFaithProduct('other-store-clothes', 'agency-b', '基督教', 30_000),
  );
  const staff = state.staff.find(item => item.id === 'staff-lin')!;
  const guided = initialGuided();
  guided.budget = 150_000;
  const unknown = simulateReceptionCase(state, staff, baseRecord(guided), '预算1500元，先看看寿衣。');
  assert.ok(unknown.ai?.recommendedProductIds.every(id => !state.products.find(product => product.id === id)?.religion));

  guided.faith = '基督教';
  const christian = simulateReceptionCase(state, staff, baseRecord(guided), '我们有基督教信仰要求。');
  const recommended = christian.ai?.recommendedProductIds || [];
  assert.ok(recommended.includes('christian-clothes'));
  assert.ok(!recommended.includes('buddhist-clothes'));
  assert.ok(!recommended.includes('other-store-clothes'));
});

test('未知自由文本保留已有资料并给出可人工补充的适配回复', () => {
  const state = seedState();
  const staff = state.staff.find(item => item.id === 'staff-lin')!;
  const guided = { ...initialGuided(), budget: 150_000, interests: '棉质' };
  const result = simulateReceptionCase(state, staff, baseRecord(guided), '我现在还不确定，想再了解一下。');
  assert.equal(result.guided?.budget, 150_000);
  assert.equal(result.guided?.interests, '棉质');
  assert.match(result.messages.at(-1)?.text || '', /未确认的内容先保留/);
  assert.match(result.messages.at(-1)?.text || '', /业务员也可按现场沟通补记/);
});

test('明确以“块”表达的预算也换算为分', () => {
  const state = seedState();
  const staff = state.staff.find(item => item.id === 'staff-lin')!;
  const result = simulateReceptionCase(state, staff, baseRecord(), '预算1200块，先了解一下寿衣。');
  assert.equal(result.guided?.budget, 120_000);
});
