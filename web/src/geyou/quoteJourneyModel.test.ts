import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, finalizeQuote } from './model';
import { submitQuoteFeedback, markQuoteShared, resolveQuoteFeedback, beginQuoteRevision } from './quoteJourneyModel';

function quoted() {
  const state = seedState();
  const staff = state.staff.find(x => x.id === 'staff-lin')!;
  const proposal = { ...state.proposals[0], id: 'proposal-journey', customerId: 'c1', status: '待客户确认' as const };
  state.proposals.push(proposal);
  const result = finalizeQuote(state, proposal.id, staff, true);
  return { state: result.state, quote: result.quote, staff };
}

test('feedback is bounded, trims text, and deduplicates same unresolved kind and text', () => {
  const { state, quote } = quoted();
  const once = submitQuoteFeedback(state, quote.id, { kind: '希望调整', text: '  希望更换款式  ' });
  assert.equal(once.quotes.find(q => q.id === quote.id)?.feedback?.[0].text, '希望更换款式');
  assert.equal(submitQuoteFeedback(once, quote.id, { kind: '希望调整', text: '希望更换款式' }), once);
  assert.throws(() => submitQuoteFeedback(state, quote.id, { kind: '希望调整', text: '  ' }), /填写/);
  assert.throws(() => submitQuoteFeedback(state, quote.id, { kind: '认可清单', text: 'a'.repeat(1001) }), /1000/);
});

test('feedback only applies to latest effective quote and a receipt prevents revision', () => {
  const { state, quote, staff } = quoted();
  const revision = beginQuoteRevision(state, staff, quote.id);
  const next = finalizeQuote(revision.state, revision.proposal.id, staff, true);
  assert.equal(next.quote.version, 2);
  assert.throws(() => submitQuoteFeedback(next.state, quote.id, { kind: '认可清单', text: '' }), /最新/);
  const paid = { ...state, quotes: state.quotes.map(q => q.id === quote.id ? { ...q, receipt: { amount: 1, recordedAt: '', recordedBy: staff.id, recorderName: staff.name, payeeName: '', note: '' } } : q) };
  assert.throws(() => beginQuoteRevision(paid, staff, quote.id), /收款/);
});

test('share and resolve require access; resolving never alters deal or payment state', () => {
  const { state, quote, staff } = quoted();
  const shared = markQuoteShared(state, staff, quote.id);
  assert.equal(shared.quotes.find(q => q.id === quote.id)?.sharedBy, staff.id);
  const withFeedback = submitQuoteFeedback(shared, quote.id, { kind: '需要联系', text: '' });
  const beforeCustomers = structuredClone(withFeedback.customers);
  const entry = withFeedback.quotes.find(q => q.id === quote.id)!.feedback![0];
  const resolved = resolveQuoteFeedback(withFeedback, staff, quote.id, entry.id, '已联系客户并说明');
  assert.equal(resolved.quotes.find(q => q.id === quote.id)?.feedback?.[0].status, '已处理');
  assert.deepEqual(resolved.customers, beforeCustomers);
  assert.throws(() => resolveQuoteFeedback(withFeedback, staff, quote.id, entry.id, '  '), /说明/);
  assert.throws(() => markQuoteShared(state, state.staff.find(x => x.id === 'boss-b')!, quote.id), /权限/);
});

test('revision reuses proposal identity, preserves a confirmed guided plan, and reopens idempotently', () => {
  const { state, quote, staff } = quoted();
  const guided = { ...state, consultations: [{ id: 'talk-1', agencyId: staff.agencyId, staffId: staff.id, mode: 'general' as const, answers: {}, messages: [], step: 1, createdAt: '', updatedAt: '', proposalId: quote.proposalId, guided: { scenario: 'advance' as const, subjectName: '', occupation: '', interests: '', faith: '', region: '', budget: 1, notes: '', step: 1, selectedProductIds: [], plan: { phase: 'confirmed' } as any } }] };
  const initialPlan = structuredClone(guided.consultations![0].guided!.plan);
  const begun = beginQuoteRevision(guided, staff, quote.id);
  const reopened = beginQuoteRevision(begun.state, staff, quote.id);
  assert.equal(begun.proposal.id, quote.proposalId);
  assert.equal(begun.proposal.status, '待客户确认');
  assert.deepEqual(reopened.proposal.lines, begun.proposal.lines);
  assert.deepEqual(reopened.state.consultations![0].guided!.plan, initialPlan);
});
