import {packageComparisonDemo} from './packageComparisonDemo';
import {calculateAgentBazi,emptyAgentProfile} from './agentModel';
import {useEffect,useRef,useState} from 'react';
import {ChevronRight,ImageIcon} from 'lucide-react';
import type {AppState,Product,Staff} from './types';
import {money} from './model';
import {PAPER_PACKAGE,paperPlanTotal,type PaperPlan} from './agentPackageSource';
import {packageProductRecommendationRequest,recommendPackageProduct,type PackagePreference} from './packageExplanationModel';
import {AgentProductImage,includedImageKeys} from './agentProductImages';
function ProductHero({state,product,item,name}:{state:AppState;product?:Product;item?:string;name:string}){
 const src=product?.image||product?.images?.[0]||state.masterProducts.find(p=>p.id===product?.masterId)?.image;
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
 return <div className="agent-product-hero">{src&&!failed?<img src={src} alt={name} onError={()=>setFailed(true)}/>:item?<AgentProductImage item={item} name={name}/>:<div className="agent-product-no-image"><ImageIcon size={42}/><span>商品主图待补充</span></div>}</div>;
}
export function AgentPackageExplain({state,staff,plan,preference,selectedItem,onSelect,onReplace}:{state:AppState;staff:Staff;plan:PaperPlan;preference:PackagePreference;selectedItem:string;onSelect:(value:string)=>void;onReplace:(included:string,product:Product,delta:number)=>void}){
 const [variant,setVariant]=useState<'current'|'upgrade'>('current');
 const [choosing,setChoosing]=useState(false),[delta,setDelta]=useState(''),[checked,setChecked]=useState(false),[selectionError,setSelectionError]=useState('');
 useEffect(()=>{setVariant('current');setChoosing(false);setDelta('');setChecked(false);setSelectionError('')},[selectedItem]);
 const included=selectedItem,recommendation=included?recommendPackageProduct(state,staff,plan,included,preference):undefined;
 const demo=preference.isDemo&&recommendation?packageComparisonDemo(included,recommendation.product):undefined,product=demo?.candidate||recommendation?.product;
 const currentAdjustment=plan.adjustments?.find(a=>a.included===included),actualCurrentProduct=state.products.find(p=>p.id===currentAdjustment?.productId&&p.agencyId===staff.agencyId);
 const currentProduct=demo?.current||actualCurrentProduct,effectivePreference=demo?.preference||preference;
 const demoChart=demo?calculateAgentBazi({...emptyAgentProfile(),...demo.preference}):undefined;
 const [reason,setReason]=useState(''),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const cache=useRef(new Map<string,string>());
 const payload=included&&product?packageProductRecommendationRequest(plan,included,product,effectivePreference,currentProduct):undefined,key=JSON.stringify(payload);
 useEffect(()=>{setReason('');setFailed(false);if(!payload){setLoading(false);return}const cached=cache.current.get(key);if(cached){setReason(cached);setLoading(false);return}
  const controller=new AbortController();setLoading(true);
  void (async()=>{try{const res=await fetch('/api/geyou/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const result=await res.json();if(!res.ok||typeof result.reply!=='string'||!result.reply.trim())throw Error();if(controller.signal.aborted)return;const text=result.reply.trim();cache.current.set(key,text);setReason(text)}catch{if(!controller.signal.aborted)setFailed(true)}finally{if(!controller.signal.aborted)setLoading(false)}})();return()=>controller.abort();
 },[key]);
 if(!included)return <section className="agent-explain" aria-label="套餐现场讲解"><div className="agent-explain-heading"><span>现场讲解</span><h3>{PAPER_PACKAGE.name}</h3><strong>{money(paperPlanTotal(plan))}</strong><p>点击商品查看详情和可选升级方案</p></div><div className="agent-explain-items">{PAPER_PACKAGE.included.filter(x=>!plan.omitted?.includes(x)).map(v=>{const adjustment=plan.adjustments?.find(a=>a.included===v);return <button className="agent-explain-row agent-explain-item-button" key={v} aria-label={'查看'+(adjustment?.name||v)+'详情'} onClick={()=>onSelect(v)}><AgentProductImage item={includedImageKeys[PAPER_PACKAGE.included.indexOf(v)]} name={v}/><span><b>{adjustment?.name||v}</b><small>套餐内商品</small></span><ChevronRight size={18}/></button>})}</div></section>;
 const active=variant==='upgrade'?product:currentProduct,activeName=variant==='upgrade'?product?.name:currentProduct?.name||currentAdjustment?.name||included;
 const originalPrice=currentProduct?.price||undefined;
 return <article className={"agent-product-detail agent-commerce-detail"+(choosing?' is-choosing':'')} aria-label="套餐商品详情">
 <ProductHero state={state} product={active} item={includedImageKeys[PAPER_PACKAGE.included.indexOf(included)]} name={activeName||included}/>
 <section className="agent-commerce-intro"><div className="agent-commerce-price">{variant==='upgrade'?<><strong>{money(product!.price)}</strong><small> / {product!.unit} · 目录价</small></>:<><strong>{originalPrice?money(originalPrice):'单品价待核实'}</strong><small>{originalPrice?' / '+(currentProduct?.unit||'件')+' · 目录价':' · 套餐已含'}</small></>}<span>{variant==='upgrade'?'待选用':currentAdjustment?'已选替换':'当前方案'}</span></div><h2>{activeName}</h2><p>{active?.spec||(variant==='current'?'套餐原款，具体规格以本次实物为准':'具体规格以本次实物为准')}</p>{variant==='upgrade'&&<small className="agent-commerce-price-note">本次替换补差待核实，目录价不作为补差。</small>}</section>
 {product&&<section className="agent-commerce-variants"><header><h3>款式选择</h3><small>当前款与升级款对比</small></header><div role="group" aria-label="商品款式"><button className={variant==='current'?'is-selected':''} aria-pressed={variant==='current'} onClick={()=>{setVariant('current');setChoosing(false)}}><strong>套餐原方案</strong><span>{currentProduct?.name||currentAdjustment?.name||included}</span><small>{originalPrice?money(originalPrice)+' · 套餐已含':'单品价待核实 · 套餐已含'}</small></button><button className={variant==='upgrade'?'is-selected':''} aria-pressed={variant==='upgrade'} onClick={()=>setVariant('upgrade')}><strong>可选升级</strong><span>{product.name}</span><small>{money(product.price)} · 目录价</small></button></div></section>}
 {product&&variant==='upgrade'&&<section className="agent-commerce-recommend"><header><h3>选款参考</h3><span>产品对比 · 八字参考</span></header>{loading?<p role="status">正在整理推荐理由…</p>:reason?<p>{reason}</p>:failed?<p>推荐说明暂未生成，可先比较商品规格。</p>:null}</section>}
 <section className="agent-commerce-description"><h3>商品介绍与规格</h3><p>{active?.description||'具体款式、材质及配套范围请对照本次实物确认。'}</p>{active?.spec&&<p>规格：{active.spec}</p>}</section>
 {demo?<details className="agent-comparison-demo"><summary>演示资料 · 查看八字依据</summary><p>出生：1944-05-16 08:30 · 北京时间</p><p>四柱：{demoChart?.ready?demoChart.pillars.join(' · '):'待排盘'}</p><p>模拟选择木方向；原款标注土、候选标注木，仅演示匹配，不代表真实喜用或功效。</p></details>:null}
 <footer className="agent-commerce-actions">{variant==='current'?<div className="agent-commerce-current-action"><span>{currentAdjustment?'当前已选替换款':'当前商品已含在套餐'}<small>当前报价 {money(paperPlanTotal(plan))}</small></span>{product&&<button className="agent-primary" onClick={()=>setVariant('upgrade')}>查看升级款</button>}</div>:<>{variant==='upgrade'&&!demo&&(plan.confirmedAt?<p className="agent-hint">报价已确认，请另行办理商品变更。</p>:choosing?<div className="agent-product-selection"><label>本次替换补差（元）<input aria-label="本次替换补差（元）" type="number" step="0.01" value={delta} onChange={e=>{setDelta(e.target.value);setChecked(false)}} placeholder="由代理核实，可填0或负数"/></label><label className="agent-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>已核实补差，家属同意选用此商品</label>{selectionError&&<p role="alert" className="agent-error">{selectionError}</p>}<div className="agent-intake-actions"><button className="agent-primary" disabled={!checked||!delta.trim()} onClick={()=>{try{if(!/^-?\d+(\.\d{1,2})?$/.test(delta.trim()))throw Error('请填写有效补差金额，最多两位小数');onReplace(included,product,Math.round(Number(delta)*100));setChoosing(false)}catch(e){setSelectionError((e as Error).message)}}}>确认替换，更新报价</button><button className="agent-secondary" onClick={()=>setChoosing(false)}>取消</button></div></div>:<button className="agent-primary agent-wide" onClick={()=>setChoosing(true)}>选用此商品</button>)}{variant==='upgrade'&&demo&&<p className="agent-help">演示商品仅供比较；返回实际商品后可选用。</p>}</>}</footer>
 </article>;
}
