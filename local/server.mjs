import http from 'node:http';
import {Readable} from 'node:stream';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {openLocalStore} from './store.mjs';

const API='https://api.paybox.sh';
const cookieName='lens_local_session';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'};
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
const random=()=>randomBytes(32).toString('base64url');
const allowedKey=k=>typeof k==='string'&&k.length<=4096&&/^(?:lens-(?:theme|palette|private-mode|low-balance)$|lens-(?:snapshots|chain-history|contact-book|paybox-public-client)-v1:)/.test(k);
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

export function createLocalApp({worker,directory,port=3000,fetchImpl=globalThis.fetch,now=Date.now,env={}}) {
  const store=openLocalStore(directory),origin=`http://localhost:${port}`,refreshing=new Map(),temporary=new Map();
  const sidOf=req=>{const match=(req.headers.get('Cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));const sid=match?.slice(cookieName.length+1);return /^[A-Za-z0-9_-]{43}$/.test(sid??'')?sid:null;};
  const slot=sid=>'session:'+createHash('sha256').update(sid).digest('hex');
  const read=sid=>sid?(temporary.get(slot(sid))??store.get(slot(sid))):null;
  const save=(sid,s)=>{if(s.remember){store.set(slot(sid),s);temporary.delete(slot(sid));}else{temporary.set(slot(sid),s);store.delete(slot(sid));}};
  const drop=sid=>{temporary.delete(slot(sid));store.delete(slot(sid));};
  const sessionCookie=(sid,remember=false)=>`${cookieName}=${sid}; Path=/; HttpOnly; SameSite=Strict${remember?'; Max-Age=2592000':''}`;
  const upstream=async(path,options={})=>{const r=await fetchImpl(API+path,{...options,redirect:'manual',signal:AbortSignal.timeout(30000)});if(!r.ok||r.status>=300){throw Object.assign(Error('PayBox rejected the connection. Reconnect in PayBox.'),{status:401});}return r.json();};
  const setTokens=(s,t)=>{const life=Number(t.expires_in);if(typeof t.access_token!=='string'||t.access_token.length>16000||!Number.isFinite(life)||life<=0||life>86400)throw Error('Invalid PayBox token response.');if(s.remember&&t.refresh_token!==undefined&&(typeof t.refresh_token!=='string'||t.refresh_token.length>16000))throw Error('Invalid refresh token.');return {...s,accessToken:t.access_token,expiresAt:now()+life*1000,refreshToken:s.remember?(t.refresh_token??null):null,refreshUntil:s.remember&&t.refresh_token?now()+30*86400000:0,refreshPending:false,pending:null};};
  async function access(sid) {
    let s=read(sid);if(!s?.accessToken)throw Object.assign(Error('Connect PayBox first.'),{status:401});
    if(s.expiresAt>now()+60000)return s.accessToken;
    if(refreshing.has(sid))return refreshing.get(sid);
    if(!s.refreshToken||s.refreshUntil<=now()||s.refreshPending){drop(sid);throw Object.assign(Error('Saved authorization expired. Connect PayBox again.'),{status:401});}
    const task=(async()=>{
      const version=s.version,old=s.refreshToken;s={...s,refreshPending:true};save(sid,s);
      try {
        const t=await upstream('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:s.clientId,refresh_token:old})});
        // Refresh tokens rotate. An ambiguous failure is never retried with the old token.
        if(!t.refresh_token||t.refresh_token===old)throw Error('Refresh rotation was not returned.');
        const current=read(sid);if(!current||current.version!==version)throw Error('Connection changed during refresh.');
        const next=setTokens(current,t);save(sid,next);return next.accessToken;
      } catch {if(read(sid)?.version===version)drop(sid);throw Object.assign(Error('Connection needs renewed authorization in PayBox.'),{status:401});}
      finally {refreshing.delete(sid);}
    })();refreshing.set(sid,task);return task;
  }
  async function fetch(request) {
    const u=new URL(request.url);
    if(u.origin!==origin||request.headers.get('Host')&&request.headers.get('Host')!==`localhost:${port}`)return json({message:'Use the localhost URL printed by npm start.'},403);
    const sensitive=u.pathname.startsWith('/local/')||u.pathname.startsWith('/bridge/paybox/');
    if(sensitive&&request.headers.get('Sec-Fetch-Site')&&!['same-origin','none'].includes(request.headers.get('Sec-Fetch-Site')))return json({message:'Cross-origin local access blocked.'},403);
    let sid=sidOf(request),s=read(sid);
    if(u.pathname==='/local/session'&&request.method==='GET') {
      if(!s){sid=random();s={csrf:random(),version:random(),remember:false};save(sid,s);}
      const connected=Boolean(s.accessToken&&(s.expiresAt>now()||s.refreshToken&&s.refreshUntil>now())&&(!s.refreshPending||refreshing.has(sid)));
      return json({local:true,connected,remembered:Boolean(s.remember&&s.refreshToken),expiresAt:s.expiresAt??null,csrfToken:s.csrf,storage:store.get('workspace')??{}},200,{'Set-Cookie':sessionCookie(sid,s.remember)});
    }
    if(u.pathname.startsWith('/local/')||u.pathname==='/bridge/paybox/mcp') {
      if(request.method!=='POST')return json({message:'POST required.'},405);
      if(request.headers.get('Origin')!==origin||!s||!equal(request.headers.get('X-Lens-CSRF'),s.csrf))return json({message:'Local session or CSRF check failed.'},403);
      try {
        if(u.pathname==='/local/logout'){save(sid,{csrf:s.csrf,version:random(),remember:false});return json({connected:false});}
        if(u.pathname==='/local/connect') {
          const input=await request.json(),remember=input.remember===true;
          const meta=await upstream('/.well-known/oauth-authorization-server');
          if(meta.authorization_endpoint!==API+'/oauth/authorize'||meta.registration_endpoint!==API+'/oauth/register'||meta.token_endpoint!==API+'/oauth/token')throw Error('Unexpected OAuth endpoint.');
          if(remember&&(!meta.scopes_supported?.includes('offline_access')||!meta.grant_types_supported?.includes('refresh_token')))throw Error('Remembered connections are unavailable from this PayBox server.');
          let clientId=store.get('client:'+origin);
          if(!clientId){const client=await upstream('/oauth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'PayBox Lens Local',redirect_uris:[origin+'/'],token_endpoint_auth_method:'none'})});if(typeof client.client_id!=='string'||client.client_id.length>300)throw Error('Invalid public client.');clientId=client.client_id;store.set('client:'+origin,clientId);}
          const verifier=random(),state=random(),challenge=createHash('sha256').update(verifier).digest('base64url');
          s={csrf:s.csrf,version:random(),remember,clientId,pending:{verifier,state,started:now()}};save(sid,s);
          const authorization=new URL(API+'/oauth/authorize');authorization.search=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:origin+'/',code_challenge:challenge,code_challenge_method:'S256',scope:remember?'mcp offline_access':'mcp',resource:API+'/mcp',state});
          return json({authorizationUrl:authorization.href},200,{'Set-Cookie':sessionCookie(sid,remember)});
        }
        if(u.pathname==='/local/callback') {
          const input=await request.json(),pending=s.pending;
          if(!pending||now()-pending.started>600000||!equal(input.state,pending.state)||typeof input.code!=='string'||input.code.length>4096)throw Object.assign(Error('Authorization session invalid or expired.'),{status:400});
          const version=s.version;save(sid,{...s,pending:null});
          const t=await upstream('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:s.clientId,code:input.code,redirect_uri:origin+'/',code_verifier:pending.verifier})});
          const current=read(sid);if(!current||current.version!==version)throw Error('Connection changed during authorization.');
          s=setTokens(current,t);save(sid,s);return json({connected:true,remembered:Boolean(s.refreshToken),expiresAt:s.expiresAt},200,{'Set-Cookie':sessionCookie(sid,s.remember)});
        }
        if(u.pathname==='/local/storage') {
          const input=await request.json();if(!Array.isArray(input.changes)||input.changes.length>500)throw Error('Invalid local storage update.');
          const next={...(store.get('workspace')??{})};for(const c of input.changes){if(!allowedKey(c.key)||c.value!==null&&(typeof c.value!=='string'||c.value.length>4*1024*1024))throw Error('Invalid local storage record.');if(c.value===null)delete next[c.key];else next[c.key]=c.value;}
          if(JSON.stringify(next).length>16*1024*1024)throw Error('Local workspace backup exceeds 16 MB. Export older records first.');store.set('workspace',next);return json({saved:true});
        }
        if(u.pathname==='/bridge/paybox/mcp') {
          const bearer=await access(sid),h=new Headers(request.headers);h.set('Authorization','Bearer '+bearer);h.delete('Cookie');h.delete('X-Lens-CSRF');
          const result=await worker.fetch(new Request(request,{headers:h}),env);if(result.status===401)drop(sid);return result;
        }
        return json({message:'Unknown local endpoint.'},404);
      } catch(e) {return json({message:e.status===400?e.message:e.status===401?e.message:'Local operation failed. Check setup or reconnect; no sensitive details are logged.'},e.status??400);}
    }
    if(u.pathname==='/bridge/paybox/oauth/token'||u.pathname==='/bridge/paybox/oauth/register')return json({message:'Use the local connection flow.'},403);
    return worker.fetch(request,env);
  }
  return {fetch,origin,store,close(){store.close();}};
}

export function listenLocal(app,port=3000,env={}) {
  const server=http.createServer(async(req,res)=>{
    try {
      const chunks=[];let size=0;const max=req.url?.startsWith('/local/storage')?5*1024*1024:100000;
      for await(const c of req){size+=c.length;if(size>max){res.writeHead(413,headers);res.end('Request too large.');return;}chunks.push(c);}
      const h=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)h.set(key,Array.isArray(value)?value.join(','):value);
      const r=await app.fetch(new Request(app.origin+req.url,{method:req.method,headers:h,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env);
      res.writeHead(r.status,Object.fromEntries(r.headers));if(r.body)Readable.fromWeb(r.body).pipe(res);else res.end();
    }catch{res.writeHead(500,headers);res.end('Local server error. No sensitive details are logged.');}
  });
  server.listen(port,'127.0.0.1',()=>console.log(`PayBox Lens Local: ${app.origin}\nDatabase: local encrypted SQLite · press Ctrl+C to stop`));return server;
}
