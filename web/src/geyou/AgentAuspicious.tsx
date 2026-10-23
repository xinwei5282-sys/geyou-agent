import {CEMETERY_ADVICE_VERSION,requestCemeteryAdvice,type CemeteryAdvice} from './cemeteryAdvice';
import {CemeteryNeedsForm,CemeteryRecommendations} from './CemeteryRecommendations';
import {defaultCemeteryNeeds,recommendCemeteries,canFinishSelection,toggleSelectionMode,selectionModeLabel,type SelectionMode,type CemeteryNeeds,type CemeteryMatch} from './cemeteryModel';
import {validateAuspiciousProfile} from './auspiciousProfile';
import {useState,useEffect,useRef,type ReactNode} from 'react';
import {ArrowLeft,CalendarDays,Check,ChevronRight,X} from 'lucide-react';
import {calculateAgentBazi,emptyAgentProfile} from './agentModel';
import {burialCandidates,defaultBurialRange,maximumBurialEnd,type BurialCandidate} from './auspiciousModel';
import type {Customer} from './types';
import type {AgentProfile} from './agentTypes';
export type Saved={cemeteryAdvice?:CemeteryAdvice;mode?:SelectionMode;cemeteryNeeds?:CemeteryNeeds;cemeteryMatches?:CemeteryMatch[];selectedCemeteryId?:string;customerId?:string;personId?:string;profile:AgentProfile;from:string;to:string;candidates?:BurialCandidate[];selected?:string;confirmedAt?:string};
const candidateKey=(c:BurialCandidate)=>c.date+' '+c.start;
const localDate=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function FeedbackToast({message,onDismiss}:{message:string;onDismiss:()=>void}){useEffect(()=>{const timer=setTimeout(onDismiss,4200);return()=>clearTimeout(timer)},[message,onDismiss]);return <div className="auspicious-toast" role="alert">{message}</div>}
function CustomerSheet({children,onClose,onSave,error,onClearError}:{onClearError:()=>void;children:ReactNode;onClose:()=>void;onSave:()=>void;error:string}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const el=ref.current!;el.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=old}},[]);
 return <dialog ref={ref} className="auspicious-profile-dialog agent-refined" aria-label="客户信息" onCancel={e=>{e.preventDefault();onClose()}}><div className="auspicious-sheet-grip"/><header><div><h2>客户信息</h2></div><button aria-label="关闭客户信息" onClick={onClose}><X size={22}/></button></header><div className="auspicious-sheet-body">{children}</div><footer>{error&&<FeedbackToast message={error} onDismiss={onClearError}/>} <button className="agent-primary agent-wide" onClick={onSave}>保存客户信息</button></footer></dialog>;
}
export function AgentAuspicious({storageKey,customers,onBack,onRecordChange,view,onViewChange}:{view?:string;onViewChange:(view:'needs'|'results')=>void;key?:string;storageKey:string;customers:Customer[];onBack:()=>void;onRecordChange?:(saved:Saved)=>void}){
 const [saved,setSaved]=useState<Saved>(()=>{try{const s=JSON.parse(localStorage.getItem(storageKey)||'null');if(s&&typeof s.from==='string'&&typeof s.to==='string'&&typeof s.profile?.birthDate==='string')return {...s,profile:{...emptyAgentProfile(),...s.profile}}}catch{}return {profile:emptyAgentProfile(),from:localDate(),to:localDate(6)}});
 const mode=saved.mode||'burial',needsTime=mode!=='cemetery',needsPlace=mode!=='burial';
 const oldCemeteryAdvice=!!saved.cemeteryMatches?.length&&(saved.cemeteryMatches.length>2||saved.cemeteryAdvice?.promptVersion!==CEMETERY_ADVICE_VERSION||!saved.cemeteryMatches[0].baziEvidence);
 const resultsPage=!oldCemeteryAdvice&&!!(saved.candidates||saved.cemeteryMatches)&&view!=='needs';
 const [detailId,setDetailId]=useState(''),[busy,setBusy]=useState(false);
 const [resultTab,setResultTab]=useState<'burial'|'cemetery'>(needsTime?'burial':'cemetery');
 const showTime=needsTime&&(!needsPlace||resultTab==='burial'),showPlace=needsPlace&&(!needsTime||resultTab==='cemetery');
 const requestRef=useRef<AbortController|null>(null);useEffect(()=>()=>requestRef.current?.abort(),[]);
 const [customerId,setCustomerId]=useState(saved.customerId||''),[personId,setPersonId]=useState(saved.personId||''),[error,setError]=useState('');
 useEffect(()=>{if(oldCemeteryAdvice){setSaved(s=>({...s,cemeteryMatches:undefined,cemeteryAdvice:undefined,selectedCemeteryId:undefined,confirmedAt:undefined}));setError('公墓推荐规则已更新，请重新生成择吉方案');onViewChange('needs')}},[oldCemeteryAdvice]);
 let chart:ReturnType<typeof calculateAgentBazi>|undefined;let chartError='';try{chart=calculateAgentBazi({...saved.profile,birthplace:'北京时间（UTC+8）'})}catch(e){chartError=(e as Error).message}
 const store=(next:Saved)=>{try{const previous=localStorage.getItem(storageKey);localStorage.setItem(storageKey,JSON.stringify(next));try{onRecordChange?.(next)}catch(e){if(previous===null)localStorage.removeItem(storageKey);else localStorage.setItem(storageKey,previous);throw e}setSaved(next);setError('');return true}catch{setError('当前资料未能保存，请检查浏览器存储空间。');return false}};
 const change=(patch:Partial<Saved>)=>{let range={};if(patch.profile?.deathDate&&(patch.profile.deathDate!==saved.profile.deathDate||'customerId' in patch||'personId' in patch)){try{range=defaultBurialRange(patch.profile.deathDate)}catch{}}const ok=store({...saved,...patch,...range,...(patch.profile||patch.mode?{cemeteryMatches:undefined,cemeteryAdvice:undefined,selectedCemeteryId:undefined}:{}),candidates:undefined,selected:undefined,confirmedAt:undefined});return ok};
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(saved.profile),[formError,setFormError]=useState('');
 const openCustomer=()=>{setDraft({...saved.profile});setCustomerId(saved.customerId||'');setPersonId(saved.personId||'');setFormError('');setEditing(true)};
 const profile=(patch:Partial<AgentProfile>)=>setDraft(p=>({...p,...patch}));
 const saveCustomer=()=>{try{validateAuspiciousProfile(draft);if(JSON.stringify(draft)!==JSON.stringify(saved.profile)||customerId!==(saved.customerId||'')||personId!==(saved.personId||'')){if(!change({profile:draft,customerId,personId}))throw Error('客户信息未能保存，请重试')}setEditing(false)}catch(e){setFormError((e as Error).message)}};
 const generate=async()=>{if(busy)return;const abort=new AbortController();requestRef.current=abort;try{validateAuspiciousProfile(saved.profile);const candidates=needsTime?burialCandidates(saved.profile,saved.from,saved.to):undefined;let cemeteryMatches=needsPlace?recommendCemeteries(saved.cemeteryNeeds||defaultCemeteryNeeds()):undefined;let cemeteryAdvice:CemeteryAdvice|undefined;
 if(cemeteryMatches?.length){setBusy(true);setError('');cemeteryAdvice=await requestCemeteryAdvice(saved.profile,saved.cemeteryNeeds||defaultCemeteryNeeds(),cemeteryMatches,abort.signal);if(abort.signal.aborted)return;cemeteryMatches=cemeteryAdvice.recommendations.map(r=>({...cemeteryMatches!.find(m=>m.cemetery.id===r.cemeteryId)!,baziReason:r.reason,baziPending:r.missing,baziEvidence:r.evidence}));}
 if(store({...saved,candidates,cemeteryMatches,cemeteryAdvice,selected:undefined,selectedCemeteryId:undefined,confirmedAt:undefined}))onViewChange('results');
 }catch(e){if(!abort.signal.aborted)setError((e as Error).message)}finally{if(requestRef.current===abort){requestRef.current=null;if(!abort.signal.aborted)setBusy(false)}}};

 return <div className="agent-app agent-refined agent-auspicious-shell"><div className="agent-frame">
  <header className="agent-subpage-top"><button className="agent-detail-back" aria-label={resultsPage?'返回填写需求':'返回安葬择吉列表'} onClick={()=>{requestRef.current?.abort();if(resultsPage)onViewChange('needs');else onBack()}}><ArrowLeft size={20}/></button><h1>{resultsPage?'安葬择吉结果':'安葬择吉'}</h1></header>
  <main key={resultsPage?'results':'needs'} className={'agent-page agent-auspicious'+(resultsPage?' auspicious-result-page':' auspicious-needs-page')}>
   <fieldset className="auspicious-fields" disabled={busy}>
   {!resultsPage&&<>
   <div className="auspicious-intro"><span>时间与安葬地点</span><h2>按需要选择服务</h2></div>
   <div className="auspicious-mode" role="group" aria-label="服务选择">{(['burial','cemetery'] as const).map(m=><button key={m} aria-pressed={mode===m||mode==='both'} onClick={()=>{const next=toggleSelectionMode(mode,m);if(next!==mode){change({mode:next});setDetailId('')}}}>{m==='burial'?'择时':'择位'}</button>)}</div>
   <button className="auspicious-customer-card" onClick={openCustomer} aria-label="填写或修改客户信息"><span className="auspicious-summary-icon"><CalendarDays size={22}/></span><span><strong>{saved.profile.name||'选择或填写客户信息'}</strong>{saved.profile.birthDate&&<small>{saved.profile.birthDate+' '+saved.profile.birthTime+' · 北京时间'}</small>}{saved.profile.deathDate&&<small>逝世日期 {saved.profile.deathDate}</small>}</span><ChevronRight size={18}/></button>

   {needsTime&&<details className="auspicious-range-panel" open><summary><span><strong>下葬日期范围</strong></span><span>调整<ChevronRight size={16}/></span></summary><section className="agent-form-section"><div className="agent-form-grid"><label className="agent-field"><span>开始日期</span><input type="date" min={saved.profile.deathDate||undefined} value={saved.from} onChange={e=>change({from:e.target.value})}/></label><label className="agent-field"><span>结束日期</span><input type="date" min={saved.from} max={maximumBurialEnd(saved.from)} value={saved.to} onChange={e=>change({to:e.target.value})}/></label></div></section></details>}
   {needsPlace&&<CemeteryNeedsForm value={saved.cemeteryNeeds||defaultCemeteryNeeds()} onChange={cemeteryNeeds=>{store({...saved,cemeteryNeeds,cemeteryMatches:undefined,cemeteryAdvice:undefined,selectedCemeteryId:undefined,confirmedAt:undefined});setDetailId('')}}/>}

   </>}
   {resultsPage&&<>
   <div className="auspicious-result-context"><strong>{saved.profile.name}</strong><span>{selectionModeLabel(mode)}</span></div>
   {chart&&<details className="auspicious-chart-panel" aria-label="四柱排盘结果" open><summary><span>四柱排盘</span><ChevronRight size={16}/></summary><section className="agent-form-section">{chart?.ready?<><div className="agent-pillars">{chart.pillars.map((text,i)=><div key={i}><small>{['年柱','月柱','日柱','时柱'][i]}</small><strong>{text}</strong></div>)}</div></>:<p className="agent-hint">{chartError||(!chart?.ready?chart?.reason:'')||'请核对出生资料'}</p>}</section></details>}
   {needsTime&&needsPlace&&<div className="auspicious-result-tabs" role="tablist" aria-label="择吉结果分类">{(['burial','cemetery'] as const).map(tab=><button key={tab} role="tab" aria-selected={resultTab===tab} aria-controls={'result-'+tab} id={'tab-'+tab} onClick={()=>setResultTab(tab)}>{tab==='burial'?'择时':'择位'}</button>)}</div>}
   <div id="result-burial" role={needsPlace&&needsTime?'tabpanel':undefined} aria-labelledby={needsPlace&&needsTime?'tab-burial':undefined} hidden={!showTime}>
   {needsTime&&saved.candidates&&<section className="auspicious-results" aria-label="候选下葬时间"><div className="auspicious-results-heading"><div><h2>候选下葬时间</h2></div><b>{new Set(saved.candidates.map(c=>c.date)).size}<small>个日期</small></b></div>

    {!saved.candidates.length&&<div className="auspicious-empty"><CalendarDays size={30}/><h3>当前范围暂无候选</h3></div>}
    {(Object.entries(saved.candidates.reduce<Record<string,BurialCandidate[]>>((groups,c)=>{(groups[c.date]??=[]).push(c);return groups},{})) as [string,BurialCandidate[]][] ).map(([date,items])=><article className="auspicious-date-card" key={date}><header><div className="auspicious-date-number"><strong>{date.slice(8)}</strong><span>{Number(date.slice(5,7))}月</span></div><div><h3>{date}</h3><p>{new Date(date+'T12:00:00+08:00').toLocaleDateString('zh-CN',{weekday:'long',timeZone:'Asia/Shanghai'})} · {items[0].day}日</p></div><span className="auspicious-suitable">宜安葬</span></header><details className="auspicious-date-evidence"><summary>推算依据</summary><p>本日日支为{items[0].day.slice(-1)}；{items.map(c=>c.start+'时段的时支为'+c.hour.slice(-1)).join('，')}，均与出生四柱地支无六冲。</p></details><div className="auspicious-time-grid">{items.map(c=><button type="button" key={candidateKey(c)} aria-pressed={saved.selected===candidateKey(c)} onClick={()=>{store({...saved,selected:candidateKey(c),confirmedAt:undefined})}}><strong>{c.start}–{c.end}</strong><small>{c.hour}时{saved.selected===candidateKey(c)&&<Check size={14}/>}</small></button>)}</div></article>)}
   </section>}
   {needsTime&&saved.candidates&&chart?.ready&&<section className="auspicious-time-reference"><h2>八字择时参考</h2><p>黄历日、时均宜安葬，且与出生四柱地支无六冲。</p><details><summary>推算依据</summary><p>出生地支：{chart.pillars.map(p=>p.slice(-1)).join('、')}。</p></details></section>}
   </div>
   <div id="result-cemetery" role={needsPlace&&needsTime?'tabpanel':undefined} aria-labelledby={needsPlace&&needsTime?'tab-cemetery':undefined} hidden={!showPlace}>
   {needsPlace&&saved.cemeteryMatches&&<CemeteryRecommendations matches={saved.cemeteryMatches} selectedId={saved.selectedCemeteryId} detailId={detailId} onDetail={setDetailId} onSelect={selectedCemeteryId=>{if(store({...saved,selectedCemeteryId,confirmedAt:undefined}))setDetailId('')}}/>}
   </div>
  </>}
  </fieldset>
  </main>
  <footer className="auspicious-actions">{resultsPage&&<div className="auspicious-selection-summary" aria-label="本次选择">{needsTime&&<span>择时：{saved.selected?saved.selected+'–'+saved.candidates?.find(c=>candidateKey(c)===saved.selected)?.end:'待选择'}</span>}{needsPlace&&<span>择位：{saved.cemeteryMatches?.find(m=>m.cemetery.id===saved.selectedCemeteryId)?.cemetery.name||'待选择'}</span>}</div>}{error&&<FeedbackToast message={error} onDismiss={()=>setError('')}/>} <div className="auspicious-action-buttons">{resultsPage?<><button className="agent-secondary" onClick={()=>onViewChange('needs')}>修改需求</button><button className="agent-primary" disabled={!canFinishSelection(mode,saved.selected,saved.selectedCemeteryId)} onClick={()=>{try{validateAuspiciousProfile(saved.profile);if(store({...saved,confirmedAt:new Date().toISOString()}))onBack()}catch(e){setError((e as Error).message)}}}>保存选择并返回</button></>:<button className="agent-primary agent-wide" disabled={busy} onClick={()=>void generate()}>{busy?'正在生成择吉方案…':'生成择吉方案'}</button>}</div></footer>
 {editing&&<CustomerSheet onClose={()=>setEditing(false)} onSave={saveCustomer} error={formError} onClearError={()=>setFormError('')}>   <section className="agent-form-section">
    <label className="agent-field"><span>选择客户</span><select value={customerId} onChange={e=>{setCustomerId(e.target.value);const people=customers.find(c=>c.id===e.target.value)?.deceased||[];const person=people.length===1?people[0]:undefined;setPersonId(person?.id||'');setDraft(person?{...emptyAgentProfile(),...person.agentProfile,name:person.name}:emptyAgentProfile())}}><option value="">手动填写客户信息</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {customerId&&(customers.find(c=>c.id===customerId)?.deceased?.length||0)!==1&&<label className="agent-field"><span>选择逝者</span><select value={personId} onChange={e=>{setPersonId(e.target.value);const p=customers.find(c=>c.id===customerId)?.deceased?.find(p=>p.id===e.target.value);setDraft(p?{...emptyAgentProfile(),...p.agentProfile,name:p.name}:emptyAgentProfile())}}><option value="">请选择服务对象</option>{customers.find(c=>c.id===customerId)?.deceased?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label className="agent-field"><span>逝者姓名</span><input value={draft.name} onChange={e=>profile({name:e.target.value})} placeholder="填写或选择逝者"/></label>
    <label className="agent-field"><span>逝世日期 *</span><input type="date" required value={draft.deathDate} onChange={e=>profile({deathDate:e.target.value})}/></label>
    <div className="agent-form-grid"><label className="agent-field"><span>日期口径</span><select value={draft.calendar} onChange={e=>profile({calendar:e.target.value as 'solar'|'lunar',leap:false})}><option value="solar">公历</option><option value="lunar">农历</option></select></label><label className="agent-field"><span>出生日期 *</span><input type="date" required value={draft.birthDate} onChange={e=>profile({birthDate:e.target.value})}/></label><label className="agent-field"><span>出生时间 *</span><input type="time" required value={draft.birthTime} onChange={e=>profile({birthTime:e.target.value})}/></label></div>
    {draft.calendar==='lunar'&&<label className="agent-check"><input type="checkbox" checked={draft.leap} onChange={e=>profile({leap:e.target.checked})}/>闰月</label>}
    <div className="auspicious-advanced"><label className="agent-field"><span>换日口径</span><select value={draft.sect} onChange={e=>profile({sect:Number(e.target.value) as 1|2})}><option value="2">零点换日</option><option value="1">23点换日</option></select></label></div>
   </section>
</CustomerSheet>}
 </div></div>;
}
