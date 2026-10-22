import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, now } from './model';
import { talkReminderEntries, setTalkReminderStatus } from './talkReminders';
import type { Consultation } from './types';

function fixture() {
  const state = seedState();
  const staff = state.staff[0];
  const session: Consultation = { id: 'talk-unlinked', agencyId: staff.agencyId, staffId: staff.id, mode: 'general', answers: {}, messages: [], step: 0, createdAt: now(), updatedAt: now(), guided: { scenario: 'hospital', subjectName: '', occupation: '', interests: '', faith: '', region: '', budget: 0, notes: '', step: 0, selectedProductIds: [], plan: { phase: 'result', processPosition: 'immediate', needs: {}, scopeConfirmed: true, packages: [], continuation: 'continue', followupTask: { id: 'talk-task', title: '回访客户', date: '2099-01-01', items: '确认后续需求', message: '请继续沟通', status: '待确认', createdAt: now(), updatedAt: now() } } } };
  return { state: { ...state, consultations: [session] }, staff };
}

test('unlinked consultation reminders are visible to talk staff', () => {
  const { state, staff } = fixture();
  const entries = talkReminderEntries(state, staff);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].task.id, 'talk-task');
});

test('talk reminder status updates preserve the consultation snapshot', () => {
  const { state, staff } = fixture();
  const next = setTalkReminderStatus(state, staff, 'talk-unlinked', '已完成');
  assert.equal(next.consultations![0].guided?.plan?.followupTask?.status, '已完成');
  assert.equal(next.consultations![0].guided?.plan?.followupTask?.items, '确认后续需求');
  assert.equal(talkReminderEntries(next, staff).length, 1);
});
