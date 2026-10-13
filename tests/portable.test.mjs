import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';import net from 'node:net';import {once} from 'node:events';
import {portableDirectory,browserCommand} from '../scripts/portable-settings.mjs';

test('Portable data uses stable user directories outside the extracted version folder',()=>{
 assert.equal(portableDirectory({platform:'win32',home:'C:\\Users\\demo',env:{APPDATA:'C:\\Users\\demo\\AppData\\Roaming'}}),'C:\\Users\\demo\\AppData\\Roaming\\PayBoxLens');
 assert.equal(portableDirectory({platform:'darwin',home:'/Users/demo',env:{}}),'/Users/demo/Library/Application Support/PayBoxLens');
 assert.equal(portableDirectory({platform:'linux',home:'/home/demo',env:{XDG_DATA_HOME:'/custom/data'}}),'/custom/data/paybox-lens');
 assert.equal(portableDirectory({platform:'linux',home:'/home/demo',env:{XDG_DATA_HOME:'relative'}}),'/home/demo/.local/share/paybox-lens');
 assert.equal(portableDirectory({env:{LENS_DATA_DIR:'./custom-private-data'}}),resolve('./custom-private-data'));
});

test('Browser handoff rejects remote destinations and shell metacharacters',()=>{
 for(const url of ['https://example.com/','http://localhost:3000/?x=1','http://localhost:3000/ & calc','javascript:alert(1)','http://127.0.0.1:3000/'])assert.throws(()=>browserCommand(url,'win32'));
 assert.equal(browserCommand('http://localhost:3000/','darwin').file,'open');assert.equal(browserCommand('http://localhost:3000/','linux').file,'xdg-open');
 const command=browserCommand('http://localhost:3000/','win32');assert.equal(command.file,'cmd.exe');assert.equal(command.args.at(-1),'http://localhost:3000/');assert.equal(command.args.at(-2),'');
});

test('Portable entry boots from a path with spaces and reports an occupied port',async()=>{
 const root=mkdtempSync(join(tmpdir(),'lens portable source ')),data=join(root,'private-data');let child;
 try {
  for(const dir of ['frontend','worker','local','scripts'])cpSync(dir,join(root,dir),{recursive:true});cpSync('package.json',join(root,'package.json'));
  execFileSync(process.execPath,[join(root,'scripts/build.mjs')],{cwd:root});
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));
  const env={...process.env,LENS_PORT:String(port),LENS_DATA_DIR:data,LENS_OPEN_BROWSER:'0'};
  child=spawn(process.execPath,[join(root,'scripts/portable-start.mjs')],{cwd:tmpdir(),env});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const url='http://localhost:'+port;let response;
  for(let n=0;n<100;n++){try{response=await fetch(url+'/');break;}catch{await new Promise(r=>setTimeout(r,40));}}
  assert.equal(response?.status,200,log);assert.ok((await response.text()).includes('PayBox Lens'));
  const s=await(await fetch(url+'/local/session')).json();assert.equal(s.local,true);assert.equal(s.connected,false);
  assert.ok(existsSync(join(data,'lens.sqlite'))&&existsSync(join(data,'encryption.key')));assert.equal((await fetch(url+'/data/lens.sqlite')).status,404);
  const other=spawn(process.execPath,[join(root,'scripts/portable-start.mjs')],{env});let otherLog='';other.stdout.on('data',b=>otherLog+=b);other.stderr.on('data',b=>otherLog+=b);
  const [code]=await once(other,'close');assert.equal(code,1);assert.match(otherLog,/Port is already in use/);
 } finally {if(child&&child.exitCode===null){child.kill();await once(child,'close');}rmSync(root,{recursive:true,force:true});}
});
