"""Publish this reviewed commit's portable artifacts with the runner's scoped GitHub token."""
from pathlib import Path
import hashlib,json,os,subprocess,time
from importlib.util import spec_from_file_location,module_from_spec

ROOT=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('package_release',ROOT/'scripts/package-release.py');module=module_from_spec(spec);spec.loader.exec_module(module)
c=module.config();tag='v'+c['version'];repo=os.environ['GITHUB_REPOSITORY'];sha=os.environ['GITHUB_SHA']

def gh(*args):return subprocess.check_output(['gh',*args],text=True)

# Gate publication on the exact commit's normal test/security workflows as well
# as the release workflow's own native-platform package checks.
for attempt in range(40):
    runs=json.loads(gh('api',f'repos/{repo}/actions/runs?head_sha={sha}&event=push&per_page=100'))['workflow_runs']
    found={r['name']:r for r in reversed(runs) if r['name'] in {'CI','CodeQL','Secret Check'}}
    if any(r['status']=='completed' and r['conclusion']!='success' for r in found.values()):raise RuntimeError('A required source/security workflow failed')
    if len(found)==3 and all(r['status']=='completed' and r['conclusion']=='success' for r in found.values()):break
    time.sleep(15)
else:raise RuntimeError('Required source/security workflows did not finish')

out=ROOT/'release-output';assets=[]
for platform in c['platforms']:
    p=out/('paybox-lens-'+tag+'-'+platform+'.zip')
    expected=(p.with_name(p.name+'.sha256')).read_text().split()[0]
    if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise ValueError('Artifact checksum mismatch')
    assets.append(p)
sums=out/'SHA256SUMS';sums.write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in assets))
assets.append(sums)
existing=subprocess.run(['gh','release','view',tag,'--repo',repo,'--json','isDraft,tagName'],capture_output=True,text=True)
if existing.returncode==0:
    current=json.loads(existing.stdout)
    ref=json.loads(gh('api',f'repos/{repo}/git/ref/tags/{tag}'))['object']
    if ref['sha']!=sha:raise RuntimeError('Existing tag points to another commit; refusing to move it')
    if not current['isDraft']:
        print('This commit already has a published release. No assets overwritten.');raise SystemExit(0)
else:
    subprocess.run(['gh','release','create',tag,'--repo',repo,'--target',sha,'--title','PayBox Lens '+tag+' — Easy Start','--notes-file',str(ROOT/'docs/RELEASE_NOTES.md'),'--draft'],check=True)
subprocess.run(['gh','release','upload',tag,*map(str,assets),'--repo',repo,'--clobber'],check=True)
subprocess.run(['gh','release','edit',tag,'--repo',repo,'--draft=false','--latest'],check=True)
print('Published '+tag+' with four verified portable ZIPs and SHA256SUMS.')
