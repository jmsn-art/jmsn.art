"""Check tracked public HTML/CSS references and JavaScript syntax; no third-party requests."""
import pathlib
import re
import subprocess
import tempfile
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]


def public_files():
    paths = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    return [ROOT / p for p in paths if p and not any(part.startswith(('_', '.')) for part in pathlib.PurePosixPath(p).parts)]


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs, self.scripts, self.styles = [], [], []
        self.script = None
        self.style = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ('href', 'src', 'poster'):
            if a.get(key):
                self.refs.append(a[key])
        if a.get('srcset'):
            self.refs.extend(item.strip().split()[0] for item in a['srcset'].split(',') if item.strip())
        if a.get('style'):
            self.styles.append(a['style'])
        if tag == 'script' and not a.get('src') and a.get('type', '').lower() in ('', 'module', 'text/javascript', 'application/javascript'):
            self.script = [a.get('type') == 'module', '']
        if tag == 'style':
            self.style = True

    def handle_data(self, data):
        if self.script is not None:
            self.script[1] += data
        if self.style:
            self.styles.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            self.scripts.append(self.script)
            self.script = None
        if tag == 'style':
            self.style = False


def css_refs(text):
    return re.findall(r'url\(\s*[\'"]?([^\s)\'";]+)', text) + re.findall(r'@import\s+[\'"]([^\'"]+)', text)


def local_target(source, ref):
    u = urlsplit(ref)
    if u.scheme and u.scheme not in ('http', 'https'):
        return None
    if u.netloc and u.netloc not in ('jmsn.art', 'www.jmsn.art'):
        return None
    if not u.path:
        return None
    target = (ROOT / unquote(u.path).lstrip('/') if u.path.startswith('/') else source.parent / unquote(u.path)).resolve()
    if not target.is_relative_to(ROOT):
        raise ValueError('reference escapes site root: ' + ref)
    if target.is_dir():
        target /= 'index.html'
    return target


def check():
    errors, references, scripts = [], 0, 0
    tracked = set(public_files())
    with tempfile.TemporaryDirectory() as tmp:
        def syntax(source, code, module=False):
            nonlocal scripts
            scripts += 1
            path = pathlib.Path(tmp) / ('script.mjs' if module else 'script.cjs')
            path.write_text(code)
            result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
            if result.returncode:
                errors.append(f'{source}: {result.stderr}')
        for path in sorted(tracked):
            refs = []
            if path.suffix == '.html':
                page = Page()
                page.feed(path.read_text())
                refs = page.refs + css_refs('\n'.join(page.styles))
                for module, code in page.scripts:
                    syntax(path.relative_to(ROOT), code, module)
            elif path.suffix == '.css':
                refs = css_refs(path.read_text())
            elif path.suffix in ('.js', '.mjs', '.cjs'):
                syntax(path.relative_to(ROOT), path.read_text(), path.suffix != '.cjs')
            for ref in refs:
                try:
                    target = local_target(path, ref)
                    if target is not None:
                        references += 1
                        if target not in tracked or not target.is_file():
                            errors.append(f'{path.relative_to(ROOT)}: missing published file {ref}')
                except ValueError as error:
                    errors.append(f'{path.relative_to(ROOT)}: {error}')
    print(f'Checked {references} local references and {scripts} JavaScript sources.')
    if errors:
        raise SystemExit('\n'.join(errors))


if __name__ == '__main__':
    check()
