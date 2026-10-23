import {validateAgentDates} from './agentAge';
import {useState,useEffect,useRef,type ReactNode} from 'react';
import {ArrowLeft,CalendarDays,Check,ChevronRight,X} from 'lucide-react';
import {calculateAgentBazi,emptyAgentProfile} from './agentModel';
import {burialCandidates,defaultBurialRange,type BurialCandidate} from './auspiciousModel';
import type {Customer} from './types';
import type {AgentProfile} from './agentTypes';
export type Saved={customerId?:string;personId?:string;profile:AgentProfile;from:string;to:string;candidates?:BurialCandidate[];selected?:string;confirmedAt?:string};
const candidateKey=(c:BurialCandidate)=>c.date+' '+c.start;
const localDate=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function CustomerSheet({children,onClose,onSave,error}:{children:ReactNode;onClose:()=>void;onSave:()=>void;error:string}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const el=ref.current!;el.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=old}},[]);
 return <dialog ref={ref} className="auspicious-profile-dialog agent-refined" aria-label="客户信息" onCancel={e=>{e.preventDefault();onClose()}}><div className="auspicious-sheet-grip"/><header><div><h2>客户信息</h2><p>选择已有客户，或手动填写</p></div><button aria-label="关闭客户信息" onClick={onClose}><X size={22}/></button></header><div className="auspicious-sheet-body">{children}{error&&<p className="agent-error" role="alert">{error}</p>}</div><footer><button className="agent-primary agent-wide" onClick={onSave}>保存客户信息</button></footer></dialog>;
}
export function AgentAuspicious({storageKey,customers,onBack,onRecordChange}:{key?:string;storageKey:string;customers:Customer[];onBack:()=>void;onRecordChange?:(saved:Saved)=>void}){
 const [saved,setSaved]=useState<Saved>(()=>{try{const s=JSON.parse(localStorage.getItem(storageKey)||'null');if(s&&typeof s.from==='string'&&typeof s.to==='string'&&typeof s.profile?.birthDate==='string')return {...s,profile:{...emptyAgentProfile(),...s.profile}}}catch{}return {profile:emptyAgentProfile(),from:localDate(),to:localDate(6)}});
 const [customerId,setCustomerId]=useState(saved.customerId||''),[personId,setPersonId]=useState(saved.personId||''),[show,setShow]=useState(!!saved.candidates),[error,setError]=useState('');
 let chart:ReturnType<typeof calculateAgentBazi>|undefined;let chartError='';try{chart=calculateAgentBazi({...saved.profile,birthplace:'北京时间（UTC+8）'})}catch(e){chartError=(e as Error).message}
 const store=(next:Saved)=>{setSaved(next);try{localStorage.setItem(storageKey,JSON.stringify(next));onRecordChange?.(next);setError('');return true}catch{setError('当前资料未能保存，请检查浏览器存储空间。');return false}};
 const change=(patch:Partial<Saved>)=>{let range={};if(patch.profile?.deathDate&&(patch.profile.deathDate!==saved.profile.deathDate||'customerId' in patch||'personId' in patch)){try{range=defaultBurialRange(patch.profile.deathDate)}catch{}}store({...saved,...patch,...range,candidates:undefined,selected:undefined,confirmedAt:undefined});setShow(false)};
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(saved.profile),[formError,setFormError]=useState('');
 const openCustomer=()=>{setDraft({...saved.profile});setCustomerId(saved.customerId||'');setPersonId(saved.personId||'');setFormError('');setEditing(true)};
 const profile=(patch:Partial<AgentProfile>)=>setDraft(p=>({...p,...patch}));
 const saveCustomer=()=>{try{if(!draft.name.trim())throw Error('请填写或选择逝者姓名');validateAgentDates(draft);if(JSON.stringify(draft)!==JSON.stringify(saved.profile)||customerId!==(saved.customerId||'')||personId!==(saved.personId||''))change({profile:draft,customerId,personId});setEditing(false)}catch(e){setFormError((e as Error).message)}};
 const generate=()=>{setShow(true);try{if(!saved.profile.name.trim())throw Error('请填写或选择逝者姓名');const candidates=burialCandidates(saved.profile,saved.from,saved.to);store({...saved,candidates,selected:undefined,confirmedAt:undefined});}catch(e){setError((e as Error).message)}};

 return <div className="agent-app agent-refined"><div className="agent-frame">
  <header className="agent-subpage-top"><button className="agent-detail-back" aria-label="返回择吉列表" onClick={onBack}><ArrowLeft size={20}/></button><h1>择吉</h1></header>
  <main className={'agent-page agent-auspicious'+(saved.selected?' has-selection':'')}>
   <div className="auspicious-intro"><span>黄历 · 八字参考</span><h2>选择下葬时间</h2></div>
   <button className="auspicious-customer-card" onClick={openCustomer} aria-label="填写或修改客户信息"><span className="auspicious-summary-icon"><CalendarDays size={22}/></span><span><strong>{saved.profile.name||'选择或填写客户信息'}</strong><small>{saved.profile.birthDate?saved.profile.birthDate+' '+saved.profile.birthTime+' · 北京时间':'填写出生资料，用于八字排盘'}</small>{saved.profile.deathDate&&<small>逝世日期 {saved.profile.deathDate}</small>}</span><ChevronRight size={18}/></button>
   {saved.selected&&<section className="auspicious-selected-result" aria-label="已选下葬时间"><span><Check size={16}/>已选下葬时间</span><strong>{saved.selected.split(' ')[0]}</strong><b>{saved.selected.split(' ')[1]}–{saved.candidates?.find(c=>candidateKey(c)===saved.selected)?.end}</b></section>}
   <details className="auspicious-range-panel" open={!saved.candidates}><summary><span><strong>下葬日期范围</strong><small>{saved.from} 至 {saved.to}</small></span><span>调整<ChevronRight size={16}/></span></summary><section className="agent-form-section"><div className="agent-form-grid"><label className="agent-field"><span>开始日期</span><input type="date" value={saved.from} onChange={e=>change({from:e.target.value})}/></label><label className="agent-field"><span>结束日期</span><input type="date" value={saved.to} onChange={e=>change({to:e.target.value})}/></label></div><p className="agent-help">默认逝世当日起7天内，可调整；最多93天。筛选07:00至18:59时段。</p><button className="agent-primary agent-wide" onClick={generate}>生成候选下葬时间</button></section></details>
   {error&&<p className="agent-error" role="alert">{error}</p>}
   {show&&<details className="auspicious-chart-panel" aria-label="四柱排盘结果"><summary><span>四柱排盘</span><small>{chart?.ready?chart.pillars.join(' · '):'资料待核对'}</small><ChevronRight size={16}/></summary><section className="agent-form-section">{chart?.ready?<><div className="agent-pillars">{chart.pillars.map((text,i)=><div key={i}><small>{['年柱','月柱','日柱','时柱'][i]}</small><strong>{text}</strong></div>)}</div><p className="agent-help">公历 {chart.solarDate} · {saved.profile.birthTime}<br/>{chart.rule}</p></>:<p className="agent-hint">{chartError||(!chart?.ready?chart?.reason:'')||'请核对出生资料'}</p>}</section></details>}
   {saved.candidates&&<section className="auspicious-results" aria-label="候选下葬时间"><div className="auspicious-results-heading"><div><span>可供人工确认</span><h2>候选下葬时间</h2></div><b>{new Set(saved.candidates.map(c=>c.date)).size}<small>个日期</small></b></div><p className="auspicious-results-sub">共 {saved.candidates.length} 个时段 · 点选即保存并返回列表</p>
    <details className="auspicious-rules"><summary>查看筛选依据与适用范围</summary><p>黄历日、时均宜安葬且未列忌安葬；日支、时支与出生四柱地支无六冲。未纳入墓向、家属命盘等条件，候选需人工复核，不代表优劣排名。</p></details>
    {!saved.candidates.length&&<div className="auspicious-empty"><CalendarDays size={30}/><h3>当前范围暂无候选</h3><p>可调整日期范围，再次筛选。</p></div>}
    {(Object.entries(saved.candidates.reduce<Record<string,BurialCandidate[]>>((groups,c)=>{(groups[c.date]??=[]).push(c);return groups},{})) as [string,BurialCandidate[]][] ).map(([date,items])=><article className="auspicious-date-card" key={date}><header><div className="auspicious-date-number"><strong>{date.slice(8)}</strong><span>{Number(date.slice(5,7))}月</span></div><div><h3>{date}</h3><p>{new Date(date+'T12:00:00+08:00').toLocaleDateString('zh-CN',{weekday:'long',timeZone:'Asia/Shanghai'})} · {items[0].day}日</p></div><span className="auspicious-suitable">宜安葬</span></header><div className="auspicious-time-grid">{items.map(c=><button type="button" key={candidateKey(c)} aria-pressed={saved.selected===candidateKey(c)} onClick={()=>{if(store({...saved,selected:candidateKey(c),confirmedAt:new Date().toISOString()}))onBack()}}><strong>{c.start}–{c.end}</strong><small>{c.hour}时{saved.selected===candidateKey(c)&&<Check size={14}/>}</small></button>)}</div></article>)}
   </section>}

  </main>


 {editing&&<CustomerSheet onClose={()=>setEditing(false)} onSave={saveCustomer} error={formError}>   <section className="agent-form-section">
    <label className="agent-field"><span>选择客户</span><select value={customerId} onChange={e=>{setCustomerId(e.target.value);const people=customers.find(c=>c.id===e.target.value)?.deceased||[];const person=people.length===1?people[0]:undefined;setPersonId(person?.id||'');setDraft(person?{...emptyAgentProfile(),...person.agentProfile,name:person.name}:emptyAgentProfile())}}><option value="">手动填写客户信息</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {customerId&&(customers.find(c=>c.id===customerId)?.deceased?.length||0)!==1&&<label className="agent-field"><span>选择逝者</span><select value={personId} onChange={e=>{setPersonId(e.target.value);const p=customers.find(c=>c.id===customerId)?.deceased?.find(p=>p.id===e.target.value);setDraft(p?{...emptyAgentProfile(),...p.agentProfile,name:p.name}:emptyAgentProfile())}}><option value="">请选择服务对象</option>{customers.find(c=>c.id===customerId)?.deceased?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label className="agent-field"><span>逝者姓名</span><input value={draft.name} onChange={e=>profile({name:e.target.value})} placeholder="填写或选择逝者"/></label>
    <label className="agent-field"><span>逝世日期</span><input type="date" value={draft.deathDate} onChange={e=>profile({deathDate:e.target.value})}/></label>
    <div className="agent-form-grid"><label className="agent-field"><span>日期口径</span><select value={draft.calendar} onChange={e=>profile({calendar:e.target.value as 'solar'|'lunar',leap:false})}><option value="solar">公历</option><option value="lunar">农历</option></select></label><label className="agent-field"><span>出生日期</span><input type="date" value={draft.birthDate} onChange={e=>profile({birthDate:e.target.value})}/></label><label className="agent-field"><span>出生时间</span><input type="time" value={draft.birthTime} onChange={e=>profile({birthTime:e.target.value})}/></label></div>
    {draft.calendar==='lunar'&&<label className="agent-check"><input type="checkbox" checked={draft.leap} onChange={e=>profile({leap:e.target.checked})}/>闰月</label>}
    <details className="auspicious-advanced"><summary>排盘口径 · 北京时间</summary><label className="agent-field"><span>换日口径</span><select value={draft.sect} onChange={e=>profile({sect:Number(e.target.value) as 1|2})}><option value="2">零点换日</option><option value="1">23点换日</option></select></label><p className="agent-help">出生时间不详时不补造时辰。北京时间（UTC+8），未校正真太阳时。</p></details>
   </section>
</CustomerSheet>}
 </div></div>;
}
