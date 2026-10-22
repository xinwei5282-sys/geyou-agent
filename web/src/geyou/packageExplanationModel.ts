import type {AppState,Product,Staff} from './types';
import {isProductAvailable} from './model';
import {PAPER_PACKAGE,paperPlanTotal,type PaperPlan,type PaperAdjustment} from './agentPackageSource';
export function replacementProducts(state:AppState,staff:Staff,included:string){
 const category=included.includes('寿衣')?'寿衣':included.includes('骨灰盒')?'骨灰盒':'';
 return category?state.products.filter(p=>p.agencyId===staff.agencyId&&isProductAvailable(state,p)&&p.category===category):[];
}
export function applyPaperAdjustment(plan:PaperPlan,item:PaperAdjustment):PaperPlan{
 if(plan.confirmedAt)throw Error('已确认清单不可直接修改，请另行办理变更');
 if(!PAPER_PACKAGE.included.includes(item.included)||plan.omitted?.includes(item.included))throw Error('该项目不在当前套餐内');
 if(!item.productId||!item.name||!item.need.trim()||!item.priceChecked||!Number.isSafeInteger(item.delta)||Math.abs(item.delta)>10000000000)throw Error('请核对商品、需求和实际补差');
 const next={...plan,adjustments:[...(plan.adjustments||[]).filter(x=>x.included!==item.included),item],pricesChecked:false,confirmedAt:undefined,updatedAt:new Date().toISOString()};
 if(paperPlanTotal(next)<0)throw Error('调整后的总价不能小于零');
 return next;
}
export function packageExplanationRequest(plan:PaperPlan,budget:string,item?:{included:string;product:Product;need:string;delta?:number;basis?:string[]}){
 const total=paperPlanTotal(plan)/100;
 return {profile:{},staffContext:{businessFacts:[
 '代理简版：套餐现场讲解模式，只生成代理建议和对客话术，不修改档案、清单或订单，不追问出生资料。',
 `当前套餐${PAPER_PACKAGE.name}；清单金额${total}元；${plan.pricesChecked?'已核价':'尚待核价，不可承诺金额'}；${plan.confirmedAt?'家属已确认，禁止直接修改':'尚待家属确认'}；预算${budget||'待确认'}元。`,
 '当前包含项目：'+PAPER_PACKAGE.included.filter(x=>!plan.omitted?.includes(x)).map(x=>(plan.adjustments||[]).find(a=>a.included===x)?.name||x).join('、'),
 ...(item?.basis||[]).map(x=>'已核实的可选推荐依据：'+x.slice(0,250)),
 ...(item?[`家属本轮明确需求：${item.need}`.slice(0,300),`比较原项目：${item.included}；候选商品：${item.product.name}；真实资料：${item.product.description}；规格：${item.product.spec||'未注明'}`.slice(0,300),`候选商品目录单价${item.product.price/100}元，不是更换补差。${item.delta===undefined?'更换补差尚未核实，不计算调整总价。':`代理已核实本次更换补差${item.delta/100}元，替换后清单总价${paperPlanTotal(applyPaperAdjustment({...plan,confirmedAt:undefined},{included:item.included,productId:item.product.id,name:item.product.name,need:item.need,delta:item.delta,priceChecked:true}))/100}元。`}`]:[])
 ]},catalog:item?[{id:item.product.id,name:item.product.name,category:item.product.category,price:item.product.price/100,unit:item.product.unit,description:item.product.description.slice(0,300),spec:item.product.spec?.slice(0,200)}]:[],messages:[{role:'user',text:item?'根据明确需求提供该单品的可选替换讲解。reply写内部依据、价格核对和预算提醒；staffScript只写给家属的一段简短话术，保留原方案，不强推、不编造材质功效。价格未核实必须说待核价。只比较不代表已更换。':'请生成当前套餐的现场讲解要点和一段对客话术，只介绍实际包含项目；没有单品调整需求，不主动升单。不生成新套餐，不声称完成操作。'}]};
}

export type PackagePreference={occupation?:string;faith?:string;interests?:string;preferredElement?:string;confirmedAt?:string};
export function recommendPackageProduct(state:AppState,staff:Staff,plan:PaperPlan,included:string,preference:PackagePreference){
 const selected=plan.adjustments?.find(a=>a.included===included),current=state.products.find(p=>p.id===selected?.productId&&p.agencyId===staff.agencyId);
 const available=replacementProducts(state,staff,included).filter(p=>(!p.religion||['通用','不限','无特定信仰'].includes(p.religion)||p.religion===preference.faith)&&p.id!==current?.id&&(!current||p.price>current.price));
 const alternatives=!current&&/普通|简易/.test(included)&&available.some(p=>!/基础|普通|简朴|素朴/.test(p.name))?available.filter(p=>!/基础|普通|简朴|素朴/.test(p.name)):available;
 const ranked=alternatives.map(product=>{
  const text=[product.name,product.description,product.spec,product.recommendationNote].filter(Boolean).join(' '),reasons:string[]=[];let score=0;
  const interests=preference.interests?.trim();
  const tags=['棉质','棉','传统','中式','素雅','简洁','木纹','实木','鲜花','白色','深色','陶瓷'];
  const matches=interests?tags.filter(x=>interests.includes(x)&&text.includes(x)):[];
  if(matches.length){reasons.push(`已记录偏好“${interests}”；商品资料包含“${matches.filter(x=>!matches.some(y=>y!==x&&y.includes(x))).join('、')}”，可对照实物确认是否符合意愿。`);score+=3;}
  if(preference.faith&&preference.faith!=='待确认'&&product.religion===preference.faith){reasons.push(`逝者信仰为“${preference.faith}”，商品宗教适用标注一致；不代表需要宗教仪式或特殊功效。`);score+=3;}
  if(preference.occupation&&product.recommendationNote?.includes(preference.occupation)){reasons.push(`已记录职业为“${preference.occupation}”；商品的推荐说明明确提及该职业：${product.recommendationNote}。仍以本人穿着习惯及家属意愿为准。`);score+=2;}
  if(preference.confirmedAt&&preference.preferredElement&&product.elements?.includes(preference.preferredElement)&&product.recommendationNote){reasons.push(`家属已确认“${preference.preferredElement}”方向偏好，商品资料标注同一方向；依据：${product.recommendationNote}。仅作偏好参考，不代表八字喜用或特殊功效。`);score+=2;}
  if(!reasons.length)reasons.push(`同类可选商品，已提供的资料为：${(product.description||product.spec||product.name).replace(/[。；]+$/,'')}。原套餐未注明具体款式材质，升级差异仍需对照实物核实。目前没有足够的个人偏好匹配依据，可先看实物，不默认升级。`);
  return {product,reasons,score};
 }).sort((a,b)=>b.score-a.score||a.product.price-b.product.price||a.product.id.localeCompare(b.product.id));
 return ranked[0];
}

export function packageProductRecommendationRequest(plan:PaperPlan,included:string,product:Product,preference:PackagePreference){
 return {profile:{},staffContext:{businessFacts:[
 '代理简版：商品详情推荐说明模式。只输出一段可对客展示的推荐理由，不修改清单或客户档案。',
 '当前套餐商品：'+included+'；原款详细材质规格未核定，不作虚构比较。',
 '商品真实资料：'+JSON.stringify({name:product.name,category:product.category,description:product.description,spec:product.spec||'',religion:product.religion||'未标注',recommendationNote:product.recommendationNote||''}).slice(0,280),
 '候选商品目录价：'+product.price/100+'元/'+product.unit+'，不是替换补差；实际补差未核定。',
 ...(preference.interests?['客户已记录的明确喜好：'+preference.interests.slice(0,200)]:[]),
 ...(preference.faith?['逝者本人宗教信仰：'+preference.faith.slice(0,80)+'；与仪式需求分开。候选商品宗教适用标注：'+(product.religion||'未标注，不得宣称宗教适配')]:[]),
 ...(preference.occupation?['老人已记录职业：'+preference.occupation.slice(0,100)+'。职业本身不能证明款式或材质偏好。']:[]),
 ...(preference.confirmedAt&&preference.preferredElement&&product.elements?.includes(preference.preferredElement)&&product.recommendationNote?['家属已确认五行方向偏好：'+preference.preferredElement+'；商品资料标注：'+product.elements.join('、')+'；资料说明：'+product.recommendationNote.slice(0,160)+'。仅是偏好，不等于八字喜用。']:[]),
 plan.confirmedAt?'清单已确认，仅展示备选，不修改订单。':'清单待确认，仅展示备选，不自动升级。'
 ]},catalog:[{id:product.id,name:product.name,category:product.category,price:product.price/100,unit:product.unit,description:product.description.slice(0,300),spec:product.spec?.slice(0,200)}],messages:[{role:'user',text:'请为当前商品详情里的这一件可选商品写推荐理由。结合逝者已知职业、本人宗教信仰、生前习惯和明确喜好，具体说清有事实支持的商品适配；职业不等于喜好，信仰不等于仪式需求，不虚构宗教适配或功效；资料不足时只讲真实商品特点和可供比较之处。不要复述完整商品介绍，不要套话或罗列资料缺口，不要说“因为您是某职业所以一定喜欢”。80至140字，平实自然、有温度、不煽情，结尾保留选择权。只在reply返回这段对客推荐说明，profile={}，staffScript=[]，todos=[]，productIds=[]，recommendations=[]，upsellTips=[]，receptionSummary=null，不输出标题或提问。'}]};
}
