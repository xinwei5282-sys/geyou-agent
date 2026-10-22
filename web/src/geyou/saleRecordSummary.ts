import type {AppState,Quote,Staff} from './types';
import {canAccessSalesRecord} from './model';
import {getSaleSummary} from './saleSettlementModel';

// Archive totals and service counts use the same accessible service scopes.
export function summarizeSaleRecords(state:AppState,staff:Staff,records:Quote[]){
 const quotes=records.filter(q=>canAccessSalesRecord(state,staff,q));
 const summaries=[...new Map(quotes.map(q=>{const summary=getSaleSummary(state,staff,q.id);return [summary.scopeKey,summary] as const})).values()];
 return {quotes,summaries,paid:summaries.reduce((sum,s)=>sum+s.paid,0),paymentCount:summaries.reduce((sum,s)=>sum+s.paymentCount,0)};
}
