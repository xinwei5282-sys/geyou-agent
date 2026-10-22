// Local prototype authentication. Production must replace this with server sessions and tenant authorization.
import type { AppState, PasswordCredential, Staff } from './types';
import { saveAgencyAccess, saveStaffAccount } from './model';
export type LoginSession={staffId:string;agencyId:string;credentialHash:string;account:string};
export const SESSION_KEY='geyou-login-v1';
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function derive(password:string,salt:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256));
}
export async function createCredential(password:string):Promise<PasswordCredential>{
 if(password.length<8||password.length>72||!password.trim())throw Error('密码需为8–72位，不能全为空格');
 const salt=hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
 return {salt,hash:await derive(password,salt)};
}
export const loginAccount=(s:AppState,st:Staff)=>st.role==='老板'?(s.agencies.find(a=>a.id===st.agencyId)?.access?.loginPhone||st.phone||''):(st.phone||'');
export function resolveSession(s:AppState,session:LoginSession|null):Staff|undefined{
 if(!session)return;
 const st=s.staff.find(st=>st.id===session.staffId&&st.agencyId===session.agencyId);
 const agency=s.agencies.find(a=>a.id===session.agencyId);
 return st&&!!st.credential&&st.enabled!==false&&agency&&agency.access?.enabled!==false&&st.credential?.hash===session.credentialHash&&loginAccount(s,st)===session.account?st:undefined;
}
export async function authenticate(s:AppState,account:string,password:string):Promise<LoginSession>{
 const st=s.staff.find(st=>loginAccount(s,st)===account.trim()&&st.credential);
 if(!st?.credential||await derive(password,st.credential.salt)!==st.credential.hash)throw Error('账号或密码不正确');
 const session={staffId:st.id,agencyId:st.agencyId,credentialHash:st.credential.hash,account:loginAccount(s,st)};
 if(!resolveSession(s,session))throw Error('账号已停用，请联系本店主账号或平台管理员');
 return session;
}
export function readLoginSession():LoginSession|null{try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}
export async function saveMemberLogin(s:AppState,actor:Staff,input:Parameters<typeof saveStaffAccount>[2],password:string):Promise<AppState>{
 const next=saveStaffAccount(s,actor,input);
 const member=next.staff.find(st=>st.agencyId===actor.agencyId&&st.phone===input.phone.trim())!;
 if(!password&&member.credential)return next;
 const credential=await createCredential(password);
 return {...next,staff:next.staff.map(st=>st.id===member.id?{...st,credential}:st)};
}
export async function saveOwnerLogin(s:AppState,input:Parameters<typeof saveAgencyAccess>[1],password:string):Promise<AppState>{
 const next=saveAgencyAccess(s,input);
 const agency=next.agencies.find(a=>a.access?.loginPhone===input.phone.trim())!;
 const boss=next.staff.find(st=>st.agencyId===agency.id&&st.role==='老板');
 if(!boss)throw Error('主账号不存在');
 if(!password&&boss.credential)return next;
 const credential=await createCredential(password);
 return {...next,staff:next.staff.map(st=>st.id===boss.id?{...st,credential}:st)};
}
export function persistPrototype(s:AppState){try{localStorage.setItem('geyou-prototype-v1',JSON.stringify(s));}catch{throw Error('本机保存失败，请检查浏览器存储空间后重试');}}
