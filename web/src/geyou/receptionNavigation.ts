import type {Consultation} from './types';

export function receptionDestination(session:Consultation):string {
 const ai=session.receptionView?session.receptionView==='ai':!!session.ai;
 return `${ai?'/talk-ai':'/talk'}?session=${encodeURIComponent(session.id)}`;
}
