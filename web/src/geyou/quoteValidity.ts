import type {AppState,Quote} from './types';
export function latestQuoteVersion(state:Pick<AppState,'quotes'>,quote:Quote){
 return state.quotes.filter(q=>q.agencyId===quote.agencyId&&q.proposalId===quote.proposalId).sort((a,b)=>b.version-a.version)[0];
}
export function isCurrentQuote(state:Pick<AppState,'quotes'>,quote:Quote){return !quote.revoked&&latestQuoteVersion(state,quote)?.id===quote.id;}
export function isPublicQuote(state:AppState,quote:Quote){return isCurrentQuote(state,quote)&&state.agencies.some(a=>a.id===quote.agencyId&&a.access?.enabled!==false);}
