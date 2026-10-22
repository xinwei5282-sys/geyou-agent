// Display regions of the approved UI reference; illustrations, not merchant SKU photos.
const source='/agent-products/reference.png';
const regions:Record<string,readonly [number,number,number,number]>={
 package:[48,196,143,131], clothes:[97,425,68,48], books:[97,486,68,48], portrait:[97,550,68,48], ceremony:[97,614,68,48], canopy:[97,679,68,48], care:[97,744,68,48], urn:[97,810,68,48],
 accompany:[586,168,67,63], wreath100:[586,258,67,64], wreath200:[586,353,67,65], bus18return:[586,448,68,66], bus18hill:[586,448,68,66], bus52return:[586,544,68,65], bus52hill:[586,544,68,65],
};
export function agentProductImage(key:string){const r=regions[key];return r?{src:source,x:r[0],y:r[1],width:r[2],height:r[3]}:undefined}
export function AgentProductImage({item,name}:{item:string;name:string}){const r=regions[item];return r?<span className="agent-product-image"><svg role="img" aria-label={name+'示意图'} viewBox={r.join(' ')} preserveAspectRatio="xMidYMid meet"><image href={source} width="1476" height="1066"/></svg><small>示意</small></span>:null}
export const includedImageKeys=['clothes','books','portrait','ceremony','canopy','care','urn'];
