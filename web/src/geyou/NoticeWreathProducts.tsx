import {ProductImage} from './Showroom';
import {isProductAvailable,money} from './model';
import type {AppState,Product} from './types';
export function NoticeWreathProducts({state,agencyId,onBuy}:{state?:AppState;agencyId:string;onBuy:(product:Product)=>void}){
 const products=state?.products.filter(p=>p.agencyId===agencyId&&p.category==='花圈'&&p.kind==='商品'&&isProductAvailable(state,p))||[];
 return <section className="notice-wreath-products" aria-label="花圈商品"><header><h2>选购花圈 <small>寄托哀思</small></h2>{products.length>2&&<span className="notice-wreath-more">左右滑动查看更多</span>}<p>选购花圈，联系业务员确认款式与送达安排</p></header>{products.length?<div className="notice-wreath-grid">{products.map(p=><article key={p.id}><div className="notice-wreath-product-image"><ProductImage product={p} draft/></div><div className="notice-wreath-product-body"><h3>{p.name}</h3><p>{p.spec||p.description}</p><div><strong>{money(p.price)}<small> / {p.unit}</small></strong><button type="button" aria-label={`购买${p.name}`} onClick={()=>onBuy(p)}>购买</button></div></div></article>)}</div>:<p className="notice-wreath-empty">暂无在售花圈</p>}</section>;
}
