import type {ReactNode} from 'react';
import './agent-empty-state.css';
export function AgentEmptyState({icon,title,description,actionLabel,onAction}:{icon:ReactNode;title:string;description?:string;actionLabel?:string;onAction?:()=>void}){
 return <section className="agent-empty-state" aria-label={title}><span className="agent-empty-illustration" aria-hidden="true">{icon}</span><h3 className="agent-empty-title">{title}</h3>{description&&<p className="agent-empty-description">{description}</p>}{actionLabel&&onAction&&<button type="button" className="agent-empty-action" onClick={onAction}>{actionLabel}</button>}</section>;
}
