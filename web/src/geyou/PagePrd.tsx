import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { BottomSheet } from './MobileUI';
import document from '../../../docs/codex/prd/2026-10-13-殡葬服务工作台-PRD.md?raw';
import './page-prd.css';

const chapters=document.split(/(?=^## )/m).filter(section=>section.startsWith('## ')).map(section=>({title:section.split('\n')[0].replace(/^## /,''),body:section.split('\n').slice(1).join('\n')}));
const requirementPages=['customers','talk','talk-ai','restoration','content','catalog','shop','quote','members','settings'];
function defaultChapter(pageId:string){return requirementPages.includes(pageId.split('/')[0])?3:0;}
// Render the Markdown forms used in the PRD without evaluating HTML.
function inline(text:string):ReactNode{
 return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part,index)=>part.startsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part.startsWith('[')?<span key={index}>{part.match(/^\[([^\]]+)\]/)?.[1]}</span>:part);
}
export function MarkdownSection({body}:{body:string}){
 const lines=body.trim().split('\n'),blocks:ReactNode[]=[];
 for(let index=0;index<lines.length;index++){
  const line=lines[index];if(!line.trim())continue;
  if(line.startsWith('|')){
   const rows:string[][]=[];
   while(index<lines.length&&lines[index].startsWith('|')){const cells=lines[index].split('|').slice(1,-1).map(cell=>cell.trim());if(!cells.every(cell=>/^:?-+:?$/.test(cell)))rows.push(cells);index++;}
   index--;blocks.push(<div className="prd-table-scroll" key={index} role="region" aria-label="需求表格，可横向滚动" tabIndex={0}><table><thead><tr>{rows[0]?.map((cell,i)=><th key={i}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.slice(1).map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>);
  }else if(line.startsWith('### ')){blocks.push(<h4 key={index}>{inline(line.slice(4))}</h4>);
  }else if(/^(- |\d+\. )/.test(line)){
   const ordered=/^\d+\. /.test(line),items:ReactNode[]=[];
   while(index<lines.length&&(ordered?/^\d+\. /:/^- /).test(lines[index])){items.push(<li key={index}>{inline(lines[index].replace(/^(- |\d+\. )/,''))}</li>);index++;}
   index--;blocks.push(ordered?<ol key={index}>{items}</ol>:<ul key={index}>{items}</ul>);
  }else{blocks.push(<p key={index}>{inline(line)}</p>);}
 }
 return <>{blocks.map((block,index)=><Fragment key={index}>{block}</Fragment>)}</>;
}
/** Developer documentation shares the Markdown source and never updates business state. */
export function PagePrd({pageId}:{pageId:string}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(defaultChapter(pageId));
 useEffect(()=>{setSelected(defaultChapter(pageId));setOpen(false)},[pageId]);
 return <><button type="button" className="prd-trigger prd-developer-trigger no-print" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><BookOpen size={16}/><span>开发 PRD</span></button>
 {open&&<BottomSheet title="殡葬服务工作台 · 开发 PRD" onClose={()=>setOpen(false)}><article className="page-prd"><div className="prd-meta"><span>{document.match(/版本：([^｜\n]+)/)?.[1].trim()||'产品需求'} · 待生产验收</span><time dateTime="2026-10-22">2026.10.22</time></div><p className="prd-goal">需求、业务规则和验收口径。实现状态与上线能力请查看第 6 章。</p><label className="prd-picker"><span>查看章节</span><select aria-label="选择PRD章节" value={selected} onChange={event=>{setSelected(Number(event.target.value));event.currentTarget.closest('.app-sheet-content')?.scrollTo(0,0)}}>{chapters.map((chapter,index)=><option key={chapter.title} value={index}>{chapter.title}</option>)}</select></label><section><h3>{chapters[selected].title}</h3><MarkdownSection body={chapters[selected].body}/></section><p className="prd-footnote">与项目 Markdown PRD 共用内容源。查看或关闭文档不会修改客户、沟通、照片或报价数据。</p></article></BottomSheet>}
 </>;
}
