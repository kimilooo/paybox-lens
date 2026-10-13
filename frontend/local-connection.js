let config=null,connected=false;
const localOrigin=()=>globalThis.location?.hostname==='localhost'&&globalThis.location?.protocol==='http:';
const allowedKey=k=>typeof k==='string'&&k.length<=4096&&/^(?:lens-(?:theme|palette|private-mode|low-balance)$|lens-(?:snapshots|chain-history|contact-book|paybox-public-client)-v1:)/.test(k);
export function localConnection(){return connected;}
export function localAvailable(){return Boolean(config?.local);}
export function localHeaders(){return localAvailable()?{'X-Lens-CSRF':config.csrfToken}:{};}
async function request(path,body){const r=await fetch('/local/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...localHeaders()},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.message??'Local connection unavailable.');return d;}
export async function initializeLocal(){
 if(!localOrigin())return {connected:false,local:false};
 const r=await fetch('/local/session',{credentials:'same-origin'});if(r.status===404)return {connected:false,local:false};if(!r.ok)throw Error('Cannot open the local database session.');config=await r.json();connected=config.connected===true;
 if(config.local!==true||typeof config.csrfToken!=='string')throw Error('Invalid local session.');
 installBackup(config.storage??{});return config;
}
export async function connectLocal(remember){if(!localAvailable())return false;await initializeLocal();const d=await request('connect',{remember});const u=new URL(d.authorizationUrl);if(u.origin!=='https://api.paybox.sh'||u.pathname!=='/oauth/authorize')throw Error('Unexpected authorization URL.');location.assign(u.href);return true;}
export async function callbackLocal(code,state){if(!localAvailable())return false;const d=await request('callback',{code,state});connected=d.connected===true;return connected;}
export function disconnectLocal(){connected=false;if(localAvailable())void request('logout',{}).catch(()=>{document.dispatchEvent(new CustomEvent('lens-local-error'));});}
function installBackup(saved){
 const storage=globalThis.localStorage,proto=globalThis.Storage?.prototype;if(!storage||!proto?.setItem||proto.__lensBackup)return;
 const set=proto.setItem,remove=proto.removeItem,clear=proto.clear;
 for(const [k,v] of Object.entries(saved))if(allowedKey(k)&&typeof v==='string'&&storage.getItem(k)===null)set.call(storage,k,v);
 const pending=new Map();let timer=null,busy=false;
 const fail=()=>document.dispatchEvent(new CustomEvent('lens-local-error'));
 async function flush(){if(busy||!pending.size)return;busy=true;const changes=[...pending].map(([key,value])=>({key,value}));pending.clear();try{await request('storage',{changes});}catch{for(const c of changes)if(!pending.has(c.key))pending.set(c.key,c.value);fail();}finally{busy=false;if(pending.size)timer=setTimeout(flush,5000);}}
 const schedule=(k,v)=>{if(!allowedKey(k))return;pending.set(k,v);clearTimeout(timer);timer=setTimeout(flush,200);};
 proto.setItem=function(k,v){set.call(this,k,v);if(this===storage)schedule(String(k),String(v));};
 proto.removeItem=function(k){remove.call(this,k);if(this===storage)schedule(String(k),null);};
 proto.clear=function(){const keys=this===storage?Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(allowedKey):[];clear.call(this);keys.forEach(k=>schedule(k,null));};
 Object.defineProperty(proto,'__lensBackup',{value:true});
 for(let i=0;i<storage.length;i++){const k=storage.key(i);if(allowedKey(k))schedule(k,storage.getItem(k));}
 addEventListener('pagehide',()=>{if(pending.size)void fetch('/local/storage',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...localHeaders()},body:JSON.stringify({changes:[...pending].map(([key,value])=>({key,value}))}),keepalive:true}).catch(fail);});
}
