"""Minimal hunspell-compatible word checker (affix stripping, twofold suffixes,
prefix+suffix cross product, AF aliases, IGNORE, ICONV). Data only — no external code."""
import re, sys, json, unicodedata

class Hun:
    def __init__(self, aff, dic):
        self.maxdepth = 1; self.flagtype = 'char'; self.af = []; self.ignore = ''; self.iconv = []
        self.sfx = {}; self.pfx = {}; self.special = set()
        lines = open(aff, encoding='utf-8', errors='replace').read().split('\n')
        i = 0; hdr = {}
        while i < len(lines):
            t = lines[i].split(); i += 1
            if not t or t[0].startswith('#'): continue
            k = t[0]
            if k == 'FLAG' and len(t) > 1: self.flagtype = {'long': 'long', 'num': 'num'}.get(t[1], 'char')
            elif k == 'AF' and len(t) > 1 and not t[1].isdigit(): self.af.append(t[1])
            elif k == 'AF' and len(t) > 1 and t[1].isdigit() and not self.af and len(t) == 2: pass
            elif k == 'IGNORE' and len(t) > 1: self.ignore = t[1]
            elif k == 'ICONV' and len(t) == 3: self.iconv.append((t[1], t[2]))
            elif k in ('NEEDAFFIX', 'ONLYINCOMPOUND', 'FORBIDDENWORD') and len(t) > 1:
                self.special.update(self.flags(t[1], alias=False))
            elif k in ('SFX', 'PFX') and len(t) >= 4:
                if len(t) == 4 and t[3].isdigit() and t[2] in ('Y', 'N'):
                    hdr[(k, t[1])] = t[2] == 'Y'; continue
                flag = self.flag1(t[1]); strip = '' if t[2] == '0' else t[2]
                add = t[3]; cont = set()
                if '/' in add: add, c = add.split('/', 1); cont = self.flags(c)
                if add == '0': add = ''
                add = self.ig(add); cond = t[4] if len(t) > 4 else '.'
                rx = (('^' + cond) if k == 'PFX' else (cond + '$')) if cond != '.' else None
                rule = [flag, strip, add, rx, cont, hdr.get((k, t[1]), False)]
                (self.sfx if k == 'SFX' else self.pfx).setdefault(add, []).append(rule)
        self.iconv.sort(key=lambda x: -len(x[0]))
        self.ic = {a: b for a, b in self.iconv}
        cache = {}
        for table in (self.sfx, self.pfx):
            for add in list(table):
                rules = []
                for r in table[add]:
                    if r[3] is not None:
                        pat = self.conv(r[3])
                        if pat not in cache:
                            try: cache[pat] = re.compile(pat)
                            except re.error: cache[pat] = None
                        r[3] = cache[pat]
                    r[1] = self.conv(r[1])
                    rules.append(tuple(r))
                table.pop(add); table[self.conv(add)] = table.get(self.conv(add), []) + rules
        self.words = {}
        with open(dic, encoding='utf-8', errors='replace') as f:
            next(f, None)
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                tok = re.split(r'[\t ]', line, 1)[0]
                if '/' in tok: w, fl = tok.split('/', 1); fs = self.flags(fl)
                else: w, fs = tok, set()
                w = self.ig(w)
                self.words.setdefault(w, set()).update(fs)

    def flag1(self, s):
        return s
    def flags(self, s, alias=True):
        if alias and self.af and s.isdigit() and 0 < int(s) <= len(self.af):
            s = self.af[int(s) - 1]
        if self.flagtype == 'long': return {s[i:i + 2] for i in range(0, len(s), 2)}
        if self.flagtype == 'num': return set(x for x in s.split(',') if x)
        return set(s)
    def ig(self, w):
        return ''.join(c for c in w if c not in self.ignore) if self.ignore else w
    def conv(self, w):
        if not self.ic: return w
        return ''.join(self.ic.get(c, c) for c in w)

    def stem_ok(self, s, flag, extra=None):
        fs = self.words.get(s)
        if fs is None or flag not in fs: return False
        if extra and not (extra <= fs): return False
        return True
    def plain(self, w):
        fs = self.words.get(w)
        return fs is not None and not (fs & self.special)
    def suffixed(self, w, need=None, depth=0):
        # need: flag that a matched suffix rule's continuation must contain (twofold)
        n = len(w)
        for k in range(0, n + 1):
            add = w[k:]
            for (flag, strip, a, rx, cont, cross) in self.sfx.get(add, ()):
                if need and need not in cont: continue
                s = w[:k] + strip
                if not s or (rx and not rx.search(s)): continue
                if s in self.words and flag in self.words[s] and not (self.words[s] & {'FORBID'}): return (flag, cross)
                if depth < self.maxdepth and self.suffixed(s, flag, depth + 1): return (flag, cross)
        return None
    def check(self, word):
        w = self.conv(self.ig(word))
        if self.plain(w): return True
        if self.suffixed(w): return True
        for k in range(1, len(w)):
            for (pflag, strip, a, rx, cont, pcross) in self.pfx.get(w[:k], ()):
                r = strip + w[k:]
                if rx and not rx.search(r): continue
                if r in self.words and pflag in self.words[r]: return True
                # prefix + suffix
                n = len(r)
                for j in range(0, n + 1):
                    for (sflag, sstrip, sa, srx, scont, scross) in self.sfx.get(r[j:], ()):
                        s = r[:j] + sstrip
                        if not s or (srx and not srx.search(s)): continue
                        fs = self.words.get(s)
                        if fs and sflag in fs and (pflag in fs and pcross and scross or pflag in scont): return True
        for (pflag, strip, a, rx, cont, pcross) in self.pfx.get('', ()):
            pass
        return False

def ko_ok(h, word, memo=None):
    """Korean: hunspell check, else split into <=3 dictionary pieces (syllable boundaries)."""
    if h.check(word): return True
    syl = list(word)
    def part(p): 
        c = h.conv(p); return c in h.words or h.check(p)
    n = len(syl)
    for i in range(1, n):
        a = ''.join(syl[:i]); b = ''.join(syl[i:])
        if not part(a): continue
        if part(b) and (len(a) > 1 or len(b) > 1): return True
        for j in range(i + 1, n):
            b1 = ''.join(syl[i:j]); c = ''.join(syl[j:])
            if part(b1) and part(c) and max(len(a), len(b1), len(c)) > 1: return True
    return False
