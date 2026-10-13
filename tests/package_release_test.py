from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
import hashlib,io,json,tarfile,tempfile,unittest,zipfile
from unittest.mock import patch
spec=spec_from_file_location('package_release',Path(__file__).resolve().parents[1]/'scripts/package-release.py')
module=module_from_spec(spec);spec.loader.exec_module(module)

class PackageTests(unittest.TestCase):
    def fixture(self,root):
        c=module.config();(root/'public-release').mkdir();b=b'Demo source'
        (root/'public-release/README.md').write_bytes(b)
        package=(json.dumps({'version':c['version']})+'\n').encode();(root/'public-release/package.json').write_bytes(package)
        (root/'public-release/SHA256SUMS').write_text(hashlib.sha256(b).hexdigest()+'  README.md\n'+hashlib.sha256(package).hexdigest()+'  package.json\n')
        (root/'dist/server').mkdir(parents=True);(root/'dist/server/index.js').write_text('export default {};')
        (root/'data').mkdir();(root/'data/encryption.key').write_text('fictional local key');(root/'.env').write_text('PRIVATE_FIXTURE=not-for-release');return c

    def test_package_runtime_license_hashes_and_private_file_exclusion(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);c=self.fixture(root);out=module.bundle(c,'linux-x64',b'fictional runtime',b'fictional license',root/'out',root)
            with zipfile.ZipFile(out) as z:
                prefix='paybox-lens-v'+c['version']+'-linux-x64/'
                self.assertFalse(any('/data/' in p or p.endswith('/.env') for p in z.namelist()));self.assertIn(prefix+'runtime/LICENSE',z.namelist())
                self.assertEqual((z.getinfo(prefix+'runtime/node').external_attr>>16)&0o777,0o755)
                for line in z.read(prefix+'PACKAGE-SHA256SUMS').decode().splitlines():
                    digest,name=line.split('  ',1);self.assertEqual(hashlib.sha256(z.read(prefix+name)).hexdigest(),digest)
            original=out.read_bytes();module.bundle(c,'linux-x64',b'fictional runtime',b'fictional license',root/'out',root);self.assertEqual(original,out.read_bytes())

    def test_tampered_source_not_packaged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);c=self.fixture(root);(root/'public-release/README.md').write_text('changed')
            with self.assertRaisesRegex(ValueError,'checksum mismatch'):module.bundle(c,'linux-x64',b'x',b'y',root/'out',root)

    def test_runtime_checksum_failure_prevents_extraction(self):
        with patch.object(module.urllib.request,'urlopen',return_value=io.BytesIO(b'untrusted bytes')):
            with self.assertRaisesRegex(ValueError,'checksum mismatch'):module.runtime(module.config(),'linux-x64')

    def test_runtime_links_rejected_and_unrelated_archive_paths_not_extracted(self):
        c=module.config();prefix='node-'+c['node']+'-linux-x64/'
        def archive(link=False):
            out=io.BytesIO()
            with tarfile.open(fileobj=out,mode='w:gz') as t:
                for name,data in [('bin/node',b'fictional runtime'),('LICENSE',b'license'),('../../unrelated',b'not extracted')]:
                    m=tarfile.TarInfo(prefix+name);m.size=len(data)
                    if link and name=='bin/node':m.type=tarfile.SYMTYPE;m.linkname='/outside';m.size=0
                    t.addfile(m,io.BytesIO(data))
            return out.getvalue()
        for link in [False,True]:
            data=archive(link);c['platforms']['linux-x64']['sha256']=hashlib.sha256(data).hexdigest()
            with patch.object(module.urllib.request,'urlopen',return_value=io.BytesIO(data)):
                if link:
                    with self.assertRaisesRegex(ValueError,'regular files'):module.runtime(c,'linux-x64')
                else:self.assertEqual(module.runtime(c,'linux-x64'),(b'fictional runtime',b'license'))

if __name__=='__main__':unittest.main()
