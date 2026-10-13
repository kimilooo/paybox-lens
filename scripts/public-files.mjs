import {readdirSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
export const directories=['frontend','worker','local','scripts','tests','docs','.github'];
export const rootFiles=['README.md','CONTRIBUTING.md','LICENSE','SECURITY.md','CHANGELOG.md','release.json','package.json','package-lock.json','sample.json','.env.example','.gitignore','.gitattributes','Start-PayBox-Lens.cmd','Start-PayBox-Lens.sh','Start-PayBox-Lens.command'];
export function publicFiles(root) {
 const out=[];
 function visit(path){const stat=lstatSync(join(root,path));if(stat.isSymbolicLink())throw Error('Symlinks are not allowed in a public release: '+path);if(stat.isDirectory()){for(const name of readdirSync(join(root,path)))if(name!=='__pycache__')visit(join(path,name));}else{if(!/\.(?:js|mjs|py|md|json|yml|yaml|html|css|svg|png|jpg)$/.test(path))throw Error('Unexpected public-source file: '+path);out.push(path);}}
 for(const directory of directories)visit(directory);
 for(const file of rootFiles){if(!lstatSync(join(root,file)).isFile())throw Error('Missing release file: '+file);out.push(file);}
 return out.sort();
}
