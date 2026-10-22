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
export function AgentPackageExplain({state,staff,plan,preference,selectedItem,onSelect}:{state:AppState;staff:Staff;plan:PaperPlan;preference:PackagePreference;selectedItem:string;onSelect:(value:string)=>void}){
 const included=selectedItem,recommendation=included?recommendPackageProduct(state,staff,plan,included,preference):undefined,product=recommendation?.product;
 const currentAdjustment=plan.adjustments?.find(a=>a.included===included),currentProduct=state.products.find(p=>p.id===currentAdjustment?.productId&&p.agencyId===staff.agencyId);
 const [reason,setReason]=useState(''),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const cache=useRef(new Map<string,string>());
 const payload=included&&product?packageProductRecommendationRequest(plan,included,product,preference):undefined,key=JSON.stringify(payload);
 useEffect(()=>{setReason('');setFailed(false);if(!payload){setLoading(false);return}const cached=cache.current.get(key);if(cached){setReason(cached);setLoading(false);return}
  const controller=new AbortController();setLoading(true);
  void (async()=>{try{const res=await fetch('/api/geyou/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const result=await res.json();if(!res.ok||typeof result.reply!=='string'||!result.reply.trim())throw Error();if(controller.signal.aborted)return;const text=result.reply.trim();cache.current.set(key,text);setReason(text)}catch{if(!controller.signal.aborted)setFailed(true)}finally{if(!controller.signal.aborted)setLoading(false)}})();return()=>controller.abort();
 },[key]);
 if(!included)return <section className="agent-explain" aria-label="套餐现场讲解"><div className="agent-explain-heading"><span>现场讲解</span><h3>{PAPER_PACKAGE.name}</h3><strong>{money(paperPlanTotal(plan))}</strong><p>点击商品查看详情和可选升级方案</p></div><div className="agent-explain-items">{PAPER_PACKAGE.included.filter(x=>!plan.omitted?.includes(x)).map(v=>{const adjustment=plan.adjustments?.find(a=>a.included===v);return <button className="agent-explain-row agent-explain-item-button" key={v} aria-label={'查看'+(adjustment?.name||v)+'详情'} onClick={()=>onSelect(v)}><AgentProductImage item={includedImageKeys[PAPER_PACKAGE.included.indexOf(v)]} name={v}/><span><b>{adjustment?.name||v}</b><small>套餐内商品</small></span><ChevronRight size={18}/></button>})}</div></section>;
 return <article className="agent-product-detail" aria-label="套餐商品详情">
 <ProductHero state={state} product={currentProduct} item={includedImageKeys[PAPER_PACKAGE.included.indexOf(included)]} name={currentAdjustment?.name||included}/>
 <section className="agent-product-intro"><span className="agent-product-included">{plan.omitted?.includes(included)?'本次未包含':'套餐已包含'}</span><h2>{currentAdjustment?.name||included}</h2>{currentProduct?.spec&&<p className="agent-product-spec">{currentProduct.spec}</p>}<p>具体款式以本次实物和服务范围为准</p></section>

 {product&&<section className="agent-product-upgrade"><header><h3>为您推荐</h3><span>可选升级</span></header><div className="agent-upgrade-product-row"><ProductHero state={state} product={product} name={product.name}/><div className="agent-product-upgrade-info"><h3>{product.name}</h3><strong>{money(product.price)}<small> / {product.unit}</small></strong><span>商品目录价</span></div></div><div className="agent-product-reason"><h3>推荐理由</h3>{loading?<p role="status">正在结合已有资料整理推荐理由…</p>:reason?<p>{reason}</p>:failed?<p>推荐说明暂未生成。可以先对照上方商品款式与规格，按家属实际意愿选择。</p>:null}</div></section>}
 <section className="agent-product-description"><h3>商品介绍</h3><p>{currentProduct?.description||'该项目包含在原始套餐中，具体款式、材质与规格需对照实物确认。'}</p>{currentProduct&&<dl><div><dt>商品分类</dt><dd>{currentProduct.category}</dd></div><div><dt>计价单位</dt><dd>{currentProduct.unit}</dd></div>{currentProduct.spec&&<div><dt>商品规格</dt><dd>{currentProduct.spec}</dd></div>}</dl>}</section>
 </article>;
}
