#!/usr/bin/env python3
# O'zbekcha MMS ovoz (Sado Studio bilan bir xil): stdin matn → WAV (16 kHz)
#   python3 scripts/tts/mms.py <model_papka> <chiqish.wav> < matn.txt
# Model: facebook/mms-tts-uzb-script_cyrillic (ONNX eksporti davron112/mms-tts-uzb-cyrl-onnx)
import json, re, sys, wave
import numpy as np, onnxruntime as ort

L = {'a':'а','b':'б','d':'д','e':'е','f':'ф','g':'г','h':'ҳ','i':'и','j':'ж','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п','q':'қ','r':'р','s':'с','t':'т','u':'у','v':'в','x':'х','y':'й','z':'з',"'":'ъ','c':'к','w':'в'}
DIG = ['nol','bir','ikki','uch',"to'rt",'besh','olti','yetti','sakkiz',"to'qqiz"]
TENS = ['',"o'n",'yigirma',"o'ttiz",'qirq','ellik','oltmish','yetmish','sakson',"to'qson"]

def number(raw):
    n = int(raw)
    if len(raw) > 12 or (len(raw) > 1 and raw[0] == '0'): return ' '.join(DIG[int(c)] for c in raw)
    if n == 0: return DIG[0]
    out, scales, i = [], ['', 'ming', 'million', 'milliard'], 0
    while n:
        g = n % 1000
        if g:
            h, t, u = g // 100, g // 10 % 10, g % 10
            out.insert(0, ' '.join(x for x in [DIG[h] + ' yuz' if h else '', TENS[t], DIG[u] if u else '', scales[i]] if x))
        n //= 1000; i += 1
    return ' '.join(out)

def cyr(s):
    s = re.sub(r"[‘’ʻʼ`]", "'", s.lower())
    s = re.sub(r'\d+', lambda m: number(m.group()), s)
    s = re.sub(r"(^|[^\w'])e", r"\1э", s)
    for a, b in [("o'", 'ў'), ("g'", 'ғ'), ('sh', 'ш'), ('ch', 'ч'), ('yo', 'ё'), ('yu', 'ю'), ('ya', 'я'), ('ye', 'е')]:
        s = s.replace(a, b)
    return ''.join(L.get(c, c) for c in s)

def main():
    d, out = sys.argv[1], sys.argv[2]
    text = sys.stdin.read()
    vocab = json.load(open(d + '/vocab.json', encoding='utf-8'))
    so = ort.SessionOptions(); so.intra_op_num_threads = 2
    sess = ort.InferenceSession(d + '/model.onnx', so)
    names = [i.name for i in sess.get_inputs()]
    pcm = []
    for sent in re.split(r'(?<=[.!?:;])\s+', text.strip()):
        ids = [0]
        for ch in cyr(sent):
            if ch in vocab: ids += [vocab[ch], 0]
        if len(ids) < 3: continue
        feeds = {'input_ids': np.array([ids], dtype=np.int64)}
        if 'attention_mask' in names: feeds['attention_mask'] = np.ones((1, len(ids)), dtype=np.int64)
        y = sess.run(None, feeds)[0].reshape(-1).astype(np.float32)
        pcm += [y, np.zeros(3200, dtype=np.float32)]          # 0.2 s gap orasida
    y = np.concatenate(pcm) if pcm else np.zeros(1600, dtype=np.float32)
    y = (np.clip(y / max(1e-6, float(np.abs(y).max())) * 0.9, -1, 1) * 32767).astype('<i2')
    w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(y.tobytes()); w.close()

if __name__ == '__main__':
    main()
