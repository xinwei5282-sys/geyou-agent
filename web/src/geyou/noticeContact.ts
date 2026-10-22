import type {AppState,Notice,Staff} from './types';
/** Agent-authored notices use the responsible agent's account phone in every view. */
export function noticeServicePhone(state:AppState,notice:Notice,currentAgent?:Staff):string{
 const staffId=currentAgent?.id||notice.serviceStaffId||state.customers.find(c=>c.id===notice.customerId&&c.agencyId===notice.agencyId)?.ownerId;
 if(staffId)return state.staff.find(s=>s.id===staffId&&s.agencyId===notice.agencyId&&s.enabled!==false)?.phone?.trim()||'';
 return state.agencies.find(a=>a.id===notice.agencyId)?.phone||'';
}
