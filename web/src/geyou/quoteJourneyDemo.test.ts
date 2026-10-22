import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {withQuoteJourneyDemo,QUOTE_JOURNEY_DEMO} from './quoteJourneyDemo';

test('quote journey example links reception, quotation and pending family feedback without replacing user records',()=>{
 const original=seedState(),before=JSON.stringify(original);
 const next=withQuoteJourneyDemo(original);
 const quote=next.quotes.find(q=>q.id===QUOTE_JOURNEY_DEMO.quoteId)!;
 const proposal=next.proposals.find(p=>p.id===quote.proposalId)!;
 const session=next.consultations!.find(c=>c.id===proposal.consultationId)!;
 assert.equal(session.customerId,quote.customerId);
 assert.equal(session.guided!.plan!.outcome,'confirmed');
 assert.equal(quote.feedback?.[0].kind,'希望调整');
 assert.equal(next.customers.find(c=>c.id===quote.customerId)?.stage,'跟进中');
 assert.equal(JSON.stringify(original),before);
 assert.deepEqual(next.quotes.find(q=>q.id==='quote-sample'),original.quotes[0]);
 assert.equal(withQuoteJourneyDemo(next),next);
});
test('example migration does not recreate a removed case or overwrite a collision',()=>{
 const next=withQuoteJourneyDemo(seedState());
 const removed={...next,quotes:next.quotes.filter(q=>q.id!==QUOTE_JOURNEY_DEMO.quoteId)};
 assert.equal(withQuoteJourneyDemo(removed),removed);
 const original=seedState();original.quotes[0]={...original.quotes[0],id:QUOTE_JOURNEY_DEMO.quoteId};
 assert.equal(withQuoteJourneyDemo(original),original);
});
