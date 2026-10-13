import test from 'node:test';
import assert from 'node:assert/strict';
import {csv} from '../frontend/data.js';
import {reportSheets,pdfBytes} from '../frontend/exports.js';
const bookModule=await import('../frontend/contact-book.js').catch(()=>({}));
const explanationModule=await import('../frontend/explanations.js').catch(()=>({}));
const privacyModule=await import('../frontend/privacy.js').catch(()=>({}));
const address='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),sol='11111111111111111111111111111111';
const empty=()=>({version:1,contacts:[],labels:{}});
const store=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('Contacts persist by wallet scope, match EVM case and cannot confer verified identity',()=>{
 assert.equal(typeof bookModule.upsertContact,'function');
 const b=bookModule.upsertContact(empty(),{name:'MoonPay label',address:address.toUpperCase(),xHandle:'@example_user',tags:'Work, Work, Income',notes:'Manual label',verified:true});
 const s=store(),key=bookModule.bookKey({source:'live',wallets:[{address:sol},{address}]});bookModule.saveBook(s,key,b);
 const restored=bookModule.readBook(s,key);assert.equal(restored.contacts.length,1);assert.equal(bookModule.contactFor(address,restored).name,'MoonPay label');assert.equal(restored.contacts[0].verified,undefined);assert.deepEqual(restored.contacts[0].tags,['Work','Income']);
 assert.notEqual(key,bookModule.bookKey({source:'live',wallets:[{address:other}]}));assert.notEqual(key,bookModule.bookKey({source:'demo',wallets:[{address:sol},{address}]}));
 assert.deepEqual(bookModule.readBook(s,bookModule.bookKey({source:'import',wallets:[{address}]})).contacts,[]);
 assert.throws(()=>bookModule.upsertContact(restored,{name:'Incomplete',address:'0x12'}));assert.throws(()=>bookModule.upsertContact(restored,{name:'Invalid X',address:other,xHandle:'https://example.com'}));
});
test('Contact edits, deletes and transaction labels survive refresh without changing accounting fields',()=>{
 assert.equal(typeof bookModule.setRecordLabels,'function');let b=bookModule.upsertContact(empty(),{name:'Client',address,tags:'Income'});const id=b.contacts[0].id;
 b=bookModule.upsertContact(b,{name:'Updated client',address:other,tags:'Work'},id);assert.equal(b.contacts.length,1);assert.equal(bookModule.contactFor(address,b),null);
 b=bookModule.setRecordLabels(b,'stable-record',{tags:'Sponsored, Paid',note:'October invoice'});
 const row={id:'stable-record',counterparty:other,type:'deposit',amount:5,amountUsd:null,status:'success'};
 const d=bookModule.decorateRecord(row,b);assert.equal(d.contactName,'Updated client');assert.equal(d.contactEvidence,'Manual label; not verified');assert.deepEqual(d.labels,['Sponsored','Paid']);assert.equal(d.note,'October invoice');assert.equal(d.amount,5);assert.equal(d.amountUsd,null);assert.equal(row.labels,undefined);
 b=bookModule.removeContact(b,id);assert.equal(bookModule.decorateRecord(row,b).contactName,null);assert.deepEqual(b.labels['stable-record'].tags,['Sponsored','Paid']);
});
test('Corrupt or oversized local contact data is rejected and failed writes leave the old book intact',()=>{
 assert.equal(typeof bookModule.readBook,'function');const s=store();s.setItem('test','{bad');assert.deepEqual(bookModule.readBook(s,'test'),empty());
 s.setItem('test',JSON.stringify({version:1,contacts:[{name:'Bad',address:'masked',verified:true}],labels:{}}));assert.deepEqual(bookModule.readBook(s,'test').contacts,[]);
 const b=empty(),next=bookModule.upsertContact(b,{name:'Valid',address});assert.throws(()=>bookModule.saveBook({setItem(){throw Error('Quota exceeded')}},'test',next));assert.equal(b.contacts.length,0);
});
test('Plain-English deposits retain exact amounts and do not guess a sender handle or fee payer',()=>{
 assert.equal(typeof explanationModule.explainTransaction,'function');const e=explanationModule.explainTransaction({type:'deposit',status:'success',source:'On-chain',amount:1e-9,amountText:'0.000000001',asset:'SOL',network:'solana',counterparty:address,contactName:'My client',contactHandle:'example_user',contactEvidence:'Manual label; not verified',amountUsd:null});
 assert.ok(e.summary.includes('received 0.000000001 SOL'));assert.ok(e.details.some(x=>x.includes('not verified')));assert.ok(e.details.some(x=>x.includes('USD value was not provided')));assert.ok(e.details.some(x=>x.includes('does not identify the fee payer')));assert.equal(JSON.stringify(e).includes('sender paid'),false);
});
test('Failed, pending and signing requests never describe money as successfully sent',()=>{
 assert.equal(typeof explanationModule.explainTransaction,'function');for(const status of ['error','denied','pending_approval']){const e=explanationModule.explainTransaction({type:'payment',status,amount:5,asset:'SOL',feeAmount:.000005,feeAsset:'SOL'});assert.equal(e.summary.includes('You sent'),false);assert.ok(e.details.some(x=>x.includes('fee')));}
 const e=explanationModule.explainTransaction({type:'request',kind:'wallet_sign',status:'success'});assert.ok(e.summary.includes('signing'));assert.ok(e.details.some(x=>x.includes('does not prove a transfer')));
});
test('An owned-wallet transfer is explained as a movement between wallets, while swap legs remain movements',()=>{
 assert.equal(typeof explanationModule.explainTransaction,'function');const e=explanationModule.explainTransaction({type:'payment',status:'success',wallet:address,counterparty:other,amount:1,asset:'ETH'},{wallets:[{address},{address:other}]});assert.ok(e.summary.includes('between your connected wallets'));
 const s=explanationModule.explainTransaction({type:'swap',status:'success',source:'On-chain',direction:'out',amount:1,asset:'ETH'});assert.ok(s.summary.includes('multi-asset'));assert.ok(s.details.some(x=>x.includes('not proof')));
});
test('Privacy projection removes figures, wallet names, identifiers, contacts and free-form errors from every field',()=>{
 assert.equal(typeof privacyModule.redactWorkspace,'function');const raw={source:'live',balanceUsd:9876.54,xConnection:{connected:true,handle:'private_handle'},wallets:[{address,name:'Secret wallet',kind:'wallet',id:'credential-secret'}],credentials:[{address,name:'Secret card',last4:'9876'}],portfolio:[{address,wallet_name:'Secret wallet',total_usd:9876.54,items:[{symbol:'SOL',name:'Secret asset',balance:'42424242',shiftedBalance:42,balanceUsd:'9876.54',networkId:'solana'}]}],transactions:[{id:'private-request',hash:'private-hash',type:'deposit',status:'success',date:'2026-10-12T00:00:00Z',wallet:address,counterparty:other,title:'Secret title',amount:42,amountUsd:9876.54,contactName:'Secret contact',labels:['Secret tag'],note:'Secret note',errorReason:'Secret error',uiKey:'0'}],warnings:['Secret provider detail'],plugins:[{name:'Secret plugin',description:'Secret description'}]};const v=privacyModule.redactWorkspace(raw),text=JSON.stringify(v);
 for(const secret of [address,other,'9876','42424242','private_handle','private-request','private-hash','Secret'])assert.equal(text.includes(secret),false,secret);assert.equal(raw.balanceUsd,9876.54);assert.equal(v.transactions[0].uiKey,'0');assert.equal(v.transactions[0].status,'success');
});
test('Activity exports retain local annotations with explicit manual identity evidence',()=>{const row={id:'r',type:'deposit',status:'success',date:'2026-10-12T00:00:00Z',contactName:'Saved sponsor',contactEvidence:'Manual label; not verified',labels:['Sponsored'],note:'October invoice'};const d={source:'import',portfolio:[],balanceUsd:null};const text=csv([row]);assert.ok(text.includes('contactEvidence'));assert.ok(text.includes('Sponsored'));assert.ok(text.includes('October invoice'));const sheet=reportSheets(d,[row],'All time')[1];assert.ok(sheet.rows[0].includes('note'));assert.ok(sheet.rows[1].includes('Manual label; not verified'));const pdf=new TextDecoder().decode(pdfBytes(d,[row],'All time'));assert.ok(pdf.includes('Saved label')&&pdf.includes('unverified')&&pdf.includes('Saved sponsor'));});
test('Imported activity IDs that match object property names retain notes without changing prototypes',()=>{let b=bookModule.setRecordLabels(empty(),'__proto__',{tags:'Work',note:'Retain this note'});assert.equal(Object.hasOwn(b.labels,'__proto__'),true);assert.equal(Object.getPrototypeOf(b.labels),Object.prototype);const s=store();bookModule.saveBook(s,'test',b);b=bookModule.readBook(s,'test');assert.equal(bookModule.decorateRecord({id:'__proto__'},b).note,'Retain this note');});
