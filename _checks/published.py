"""Compare public text assets with the successful Pages commit, allowing CDN propagation."""
import concurrent.futures
import hashlib
import pathlib
import subprocess
import time
import urllib.request
from urllib.parse import quote
from gallery import ROOT, public_files


def verify(path, commit):
    relative = path.relative_to(ROOT).as_posix()
    url = 'https://jmsn.art/' + quote(relative) + '?verify=' + commit
    expected = hashlib.sha256(path.read_bytes()).hexdigest()
    try:
        request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'jmsn-pages-verification'})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                return f'{relative}: HTTP {response.status}'
            actual = hashlib.sha256(response.read()).hexdigest()
        return None if actual == expected else f'{relative}: published bytes differ from {commit}'
    except Exception as error:
        return f'{relative}: {error}'


def main():
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    pending = [p for p in public_files() if p.suffix in ('.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.webmanifest', '.svg') and p.name != 'source-manifest.json']
    total = len(pending)
    for attempt in range(1, 6):
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            errors = list(pool.map(lambda p: verify(p, commit), pending))
        pending = [p for p, error in zip(pending, errors) if error]
        if not pending:
            print(f'PASS: all {total} published text assets match {commit}.')
            return
        print(f'Attempt {attempt}: {len(pending)} assets pending. ' + '; '.join(e for e in errors if e), flush=True)
        if attempt < 5:
            time.sleep(30)
    raise SystemExit('Published asset verification failed after retries.')


if __name__ == '__main__':
    main()
