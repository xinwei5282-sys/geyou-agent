import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from './model';
import { createGuidedSale, saveConsultationDetails } from './guidedSalesModel';
import { continuePlannedSale } from './plannedResultModel';

const details = {
  scenario: 'advance' as const,
  subjectName: '服务对象甲',
  subjectGender: '女',
  subjectAge: '86',
  customs: '按家属意愿从简',
  nickname: '家属甲',
  occupation: '',
  interests: '',
  faith: '待确认',
  region: '杭州',
  budget: 0,
  notes: '',
  serviceAddress: '杭州市拱墅区某路',
  reservationTime: '2026-10-20T10:30',
  familySupplies: '已备寿衣',
};

function profile(session: ReturnType<typeof createGuidedSale>['session']) {
  const guided = session.guided!;
  return {
    nickname: session.contact?.name || '',
    phone: session.contact?.phone,
    budget: guided.budget,
    subjectName: guided.subjectName,
    region: guided.region,
    faith: guided.faith,
    occupation: guided.occupation,
    interests: guided.interests,
    notes: guided.notes,
    scenario: guided.scenario,
  };
}

test('optional booking details are saved at start and preserved when a later profile save omits them', () => {
  const seed = seedState();
  const staff = seed.staff[0];
  const created = createGuidedSale(seed, staff, details);
  const saved = saveConsultationDetails(created.state, staff, created.session.id, profile(created.session));
  const guided = saved.consultations!.find(item => item.id === created.session.id)!.guided!;
  assert.deepEqual([guided.serviceAddress, guided.reservationTime, guided.familySupplies], ['杭州市拱墅区某路', '2026-10-20T10:30', '已备寿衣']);
});

test('explicit empty booking details clear them, while malformed dates and overlong text are rejected', () => {
  const seed = seedState();
  const staff = seed.staff[0];
  const created = createGuidedSale(seed, staff, details);
  const cleared = saveConsultationDetails(created.state, staff, created.session.id, {
    ...profile(created.session), serviceAddress: '', reservationTime: '', familySupplies: '',
  });
  const guided = cleared.consultations!.find(item => item.id === created.session.id)!.guided!;
  assert.deepEqual([guided.serviceAddress, guided.reservationTime, guided.familySupplies], ['', '', '']);
  assert.throws(() => saveConsultationDetails(created.state, staff, created.session.id, {
    ...profile(created.session), reservationTime: '2026-02-30T10:00',
  }), /预约时间/);
  assert.throws(() => saveConsultationDetails(created.state, staff, created.session.id, {
    ...profile(created.session), serviceAddress: '路'.repeat(501),
  }), /500/);
  assert.throws(() => saveConsultationDetails(created.state, staff, created.session.id, {
    ...profile(created.session), familySupplies: '物品'.repeat(251),
  }), /500/);
});

test('new consultations reject invalid booking details before saving them', () => {
  const seed = seedState();
  const staff = seed.staff[0];
  assert.throws(() => createGuidedSale(seed, staff, { ...details, reservationTime: '2026-13-02T10:00' }), /预约时间/);
  assert.throws(() => createGuidedSale(seed, staff, { ...details, familySupplies: '物品'.repeat(251) }), /500/);
});

test('continuing a confirmed service retains booking details and the full subject profile', () => {
  const seed = seedState();
  const staff = seed.staff[0];
  const created = createGuidedSale(seed, staff, { ...details, customerId: 'c1' });
  const confirmed = {
    ...created.state,
    consultations: created.state.consultations!.map(item => item.id === created.session.id
      ? { ...item, guided: { ...item.guided!, plan: { ...item.guided!.plan!, outcome: 'confirmed' as const } } }
      : item),
  };
  const continued = continuePlannedSale(confirmed, staff, created.session.id);
  const next = continued.session.guided!;
  assert.deepEqual(
    [next.serviceAddress, next.reservationTime, next.familySupplies, next.subjectGender, next.subjectAge, next.customs],
    ['杭州市拱墅区某路', '2026-10-20T10:30', '已备寿衣', '女', '86', '按家属意愿从简'],
  );
});

test('booking details remain isolated between different customer consultations', () => {
  const seed = seedState();
  const staff = seed.staff[0];
  const first = createGuidedSale(seed, staff, { ...details, customerId: 'c1' });
  const second = createGuidedSale(first.state, staff, { ...details, customerId: 'c2', serviceAddress: undefined, reservationTime: undefined, familySupplies: undefined });
  const guided = second.session.guided!;
  assert.deepEqual([guided.serviceAddress, guided.reservationTime, guided.familySupplies], [undefined, undefined, undefined]);
});
