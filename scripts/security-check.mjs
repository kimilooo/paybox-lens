import {readFileSync} from 'node:fs';
import {publicFiles} from './public-files.mjs';
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{36,}\b/,/\bgithub_pat_[A-Za-z0-9_]{70,}\b/,/\bAKIA[0-9A-Z]{16}\b/];
const files=publicFiles(process.cwd()),findings=[];
for(const file of files){if(/\.(?:png|jpg)$/.test(file))continue;const text=readFileSync(file,'utf8');if(patterns.some(p=>p.test(text)))findings.push(file);}
const pkg=JSON.parse(readFileSync('package.json','utf8'));
for(const key of ['preinstall','install','postinstall','prepare'])if(pkg.scripts?.[key])findings.push('Unexpected installation hook: '+key);
if(Object.keys(pkg.dependencies??{}).length)findings.push('Runtime dependencies need a reviewed release-policy change.');
if(findings.length){console.error('Publication check failed; inspect these files (matching secret values are redacted):\n'+findings.join('\n'));process.exit(1);}
console.log(`Publication content check passed: ${files.length} allowlisted files; no installation hooks or runtime dependencies. This is not a malware certificate.`);
