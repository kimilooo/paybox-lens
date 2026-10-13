import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createLocalApp,listenLocal} from '../local/server.mjs';
import {portableDirectory,browserCommand} from './portable-settings.mjs';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const port=Number(process.env.LENS_PORT??3000);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('LENS_PORT must be between 1024 and 65535.');
const {default:worker}=await import('../dist/server/index.js');
const directory=portableDirectory();
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const app=createLocalApp({worker,directory,port,env:{SOLANA_RPC_URL:process.env.SOLANA_RPC_URL,BLOCKSCOUT_API_KEY:process.env.BLOCKSCOUT_API_KEY}});
console.log(`PayBox Lens ${version} · portable local dashboard`);
console.log(`Local data folder: ${directory}\nKeep this window open. Close it or press Ctrl+C to stop.`);
const server=listenLocal(app,port);
server.once('error',e=>{
  console.error(e.code==='EADDRINUSE'?'Port is already in use. Close the other Lens window, then start again.':'The local server could not start. Check your local folder permissions.');
  app.close();process.exitCode=1;
});
server.once('listening',()=>{
  if(process.env.LENS_OPEN_BROWSER==='0')return;
  const {file,args}=browserCommand(app.origin+'/');
  const child=spawn(file,args,{detached:true,stdio:'ignore',windowsHide:true});
  child.once('error',()=>console.log(`Open ${app.origin}/ in your browser.`));child.unref();
});
const stop=()=>server.close(()=>{app.close();process.exit(0);});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
