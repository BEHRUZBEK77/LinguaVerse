#!/usr/bin/env python3
"""MeloTTS (MIT) — koreyscha ovoz. Modelni bir marta yuklaydi, stdin'dan JSON qatorlarini o'qiydi:
  {"text": "...", "out": "/path.wav", "speed": 1.0}   →  stdout'ga "ok" yoki "err <xabar>"
Ishlatish: python3 scripts/tts/melo_server.py KR
"""
import sys, json, os
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
lang = sys.argv[1] if len(sys.argv) > 1 else "KR"
from melo.api import TTS
model = TTS(language=lang, device="cpu")
spk = model.hps.data.spk2id[lang]
print("ready", flush=True)
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
        model.tts_to_file(req["text"], spk, req["out"], speed=float(req.get("speed", 1.0)), quiet=True)
        print("ok", flush=True)
    except Exception as e:  # noqa
        print("err " + str(e).replace("\n", " ")[:300], flush=True)
