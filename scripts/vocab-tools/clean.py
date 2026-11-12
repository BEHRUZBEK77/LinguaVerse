"""Lug'at tozalash: har so'zni imlo lug'ati bilan tekshiradi, keraksizlarini chiqarib,
o'rniga keyingi chastotali to'g'ri so'zlarni qo'yadi.  python3 -I clean.py review|build [til...]"""
import sys, json, re, os, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hun import Hun, ko_ok

SRC = '/home/claude/hermitdave/frequencywords/content/2018/'
D = '/home/claude/lexdeps/dictionaries/dictionaries/'
OUT = '/home/claude/linguaverse/vocab/'
OVR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'overrides.json')
TARGET, CHUNK, REVIEW_TOP = 40000, 2000, 1500

LANGS = {
  'english': ('en', r'^[a-z]+(?:[\'-][a-z]+)*$', {'a', 'i'}),
  'russian': ('ru', r'^[а-яё]+(?:-[а-яё]+)*$', set('явскоуа') | {'и'}),
  'turkish': ('tr', r'^[a-zçğıöşüâîû]+$', {'o'}),
  'german':  ('de', r'^[a-zäöüß]+(?:-[a-zäöüß]+)*$', set()),
  'spanish': ('es', r'^[a-záéíóúñü]+$', set('ayoeu')),
  'arabic':  ('ar', r'^[ء-غف-ي]+$', {'و'}),
  'chinese': ('zh_cn', r'^[一-鿿]+$', None),
  'korean':  ('ko', r'^[가-힣]+$', None),
}
ACC = str.maketrans('áéíóú', 'aeiou')
CLIT = re.compile(r'(?:me|te|se|nos|os|lo|la|los|las|le|les)$')

def checker(lang):
    if lang == 'chinese':
        zh = set(l.split(' ')[0] for l in open('/home/claude/lexdeps/jieba/jieba/dict.txt', encoding='utf-8'))
        return lambda w: (w in zh) or None
    if lang == 'arabic': hs = [Hun('/home/claude/lexdeps/lo/ar/ar.aff', '/home/claude/lexdeps/lo/ar/ar.dic')]
    elif lang == 'english': hs = [Hun(D + 'en/index.aff', D + 'en/index.dic'), Hun(D + 'en-GB/index.aff', D + 'en-GB/index.dic')]
    else:
        c = LANGS[lang][0]; hs = [Hun(D + c + '/index.aff', D + c + '/index.dic')]
    if lang == 'korean':
        hs[0].maxdepth = 2
        END = set('요들죠나도만는은을를이가야지네게고서')
        kk = set(json.load(open(OVR, encoding='utf-8')).get('korean', {}).get('keep', [])) if os.path.exists(OVR) else set()
        base = lambda w: w in kk or ko_ok(hs[0], w) or hs[0].conv(w) in hs[0].words
        return lambda w: base(w) or (len(w) > 2 and w[-1] in END and base(w[:-1])) or None
    cap = lambda w: w[:1].upper() + w[1:]
    def one(w):
        return any(h.check(w) for h in hs)
    def ok(w):
        if one(w): return True
        if '-' in w and all(one(p) or one(cap(p)) for p in w.split('-') if p): return True
        if lang == 'spanish':
            v = w
            for _ in range(2):
                m = CLIT.search(v)
                if not m or len(v) - len(m.group()) < 3: break
                v = v[:m.start()]
                if one(v) or one(v.translate(ACC)): return True
        if lang == 'german':
            W = cap(w)
            if one(W): return True
            for i in range(3, len(w) - 2):
                a, b = w[:i], w[i:]
                if not (one(cap(b)) or one(b)): continue
                for left in (a, a[:-1] if a.endswith('s') else None, a[:-1] if a.endswith(('n', 'e')) else None):
                    if left and len(left) >= 3 and (one(cap(left)) or one(left)): return True
        if lang != 'german' and one(cap(w)): return 'name'   # faqat bosh harf bilan to'g'ri → atoqli ot
        return None
    return ok

def candidates(lang):
    code, rx, keep1 = LANGS[lang]; rx = re.compile(rx); seen = set()
    for line in open(f'{SRC}{code}/{code}_full.txt', encoding='utf-8'):
        w = line.split(' ')[0].strip()
        w = unicodedata.normalize('NFC', w)
        if not w or w in seen or not rx.match(w) or len(w) > 30: continue
        if keep1 is not None and len(w) == 1 and w not in keep1: continue
        seen.add(w); yield w

def main():
    mode, langs = sys.argv[1], sys.argv[2:] or list(LANGS)
    ovr = json.load(open(OVR, encoding='utf-8')) if os.path.exists(OVR) else {}
    report = {}
    for lang in langs:
        ok = checker(lang); o = ovr.get(lang, {}); keep, drop = set(o.get('keep', [])), set(o.get('drop', []))
        out, rej, names, n = [], [], 0, 0
        for w in candidates(lang):
            n += 1
            if mode == 'review' and n > REVIEW_TOP: break
            r = True if w in keep else (None if w in drop else ok(w))
            if r is True: out.append(w)
            else:
                names += r == 'name'
                if mode == 'review' or len(rej) < 60: rej.append(w + ('*' if r == 'name' else ''))
            if len(out) == TARGET: break
        if mode == 'review':
            print(lang, len(rej), ' '.join(rej), flush=True); continue
        old = []
        for i in range(20): old += json.load(open(f'{OUT}{lang}/{i}.json', encoding='utf-8'))
        oldset = set(old)
        removed = [w for w in old if w not in set(out)]
        report[lang] = {'checked': n, 'kept': len(out), 'removed_from_old': len(removed), 'names': names, 'examples_removed': removed[:40], 'added_examples': [w for w in out if w not in oldset][:15]}
        os.makedirs(f'{OUT}{lang}', exist_ok=True)
        for i in range(0, len(out), CHUNK):
            json.dump(out[i:i + CHUNK], open(f'{OUT}{lang}/{i // CHUNK}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print(lang, json.dumps({k: v for k, v in report[lang].items() if k != 'examples_removed'}, ensure_ascii=False), flush=True)
    if mode == 'build':
        json.dump(report, open('/tmp/claude-0/-home-claude/b27c2e18-4a71-5b25-9402-cd64ae6b186d/scratchpad/report.json', 'w'), ensure_ascii=False, indent=1)

main()
