import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';

export function PageHeader({title,onBack,action,subtitle}:{title:string;onBack?:()=>void;action?:ReactNode;subtitle?:ReactNode}){
 return <header className="app-page-header"><div className="app-page-title">{onBack&&<button className="app-back" aria-label="返回上一页" onClick={onBack}><ArrowLeft size={22}/></button>}<div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></div>{action&&<div className="app-page-action">{action}</div>}</header>;
}
export function ActionBar({children}:{children:ReactNode}){return <div className="app-action-bar no-print"><div>{children}</div></div>}
export function BottomSheet({title,onClose,children,footer,className='',subtitle}:{title:string;onClose:()=>void;children:ReactNode;footer?:ReactNode;className?:string;subtitle?:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;
 useLayoutEffect(()=>{const el=dialog.current;el?.showModal();const original=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el?.close();document.body.style.overflow=original}},[]);
 return createPortal(<dialog ref={dialog} className={`app-sheet ${className}`} aria-label={title} onCancel={e=>{e.preventDefault();close.current()}} onClick={e=>{if(e.target===e.currentTarget)close.current()}}><div className="app-sheet-surface"><div className="app-sheet-handle"/><header><div><h2>{title}</h2>{subtitle&&<p className="sheet-subtitle">{subtitle}</p>}</div><button className="app-back" aria-label="关闭弹层" onClick={onClose} autoFocus><X size={22}/></button></header><div className="app-sheet-content">{children}</div>{footer&&<footer>{footer}</footer>}</div></dialog>,document.body);
}
export function useViewState<T>(key:string,initial:T):[T,Dispatch<SetStateAction<T>>]{
 const [value,setValue]=useState<T>(()=>{try{const saved=sessionStorage.getItem(`geyou-view:${key}`);return saved===null?initial:JSON.parse(saved)}catch{return initial}});
 useEffect(()=>{try{sessionStorage.setItem(`geyou-view:${key}`,JSON.stringify(value))}catch{}},[key,value]);
 return [value,setValue];
}
export function useUnsavedGuard(dirty:boolean){useEffect(()=>{const f=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',f);return()=>window.removeEventListener('beforeunload',f)},[dirty]);}

export function SelectedDate({value}:{value:string|undefined}){const parts=value?.slice(0,10).split('-');return <small className="date-format-hint">{parts?.length===3?`已选：${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`:'请选择日期'}</small>}
