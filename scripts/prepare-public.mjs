import {cpSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {publicFiles} from './public-files.mjs';
execFileSync(process.execPath,['scripts/security-check.mjs'],{stdio:'inherit'});
const root=process.cwd(),out=resolve(root,'public-release'),files=publicFiles(root);
rmSync(out,{recursive:true,force:true});mkdirSync(out);
for(const file of files){mkdirSync(dirname(join(out,file)),{recursive:true});cpSync(join(root,file),join(out,file));}
writeFileSync(join(out,'SHA256SUMS'),files.map(file=>createHash('sha256').update(readFileSync(join(out,file))).digest('hex')+'  '+file.replaceAll('\\','/')).join('\n')+'\n');
console.log(`Prepared ${files.length} source files at public-release/. No Site identity, Git history, database, key, .env, exports or generated Worker included.`);
