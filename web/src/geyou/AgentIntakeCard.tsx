import {ChevronRight,ClipboardList} from 'lucide-react';
import type {AgentData} from './agentTypes';
import {agentIntake,type IntakeField} from './agentIntake';
export function AgentIntakeCard({data,busy,onProfile,onIdentityConfirm}:{data:AgentData;busy:boolean;onProfile:()=>void;onChoice:(field:IntakeField,value:string,custom?:boolean)=>void;onIdentityConfirm:()=>void}){
 const guide=agentIntake(data);
 return <section className="agent-intake" aria-label="个人信息完善">
  <button className="agent-intake-profile" disabled={busy} onClick={onProfile}><ClipboardList size={21}/><span><strong>个人信息完善</strong><small>{guide.identity.pending?'识别结果待人工核对':data.personalization==='yes'?'点击完善职业、喜好、信仰与习俗':guide.missing.length?'点击查看或完善逝者资料':guide.complete?'资料已核对，可查看或补充':'资料已整理，请核对后保存'}</small></span><ChevronRight size={18}/></button>

 </section>;
}

export function AgentRecognitionCard({data,busy,onProfile,onIdentityConfirm}:{data:AgentData;busy:boolean;onProfile:()=>void;onIdentityConfirm:()=>void}){
 const {identity}=agentIntake(data);
 return <section className="agent-intake" aria-label={identity.pending?'身份识别人工核对':'已核对的识别资料'}><div className="agent-intake-followup" role="region"><p><strong>{identity.pending?'请对照原件，确认识别信息是否正确。':'识别资料 · 已核对'}</strong></p>{identity.fields.map(f=><p key={f.key}>{f.label}：{identity.pending?f.value:String(f.current||f.value)}{identity.pending&&f.current&&f.current!==f.value?<small>（当前档案：{String(f.current)}，请人工选择）</small>:null}</p>)}{identity.material?.recognition?.warnings.map((w,i)=><p key={i}>{w}</p>)}{identity.pending&&<div className="agent-intake-actions"><button disabled={busy||identity.conflict||!identity.fields.length} onClick={onIdentityConfirm}>识别正确，继续</button><button disabled={busy} onClick={onProfile}>有误，修改资料</button></div>}</div></section>;
}
