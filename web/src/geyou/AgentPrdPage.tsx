import {useRef,useState} from 'react';
import {ArrowLeft,BookOpen} from 'lucide-react';
import source from '../../../docs/codex/prd/geyou-agent-prd.md?raw';
import {MarkdownSection} from './PagePrd';
import './agent-prd.css';
const chapters=source.split(/(?=^## )/m).filter(s=>s.startsWith('## ')).map(s=>({title:s.split('\n')[0].replace(/^## /,''),body:s.split('\n').slice(1).join('\n')}));
const version=source.match(/版本：([^｜\n]+)/)?.[1]||'',date=source.match(/日期：([^｜\n]+)/)?.[1]||'';
export function AgentPrdPage({onBack}:{onBack:()=>void}){
 const [selected,setSelected]=useState(0),article=useRef<HTMLElement>(null);
 return <div className="agent-app agent-refined"><div className="agent-frame agent-prd-frame"><header className="agent-prd-header"><button aria-label="返回我的" onClick={onBack}><ArrowLeft size={22}/></button><h1>产品说明（PRD）</h1><span/></header><main className="agent-prd-content"><div className="agent-prd-intro"><BookOpen size={27}/><h2>格优代理端</h2><p>产品需求与业务规则</p><span>{version} · {date}</span></div><label className="agent-prd-picker"><span>查看章节</span><select aria-label="选择代理端PRD章节" value={selected} onChange={e=>{setSelected(Number(e.target.value));article.current?.scrollIntoView({block:'start'})}}>{chapters.map((chapter,i)=><option key={chapter.title} value={i}>{chapter.title}</option>)}</select></label><article className="page-prd agent-prd-article" ref={article}><h3>{chapters[selected].title}</h3><MarkdownSection body={chapters[selected].body}/></article><p className="agent-prd-footnote">与项目PRD共用内容源，仅供查看。实现差异和验证范围见第12章。</p></main></div></div>;
}
