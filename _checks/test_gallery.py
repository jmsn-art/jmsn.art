import pathlib
import tempfile
import unittest
from unittest.mock import patch
import gallery
import published


class GalleryChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name).resolve()
        self.root_patch = patch.object(gallery, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def run_check(self, html):
        page = self.root / 'index.html'
        page.write_text(html)
        with patch.object(gallery, 'public_files', return_value=[page]):
            gallery.check()

    def test_missing_reference_fails(self):
        with self.assertRaisesRegex(SystemExit, 'missing published file missing.png'):
            self.run_check('<img src="missing.png">')

    def test_broken_inline_script_fails(self):
        with self.assertRaisesRegex(SystemExit, 'SyntaxError'):
            self.run_check('<script>const broken = ;</script>')

    def test_comments_data_and_external_links_are_ignored(self):
        self.run_check('<!-- <img src="gone.png"> --><img src="data:image/png;base64,abc"><a href="https://example.com/">External</a><script type="application/ld+json">{}</script>')

    def test_module_syntax_is_supported(self):
        self.run_check('<script type="module">import x from "./module.js"; export {x};</script>')

    def test_css_and_srcset_are_collected(self):
        page = gallery.Page()
        page.feed('<img srcset="one.png 1x, two.png 2x"><div style="background:url(three.png)"></div>')
        self.assertEqual(page.refs, ['one.png', 'two.png'])
        self.assertEqual(gallery.css_refs(''.join(page.styles)), ['three.png'])

    def test_encoded_path_and_escape(self):
        self.assertEqual(gallery.local_target(self.root / 'index.html', '/my%20image.png?v=2'), self.root / 'my image.png')
        with self.assertRaises(ValueError):
            gallery.local_target(self.root / 'index.html', '../outside.png')

    def test_published_mismatch_fails(self):
        page = self.root / 'index.html'
        page.write_bytes(b'expected')
        with patch.object(published, 'ROOT', self.root), patch('urllib.request.urlopen') as fetch:
            fetch.return_value.__enter__.return_value.status = 200
            fetch.return_value.__enter__.return_value.read.return_value = b'old content'
            self.assertIn('published bytes differ', published.verify(page, 'abc123'))
            fetch.return_value.__enter__.return_value.read.return_value = b'expected'
            self.assertIsNone(published.verify(page, 'abc123'))


if __name__ == '__main__':
    unittest.main()
