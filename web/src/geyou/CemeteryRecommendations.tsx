import {cemeteryPhotos} from './cemeteryPhotos';
import {useEffect,useRef,useState} from 'react';
import {MapPin,Check,ChevronRight,X} from 'lucide-react';
import type {BaziCemeteryEvidence} from './cemeteryAdvice';
import {CEMETERIES,type CemeteryNeeds,type CemeteryMatch} from './cemeteryModel';
function BaziEvidence({evidence}:{evidence:BaziCemeteryEvidence}){return <section className="cemetery-evidence"><h3>八字匹配依据</h3><dl>{([['chartBasis','四柱依据'],['ruleBasis','传统规则'],['siteBasis','公墓事实'],['conclusion','匹配结论']] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{evidence[key]}</dd></div>)}</dl></section>}
export function CemeteryNeedsForm({value,onChange}:{value:CemeteryNeeds;onChange:(next:CemeteryNeeds)=>void}){
 const districts=[...new Set(CEMETERIES.filter(c=>c.city===value.city.trim().replace(/市$/,'')).map(c=>c.district))];
 return <section className="agent-form-section cemetery-needs"><h2>公墓需求</h2><div className="agent-form-grid">
  <label className="agent-field"><span>意向城市</span><input value={value.city} maxLength={30} onChange={e=>onChange({...value,city:e.target.value,district:''})} placeholder="如：杭州"/></label>
  <label className="agent-field"><span>意向区县</span><select value={value.district} onChange={e=>onChange({...value,district:e.target.value})}><option value="">全市范围</option>{districts.map(d=><option key={d}>{d}</option>)}</select></label>
  <label className="agent-field"><span>安葬需求</span><select value={value.burialType} onChange={e=>onChange({...value,burialType:e.target.value})}><option value="">暂不限</option>{['单穴','双穴／合葬','生态安葬'].map(v=><option key={v}>{v}</option>)}</select></label>
  <label className="agent-field"><span>预算上限（元，选填）</span><input type="number" min="1" value={value.maxBudget} onChange={e=>onChange({...value,maxBudget:e.target.value})} placeholder="不限"/></label>
 </div></section>;
}
function CemeteryGallery({id,name}:{id:string;name:string}){
 const photos=cemeteryPhotos[id]||[];const [active,setActive]=useState(0);
 if(!photos.length)return null;
 return <section className="cemetery-gallery" aria-label={name+'照片'}><div className="cemetery-gallery-hero"><img src={photos[active].src} alt={name+' · '+photos[active].alt}/><span>{active+1} / {photos.length}</span></div>{photos.length>1&&<div className="cemetery-gallery-thumbs">{photos.map((photo,i)=><button key={photo.src} aria-label={'查看'+photo.alt} aria-pressed={active===i} onClick={()=>setActive(i)}><img src={photo.src} alt={photo.alt} loading="lazy"/></button>)}</div>}</section>;
}
function CemeteryDetail({match,onClose,onSelect,selected}:{match:CemeteryMatch;onClose:()=>void;onSelect:()=>void;selected:boolean}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const d=ref.current!;d.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{d.close();document.body.style.overflow=old}},[]);
 const c=match.cemetery;
 return <dialog ref={ref} className="auspicious-profile-dialog agent-refined cemetery-dialog" aria-label="公墓详情" onCancel={e=>{e.preventDefault();onClose()}}><header><h2>{c.name}</h2><button aria-label="关闭公墓详情" onClick={onClose}><X size={22}/></button></header><div className="auspicious-sheet-body"><CemeteryGallery id={c.id} name={c.name}/><p className="cemetery-location"><MapPin size={17}/>{c.location}</p><p className="agent-help">{c.description}</p>{c.phone&&<section className="cemetery-detail-section"><h3>咨询电话</h3><a href={'tel:'+c.phone}>{c.phone}</a></section>}<section className="cemetery-detail-section"><h3>八字与公墓参考</h3>{match.baziReason&&<p>{match.baziReason}</p>}<h3>地区与需求依据</h3>{match.reasons.map(r=><p key={r}>{r}</p>)}</section>{match.baziEvidence&&<BaziEvidence evidence={match.baziEvidence}/>}</div><footer><button className="agent-primary agent-wide" onClick={onSelect}>{selected?'保留意向公墓':'选为意向公墓'}</button></footer></dialog>;
}
export function CemeteryRecommendations({matches,selectedId,detailId,onDetail,onSelect}:{matches:CemeteryMatch[];selectedId?:string;detailId:string;onDetail:(id:string)=>void;onSelect:(id:string)=>void}){
 const detail=matches.find(m=>m.cemetery.id===detailId);
 return <section className="cemetery-results" aria-label="公墓推荐结果"><div className="auspicious-results-heading"><h2>公墓推荐</h2><b>{matches.length}<small>家推荐</small></b></div>{!matches.length?<div className="auspicious-empty"><MapPin size={30}/><h3>暂无符合条件的已收录公墓</h3><p>可调整地区或需求；未收录地区不会生成虚构推荐。</p></div>:matches.map(m=><article className={'cemetery-compact-card'+(selectedId===m.cemetery.id?' is-selected':'')} key={m.cemetery.id}><div className="cemetery-card-heading"><button className="cemetery-open-detail" onClick={()=>onDetail(m.cemetery.id)}><strong>{m.cemetery.name}</strong><small>{m.cemetery.location}</small></button><button className="cemetery-select" role="radio" aria-checked={selectedId===m.cemetery.id} aria-label={'选择'+m.cemetery.name} onClick={()=>onSelect(m.cemetery.id)}>{selectedId===m.cemetery.id&&<Check size={16}/>}</button></div></article>)}{detail&&<CemeteryDetail match={detail} selected={selectedId===detail.cemetery.id} onClose={()=>onDetail('')} onSelect={()=>onSelect(detail.cemetery.id)}/>}</section>;
}
