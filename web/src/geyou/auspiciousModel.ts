import {Solar} from 'lunar-javascript';
import {calculateAgentBazi} from './agentModel';
import type {AgentProfile} from './agentTypes';
export type BurialCandidate={date:string;start:string;end:string;day:string;hour:string;reasons:string[]};
const branches='子丑寅卯辰巳午未申酉戌亥';
export const branchClash=(a:string,b:string)=>branches.includes(a)&&branches.includes(b)&&Math.abs(branches.indexOf(a)-branches.indexOf(b))===6;
function validDate(value:string){const d=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==value)throw Error('请填写有效日期');return d;}
export function defaultBurialRange(deathDate:string){const from=validDate(deathDate);return {from:deathDate,to:new Date(from.valueOf()+6*86400000).toISOString().slice(0,10)}}
export function burialCandidates(profile:AgentProfile,from:string,to:string):BurialCandidate[]{
 const chart=calculateAgentBazi({...profile,birthplace:'北京时间（UTC+8）'});if(!chart.ready)throw Error(chart.reason);
 const start=validDate(from),end=validDate(to),days=(end.valueOf()-start.valueOf())/86400000;
 if(days<0||days>92)throw Error('请选择先后正确、跨度不超过93天的范围');
 if(from<chart.solarDate||profile.deathDate&&from<profile.deathDate)throw Error('候选日期不能早于出生或逝世日期');
 const natal=chart.pillars.map(x=>x.slice(-1)),results:BurialCandidate[]=[];
 for(let offset=0;offset<=days;offset++){
 const date=new Date(start.valueOf()+offset*86400000).toISOString().slice(0,10),[y,m,d]=date.split('-').map(Number),lunar=Solar.fromYmdHms(y,m,d,12,0,0).getLunar();
 if(!lunar.getDayYi().includes('安葬')||lunar.getDayJi().includes('安葬')||natal.some(b=>branchClash(b,lunar.getDayZhi())))continue;
 for(const hour of [7,9,11,13,15,17]){
 const time=Solar.fromYmdHms(y,m,d,hour,0,0).getLunar();
 if(!time.getTimeYi().includes('安葬')||time.getTimeJi().includes('安葬')||natal.some(b=>branchClash(b,time.getTimeZhi())))continue;
 results.push({date,start:String(hour).padStart(2,'0')+':00',end:String(hour+1).padStart(2,'0')+':59',day:lunar.getDayInGanZhi(),hour:time.getTimeInGanZhi(),reasons:['黄历当日宜安葬，未列忌安葬','黄历该时辰宜安葬，未列忌安葬','日支、时支与出生四柱地支无六冲']});
 }
 }
 return results;
}
