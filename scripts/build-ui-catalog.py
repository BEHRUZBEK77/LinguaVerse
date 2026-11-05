"""Build the allow-list of public interface copy; never send user data to translation.

Run after changing UI copy: python scripts/build-ui-catalog.py
Generated catalogs are checked in, so production does not need Python.
"""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parent.parent
texts = set()

def add(value):
    value = re.sub(r"\s+", " ", html.unescape(value)).strip()
    if 2 <= len(value) <= 1500 and re.search(r"[A-Za-zА-Яа-я]", value) and not re.search(r"[{}]|https?://|=>|</|\$\{", value):
        texts.add(value)

class CopyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'code', 'pre'):
            self.skip += 1
        if not self.skip:
            for k,v in attrs:
                if k in ('placeholder', 'title', 'aria-label') and v:
                    add(v)
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'code', 'pre'):
            self.skip = max(0, self.skip - 1)
    def handle_data(self, value):
        if not self.skip:
            add(value)

paths = [*ROOT.glob('*.html'), *ROOT.joinpath('auth').glob('*.html'), *ROOT.joinpath('languages-html').glob('*.html'), *ROOT.joinpath('js').glob('*.js'), *ROOT.joinpath('js').glob('*.mjs'), *ROOT.joinpath('languages-html/js').glob('*.js')]
for path in paths:
    if path.name in ('index-eski-zaxira.html', 'learning-copy.mjs'):
        continue
    source = path.read_text(encoding='utf-8')
    if path.suffix == '.html':
        CopyParser().feed(source)
    # Quoted static strings and literal HTML fragments in template strings.
    # Interpolated/private values cannot enter the allow-list.
    for match in re.finditer(r'''(["'])(?:\\.|(?!\1)[^\\\r\n])*?\1''', source):
        value = match.group()[1:-1]
        value = value.replace("\\'", "'").replace('\\"','"').replace('\\n',' ')
        if '<' in value:
            CopyParser().feed(value)
        elif not re.search(r'[=;]|^[.#/]|\b(function|const|return|import)\b', value):
            add(value)
    for match in re.finditer(r'>\s*([^<>${}]+?)\s*<', source):
        add(match.group(1))

mapping = {text: hashlib.sha256(text.encode()).hexdigest()[:20] for text in sorted(texts)}
folder = ROOT / 'locales'
folder.mkdir(exist_ok=True)
(folder / 'ui-source.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(mapping)} public UI strings indexed')
