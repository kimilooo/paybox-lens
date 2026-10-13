import worker from '../dist/server/index.js';
import {createLocalApp,listenLocal} from '../local/server.mjs';
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const port=Number(process.env.LENS_PORT??3000);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('LENS_PORT must be between 1024 and 65535.');
const app=createLocalApp({worker,directory:process.env.LENS_DATA_DIR??'data',port,env:{SOLANA_RPC_URL:process.env.SOLANA_RPC_URL,BLOCKSCOUT_API_KEY:process.env.BLOCKSCOUT_API_KEY}});
const server=listenLocal(app,port);const stop=()=>server.close(()=>{app.close();process.exit(0);});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
