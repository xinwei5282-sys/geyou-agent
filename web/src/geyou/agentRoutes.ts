/** Keep the standalone app within agent workflows and public notice views. */
export function agentRoute(route:string){
 if(route==='/agent'||route.startsWith('/agent/')||route.startsWith('/agent?')||route.startsWith('/notice/')||route.startsWith('/notice-preview/'))return route;
 return '/agent';
}
