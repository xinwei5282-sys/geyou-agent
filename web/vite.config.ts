import {geyouCemeteryPlugin} from './geyou-cemetery-plugin';
import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {geyouAiPlugin} from './geyou-ai-plugin';
import {geyouDocumentPlugin} from './geyou-document-plugin';
import {geyouFlowSharePlugin} from './geyou-flow-share-plugin';
import {geyouMediaPlugin} from './geyou-media-plugin';
const root=path.resolve(import.meta.dirname),project=path.dirname(root);
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,project,'');
 return {
  root,
  plugins:[react(),geyouCemeteryPlugin(env),geyouAiPlugin(env),geyouDocumentPlugin(),geyouMediaPlugin(env),geyouFlowSharePlugin(),{name:'geyou-agent-identity',configureServer(server){server.middlewares.use((req,res,next)=>{
   if(req.url?.split('?')[0]!=='/__project')return next();
   let branch='unversioned';try{branch=execFileSync('git',['branch','--show-current'],{cwd:project,encoding:'utf8'}).trim()}catch{}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({name:'格优代理端',root:project,branch,mode:'local-agent-prototype'}));
  })}}],
  server:{host:'127.0.0.1',port:Number(env.GEYOU_AGENT_PORT)||5197,strictPort:true,watch:{usePolling:true,interval:500}},
  preview:{host:'127.0.0.1',port:5198,strictPort:true},
  build:{outDir:path.join(project,'dist'),emptyOutDir:true}
 };
});
