"""Verifica empacotamento e falhas do build usando apenas a biblioteca padrao."""
import base64
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="epic-build-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ("build.py", "index.html", "css", "js", "img"):
            source = ROOT / name
            if source.is_dir():
                shutil.copytree(source, self.root / name)
            else:
                shutil.copy2(source, self.root / name)

    def build(self):
        return subprocess.run(
            [sys.executable, str(self.root / "build.py")],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )

    def test_generated_html_matches_sources_and_images(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        html = (self.root / "dist/index.html").read_text(encoding="utf-8")
        self.assertEqual(html, (self.root / "dist/epic-simulador.html").read_text(encoding="utf-8"))
        css = re.search(r"<style>\n(.*?)\n</style>", html, re.S).group(1)
        self.assertEqual(css, (ROOT / "css/styles.css").read_text(encoding="utf-8").rstrip())
        js = re.search(r"<script>\n(.*?)\n</script>", html, re.S).group(1)
        for label, filename in (("DARK", "logo-epic.png"), ("LIGHT", "logo-epic-branca.png")):
            uri = re.search(r'var LOGO_' + label + r' = resolveAsset\("([^"]+)"\)', js).group(1)
            self.assertEqual(base64.b64decode(uri.split(",", 1)[1]), (ROOT / "img" / filename).read_bytes())
            js = js.replace(uri, "img/" + filename)
        self.assertEqual(js, (ROOT / "js/app.js").read_text(encoding="utf-8").rstrip())
        self.assertNotIn('src="js/', html)
        self.assertNotIn('href="css/', html)
        self.assertNotIn('src="img/', html)
        for relative in re.findall(r'(?:href|src)="([^"]+)"', (ROOT / "index.html").read_text(encoding="utf-8")):
            self.assertTrue((ROOT / relative).is_file(), relative)

    def test_missing_asset_does_not_generate_output(self):
        (self.root / "img/logo-epic.png").unlink()
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("erro no build", result.stderr)
        self.assertFalse((self.root / "dist").exists())

    def test_changed_reference_does_not_silently_generate_broken_output(self):
        html = self.root / "index.html"
        html.write_text(html.read_text(encoding="utf-8").replace("js/app.js", "js/missing.js"), encoding="utf-8")
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("exatamente uma", result.stderr)
        self.assertFalse((self.root / "dist").exists())


if __name__ == "__main__":
    unittest.main()
