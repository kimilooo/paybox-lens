import {normalizeRequest,normalizeHoldings,finite,safeLink} from './analytics.js';
import {detectAddress} from './address.js';
import {networks} from './history-data.js';
import {localConnection,localAvailable,localHeaders,connectLocal,callbackLocal,disconnectLocal} from './local-connection.js';
// Official public OAuth + MCP surface only. No internal /api/* calls.
const origin='https://api.paybox.sh',resource=origin+'/mcp';
let token=null,expires=0,sessionId=null,requestId=0,initialized=false,authEpoch=0,initialization=null;
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const bridge=url=>{const u=new URL(url);if(u.origin!==origin)throw Error('Unexpected PayBox origin.');return '/bridge/paybox'+u.pathname;};
const registrationKey=()=>'lens-paybox-public-client-v1:'+location.origin+location.pathname;
export function clearClientRegistration(){try{globalThis.localStorage?.removeItem(registrationKey());}catch{}}
function cachedClient(redirect){try{const d=JSON.parse(globalThis.localStorage?.getItem(registrationKey())??'null');return d?.redirect===redirect&&typeof d.clientId==='string'&&d.clientId.length>0&&d.clientId.length<=300&&!/[\x00-\x20]/.test(d.clientId)?d.clientId:null;}catch{return null;}}
async function jsonFetch(url,options={}){let r;try{r=await fetch(bridge(url),{...options,credentials:'same-origin'});}catch{throw Error('Cannot reach the dashboard connection service. Reload and retry.');}if(!r.ok){const error=await r.json().catch(()=>({}));const e=Error(error.error_description||error.message||`PayBox returned HTTP ${r.status}.`);e.code=error.error;throw e;}return r.json();}
export async function connect({remember=false}={}){
 if(await connectLocal(remember))return;
 const epoch=authEpoch;
 const meta=await jsonFetch(origin+'/.well-known/oauth-authorization-server');
 for(const k of ['registration_endpoint','authorization_endpoint','token_endpoint'])if(new URL(meta[k]).origin!==origin)throw Error('Unexpected OAuth endpoint.');
 const redirect=location.origin+location.pathname;
 let clientId=cachedClient(redirect);
 if(!clientId){const client=await jsonFetch(meta.registration_endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'PayBox Lens',redirect_uris:[redirect],token_endpoint_auth_method:'none'})});
  if(typeof client.client_id!=='string'||!client.client_id.length||client.client_id.length>300)throw Error('Invalid registration response.');clientId=client.client_id;
  // A public client identifier is not an access token. Reusing it preserves this client's history scope.
  try{globalThis.localStorage?.setItem(registrationKey(),JSON.stringify({clientId,redirect}));}catch{}
 }
 const verifier=b64(crypto.getRandomValues(new Uint8Array(32))),state=b64(crypto.getRandomValues(new Uint8Array(24)));
 const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 sessionStorage.setItem('lens-oauth',JSON.stringify({verifier,state,clientId,redirect,tokenEndpoint:meta.token_endpoint,started:Date.now()}));
 if(epoch!==authEpoch){sessionStorage.removeItem('lens-oauth');throw Error('Connection changed during authorization.');}
 const url=new URL(meta.authorization_endpoint);url.search=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirect,code_challenge:challenge,code_challenge_method:'S256',scope:'mcp',resource,state});location.assign(url);
}
export async function callback(){
 const p=new URLSearchParams(location.search);if(!p.has('code')&&!p.has('error'))return false;
 if(localAvailable()){if(p.has('error')){history.replaceState({},'',location.pathname);throw Error('PayBox authorization was cancelled or rejected.');}const code=p.get('code'),state=p.get('state');history.replaceState({},'',location.pathname);if(await callbackLocal(code,state))return true;}
 const raw=sessionStorage.getItem('lens-oauth');sessionStorage.removeItem('lens-oauth');history.replaceState({},'',location.pathname);
 if(p.has('error')){if(p.get('error')==='invalid_client')clearClientRegistration();throw Error(p.get('error')==='invalid_client'?'The saved public client expired. Connect again to register a new client.':'PayBox authorization was cancelled or rejected.');}
 if(!raw)throw Error('Missing authorization session. Please connect again.');
 const auth=JSON.parse(raw);if(p.get('state')!==auth.state||Date.now()-auth.started>600000)throw Error('Authorization session is invalid or expired.');
 if(auth.tokenEndpoint!==origin+'/oauth/token'||auth.redirect!==location.origin+location.pathname)throw Error('Invalid authorization endpoint.');
 const epoch=authEpoch;let result;try{result=await jsonFetch(auth.tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:auth.clientId,code:p.get('code'),redirect_uri:auth.redirect,code_verifier:auth.verifier})});}catch(e){if(e.code==='invalid_client')clearClientRegistration();throw e;}
 if(typeof result.access_token!=='string')throw Error('No access token returned.');
 if(epoch!==authEpoch)throw Error('Connection changed during authorization.');const lifetime=Number(result.expires_in??3600);if(!Number.isFinite(lifetime)||lifetime<=0)throw Error('Invalid token expiry.');authEpoch++;sessionId=null;initialized=false;initialization=null;token=result.access_token;expires=Date.now()+lifetime*1000;
 try{globalThis.localStorage?.setItem(registrationKey(),JSON.stringify({clientId:auth.clientId,redirect:auth.redirect}));}catch{}return true;
}
export function disconnect(){authEpoch++;initialization=null;token=null;expires=0;sessionId=null;initialized=false;sessionStorage.removeItem('lens-oauth');disconnectLocal();}
async function rpc(method,params,notification=false){
 if(!localConnection()&&(!token||Date.now()>=expires))throw Error('Session expired. Reconnect PayBox.');
 const epoch=authEpoch;const id=++requestId;const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18',...localHeaders()};if(!localConnection())headers.Authorization='Bearer '+token;if(sessionId)headers['Mcp-Session-Id']=sessionId;
 const r=await fetch(bridge(resource),{method:'POST',credentials:'same-origin',headers,body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,...(params?{params}:{})})});
 if(epoch!==authEpoch)throw Error('Connection changed during request.');if(!r.ok){const error=await r.json().catch(()=>({}));throw Error(error.message||`PayBox MCP returned HTTP ${r.status}.`);}
 if(r.headers.get('Mcp-Session-Id'))sessionId=r.headers.get('Mcp-Session-Id');
 if(notification||r.status===202)return null;
 const raw=await r.text();let response;
 if(r.headers.get('content-type')?.includes('text/event-stream')){for(const block of raw.split(/\r?\n\r?\n/)){const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)continue;try{const candidate=JSON.parse(data);if(candidate.id===id)response=candidate;}catch{}}}else response=JSON.parse(raw);
 if(!response)throw Error('No MCP response received.');if(response.error)throw Error(response.error.message||'MCP request failed.');return response.result;
}
async function init(){if(initialized)return;if(initialization)return initialization;const epoch=authEpoch;initialization=(async()=>{try{await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'paybox-lens',version:'0.8.0'}});await rpc('notifications/initialized',undefined,true);if(epoch!==authEpoch)throw Error('Connection changed during initialization.');initialized=true;}finally{if(epoch===authEpoch)initialization=null;}})();return initialization;}
export async function callTool(name,args={}){
 // No payment, wallet-signing, swap or plugin execution calls. The extra tools only read data or return human-operated links.
 if(!['list_credentials','get_portfolio','list_requests','get_request','discover_plugins','discover_tokens','get_buy_link','request_account_change'].includes(name))throw Error('Read-only tool required.');
 await init();const result=await rpc('tools/call',{name,arguments:args});
 if(result.isError)throw Error(result.content?.filter(c=>c.type==='text').map(c=>c.text).join(' ')||'Tool failed.');
 if(result.structuredContent)return result.structuredContent;
 for(const c of result.content??[])if(c.type==='text'){try{return JSON.parse(c.text);}catch{}}
 return result;
}
async function clientHistory(){let rows=[],cursor=null,hasMore=false;const seen=new Set();for(let page=0;page<100;page++){const d=await callTool('list_requests',{limit:500,...(cursor??{})});const next=Array.isArray(d)?d:(d?.requests??d?.rows);if(!Array.isArray(next))throw Error('Invalid request history response.');for(const row of next)if(!seen.has(row.request_id)){seen.add(row.request_id);rows.push(row);}if(next.length<500){hasMore=false;break;}const last=next.at(-1);const updated={before:last.created_at,before_id:last.request_id};if(JSON.stringify(updated)===JSON.stringify(cursor))throw Error('Request history cursor did not advance.');cursor=updated;hasMore=true;}return{rows,hasMore};}
export async function snapshot(){
 const result=await callTool('list_credentials');const granted=result.credentials??[];
 const credentials=granted.map(c=>({id:c.credential_id,name:c.name??'Credential',kind:c.kind,approvalMode:c.approval_mode??null,address:c.kind==='wallet'?(detectAddress(c.metadata?.address)?.address??c.metadata?.address??null):null,chains:c.metadata?.chains??[],brand:c.kind==='card'?c.metadata?.brand??null:null,last4:c.kind==='card'?c.metadata?.last4??null:null}));
 const wallets=credentials.filter(c=>c.kind==='wallet');const readable=wallets.filter(w=>detectAddress(w.address));
 const results=await Promise.allSettled([clientHistory(),callTool('discover_plugins',{status:'enabled'}),readPortfolio(readable)]);
 const warnings=[];results.forEach((r,i)=>{if(r.status==='rejected')warnings.push(['Requests','Plugins','Portfolio'][i]+': '+r.reason.message);});
 if(readable.length<wallets.length)warnings.push('Some granted wallets have missing or invalid addresses.');
 const requests=results[0].status==='fulfilled'?results[0].value:null,view=results[2].status==='fulfilled'?results[2].value:{};
 warnings.push(...(view.warnings??[]));
 const supported=new Set(Object.values(networks).map(n=>n.name)),uncovered=[...new Set(normalizeHoldings(view.portfolio??[]).filter(h=>!supported.has(h.chain)).map(h=>h.chain))];
 if(uncovered.length)warnings.push('On-chain history has no configured source for: '+uncovered.join(', ')+'. Holdings are still shown; those networks are excluded from history totals.');
 const pluginResult=results[1].status==='fulfilled'?results[1].value:null;
 return{version:1,source:'live',balanceUsd:view.balanceUsd??null,date:view.asOf??new Date().toISOString(),plugins:Array.isArray(pluginResult)?pluginResult:(pluginResult?.plugins??pluginResult?.results??[]),pluginCursor:pluginResult?.next_cursor??null,credentials,ungrantedSummary:result.ungranted??result.ungranted_summary??null,wallets,portfolio:view.portfolio??[],warnings,transactions:(requests?.rows??[]).map(normalizeRequest),hasMore:requests?.hasMore??false,xConnection:view.xConnection??null,xConnectUrl:view.xConnectUrl??null};
}
// Aggregate reads expose X status and tag each holding; older servers can fall back to wallet reads.
async function readPortfolio(wallets){
 const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&(a.startsWith('0x')&&b.startsWith('0x')?a.toLowerCase()===b.toLowerCase():a===b);
 const xFields=d=>({xConnection:d.x_connection===null?{connected:false}:typeof d.x_connection?.handle==='string'&&/^[A-Za-z0-9_]{1,15}$/.test(d.x_connection.handle.replace(/^@/,''))?{connected:true,handle:d.x_connection.handle.replace(/^@/,''),verifiedAt:d.x_connection.verified_at??null}:null,xConnectUrl:safeLink(d.x_connect_url),asOf:typeof d.as_of==='string'&&Number.isFinite(Date.parse(d.as_of))?d.as_of:null});
 let aggregateError;
 try{
  const d=await callTool('get_portfolio',{});
  if(d.aggregate===true&&Array.isArray(d.items)&&Array.isArray(d.wallets)){
   const portfolio=wallets.map(w=>{const summary=d.wallets.find(p=>same(p.address,w.address));return{address:w.address,wallet_name:summary?.name??w.name,total_usd:finite(summary?.total_usd),items:d.items.filter(h=>same(h.wallet_address,w.address)),as_of:d.as_of,last_indexed_slot:d.last_indexed_slot};});
   const covered=d.wallets.length===wallets.length&&wallets.every(w=>d.wallets.some(p=>same(p.address,w.address)))&&d.items.every(h=>wallets.some(w=>same(h.wallet_address,w.address)));
   return{portfolio,balanceUsd:covered?finite(d.total_usd):null,...xFields(d),warnings:covered?[]:['Portfolio wallet coverage differs from the reported grants. Refresh before relying on the total.']};
  }
  if(wallets.length===1&&same(d.address,wallets[0].address))return{portfolio:[{...d,wallet_name:d.wallet_name??wallets[0].name}],balanceUsd:finite(d.total_usd),...xFields(d),warnings:[]};
  throw Error('Aggregate portfolio is not available from this PayBox server.');
 }catch(e){aggregateError=e;}
 const results=await Promise.allSettled(wallets.map(w=>callTool('get_portfolio',{address:w.address}))),portfolio=[],warnings=['Aggregate portfolio unavailable; X status may be unknown. '+aggregateError.message];
 results.forEach((r,i)=>{if(r.status==='fulfilled')portfolio.push({...r.value,address:wallets[i].address,wallet_name:r.value.wallet_name??wallets[i].name,total_usd:finite(r.value.total_usd)});else warnings.push(wallets[i].name+': '+r.reason.message);});
 const priced=portfolio.filter(p=>p.total_usd!=null);
 return{portfolio,balanceUsd:portfolio.length===wallets.length&&priced.length?priced.reduce((sum,p)=>sum+p.total_usd,0):null,warnings};
}
export async function requestDetails(record){const d=await callTool('get_request',{request_id:record.requestId??record.id});return normalizeRequest({...d,request_id:record.requestId??record.id,kind:d.kind??record.kind,created_at:record.date,credential_id:d.credential_id??record.credentialId});}
