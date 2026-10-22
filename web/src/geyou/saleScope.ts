import type {AppState,Quote} from './types';
export function saleScope(state:AppState,quote:Quote){
 const session=state.consultations?.find(c=>c.proposalId===quote.proposalId||c.id===state.proposals.find(p=>p.id===quote.proposalId)?.consultationId);
 let root=session;const seen=new Set<string>();
 while(root?.guided?.plan?.continuedFrom&&!seen.has(root.id)){seen.add(root.id);const previous=state.consultations?.find(c=>c.id===root!.guided!.plan!.continuedFrom&&c.agencyId===quote.agencyId);if(!previous)break;root=previous;}
 return JSON.stringify([quote.agencyId,quote.customerId||`talk:${root?.id||quote.proposalId}`,quote.deceasedId||null]);
}
export function serviceHasPayments(state:AppState,quote:Quote){
 const scope=saleScope(state,quote);
 return state.quotes.some(q=>saleScope(state,q)===scope&&(q.receipt?.amount||0)>0)||(state.salePayments||[]).some(p=>p.scopeKey===scope&&p.amount>0);
}
