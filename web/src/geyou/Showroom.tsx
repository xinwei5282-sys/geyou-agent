import { ChevronRight, Search, ShoppingBag, SlidersHorizontal, ArrowLeft, Building2, Flower2, HandHeart, MicVocal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionBar, PageHeader, useViewState } from './MobileUI';
import type { PageProps, Product } from './types';
import { isProductAvailable, money } from './model';
import { FAITH_OPTIONS } from './profileMatching';
import './showroom.css';

export function ShowroomPage({ state, context, navigate }: PageProps) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const session = params.get('session');
  const returnRoute=params.get('ai')==='1'?'/talk-ai':'/talk';
  const initialCategory = params.get('category') || '全部';
  const [query, setQuery] = useViewState(`showroom-query:${context.staff.id}`, '');
  const [category, setCategory] = useState(initialCategory);
  const [priceRange, setPriceRange] = useState('all');
  const [religion, setReligion] = useState('all');
  const [kind, setKind] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selected = params.get('product'); const customer = params.get('customer');
  const shopUrl = (extra: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    if (session) next.set('session', session);
    if(returnRoute==='/talk-ai') next.set('ai','1');
    if (customer) next.set('customer', customer);
    if (category !== '全部') next.set('category', category);
    Object.entries(extra).forEach(([key, value]) => next.set(key, value));
    return `/shop${next.size ? `?${next.toString()}` : ''}`;
  };
  const products = useMemo(() => state.products.filter(p => p.agencyId === context.agency.id && isProductAvailable(state, p)), [state, context.agency.id]);
  const categories = ['全部', ...new Set(['寿衣','骨灰盒','礼仪服务',...products.map(p => p.category), ...(initialCategory !== '全部' ? [initialCategory] : [])].filter(c=>products.some(p=>p.category===c)||c===initialCategory))];
  const visible = products.filter(p => {
    const matchesPrice = priceRange === 'all' || (priceRange === 'under500' && p.price <= 500) || (priceRange === '500to1500' && p.price > 500 && p.price < 1500) || (priceRange === 'over1500' && p.price >= 1500);
    const matchesReligion = religion === 'all' || (religion === 'general' ? !p.religion : p.religion === religion);
    return (!query || `${p.name}${p.category}${p.description}`.toLowerCase().includes(query.toLowerCase())) && (category === '全部' || p.category === category) && matchesPrice && matchesReligion && (kind === 'all' || p.kind === kind);
  });
  const detail = selected ? products.find(p => p.id === selected) : null;
  const master = detail?.masterId ? state.masterProducts.find(m => m.id === detail.masterId) : undefined;
  const elements = (detail?.masterId?master?.elements:detail?.elements) || [];
  const note = (detail?.masterId?master?.recommendationNote:detail?.recommendationNote) || '';
  visible.sort((a,b)=>{const order=['p2','p1','p3','p7'];return (order.includes(a.id)?order.indexOf(a.id):99)-(order.includes(b.id)?order.indexOf(b.id):99)});
  const card=(p:Product)=><button className={`showroom-card ${p.kind==='服务'?'showroom-service-card':''}`} key={p.id} onClick={()=>navigate(shopUrl({product:p.id}))}><ProductImage product={p} draft/><div className="showroom-card-body"><span>{p.category}</span><strong>{p.name}</strong><p className="showroom-card-spec">{p.spec||p.description||'服务内容以报价确认为准'}</p><div className="showroom-card-footer"><b>{money(p.price)}</b><span className="showroom-card-link">查看详情</span></div></div></button>;
  if (detail) return <main className="showroom-page showroom-detail shop-detail-replica"><PageHeader title="商品详情" onBack={() => navigate(shopUrl())} /><ProductImage product={detail} detail draft/><div className="showroom-detail-body"><span className="showroom-category">{detail.category} · {detail.kind}</span><h1>{detail.name}</h1><strong className="showroom-price">{money(detail.price)} <small>/ {detail.unit}</small></strong>{(detail.spec||master?.spec)&&<p className="showroom-spec"><span>规格</span>{detail.spec||master?.spec}</p>}<h2 className="showroom-description-title">商品介绍</h2><p className="showroom-description">{detail.description || '暂无详细介绍'}</p>{elements.length > 0 && <div className="showroom-bazi"><b>八字帮选属性</b><div>{elements.map(e => <span key={e}>{e}</span>)}</div>{note && <p>{note}</p>}</div>}<ActionBar><button className="btn btn-primary" onClick={() => navigate(session ? `${returnRoute}?session=${encodeURIComponent(session)}&product=${encodeURIComponent(detail.id)}` : `/talk?new=1&product=${encodeURIComponent(detail.id)}${customer ? `&customer=${encodeURIComponent(customer)}` : ''}`)}>{session?'选择此商品':'选购此商品'}<ChevronRight size={17}/></button></ActionBar></div><section className="showroom-agency"><h2>服务机构信息</h2><div><Building2 size={32}/><strong>{context.agency.name||'本店'}</strong><p>{context.agency.introduction||'服务内容与安排请与本店人员核对。'}</p>{context.agency.phone&&<small>{context.agency.phone}</small>}</div></section></main>;
  return <main className="showroom-page shop-replica"><header className="showroom-draft-header">{session?<button onClick={()=>navigate(`${returnRoute}?session=${encodeURIComponent(session)}`)} aria-label="返回接待"><ArrowLeft size={24}/></button>:<span/>}<h1>商城</h1><span aria-hidden="true"/></header><label className="showroom-search"><Search size={21}/><input value={query} onChange={e => setQuery(e.target.value)} aria-label="搜索商城商品" placeholder="搜索商品与服务"/><button type="button" aria-label="筛选商品" aria-expanded={filtersOpen} aria-controls="showroom-filter-panel" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={22}/></button></label><section className="showroom-hero" aria-label="专业服务，安心选择"><img src="/reference-art/shop-draft/banner.png" width={799} height={224} alt="专业服务 · 安心选择。以尊重之心，陪伴生命的最后一程。格优殡葬，用心守护每一份告别。生命有终，爱与尊重始终相伴。"/></section><div className="showroom-categories">{categories.map(c => <button className={category === c ? 'active' : ''} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div><div id="showroom-filter-panel" className="showroom-filters" aria-label="筛选商品" hidden={!filtersOpen}><label><span>价格</span><select aria-label="价格范围" value={priceRange} onChange={e=>setPriceRange(e.target.value)}><option value="all">全部</option><option value="under500">500元以内</option><option value="500to1500">500-1500元</option><option value="over1500">1500元以上</option></select></label><label><span>信仰</span><select aria-label="信仰筛选" value={religion} onChange={e=>setReligion(e.target.value)}><option value="all">全部</option><option value="general">通用</option>{FAITH_OPTIONS.map(value=><option value={value} key={value}>{value}</option>)}</select></label><label><span>类型</span><select aria-label="商品类型" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">全部</option><option value="商品">商品</option><option value="服务">服务</option></select></label></div>{visible.length ? <div className="showroom-grid">{visible.map(card)}</div> : <div className="showroom-empty showroom-filter-empty"><ShoppingBag size={28}/><strong>没有符合条件的商品</strong><p>试试放宽筛选条件，查看本店其他可选项目。</p><button onClick={()=>{setPriceRange('all');setReligion('all');setKind('all');setCategory('全部');setQuery('')}}>清空筛选</button></div>}</main>;
}
export function ProductImage({ product,detail=false,draft=false }: { product: Product;detail?:boolean;draft?:boolean }) {
 const demo=product.agencyId==='agency-a'?({'p1':['素雅实木骨灰盒','urn'],'p2':['安宁传统寿衣套装','clothes'],'p3':['告别仪式基础服务','ceremony'],'p7':['雅致追思花篮','flower']} as Record<string,string[]>)[product.id]:undefined;
 const art=!product.image&&demo?.[0]===product.name?demo[1]:null;
 if(draft&&art)return <div className="showroom-image draft-product-image"><img src={`/reference-art/shop-draft/${art}.png`} alt={`${product.name}设计示意图`}/></div>;
 const fixtureImage=product.agencyId==='agency-a'?(product.id==='p4'&&product.name==='素白追思花圈'?'/demo-products/flower-wreath.png':product.masterId==='master-clothes-basic'&&product.name==='素朴寿衣基础套装'?'/demo-products/clothes-basic.png':undefined):undefined;
 const displayImage=product.image||fixtureImage;
 if(!displayImage&&!art&&product.kind==='服务'){const Icon=product.category==='灵堂布置'?Flower2:product.category==='礼仪服务'?MicVocal:HandHeart;return <div className="showroom-image service-product-art"><Icon size={54} strokeWidth={1.2}/><span>{product.category}</span><small>服务内容以清单为准</small></div>;}
 return <div className={`showroom-image ${!displayImage&&!art?'without-image':''} ${art?'reference-product-photo '+art:''} ${art&&detail?'reference-detail-photo':''}`} aria-label={art?`${product.name}设计示意图`:undefined}>{displayImage?<img src={displayImage} alt={product.name}/>:art?<img src={detail&&art==='urn'?'/reference-art/product-source.png':'/reference-art/shop-source.png'} alt={`${product.name}设计示意图`}/>:<span className="showroom-placeholder"><ShoppingBag size={32}/><small>商品图片待上传</small></span>}</div>;
}
