import type { AppState } from './types';
// Public fixture for this local prototype only: an owner already provisioned by the service platform.
// Never replace credentials, account state, permissions or business records entered by the user.
export const DEMO_PHONE='13900000000';
export function withDemoAccount(s:AppState):AppState{
 const boss=s.staff.find(st=>st.id==='boss-a'&&st.agencyId==='agency-a'&&st.role==='老板');
 const agency=s.agencies.find(a=>a.id==='agency-a');
 if(!boss||!agency?.access||boss.credential||boss.enabled===false||agency.access.enabled===false||agency.access.loginPhone||boss.phone)return s;
 if(s.staff.some(st=>st.id!==boss.id&&st.phone===DEMO_PHONE)||s.agencies.some(a=>a.id!==agency.id&&a.access?.loginPhone===DEMO_PHONE))return s;
 return {...s,agencies:s.agencies.map(a=>a.id===agency.id?{...a,access:{...a.access!,loginPhone:DEMO_PHONE}}:a),staff:s.staff.map(st=>st.id===boss.id?{...st,phone:DEMO_PHONE,credential:{salt:'cdc69d40641ccd3c501724607ac7f5b1',hash:'717c01d7303ae0eaf66802273ab35f4b865aa9c88e6257d7b6ad112cca85834a'}}:st)};
}
