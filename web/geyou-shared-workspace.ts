import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import type {Plugin} from 'vite';
import type {AppState,Staff} from './src/geyou/types';
import {seedState,visibleCustomers,canAccessSalesRecord,hasStaffModule} from './src/geyou/model';
import {visibleUnlinkedPortraits} from './src/geyou/memorialModel';
import {ensureAgentDemo} from './src/geyou/agentModel';
export type WorkspaceActor={staffId:string;agencyId?:string;admin?:boolean};
type Database={state:AppState;revisions:Record<string,number>};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const accounts=[{account:'admin',staffId:'platform-demo',admin:true},{account:'13900000010',staffId:'boss-a',agencyId:'agency-a'},{account:'13900000020',staffId:'staff-lin',agencyId:'agency-a'},{account:'13900000030',staffId:'boss-b',agencyId:'agency-b'}];
// Deliberately public demo credentials. This development-only plugin is never mounted by a production build.
const demoPasswordHash=scryptSync('SharedDemo2026!','geyou-isolated-demo-v1',32);
function freshDatabase():Database{
 let s=seedState();s={...s,customers:[],consultations:[],proposals:[],quotes:[],notices:[],visits:[],unlinkedPortraits:[],salePayments:[],saleSettlements:[],staff:s.staff.filter(x=>['boss-a','staff-lin','boss-b'].includes(x.id))};
 for(const st of s.staff)s=ensureAgentDemo(s,st);
 return {state:s,revisions:{'agency-a':0,'agency-b':0}};
}
export class SharedDemoWorkspace{
 private db!:Database;private queue:Promise<unknown>=Promise.resolve();
 constructor(private directory:string){}
 async init(){await mkdir(this.directory,{recursive:true,mode:0o700});try{this.db=JSON.parse(await readFile(path.join(this.directory,'state.json'),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;this.db=freshDatabase();await this.persist(this.db)}}
 private async persist(db:Database){const file=path.join(this.directory,'state.json'),temp=file+'.'+randomBytes(8).toString('hex');await writeFile(temp,JSON.stringify(db),{mode:0o600});await rename(temp,file)}
 private async transaction<T>(fn:()=>Promise<T>):Promise<T>{const run=this.queue.then(fn);this.queue=run.catch(()=>{});return run}
 login(account:string,password:string):WorkspaceActor{
  const a=accounts.find(a=>a.account===account.trim());const hash=scryptSync(password,'geyou-isolated-demo-v1',32);
  if(!a||!timingSafeEqual(hash,demoPasswordHash))throw Error('账号或密码不正确');const actor={staffId:a.staffId,agencyId:a.agencyId,admin:a.admin};if(!actor.admin)this.staff(actor);return actor;
 }
 private staff(actor:WorkspaceActor):Staff{const st=this.db.state.staff.find(s=>s.id===actor.staffId&&s.agencyId===actor.agencyId);if(!st||st.enabled===false||this.db.state.agencies.find(a=>a.id===actor.agencyId)?.access?.enabled===false)throw Error('账号或机构已停用');return st}
 snapshot(actor:WorkspaceActor){
  const s=this.db.state,st=this.staff(actor),customers=visibleCustomers(s,st),ids=new Set(customers.map(c=>c.id));
  const state:AppState={...s,session:{agencyId:st.agencyId,staffId:st.id},agencies:s.agencies.filter(a=>a.id===st.agencyId),staff:s.staff.filter(x=>x.agencyId===st.agencyId).map(({credential:_credential,...rest})=>rest),customers:customers.map(c=>hasStaffModule(s,st,'restoration')?c:{...c,deceased:c.deceased?.map(d=>({...d,portraits:[],selectedPortraitId:undefined}))}),consultations:(s.consultations||[]).filter(c=>canAccessSalesRecord(s,st,c)),products:s.products.filter(p=>p.agencyId===st.agencyId),notices:hasStaffModule(s,st,'content')?s.notices.filter(n=>n.agencyId===st.agencyId&&!!n.customerId&&ids.has(n.customerId)):[],quotes:s.quotes.filter(q=>canAccessSalesRecord(s,st,q)),proposals:s.proposals.filter(p=>canAccessSalesRecord(s,st,p)),visits:[],unlinkedPortraits:hasStaffModule(s,st,'restoration')?visibleUnlinkedPortraits(s,st):[],salePayments:[],saleSettlements:[]};
  return {state,revision:this.db.revisions[st.agencyId],actor:{...actor,admin:false},mode:'shared-local-demo' as const};
 }
 async save(actor:WorkspaceActor,revision:number,input:AppState){return this.transaction(async()=>{
  const st=this.staff(actor),view=this.snapshot(actor);if(revision!==view.revision)throw Error('版本冲突，请重新读取后核对；未覆盖另一设备的修改');
  if(!input||input.schema!==1)throw Error('资料格式不正确');
  const mutable=new Set(['customers','consultations','notices','unlinkedPortraits']);for(const key of Object.keys(view.state) as (keyof AppState)[])if(!mutable.has(key)&&!equal(input[key],view.state[key]))throw Error('账号及机构权限等资料由服务端维护，不能通过业务同步修改');
  const next=structuredClone(this.db.state);
  for(const key of ['customers','consultations','notices','unlinkedPortraits'] as const){
   const submitted=input[key]||[],previous=view.state[key]||[],all=this.db.state[key]||[];if(!Array.isArray(submitted)||submitted.length>5000)throw Error('资料格式不正确');
   if(new Set(submitted.map(x=>x.id)).size!==submitted.length||submitted.some(x=>typeof x.id!=='string'||!x.id||x.agencyId!==st.agencyId))throw Error('资料机构或记录编号不正确');
   if(previous.some(x=>!submitted.some(y=>y.id===x.id)&&!(key==='unlinkedPortraits'&&input.customers.some(c=>c.deceased?.some(d=>d.portraits.some(p=>p.id===x.id))))))throw Error('不支持通过同步删除历史记录');
   for(const item of submitted){const old=all.find(x=>x.id===item.id);if(old&&!previous.some(x=>x.id===item.id))throw Error('无权修改该记录');if(equal(item,old))continue;
    if(key==='customers'){
     const c=item as AppState['customers'][number];if(!hasStaffModule(this.db.state,st,'customers')||(st.role!=='老板'&&c.ownerId!==st.id)||!this.db.state.staff.some(x=>x.id===c.ownerId&&x.agencyId===st.agencyId)||typeof c.name!=='string'||!c.name.trim()||!Array.isArray(c.followups))throw Error('客户资料或负责人权限不正确');
     const before=old as typeof c|undefined;if(before){for(const d of before.deceased||[]){const after=c.deceased?.find(x=>x.id===d.id);if(!after)throw Error('不能删除已有服务对象');for(const p of d.portraits.filter(p=>p.confirmedAt)){if(!equal(after.portraits.find(x=>x.id===p.id),p))throw Error('已确认照片须保留原快照');}}}
     if(!hasStaffModule(this.db.state,st,'restoration')&&!equal(c.deceased?.map(d=>d.portraits),before?.deceased?.map(d=>d.portraits)))throw Error('没有遗照权限');
    }else if(key==='unlinkedPortraits'){
     const p=item as NonNullable<AppState['unlinkedPortraits']>[number];if(!hasStaffModule(this.db.state,st,'restoration')||(st.role!=='老板'&&p.staffId!==st.id)||!this.db.state.staff.some(x=>x.id===p.staffId&&x.agencyId===st.agencyId)||typeof p.original!=='string'||!p.original.startsWith('data:image/'))throw Error('照片资料或权限不正确');
    }else{
     const c=item as NonNullable<AppState['consultations']>[number];const permittedCustomers=input.customers.filter(c=>st.role==='老板'||c.ownerId===st.id);
     if(c.customerId&&!permittedCustomers.some(x=>x.id===c.customerId)||!c.customerId&&st.role!=='老板'&&c.staffId!==st.id)throw Error('无权访问该客户资料');
     if(key==='consultations'){
      if(!hasStaffModule(this.db.state,st,'talk')||!this.db.state.staff.some(x=>x.id===c.staffId&&x.agencyId===st.agencyId)||!Array.isArray(c.messages))throw Error('沟通资料或权限不正确');
      const before=old as typeof c|undefined;if(before?.agent?.paperPlan?.confirmedAt&&!equal(before.agent.paperPlan,c.agent?.paperPlan))throw Error('已确认清单须保留原快照');
     }else if(!hasStaffModule(this.db.state,st,'content'))throw Error('没有电子讣告权限');
    }
   }
   // Only visible records can be changed. Preserve every other staff member and tenant record.
   const byId=new Map(submitted.map(x=>[x.id,x] as const));(next[key] as unknown[])=all.filter(x=>!(key==='unlinkedPortraits'&&previous.some(p=>p.id===x.id)&&!byId.has(x.id))).map(x=>byId.get(x.id)||x).concat(submitted.filter(x=>!all.some(y=>y.id===x.id)) as never[]);
  }
  const db={state:next,revisions:{...this.db.revisions,[st.agencyId]:view.revision+1}};await this.persist(db);this.db=db;return this.snapshot(actor);
 })}
 adminAgencies(actor:WorkspaceActor){if(!actor.admin)throw Error('仅平台管理员可操作');return this.db.state.agencies.map(a=>({id:a.id,name:a.name,enabled:a.access?.enabled!==false}))}
 async setAgencyEnabled(actor:WorkspaceActor,id:string,enabled:boolean){if(!actor.admin)throw Error('仅平台管理员可操作');return this.transaction(async()=>{if(!this.db.state.agencies.some(a=>a.id===id))throw Error('机构不存在');const db=structuredClone(this.db);db.state.agencies=db.state.agencies.map(a=>a.id===id?{...a,access:{...a.access!,enabled}}:a);db.revisions[id]++;await this.persist(db);this.db=db;return this.adminAgencies(actor)})}
}
export function geyouSharedWorkspacePlugin():Plugin{
 const store=new SharedDemoWorkspace(path.join(import.meta.dirname,'.geyou-shared-demo'));const ready=store.init();
 const sessions=new Map<string,{actor:WorkspaceActor;expires:number}>(),failures=new Map<string,{attempts:number;until:number}>();
 return {name:'geyou-shared-demo',configureServer(server){server.middlewares.use((req,res,next)=>{
  const route=req.url?.split('?')[0];if(!route?.startsWith('/api/geyou/shared/'))return next();
  const send=(status:number,value:unknown)=>{if(res.writableEnded||res.destroyed)return;res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value))};
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return send(403,{message:'请从当前工作台访问。'});
  const token=/geyou_shared=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1],session=token?sessions.get(token):undefined;
  let body='',size=0;req.setEncoding('utf8');req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size<=12000000)body+=chunk});
  req.on('error',()=>send(400,{message:'提交中断，请重试。'}));req.on('end',()=>{void(async()=>{try{
   await ready;if(size>12000000)return send(413,{message:'资料过大，请减少图片大小。'});let input:Record<string,unknown>={};if(body){try{input=JSON.parse(body)}catch{return send(400,{message:'提交格式不正确。'})}if(!input||typeof input!=='object'||Array.isArray(input))return send(400,{message:'提交格式不正确。'})}
   if(route.endsWith('/login')&&req.method==='POST'){
    const ip=req.socket.remoteAddress||'local',attempt=failures.get(ip);if(attempt&&attempt.until>Date.now()&&attempt.attempts>=10)return send(429,{message:'尝试过于频繁，请稍后重试。'});
    if(typeof input.account!=='string'||typeof input.password!=='string'||input.account.length>64||input.password.length>72)return send(400,{message:'请输入有效账号和密码。'});
    try{const actor=store.login(input.account,input.password),token=randomBytes(32).toString('hex');if(session){const oldToken=/geyou_shared=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];if(oldToken)sessions.delete(oldToken);}sessions.set(token,{actor,expires:Date.now()+8*3600000});failures.delete(ip);res.setHeader('Set-Cookie',`geyou_shared=${token}; HttpOnly; SameSite=Strict; Path=/api/geyou/shared; Max-Age=28800`);return send(200,{actor})}catch{const current=attempt&&attempt.until>Date.now()?attempt:{attempts:0,until:Date.now()+60000};failures.set(ip,{...current,attempts:current.attempts+1});return send(401,{message:'账号或密码不正确，或机构已停用。'})}
   }
   if(!session||session.expires<Date.now()){if(token)sessions.delete(token);return send(401,{message:'请先登录共享演示工作区。'})}
   if(route.endsWith('/logout')&&req.method==='POST'){sessions.delete(token!);res.setHeader('Set-Cookie','geyou_shared=; HttpOnly; SameSite=Strict; Path=/api/geyou/shared; Max-Age=0');return send(200,{ok:true})}
   if(route.endsWith('/session')&&req.method==='GET'){if(!session.actor.admin)store.snapshot(session.actor);return send(200,{actor:session.actor})}
   if(route.endsWith('/state')&&req.method==='GET')return send(200,store.snapshot(session.actor));
   if(route.endsWith('/state')&&req.method==='PUT'){if(!Number.isSafeInteger(input.revision)||!input.state)return send(400,{message:'请核对资料版本。'});return send(200,await store.save(session.actor,input.revision as number,input.state as AppState))}
   if(route.endsWith('/agencies')&&req.method==='GET')return send(200,{agencies:store.adminAgencies(session.actor)});
   if(route.endsWith('/agencies')&&req.method==='PATCH'){if(typeof input.id!=='string'||typeof input.enabled!=='boolean')return send(400,{message:'请核对机构设置。'});return send(200,{agencies:await store.setAgencyEnabled(session.actor,input.id,input.enabled)})}
   return send(405,{message:'不支持此操作。'});
  }catch(e){const message=e instanceof Error?e.message:'暂时无法读取资料，请重试。';send(message.includes('版本冲突')?409:message.includes('仅平台管理员')?403:message.includes('停用')?403:400,{message})}})()});
 })}};
}
