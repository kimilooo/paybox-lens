import {historyRoute} from './history.js';
const UPSTREAM='https://api.paybox.sh';
const READ_TOOLS=new Set(['list_credentials','get_portfolio','list_requests','get_request','discover_plugins','discover_tokens','get_buy_link','request_account_change']);
const responseHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const error=(status,message)=>Response.json({message},{status,headers:responseHeaders});
export default {async fetch(request,env={}){
 const url=new URL(request.url);
 if(url.pathname==='/bridge/history')return historyRoute(request,env);
 if(!url.pathname.startsWith('/bridge/paybox/'))return serveAsset(url.pathname,request.method);
 const path=url.pathname.slice('/bridge/paybox'.length);
 const discovery=['/.well-known/oauth-authorization-server','/.well-known/oauth-protected-resource'].includes(path);
 if(discovery&&request.method!=='GET')return error(405,'GET required.');
 if(!discovery&&!['/oauth/register','/oauth/token','/mcp'].includes(path))return error(404,'Unknown connection endpoint.');
 if(!discovery&&request.method!=='POST')return error(405,'POST required.');
 if(!discovery&&request.headers.get('Origin')!==url.origin)return error(403,'Same-origin request required.');
 if(request.headers.get('Sec-Fetch-Site')==='cross-site')return error(403,'Cross-site request blocked.');
 const headers=new Headers({Accept:discovery?'application/json':(path==='/mcp'?'application/json, text/event-stream':'application/json')});
 let body;
 if(!discovery){
  if(Number(request.headers.get('Content-Length'))>100000)return error(413,'Request too large.');
  body=await request.text();if(body.length>100000)return error(413,'Request too large.');
  try{
   if(path==='/oauth/token'){
    const form=new URLSearchParams(body);
    if(form.get('grant_type')!=='authorization_code'||form.get('redirect_uri')!==url.origin+'/')return error(400,'Invalid token exchange.');
    for(const key of ['code','client_id','code_verifier'])if(!form.get(key))return error(400,'Missing token exchange field.');
    headers.set('Content-Type','application/x-www-form-urlencoded');
   }else{
    const payload=JSON.parse(body);headers.set('Content-Type','application/json');
    if(path==='/oauth/register'){
     if(payload.token_endpoint_auth_method!=='none'||payload.redirect_uris?.length!==1||payload.redirect_uris[0]!==url.origin+'/')return error(400,'Invalid client registration.');
     // Do not accept arbitrary callback hosts or caller-controlled client settings.
     body=JSON.stringify({client_name:'PayBox Lens',redirect_uris:[url.origin+'/'],token_endpoint_auth_method:'none'});
    }else{
     if(payload.jsonrpc!=='2.0'||!['initialize','notifications/initialized','tools/call'].includes(payload.method))return error(400,'Unsupported MCP operation.');
     if(payload.method==='tools/call'&&!READ_TOOLS.has(payload.params?.name))return error(403,'Only read-only dashboard tools are allowed.');
     const auth=request.headers.get('Authorization');if(!auth?.startsWith('Bearer ')||auth.length>16000)return error(401,'PayBox token required.');headers.set('Authorization',auth);
     headers.set('MCP-Protocol-Version','2025-06-18');const session=request.headers.get('Mcp-Session-Id');if(session&&session.length<1000)headers.set('Mcp-Session-Id',session);
    }
   }
  }catch{return error(400,'Malformed connection request.');}
 }
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const upstream=await fetch(UPSTREAM+path,{method:request.method,headers,...(body?{body}:{}),redirect:'manual',signal:controller.signal});
  if(upstream.status>=300&&upstream.status<400)return error(502,'PayBox unexpectedly redirected the API request.');
  if(!upstream.ok){let code='';try{const obj=await upstream.json();code=typeof obj.error==='string'?obj.error.slice(0,80):'';}catch{}return error(upstream.status,`PayBox ${path} returned HTTP ${upstream.status}${code?' ('+code+')':''}.`);}
  const out=new Headers(responseHeaders);out.set('Content-Type',upstream.headers.get('Content-Type')??'application/json');const session=upstream.headers.get('Mcp-Session-Id');if(session)out.set('Mcp-Session-Id',session);
  return new Response(upstream.body,{status:upstream.status,headers:out});
 }catch(e){
  const errorName=String(e?.name??'Error').slice(0,40);
  console.error(JSON.stringify({event:'paybox_connection_failure',path,errorName,...(discovery?{detail:String(e?.message??'').slice(0,300)}:{})}));
  return error(502,`PayBox connection failed at ${path} (${errorName}).`);
 }finally{clearTimeout(timer);}
}};
// Build inserts the standalone asset server here.
function serveAsset(){return error(404,'Asset not found.');}
