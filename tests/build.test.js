import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,cpSync,readdirSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
test('Built Worker serves frontend modules byte-for-byte, including dollar / backslash regexes in financial exports',async()=>{execFileSync(process.execPath,['scripts/build.mjs']);const {default:worker}=await import('../dist/server/index.js');for(const file of ['app.js','data.js','exports.js','analytics.js','snapshots.js','contact-book.js','explanations.js','privacy.js']){const r=await worker.fetch(new Request('https://lens.example/'+file));assert.equal(r.status,200);assert.equal(await r.text(),readFileSync('frontend/'+file,'utf8'));}const logo=await worker.fetch(new Request('https://lens.example/assets/paybox-logo.jpg'));assert.equal(logo.status,200);assert.equal((await logo.arrayBuffer()).byteLength,readFileSync('frontend/assets/paybox-logo.jpg').length);});

test('Windows CRLF sources build an import-free Worker while served assets retain their bytes',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'lens-crlf-'));
 try {
  for(const name of ['frontend','worker'])cpSync(name,join(directory,name),{recursive:true});
  mkdirSync(join(directory,'scripts'));cpSync('scripts/build.mjs',join(directory,'scripts/build.mjs'));
  writeFileSync(join(directory,'package.json'),'{"type":"module"}');
  for(const name of ['frontend','worker'])for(const file of readdirSync(join(directory,name)))if(file.endsWith('.js')){
   const path=join(directory,name,file);writeFileSync(path,readFileSync(path,'utf8').replace(/\r?\n/g,'\r\n'));
  }
  execFileSync(process.execPath,[resolve('scripts/build.mjs')],{cwd:directory});
  const {default:worker}=await import(pathToFileURL(join(directory,'dist/server/index.js')).href);
  for(const file of ['solana-history.js','exports.js','local-connection.js']){
   const response=await worker.fetch(new Request('https://lens.example/'+file));
   assert.equal(response.status,200);assert.equal(await response.text(),readFileSync(join(directory,'frontend',file),'utf8'));
  }
 } finally {rmSync(directory,{recursive:true,force:true});}
});
