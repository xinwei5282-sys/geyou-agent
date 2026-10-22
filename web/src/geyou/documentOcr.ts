import type {AgentProfile} from './agentTypes';
export const DOCUMENT_FIELDS={name:'逝者姓名',gender:'性别',birthDate:'出生日期',deathDate:'逝世日期'} as const;
export type DocumentField=keyof typeof DOCUMENT_FIELDS;
export type DocumentRecognition={documentType:'身份证'|'死亡证明'|'户口本'|'其他资料';fields:Partial<Record<DocumentField,string>>;warnings:string[];reviewedAt?:string};
const labels:Record<DocumentField,RegExp>={name:/^(?:死者|逝者|居民)?姓\s*名\s*[:：]?\s*/,gender:/^性\s*别\s*[:：]?\s*/,birthDate:/^(?:出生日期|出生年月日|出生)\s*[:：]?\s*/,deathDate:/^(?:死亡日期|死亡时间|死亡|逝世日期)\s*[:：]?\s*/};
function dateValue(s:string){const m=/(19\d{2}|20\d{2})\s*[年.\-/]\s*(\d{1,2})\s*[月.\-/]\s*(\d{1,2})\s*日?/.exec(s);if(!m)return;const [y,mo,d]=m.slice(1).map(Number),dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d||dt.toISOString().slice(0,10)>new Date().toISOString().slice(0,10))return;return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
// Labelled fields only. No inference from ID numbers, addresses, age or issue dates.
export function parseDocumentText(input:string[]):DocumentRecognition{
 const lines=input.map(x=>x.trim()).filter(Boolean),text=lines.join('\n');
 const documentType=/死亡|逝世/.test(text)?'死亡证明':/户口|常住人口/.test(text)?'户口本':/身份证|公民身份/.test(text)?'身份证':'其他资料';
 const fields:DocumentRecognition['fields']={},warnings:string[]=[];
 for(const key of Object.keys(labels) as DocumentField[]){const values=new Set<string>();for(let i=0;i<lines.length;i++){
  if(!labels[key].test(lines[i]))continue;const rest=lines[i].replace(labels[key],'').trim(),value=rest||lines[i+1]||'';
  if(key==='name'){const m=/^([\p{Script=Han}·]{2,30})(?:\s|$)/u.exec(value);if(m&&!/姓名|性别|民族|住址|出生|死亡/.test(m[1]))values.add(m[1]);}
  else if(key==='gender'){const m=/^(男|女)(?:\s|民族|$)/.exec(value);if(m)values.add(m[1]);}
  else {const d=dateValue(value);if(d)values.add(d);}
 }if(values.size===1)fields[key]=[...values][0];else if(values.size>1)warnings.push(`${DOCUMENT_FIELDS[key]}识别到多个值，请选择逝者所在页并人工核对。`);}
 if(!Object.keys(fields).length)warnings.push('未识别到明确的建档字段，请拍摄清晰、完整的单页，或手动填写。');
 if(fields.birthDate&&fields.deathDate&&fields.birthDate>fields.deathDate){delete fields.birthDate;delete fields.deathDate;warnings.push('生卒日期顺序有冲突，请对照原件核对。');}
 return {documentType,fields,warnings};
}
export function recognitionCandidates(materials:{id:string;name:string;recognition?:DocumentRecognition}[]){return materials.flatMap(m=>(Object.entries(m.recognition?.fields||{}) as [DocumentField,string][]).map(([key,value])=>({key,value,source:m.name,id:m.id})));}
export function fillRecognitionBlanks(profile:AgentProfile,recognition:DocumentRecognition):AgentProfile{
 if(profile.confirmedAt)return profile;const next={...profile};for(const [key,value] of Object.entries(recognition.fields) as [DocumentField,string][]){if(!next[key]&&(key!=='birthDate'||next.calendar==='solar'))next[key]=value;}return next;
}
