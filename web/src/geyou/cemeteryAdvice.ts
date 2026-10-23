export const CEMETERY_ADVICE_VERSION='cemetery-bazi-v1.2-20261023';
import type {AgentProfile} from './agentTypes';
import type {CemeteryNeeds,CemeteryMatch} from './cemeteryModel';
export type BaziCemeteryEvidence={chartBasis:string;ruleBasis:string;siteBasis:string;conclusion:string};
export type CemeteryAdvice={analysis:string;recommendations:{cemeteryId:string;reason:string;missing:string[];evidence:BaziCemeteryEvidence}[];promptVersion:string};
export function validateCemeteryAdvice(raw:unknown,allowedIds:string[]):raw is CemeteryAdvice{
 if(!raw||typeof raw!=='object')return false;const value=raw as CemeteryAdvice;
 if(typeof value.analysis!=='string'||!value.analysis.trim()||value.analysis.length>600||typeof value.promptVersion!=='string'||!Array.isArray(value.recommendations)||value.recommendations.length!==Math.min(2,allowedIds.length))return false;
 const ids=new Set<string>();for(const r of value.recommendations){if(!r||!allowedIds.includes(r.cemeteryId)||ids.has(r.cemeteryId)||typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>400||!Array.isArray(r.missing)||r.missing.length>6||r.missing.some(m=>typeof m!=='string'||!m.trim()||m.length>120))return false;if(!r.evidence||['chartBasis','ruleBasis','siteBasis','conclusion'].some(k=>typeof r.evidence[k as keyof BaziCemeteryEvidence]!=='string'||!r.evidence[k as keyof BaziCemeteryEvidence].trim()||r.evidence[k as keyof BaziCemeteryEvidence].length>500))return false;ids.add(r.cemeteryId)}return true;
}
export async function requestCemeteryAdvice(profile:AgentProfile,needs:CemeteryNeeds,matches:CemeteryMatch[],signal:AbortSignal):Promise<CemeteryAdvice>{
 const {birthDate,birthTime,deathDate,calendar,leap,sect}=profile;
 const res=await fetch('/api/geyou/cemetery/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:{birthDate,birthTime,deathDate,calendar,leap,sect},needs}),signal});
 const raw=await res.json();if(!res.ok)throw Error(raw.message||'公墓建议暂时无法生成，请重试');
 if(!validateCemeteryAdvice(raw,matches.map(m=>m.cemetery.id)))throw Error('公墓建议资料不完整，请重新生成');return raw;
}
