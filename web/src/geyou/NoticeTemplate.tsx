import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import type {Notice} from './types';
import {buildAmapSearchUrl} from './noticeNavigation';
import './notice-template.css';

export function NoticeTemplate({notice,phone,region,onContact,onWreath}:{notice:Notice;phone?:string;region?:string;onContact?:()=>void;onWreath?:()=>void}){
 return <article className={`notice-design notice-design-${notice.template||'simple'}`} aria-label="讣告模板">
  <header className="notice-design-heading"><span>谨 此 讣 告</span><h1>讣告</h1><i aria-hidden="true"/></header>
  {notice.portrait&&<figure className="notice-design-portrait"><img src={notice.portrait} alt={`${notice.name||'逝者'}遗照`}/></figure>}
  <div className="notice-design-person"><h2>{notice.name||'姓名待确认'}</h2>{notice.age&&<p>享年 {notice.age} 岁</p>}</div>
  <div className="notice-design-copy">{notice.text.split(/\n+/).filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div>
  <dl className="notice-design-arrangements"><div><dt>告别时间</dt><dd>{notice.ceremonyDate.replace('T',' ')||'待家属确认'}</dd></div><div><dt>告别地点</dt><dd className="notice-location-inline"><span>{notice.location||'待家属确认'}</span>{notice.location.trim()&&<a className="notice-navigation-link" href={buildAmapSearchUrl(notice.location,region||'')} target="_blank" rel="noopener noreferrer">导航前往</a>}</dd></div></dl>
  <footer className="notice-design-footer"><span>深切缅怀 · 永存思念</span>{phone&&<div><small>服务电话</small>{onContact?<button onClick={onContact}>{phone}</button>:<strong>{phone}</strong>}</div>}{onWreath&&<button type="button" className="notice-wreath-entry" onClick={onWreath}>购买花圈</button>}</footer>
 </article>;
}

export function NoticeScreen({children,footer}:{children:ReactNode;footer?:ReactNode}){
 const stage=useRef<HTMLDivElement>(null),sheet=useRef<HTMLDivElement>(null);
 const [scale,setScale]=useState(1);
 useLayoutEffect(()=>{const container=stage.current,node=sheet.current;if(!container||!node)return;
 const measure=()=>setScale(Math.min(1,container.clientHeight/Math.max(1,node.scrollHeight)));
 const observer=new ResizeObserver(measure);observer.observe(container);observer.observe(node);measure();
 return()=>observer.disconnect();},[]);
 return <div className={footer?"notice-screen-with-products":"notice-screen-wrapper"}><div ref={stage} className="notice-screen"><div ref={sheet} className="notice-screen-sheet" style={{transform:`scale(${scale})`}}>{children}</div></div>{footer}</div>;
}
