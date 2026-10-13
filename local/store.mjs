import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createCipheriv,createDecipheriv,createHmac} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,chmodSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';

// The key stays on the user's device. This is not protection from a device administrator.
export function openLocalStore(directory) {
  const dir=resolve(directory);mkdirSync(dir,{recursive:true,mode:0o700});
  if(!lstatSync(dir).isDirectory()||lstatSync(dir).isSymbolicLink())throw Error('Use a regular local data directory.');
  chmodSync(dir,0o700);
  const keyPath=join(dir,'encryption.key');
  try{writeFileSync(keyPath,randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  if(!lstatSync(keyPath).isFile()||lstatSync(keyPath).isSymbolicLink())throw Error('Invalid local encryption key file.');
  chmodSync(keyPath,0o600);const key=readFileSync(keyPath);if(key.length!==32)throw Error('Invalid local encryption key.');
  const file=join(dir,'lens.sqlite');
  try{if(!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink())throw Error('Invalid database file.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const db=new DatabaseSync(file);chmodSync(file,0o600);
  db.exec('PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const id=name=>createHmac('sha256',key).update(name).digest('hex');
  const encrypt=value=>{const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);return Buffer.concat([nonce,cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]).toString('base64');};
  const decrypt=value=>{const bytes=Buffer.from(value,'base64');const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(-16));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString());};
  db.exec('CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)');
  const check=db.prepare('SELECT value FROM metadata WHERE id=1').get();
  if(check){try{if(decrypt(check.value)!=='paybox-lens-local-v1')throw Error('Mismatch');}catch{db.close();throw Error('Local database encryption key does not match. Restore the matching backup.');}}
  else db.prepare('INSERT INTO metadata(id,value) VALUES(1,?)').run(encrypt('paybox-lens-local-v1'));
  const get=db.prepare('SELECT value FROM records WHERE id=?'),put=db.prepare('INSERT INTO records(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value'),remove=db.prepare('DELETE FROM records WHERE id=?');
  return {file,get(name){const row=get.get(id(name));return row?decrypt(row.value):null;},set(name,value){put.run(id(name),encrypt(value));},delete(name){remove.run(id(name));},transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},close(){db.close();}};
}
