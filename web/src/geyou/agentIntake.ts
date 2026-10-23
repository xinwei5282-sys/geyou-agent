import type {AgentData,AgentProfile} from './agentTypes';
import type {AppState,Staff} from './types';
import {agentData,agentRecord,putAgentData,syncAgentArchive,agentMessage} from './agentModel';

export const INTAKE_GREETING='请先提交能获取逝者信息的文件，例如身份证、死亡证明或户口本逝者所在页。上传后我会整理资料，并逐项提示补充缺失信息。';
export const RELATIONSHIP_OPTIONS=['父亲','母亲','配偶','祖父母','兄弟姐妹','其他亲属'];
export type IntakeField='name'|'gender'|'birthDate'|'relationship'|'deathDate';
const fields:{field:IntakeField;label:string;question:string;options:{label:string;value:string}[]}[]=[
 {field:'name',label:'逝者姓名',question:'请先上传逝者的身份证、死亡证明或户口本，获取姓名等信息。',options:[]},
 {field:'gender',label:'性别',question:'逝者的性别是？',options:['男','女'].map(value=>({label:value,value}))},
 {field:'birthDate',label:'出生日期',question:'请从证件核对逝者的出生日期，可在个人信息中选择日期。',options:[]},
 {field:'relationship',label:'与家属关系',question:'逝者与当前家属是什么关系？',options:RELATIONSHIP_OPTIONS.map(value=>({label:value,value}))},
 {field:'deathDate',label:'逝世日期',question:'请核对逝世日期，可上传死亡证明，或在个人信息中选择日期。',options:[]},
];
export function agentIntake(data:Pick<AgentData,'profile'|'materials'>){
 const missing=fields.filter(x=>!data.profile[x.field]?.trim());
 return {complete:missing.length===0&&!!data.profile.confirmedAt,missing:missing.map(x=>x.label),question:missing[0],hasDocuments:data.materials.some(m=>m.kind==='证件资料'),hasRecognition:data.materials.some(m=>!!m.recognition),recognitionFailed:data.materials.some(m=>m.recognitionFailed)};
}
/** A button records only its explicit choice, never an inferred or family-confirmed fact. */
export function chooseIntakeOption(s:AppState,staff:Staff,sid:string,field:IntakeField,value:string):AppState{
 const data=agentData(s,agentRecord(s,staff,sid)),question=agentIntake(data).question;
 if(!question||question.field!==field||!question.options.some(x=>x.value===value)||data.profile[field])throw Error('当前资料已变化，请按最新提示选择');
 const next=syncAgentArchive(putAgentData(s,staff,sid,{...data,profile:{...data.profile,[field]:value}}),staff,sid);
 return agentMessage(agentMessage(next,staff,sid,`${question.label}：${value}`,'user'),staff,sid,`已记录${question.label}为“${value}”，请继续补充并核对个人信息。`);
}
export function receptionQuickReplies(value:unknown):string[]{
 if(!Array.isArray(value))return [];
 return [...new Set(value.filter((x):x is string=>typeof x==='string').map(x=>x.trim()).filter(x=>x.length>0&&x.length<=60&&!/预算|价位|资料已[经]?核对|已确认|已付款|已发布|已采用/.test(x)))].slice(0,3);
}
