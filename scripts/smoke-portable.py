"""Boot an extracted portable package through its actual OS launcher, without opening a browser."""
import argparse, hashlib, json, os, socket, subprocess, sys, tempfile, time, urllib.request, urllib.error, zipfile
from pathlib import Path

def smoke(archive):
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with tempfile.TemporaryDirectory(prefix='lens portable smoke ') as folder:
        parent=Path(folder)
        with zipfile.ZipFile(archive) as z:
            for member in z.infolist():
                target=parent/member.filename
                if not target.resolve().is_relative_to(parent.resolve()):raise ValueError('Unsafe package path')
                z.extract(member,parent)
                if os.name!='nt':target.chmod((member.external_attr>>16)&0o777)
        roots=[p for p in parent.iterdir() if p.is_dir()];assert len(roots)==1
        root=roots[0]
        for line in (root/'PACKAGE-SHA256SUMS').read_text().splitlines():
            digest,name=line.split('  ',1)
            assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        data=parent/'private-data';env=dict(os.environ,LENS_PORT=str(port),LENS_DATA_DIR=str(data),LENS_OPEN_BROWSER='0')
        if os.name=='nt':cmd=[str(Path(os.environ['SystemRoot'])/'System32/cmd.exe'),'/d','/c',str(root/'Start-PayBox-Lens.cmd')]
        else:cmd=['/bin/sh',str(root/('Start-PayBox-Lens.command' if sys.platform=='darwin' else 'Start-PayBox-Lens.sh'))]
        log=parent/'startup.log'
        with log.open('wb') as output:
            p=subprocess.Popen(cmd,cwd=parent,env=env,stdout=output,stderr=subprocess.STDOUT)
            try:
                url='http://localhost:'+str(port)
                for attempt in range(100):
                    if p.poll() is not None:raise RuntimeError('Launcher stopped: '+log.read_text())
                    try:
                        with opener.open(url+'/',timeout=1) as r:
                            assert r.status==200 and b'PayBox Lens' in r.read();break
                    except (OSError,urllib.error.URLError):time.sleep(.2)
                else:raise RuntimeError('Launcher was not ready: '+log.read_text())
                with opener.open(url+'/local/session',timeout=5) as r:
                    session=json.load(r);assert session['local'] and not session['connected']
                    assert 'accessToken' not in session and 'refreshToken' not in session
                assert (data/'lens.sqlite').exists() and (data/'encryption.key').exists()
                try:opener.open(url+'/data/lens.sqlite',timeout=5);raise AssertionError('Database served publicly')
                except urllib.error.HTTPError as e:assert e.code==404
                print('Portable launcher, HTTP, local session, private DB and package checksums passed.')
            finally:
                if os.name=='nt':subprocess.run(['taskkill','/PID',str(p.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                else:p.terminate()
                try:p.wait(timeout=10)
                except subprocess.TimeoutExpired:p.kill();p.wait()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('archive');args=parser.parse_args();smoke(Path(args.archive))
