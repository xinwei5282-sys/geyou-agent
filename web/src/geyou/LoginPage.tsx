import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, LockKeyhole, Smartphone } from 'lucide-react';
import type { AppState } from './types';
import { authenticate, type LoginSession } from './auth';
import './login.css';
export function PasswordField({value,onChange,label='登录密码',placeholder='请输入密码',autoComplete='new-password',disabled=false,icon}:{value:string;onChange:(value:string)=>void;label?:string;placeholder?:string;autoComplete?:string;disabled?:boolean;icon?:ReactNode}){
 const [visible,setVisible]=useState(false);
 return <label className="field"><span>{label}</span><div className="password-input">{icon&&<span className="password-leading-icon">{icon}</span>}<input aria-label={label==='密码'?'登录密码':label} type={visible?'text':'password'} autoComplete={autoComplete} maxLength={72} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}/><button type="button" aria-label={`${visible?'隐藏':'显示'}${label}`} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>;
}
export function LoginPage({state,onLogin}:{state:AppState;onLogin:(session:LoginSession)=>void}){
 const [account,setAccount]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setError('');setBusy(true);try{
  onLogin(await authenticate(state,account,password));
  setPassword('');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <div className="geyou-login" style={{backgroundImage:"url('/reference-art/login-business-assistant.png')"}}><main className="login-card"><div className="login-card-head"><h1>登录</h1><p>欢迎登录您的工作台</p></div><form onSubmit={submit}><label className="field"><span>手机号</span><div className="login-input-wrap"><Smartphone size={22}/><input aria-label="登录账号" autoComplete="username" inputMode="tel" maxLength={11} value={account} onChange={e=>setAccount(e.target.value)} placeholder="请输入手机号" required disabled={busy}/></div></label><PasswordField value={password} onChange={setPassword} label="密码" autoComplete="current-password" placeholder="请输入密码" disabled={busy} icon={<LockKeyhole size={22}/>}/><div className="login-error" role="alert">{error}</div><button className="btn btn-primary wide login-submit" disabled={busy}><span>{busy?'正在登录…':'登录'}</span></button></form></main></div>;
}
