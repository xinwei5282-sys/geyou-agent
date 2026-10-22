import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicFuneralPlan, validateFuneralPlanShare } from './funeralPlanShare';

const payload = {
  title: '本次丧事流程',
  steps: [{ title: '当前情况与手续核实', detail: '当前在医院，先核实手续。' }],
  pending: ['确认治丧或告别时间'],
  familyPrepared: ['寿衣或衣物已由家属准备，按实际使用核对'],
  agencyPrepared: ['寿衣'],
  agencyName: '格优服务',
  servicePhone: '0571-12345678',
};

test('public payload validator accepts bounded schema and returns a detached copy', () => {
  const result = validateFuneralPlanShare(payload);
  assert.deepEqual(result, payload);
  assert.notEqual(result, payload);
  for (const invalid of [
    { ...payload, rawState: {} },
    { ...payload, steps: [{ title: '步骤', detail: '内容', internal: 'secret' }] },
    { ...payload, title: ' ' },
    { ...payload, agencyPrepared: Array.from({ length: 101 }, () => '物品') },
    { ...payload, servicePhone: 'x'.repeat(31) },
  ]) assert.equal(validateFuneralPlanShare(invalid), null);
});

test('public projection removes private facts and only exposes fixed generated checklist entries', () => {
  const plan = {
    title: '本次丧事流程', scenario: '医院',
    steps: [
      { id: 'scene', title: '当前情况与手续核实', detail: '当前在医院。', status: '按当前场景' },
      { id: 'known-facts', title: '已确认情况', detail: '联系人：张某，电话：13800000000', status: '已记录' },
      { id: 'reservation', title: '预订信息', detail: '服务地址：真实地址', status: '部分信息已记录' },
      { id: 'confirmed-items', title: '已确认销售项目', detail: '报价列有：寿衣', status: '已确认' },
    ],
    pending: ['未知顾客私密信息', '确认治丧或告别时间'],
    familyPrepared: ['私密自由文本', '寿衣或衣物已由家属准备，按实际使用核对'],
    agencyPrepared: ['按已确认报价准备或衔接：寿衣'],
  };
  const result = buildPublicFuneralPlan(plan, { name: '格优服务', phone: '0571-12345678' });
  assert.deepEqual(result.steps.map(step => step.title), ['当前情况与手续核实']);
  assert.deepEqual(result.pending, ['确认治丧或告别时间']);
  assert.deepEqual(result.familyPrepared, ['寿衣或衣物已由家属准备，按实际使用核对']);
  assert.deepEqual(result.agencyPrepared, ['寿衣']);
  assert.doesNotMatch(JSON.stringify(result), /张某|13800000000|真实地址|私密/);
});
