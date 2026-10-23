import {ArrowLeft,House,UsersRound,UserRound} from 'lucide-react';
import type {PageProps} from './types';
import {hasStaffModule} from './model';
import {ContentPage} from './ContentTools';
import {LinkedRestorationPage} from './MemorialPages';
import {NoticePreviewPage} from './NoticePreviewPage';
// Keep the original service screens and business flows; adapt only the mobile shell and routes.
export function AgentServiceWorkspace(props:PageProps&{kind:'notice'|'portrait';route:string;sharedDemo?:boolean;toast:string}){
 const {kind,route}=props,[pathname,query='']=route.split('?'),params=new URLSearchParams(query),isPreview=pathname.startsWith('/agent/notice-preview/');
 const isList=!query&&!isPreview,base=kind==='notice'?'/agent/notices':'/agent/portraits',prefix=props.sharedDemo?'/shared':'';
 const navigate=(path:string)=>{
  if(path.startsWith('/content'))props.navigate('/agent/notices'+path.slice('/content'.length));
  else if(path.startsWith('/restoration'))props.navigate('/agent/portraits'+path.slice('/restoration'.length));
  else if(path.startsWith('/customers')){const q=new URLSearchParams(path.split('?')[1]||'');props.navigate(q.get('customer')?'/agent/customer?customer='+q.get('customer')+(q.get('deceased')?'&deceased='+q.get('deceased'):''):'/agent/customers')}
  else if(path.startsWith('/notice/'))props.navigate('/agent/notices?notice='+path.split('/')[2]+'&view=detail');
  else if(path==='/settings')props.notify('企业电话等资料请在机构完整版维护；此处可先保存草稿。');
  else props.navigate('/agent');
 };
 const pageProps={...props,navigate,routeBase:prefix+base,previewBase:prefix+'/agent/notice-preview/',localPersistence:!props.sharedDemo,serviceLabel:kind==='portrait'?'纪念遗照':undefined};
 if(!hasStaffModule(props.state,props.context.staff,kind==='notice'?'content':'restoration'))return <div className="agent-app"><main className="agent-page"><h1>此功能尚未开通</h1><button className="agent-secondary" onClick={()=>props.navigate('/agent')}>返回首页</button></main></div>;
 return <div className={'geyou-app quality-app agent-service-shell agent-refined'+(isList?' agent-service-list':'')}><div className="agent-service-frame"><main className={'main-content route-'+(kind==='notice'?'content':'restoration')}>{isList&&<button className="agent-detail-back" onClick={()=>props.navigate('/agent')}><ArrowLeft size={18}/>返回首页</button>}{isPreview?<NoticePreviewPage previewId={pathname.split('/').at(-1)!} state={props.state}/>:kind==='notice'?<ContentPage {...pageProps}/>:<LinkedRestorationPage {...pageProps}/>}</main></div>{isList&&<nav className="agent-tabs" aria-label="代理版导航">{[{name:'首页',path:'/agent',Icon:House},{name:'客户',path:'/agent/customers',Icon:UsersRound},{name:'我的',path:'/agent/me',Icon:UserRound}].map(({name,path,Icon})=><button key={name} className={path==='/agent'?'is-active':undefined} aria-current={path==='/agent'?true:undefined} onClick={()=>props.navigate(path)}><Icon size={22}/><span>{name}</span></button>)}</nav>}{props.toast&&<div className="agent-toast" role="status">{props.toast}</div>}</div>;
}
