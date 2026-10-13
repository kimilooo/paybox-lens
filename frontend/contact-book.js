import {detectAddress} from './address.js';
import {snapshotKey} from './snapshots.js';

const empty=()=>({version:1,contacts:[],labels:{}});
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const canonical=v=>{const d=detectAddress(v);return d?d.family==='evm'?d.address.toLowerCase():d.address:null;};
export function bookKey(data){return 'lens-contact-book-v1:'+(['demo','import'].includes(data.source)?data.source+':':'wallets:')+snapshotKey(data.wallets??[]);}
export function parseTags(value){return [...new Set((Array.isArray(value)?value:typeof value==='string'?value.split(','):[]).map(v=>clean(v,24)).filter(Boolean))].slice(0,8);}
function contact(input,restoreId=false){const detected=detectAddress(input?.address),name=clean(input?.name,80),xHandle=clean(input?.xHandle,30).replace(/^@/,'');
 if(!detected)throw Error('Enter a full valid EVM or Solana address.');if(!name)throw Error('Enter a contact name.');if(xHandle&&!/^[A-Za-z0-9_]{1,15}$/.test(xHandle))throw Error('Enter an X handle without a URL (up to 15 letters, numbers or underscores).');
 const stored=typeof input.id==='string'?input.id.split(':'):[];const id=restoreId&&stored.length===2&&detectAddress(stored[1])?.family===stored[0]?input.id:detected.family+':'+canonical(detected.address);
 return{id,address:detected.address,name,xHandle,tags:parseTags(input.tags),notes:clean(input.notes,500),updatedAt:new Date().toISOString()};
}
export function upsertContact(book,input,previousId=null){const c=contact(input),existing=previousId?book.contacts.find(v=>v.id===previousId):null;if(previousId&&!existing)throw Error('That contact no longer exists.');if(existing)c.id=existing.id;const others=book.contacts.filter(v=>v.id!==previousId);if(others.some(v=>canonical(v.address)===canonical(c.address)))throw Error('That address is already saved. Edit the existing contact.');if(others.length>=500)throw Error('The contact book limit is 500 contacts.');return {...book,contacts:[...others,c]};}
export function removeContact(book,id){return{...book,contacts:book.contacts.filter(c=>c.id!==id)};}
const indexes=new WeakMap();
export function contactFor(address,book){const key=canonical(address);if(!key)return null;let index=indexes.get(book);if(!index){index=new Map(book.contacts.map(c=>[canonical(c.address),c]));indexes.set(book,index);}return index.get(key)??null;}
export function setRecordLabels(book,id,input){if(typeof id!=='string'||!id||id.length>500)throw Error('Invalid activity identifier.');const tags=parseTags(input.tags),note=clean(input.note,500),labels=tags.length||note?{...book.labels,[id]:{tags,note}}:{...book.labels};if(!tags.length&&!note)delete labels[id];if(Object.keys(labels).length>10000)throw Error('The activity-label limit is 10,000 records.');return{...book,labels};}
export function readBook(storage,key){try{const raw=storage?.getItem(key);if(!raw||raw.length>2000000)return empty();const b=JSON.parse(raw);if(b.version!==1||!Array.isArray(b.contacts)||b.contacts.length>500||!b.labels||typeof b.labels!=='object'||Array.isArray(b.labels)||Object.keys(b.labels).length>10000)return empty();
 const contacts=[],seen=new Set(),addresses=new Set();for(const input of b.contacts){try{const c=contact(input,true);if(!seen.has(c.id)&&!addresses.has(canonical(c.address))){seen.add(c.id);addresses.add(canonical(c.address));contacts.push(c);}}catch{}}
 const labels=Object.fromEntries(Object.entries(b.labels).filter(([id,v])=>id.length>0&&id.length<=500&&v&&typeof v==='object').map(([id,v])=>[id,{tags:parseTags(v.tags),note:clean(v.note,500)}]));return{version:1,contacts,labels};
 }catch{return empty();}}
export function saveBook(storage,key,book){const raw=JSON.stringify(book);if(raw.length>2000000)throw Error('Local contact storage is full. Export your book before adding more.');if(!storage?.setItem)throw Error('Browser storage is unavailable.');storage.setItem(key,raw);}
export function decorateRecord(row,book){const c=contactFor(row.counterparty,book),label=Object.hasOwn(book.labels,row.id)?book.labels[row.id]:null;return{...row,contactName:c?.name??null,contactHandle:c?.xHandle??null,contactTags:c?.tags??[],contactEvidence:c?'Manual label; not verified':null,labels:label?.tags??[],note:label?.note??''};}
