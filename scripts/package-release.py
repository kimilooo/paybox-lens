"""Build portable ZIPs from the sanitized source and checksum-pinned Node archives."""
from pathlib import Path
import argparse, hashlib, io, json, re, tarfile, urllib.request, zipfile

ROOT=Path(__file__).resolve().parents[1]

def config(root=ROOT):
    c=json.loads((root/'release.json').read_text())
    if not re.fullmatch(r'\d+\.\d+\.\d+',c['version']) or not re.fullmatch(r'v24\.\d+\.\d+',c['node']):
        raise ValueError('Invalid release/runtime version')
    if c['version']!=json.loads((root/'package.json').read_text())['version']:
        raise ValueError('Release and package versions must match')
    for platform,spec in c['platforms'].items():
        if platform not in {'win-x64','linux-x64','darwin-arm64','darwin-x64'}:raise ValueError('Unsupported platform')
        expected='node-'+c['node']+'-'+platform+('.zip' if platform.startswith('win-') else '.tar.gz')
        if spec['archive']!=expected or not re.fullmatch('[a-f0-9]{64}',spec['sha256']):raise ValueError('Invalid runtime pin')
    return c

def runtime(c,platform):
    spec=c['platforms'][platform]
    url='https://nodejs.org/dist/'+c['node']+'/'+spec['archive']
    with urllib.request.urlopen(url,timeout=120) as r:data=r.read()
    if hashlib.sha256(data).hexdigest()!=spec['sha256']:raise ValueError('Official Node archive checksum mismatch')
    prefix='node-'+c['node']+'-'+platform+'/'
    # Read only two known files; never extract arbitrary archive paths or links.
    if platform.startswith('win-'):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            binary=z.read(prefix+'node.exe');license_bytes=z.read(prefix+'LICENSE')
    else:
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
            members=[t.getmember(prefix+name) for name in ['bin/node','LICENSE']]
            if not all(m.isfile() for m in members):raise ValueError('Runtime members must be regular files')
            binary,license_bytes=[t.extractfile(m).read() for m in members]
    return binary,license_bytes

def source_payload(root):
    public=root/'public-release';out={}
    for line in (public/'SHA256SUMS').read_text().splitlines():
        digest,name=line.split('  ',1);path=public/name
        if path.is_symlink() or not path.resolve().is_relative_to(public.resolve()):raise ValueError('Unsafe release path')
        data=path.read_bytes()
        if hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Public source checksum mismatch: '+name)
        out[name]=data
    out['SHA256SUMS']=(public/'SHA256SUMS').read_bytes()
    out['dist/server/index.js']=(root/'dist/server/index.js').read_bytes()
    return out

def bundle(c,platform,binary,license_bytes,output,root=ROOT):
    payload=source_payload(root)
    if json.loads(payload['package.json'])['version']!=c['version']:raise ValueError('Prepared source version does not match release')
    exe='runtime/node.exe' if platform.startswith('win-') else 'runtime/node'
    payload[exe]=binary;payload['runtime/LICENSE']=license_bytes
    payload['runtime/INFO.json']=(json.dumps({'node':c['node'],'platform':platform,
        'official_archive':c['platforms'][platform]['archive'],
        'archive_sha256':c['platforms'][platform]['sha256'],
        'binary_sha256':hashlib.sha256(binary).hexdigest()},indent=2)+'\n').encode()
    payload['PACKAGE-SHA256SUMS']=(''.join(hashlib.sha256(b).hexdigest()+'  '+p+'\n' for p,b in sorted(payload.items()))).encode()
    name='paybox-lens-v'+c['version']+'-'+platform
    output.mkdir(parents=True,exist_ok=True);path=output/(name+'.zip')
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p,data in sorted(payload.items()):
            item=zipfile.ZipInfo(name+'/'+p,date_time=(2026,1,1,0,0,0))
            item.create_system=3;item.compress_type=zipfile.ZIP_DEFLATED
            mode=0o755 if p in {exe,'Start-PayBox-Lens.sh','Start-PayBox-Lens.command'} else 0o644
            item.external_attr=(0o100000|mode)<<16
            z.writestr(item,data)
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    (output/(name+'.zip.sha256')).write_text(digest+'  '+path.name+'\n')
    return path

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--platform',required=True);parser.add_argument('--output',default='release-output')
    args=parser.parse_args();c=config()
    if args.platform not in c['platforms']:parser.error('Unsupported platform')
    b,l=runtime(c,args.platform)
    print(bundle(c,args.platform,b,l,Path(args.output).resolve()))
