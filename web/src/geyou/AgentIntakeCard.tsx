import {useEffect,useState} from 'react';
import {ChevronRight,ClipboardList} from 'lucide-react';
import type {AgentData} from './agentTypes';
import {agentIntake,type IntakeField} from './agentIntake';
export function AgentIntakeCard({data,busy,onProfile,onChoice,onIdentityConfirm}:{data:AgentData;busy:boolean;onProfile:()=>void;onChoice:(field:IntakeField,value:string,custom?:boolean)=>void;onIdentityConfirm:()=>void}){
 const guide=agentIntake(data),q=guide.question;const [customField,setCustomField]=useState<IntakeField|null>(null),[customValue,setCustomValue]=useState('');useEffect(()=>{setCustomField(null);setCustomValue('')},[q?.field]);
 return <section className="agent-intake" aria-label="个人信息完善">
  <button className="agent-intake-profile" disabled={busy} onClick={onProfile}><ClipboardList size={21}/><span><strong>个人信息完善</strong><small>{guide.identity.pending?'识别结果待人工核对':guide.missing.length?'待补充：'+guide.missing.join('、'):guide.complete?'资料已核对，可查看或补充':'资料已整理，请核对后保存'}</small></span><ChevronRight size={18}/></button>
  {guide.identity.pending?<div className="agent-intake-followup" role="region" aria-label="身份识别人工核对"><p><strong>请对照原件，确认识别信息是否正确。</strong></p>{guide.identity.fields.map(f=><p key={f.key}>{f.label}：{f.value}{f.current&&f.current!==f.value?<small>（当前档案：{String(f.current)}，请人工选择）</small>:null}</p>)}{guide.identity.material?.recognition?.warnings.map((w,i)=><p key={i}>{w}</p>)}<div className="agent-intake-actions"><button disabled={busy||guide.identity.conflict||!guide.identity.fields.length} onClick={onIdentityConfirm}>识别正确，继续</button><button disabled={busy} onClick={onProfile}>有误，修改资料</button></div></div>:(!guide.complete||!!q)&&<div className="agent-intake-followup">
   <p>{guide.recognitionFailed?'本次未能识别完整信息，可从底部加号重传，或点击个人信息完善核对。':q?.question||'请打开个人信息，核对已整理的内容后保存。'}</p>
   {!!q?.options.length&&<div className="agent-intake-options" aria-label={q.label+'推荐选项'}>{q.options.map(o=><button key={o.value} disabled={busy} onClick={()=>{if(o.value==='__custom__'){setCustomField(q.field);setCustomValue('')}else onChoice(q.field,o.value)}}>{o.label}</button>)}</div>}
   {q&&customField===q.field&&<div className="agent-intake-custom"><label>填写{q.label}<input autoFocus aria-label={'填写'+q.label} maxLength={100} value={customValue} onChange={e=>setCustomValue(e.target.value)} placeholder="请输入具体内容"/></label><div className="agent-intake-actions"><button disabled={busy||!customValue.trim()} onClick={()=>onChoice(q.field,customValue,true)}>保存并继续</button><button disabled={busy} onClick={()=>setCustomField(null)}>取消</button></div></div>}

  </div>}
 </section>;
}
