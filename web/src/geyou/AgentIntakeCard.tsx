import {ChevronRight,ClipboardList,Upload} from 'lucide-react';
import type {AgentData} from './agentTypes';
import {agentIntake,type IntakeField} from './agentIntake';
export function AgentIntakeCard({data,busy,onUpload,onProfile,onChoice}:{data:AgentData;busy:boolean;onUpload:()=>void;onProfile:()=>void;onChoice:(field:IntakeField,value:string)=>void}){
 const guide=agentIntake(data),q=guide.question;
 return <section className="agent-intake" aria-label="个人信息完善">
  <button className="agent-intake-profile" disabled={busy} onClick={onProfile}><ClipboardList size={21}/><span><strong>个人信息完善</strong><small>{guide.complete?'资料已核对，可查看或补充':guide.missing.length?'待补充：'+guide.missing.join('、'):'资料已整理，请核对后保存'}</small></span><ChevronRight size={18}/></button>
  {!guide.complete&&<div className="agent-intake-followup">
   <p>{guide.recognitionFailed?'本次未能识别完整信息，请补传清晰的文件，或选择补充资料。':q?.question||'请打开个人信息，核对已整理的内容后保存。'}</p>
   {!!q?.options.length&&<div className="agent-intake-options" aria-label={q.label+'推荐选项'}>{q.options.map(o=><button key={o.value} disabled={busy} onClick={()=>onChoice(q.field,o.value)}>{o.label}</button>)}</div>}
   <div className="agent-intake-actions"><button disabled={busy} onClick={onUpload}><Upload size={16}/>{guide.hasDocuments?'补传证件资料':'提交身份文件'}</button><button disabled={busy} onClick={onProfile}>{q?.field==='birthDate'?'选择出生日期':q?.field==='deathDate'?'选择逝世日期':'补充并核对'}</button></div>
  </div>}
 </section>;
}
