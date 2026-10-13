import {homedir} from 'node:os';
import {posix,win32,resolve} from 'node:path';

export function portableDirectory({platform=process.platform,env=process.env,home=homedir()}={}) {
  if(env.LENS_DATA_DIR?.trim())return resolve(env.LENS_DATA_DIR);
  if(platform==='win32')return win32.join(env.APPDATA||win32.join(home,'AppData','Roaming'),'PayBoxLens');
  if(platform==='darwin')return posix.join(home,'Library','Application Support','PayBoxLens');
  const base=env.XDG_DATA_HOME&&posix.isAbsolute(env.XDG_DATA_HOME)?env.XDG_DATA_HOME:posix.join(home,'.local','share');
  return posix.join(base,'paybox-lens');
}

export function browserCommand(url,platform=process.platform) {
  if(!/^http:\/\/localhost:[0-9]{4,5}\/$/.test(url))throw Error('Only the local dashboard URL can be opened.');
  if(platform==='win32')return {file:'cmd.exe',args:['/d','/s','/c','start','',url]};
  return {file:platform==='darwin'?'open':'xdg-open',args:[url]};
}
