import type {AppState,Consultation,Customer,Proposal,Quote} from './types';
import {calculateTotal,hasStaffModule,isProductAvailable,now} from './model';

export const QUOTE_JOURNEY_DEMO={customerId:'demo-journey-customer',sessionId:'demo-journey-talk',proposalId:'demo-journey-proposal',quoteId:'demo-journey-quote'};

// Add this example once. Existing records and edits are never replaced.
export function withQuoteJourneyDemo(input:AppState):AppState{
 if(input.quoteJourneyDemoVersion===1)return input;
 const {customerId,sessionId,proposalId,quoteId}=QUOTE_JOURNEY_DEMO;
 if(input.customers.some(c=>c.id===customerId)||input.consultations?.some(c=>c.id===sessionId)||input.proposals.some(p=>p.id===proposalId)||input.quotes.some(q=>q.id===quoteId))return input;
 const staff=input.staff.find(s=>s.id==='boss-a'&&s.agencyId==='agency-a');
 const agency=input.agencies.find(a=>a.id==='agency-a');
 if(!staff||!agency||!hasStaffModule(input,staff,'talk')||!hasStaffModule(input,staff,'customers'))return input;
 const products=['p2','p3'].map(id=>input.products.find(p=>p.id===id&&isProductAvailable(input,p))).filter(p=>!!p);
 if(products.length!==2)return input;
 const at=now(),lines=products.map(p=>({productId:p.id,name:p.name,kind:p.kind,unit:p.unit,quantity:1,price:p.price}));
 const preference='先选择寿衣与基础告别服务；家属希望核对数量、时间和预算，再决定后续安排。';
 const customer:Customer={id:customerId,agencyId:agency.id,ownerId:staff.id,name:'林女士（流程示例）',phone:'',region:agency.region,budget:300000,stage:'跟进中',note:preference,source:'到店咨询',createdAt:at,followups:[{id:'demo-journey-reception-note',at,staffId:staff.id,text:'已了解本次需求，并核对寿衣与告别服务清单；下一步与家属沟通调整意见。'}]};
 const session:Consultation={id:sessionId,agencyId:agency.id,staffId:staff.id,customerId,contact:{name:customer.name,phone:''},mode:'general',answers:{},messages:[],step:0,createdAt:at,updatedAt:at,proposalId,guided:{scenario:'hospital',subjectName:'',occupation:'',interests:'偏好素雅',faith:'待确认',region:agency.region,budget:customer.budget,notes:preference,step:0,selectedProductIds:products.map(p=>p.id),plan:{phase:'result',processPosition:'farewell',needs:{clothes:'needed',ceremony:'needed'},scopeConfirmed:true,packages:[],selectedLines:structuredClone(lines),outcome:'confirmed',confirmedAt:at,continuation:'continue'}}};
 const proposal:Proposal={id:proposalId,agencyId:agency.id,staffId:staff.id,customerId,consultationId:sessionId,phaseOne:true,region:agency.region,budget:customer.budget,preference,lines:structuredClone(lines),status:'已确认',confirmedAt:at,warnings:[],createdAt:at,updatedAt:at};
 const quote:Quote={id:quoteId,agencyId:agency.id,staffId:staff.id,customerId,proposalId,phaseOne:true,number:'FW-DEMO-001',version:1,lines:structuredClone(lines),total:calculateTotal(lines),createdAt:at,customerName:customer.name,agencyName:agency.name,agencyLogo:agency.logo,phone:agency.phone,region:agency.region,revoked:false,note:'流程示例报价，具体项目与安排以双方核对为准。',sharedAt:at,sharedBy:staff.id,feedback:[{id:'demo-journey-feedback',kind:'希望调整',text:'家属讨论后，希望寿衣改为两套。告别服务先保留，请重新核对合计，并联系我确认时间。',at,status:'待处理'}]};
 return {...input,quoteJourneyDemoVersion:1,customers:[...input.customers,customer],consultations:[...(input.consultations||[]),session],proposals:[...input.proposals,proposal],quotes:[...input.quotes,quote]};
}
