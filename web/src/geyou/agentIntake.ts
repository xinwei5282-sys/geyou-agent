import type {AgentData,AgentProfile} from './agentTypes';
import type {AppState,Staff} from './types';
import {DOCUMENT_FIELDS} from './documentOcr';
import {agentData,agentRecord,putAgentData,syncAgentArchive,agentMessage} from './agentModel';

export const INTAKE_GREETING='请上传逝者的身份证、死亡证明或户口本逝者所在页，我来整理信息。';
export const RELATIONSHIP_OPTIONS=['父亲','母亲','配偶','祖父母','兄弟姐妹','其他亲属'];
export type IntakeField='name'|'gender'|'birthDate'|'relationship'|'deathDate'|'occupation'|'faith'|'interests';
const preferenceFields=['occupation','faith','interests'];
const choices=(values:string[])=>[...values.map(value=>({label:value,value})),{label:'都不是，自己填写',value:'__custom__'},{label:'暂不清楚',value:'__unknown__'}];
const fields:{field:IntakeField;label:string;question:string;options:{label:string;value:string}[]}[]=[
 {field:'name',label:'逝者姓名',question:'请先上传逝者的身份证、死亡证明或户口本，获取姓名等信息。',options:[]},
 {field:'gender',label:'性别',question:'逝者的性别是？',options:['男','女'].map(value=>({label:value,value}))},
 {field:'birthDate',label:'出生日期',question:'请从证件核对逝者的出生日期，可在个人信息中选择日期。',options:[]},
 {field:'relationship',label:'与家属关系',question:'逝者与当前家属是什么关系？',options:[...RELATIONSHIP_OPTIONS.map(value=>({label:value,value})),{label:'都不是，自己填写',value:'__custom__'}]},
 {field:'deathDate',label:'逝世日期',question:'请核对逝世日期，可上传死亡证明，或在个人信息中选择日期。',options:[]},
 {field:'occupation',label:'生前职业',question:'逝者生前主要从事什么职业？',options:choices(['教师','军人','工人','务农','经商','公务人员'])},
 {field:'faith',label:'逝者信仰',question:'逝者本人有宗教信仰吗？',options:choices(['无特定信仰','佛教','道教','基督教','天主教','伊斯兰教'])},
 {field:'interests',label:'生前喜好',question:'逝者生前有什么喜好？可选一项，也可以直接补充。',options:choices(['园艺','书画','音乐','阅读','运动'])},
];
export function agentIdentityReview(data:Pick<AgentData,'profile'|'materials'|'identityReviewPending'>){
 const material=data.materials.filter(m=>m.kind==='证件资料'&&m.recognition).at(-1);
 const pending=!!material&&(data.identityReviewPending===true||(!material.recognition?.reviewedAt&&!data.profile.confirmedAt));
 const fields=Object.entries(material?.recognition?.fields||{}).map(([key,value])=>({key,label:DOCUMENT_FIELDS[key as keyof typeof DOCUMENT_FIELDS],value,current:data.profile[key as keyof AgentProfile]}));
 return {pending,material,fields,conflict:fields.some(f=>f.current&&f.current!==f.value)};
}
export function reviewAgentIdentity(s:AppState,staff:Staff,sid:string,edited?:AgentProfile){
 const c=agentRecord(s,staff,sid),data=agentData(s,c),review=agentIdentityReview(data);if(!review.pending)throw Error('当前没有待核对的识别资料');
 if(!edited&&(review.conflict||!review.fields.length))throw Error('请先对照原件修改或选择资料');
 const profile=edited?{...edited,confirmedAt:undefined}:data.profile;if(!profile.name.trim())throw Error('请先对照原件填写逝者姓名');
 const at=new Date().toISOString(),materials=data.materials.map(m=>m.id===review.material!.id?{...m,recognition:{...m.recognition!,reviewedAt:at}}:m);
 const next=syncAgentArchive(putAgentData(s,staff,sid,{...data,profile,materials,identityReviewPending:false,identityReviewedAt:at}),staff,sid);
 return agentMessage(next,staff,sid,'识别资料已人工核对，请继续补充信息。');
}
export function agentIntake(data:Pick<AgentData,'profile'|'materials'|'preferenceReviewed'|'identityReviewPending'>){
 const missing=fields.filter(x=>{const value=data.profile[x.field]?.trim();return (!value||value==='待确认')&&!(preferenceFields.includes(x.field)&&data.preferenceReviewed?.includes(x.field))});
 const identity=agentIdentityReview(data);
 return {identity,complete:!identity.pending&&!missing.some(x=>!preferenceFields.includes(x.field))&&!!data.profile.confirmedAt,missing:missing.map(x=>x.label),question:identity.pending?undefined:missing[0],hasDocuments:data.materials.some(m=>m.kind==='证件资料'),hasRecognition:data.materials.some(m=>!!m.recognition),recognitionFailed:data.materials.some(m=>m.recognitionFailed)};
}
/** A button records only its explicit choice, never an inferred or family-confirmed fact. */
export function chooseIntakeOption(s:AppState,staff:Staff,sid:string,field:IntakeField,value:string,custom=false):AppState{
 const data=agentData(s,agentRecord(s,staff,sid)),question=agentIntake(data).question;
 if(!question||question.field!==field||!(custom?['relationship',...preferenceFields].includes(field)&&value.trim().length>0&&value.trim().length<=100&&!value.startsWith('__'):question.options.some(x=>x.value===value)&&value!=='__custom__')||(data.profile[field]&&data.profile[field]!=='待确认'))throw Error('当前资料已变化，请按最新提示选择');
 value=value.trim();const selected=field==='faith'&&custom?'其他宗教':value;
 const next=syncAgentArchive(putAgentData(s,staff,sid,{...data,preferenceReviewed:preferenceFields.includes(field)?[...new Set([...(data.preferenceReviewed||[]),field])]:data.preferenceReviewed,profile:value==='__unknown__'?data.profile:{...data.profile,[field]:selected,...(field==='faith'?{faithDetail:custom?value:undefined}:{}),...(preferenceFields.includes(field)?{confirmedAt:undefined}:{})}}),staff,sid);
 return agentMessage(agentMessage(next,staff,sid,`${question.label}：${value==='__unknown__'?'暂不清楚':value}`,'user'),staff,sid,value==='__unknown__'?`这项先留待确认，继续下一项。`:`已记录${question.label}为“${value}”。`);
}
export function receptionQuickReplies(value:unknown):string[]{
 if(!Array.isArray(value))return [];
 return [...new Set(value.filter((x):x is string=>typeof x==='string').map(x=>x.trim()).filter(x=>x.length>0&&x.length<=60&&!/预算|价位|资料已[经]?核对|已确认|已付款|已发布|已采用/.test(x)))].slice(0,3);
}
