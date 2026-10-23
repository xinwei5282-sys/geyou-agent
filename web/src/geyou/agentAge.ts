import type {AgentProfile} from './agentTypes';
function dateParts(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==value)return;return value.split('-').map(Number);}
/** Completed years at death, using verified Gregorian date fields, never the current date. */
export function calculatedAgentAge(p:Pick<AgentProfile,'birthDate'|'deathDate'|'calendar'>):string{
 if(p.calendar!=='solar')return '';const b=dateParts(p.birthDate),d=dateParts(p.deathDate);if(!b||!d||p.birthDate>p.deathDate)return '';
 const years=d[0]-b[0]-(d[1]<b[1]||d[1]===b[1]&&d[2]<b[2]?1:0);return years>=0&&years<=150?String(years):'';
}
export function validateAgentDates(p:AgentProfile){
 if(p.birthDate&&p.calendar==='solar'&&!dateParts(p.birthDate))throw Error('请核对出生日期');
 if(p.deathDate&&!dateParts(p.deathDate))throw Error('请核对逝世日期');
 if(p.calendar==='solar'&&p.birthDate&&p.deathDate&&p.birthDate>p.deathDate)throw Error('逝世日期不能早于出生日期');
}
export function withCalculatedAgentAge(p:AgentProfile):AgentProfile{
 const age=calculatedAgentAge(p);
 if(age!=='')return age!==p.age||!p.ageCalculated?{...p,age,ageCalculated:true}:p;
 return (p.ageCalculated||p.birthDate||p.deathDate)&&p.age?{...p,age:'',ageCalculated:true}:p;
}
