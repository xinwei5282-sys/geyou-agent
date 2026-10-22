import {lazy,Suspense,useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {LoginPage} from './LoginPage';
import {PublicNoticePage} from './ContentTools';
import {NoticePreviewPage} from './NoticePreviewPage';
import {seedState,migrateState} from './model';
import {withDemoAccount} from './demoAccount';
import {withConsultationDemo} from './consultationDemo';
import {withQuoteJourneyDemo} from './quoteJourneyDemo';
import {readLoginSession,resolveSession,SESSION_KEY,type LoginSession} from './auth';
import {persistStateUpdate} from './statePersistence';
import type {AppState,PageProps} from './types';
import {agentRoute} from './agentRoutes';
import './agent-theme.css';

const AgentMobile=lazy(()=>import('./AgentMobile').then(m=>({default:m.AgentMobile})));

const STORAGE='geyou-prototype-v1';
const fixtures=(s:AppState)=>withQuoteJourneyDemo(withDemoAccount(withConsultationDemo(s)));
function load():AppState{
 try{const s=JSON.parse(localStorage.getItem(STORAGE)||'null');if(s?.schema===1&&s.agencies?.length&&s.staff?.length&&s.session&&['products','customers','quotes','proposals','notices','visits'].every(k=>Array.isArray(s[k])))return fixtures(migrateState(s));}catch{}
 return fixtures(seedState());
}
export default function AgentApp(){
 return <Suspense fallback={<p role="status" style={{padding:24}}>正在打开代理工作台…</p>}><AgentWorkspace/></Suspense>;
}
function AgentWorkspace(){
 const [stored,setStored]=useState(load),[login,setLogin]=useState<LoginSession|null>(readLoginSession);
 const [route,setRoute]=useState(()=>agentRoute(location.hash.slice(1))),[toast,setToast]=useState(''),[storageError,setStorageError]=useState(false);
 const stateRef=useRef(stored);stateRef.current=stored;
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const signedIn=resolveSession(stored,login);
 const state=signedIn?{...stored,session:{agencyId:signedIn.agencyId,staffId:signedIn.id}}:stored;
 const update=useCallback((change:(s:AppState)=>AppState)=>{try{const next=persistStateUpdate(localStorage,STORAGE,stateRef.current,change);stateRef.current=next;setStored(next);setStorageError(false)}catch{setStorageError(true)}},[]);
 const notify=useCallback((text:string)=>{setToast(text);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),2400)},[]);
 const navigate=(path:string)=>{location.hash=agentRoute(path)};
 useEffect(()=>{const sync=()=>{const next=agentRoute(location.hash.slice(1));if(location.hash!=='#'+next)location.replace('#'+next);setRoute(next)};sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[]);
 useEffect(()=>{const sync=(e:StorageEvent)=>{if(e.key===STORAGE&&e.newValue)setStored(load())};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
 useEffect(()=>{if(login&&!signedIn){sessionStorage.removeItem(SESSION_KEY);setLogin(null)}},[login,signedIn]);
 useEffect(()=>{setToast('');if(timer.current)clearTimeout(timer.current);return()=>{if(timer.current)clearTimeout(timer.current)}},[route]);
 useLayoutEffect(()=>{const key=`geyou-agent-scroll:${state.session.staffId}:${route}`;window.scrollTo(0,Number(sessionStorage.getItem(key)||0));const save=()=>sessionStorage.setItem(key,String(window.scrollY));window.addEventListener('scroll',save,{passive:true});return()=>window.removeEventListener('scroll',save)},[route,state.session.staffId]);
 useEffect(()=>{const vv=window.visualViewport;const resize=()=>{const inset=vv?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0;document.documentElement.style.setProperty('--keyboard-inset',`${inset>100?inset:0}px`);document.documentElement.style.setProperty('--visible-height',`${vv?.height||window.innerHeight}px`)};resize();vv?.addEventListener('resize',resize);vv?.addEventListener('scroll',resize);return()=>{vv?.removeEventListener('resize',resize);vv?.removeEventListener('scroll',resize)}},[]);
 const agency=state.agencies.find(a=>a.id===state.session.agencyId)||state.agencies[0];
 const staff=state.staff.find(s=>s.id===state.session.staffId&&s.agencyId===agency.id)||state.staff.find(s=>s.agencyId===agency.id)!;
 const props:PageProps={state,update,context:{agency,staff},navigate,notify};
 const logout=()=>{sessionStorage.removeItem(SESSION_KEY);setLogin(null);navigate('/agent')};
 if(route.startsWith('/notice-preview/'))return <NoticePreviewPage previewId={route.split('/')[2]}/>;
 if(route.startsWith('/agent/notice-preview/'))return <AgentMobile {...props} route={route} onLogout={logout} storageError={storageError}/>;
 if(route.startsWith('/notice/'))return <div className="geyou-app public-layout"><main className="public-main"><PublicNoticePage {...props} noticeId={route.split('/')[2]}/></main></div>;
 if(!signedIn)return <LoginPage state={stored} onLogin={session=>{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));setLogin(session)}}/>;
 return <><AgentMobile {...props} route={route} onLogout={logout} storageError={storageError}/>{toast&&<div className="toast" role="status">{toast}</div>}</>;
}
