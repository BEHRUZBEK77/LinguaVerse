#!/usr/bin/env bash
# Sado Studio ovoz modellari (erkak ovoz): o'zbekcha MMS + chet tillar uchun Piper
set -e
D="${1:-$HOME/.sado-models}"; mkdir -p "$D"
get(){ [ -s "$D/$2" ] || curl -sfL --retry 3 -o "$D/$2" "$1"; }
mkdir -p "$D/uz-mms"
get https://huggingface.co/davron112/mms-tts-uzb-cyrl-onnx/resolve/6c407c05fa87c2e2783acf684227cec4966c63fd/onnx/model.onnx uz-mms/model.onnx
get https://huggingface.co/davron112/mms-tts-uzb-cyrl-onnx/resolve/6c407c05fa87c2e2783acf684227cec4966c63fd/vocab.json uz-mms/vocab.json
P=https://huggingface.co/rhasspy/piper-voices/resolve/e7229f7d33a10e145e109b886d661984201ac3c4
for v in en/en_US/libritts/high/en_US-libritts-high ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium de/de_DE/mls/medium/de_DE-mls-medium es/es_ES/sharvard/medium/es_ES-sharvard-medium tr/tr_TR/dfki/medium/tr_TR-dfki-medium ar/ar_JO/kareem/medium/ar_JO-kareem-medium zh/zh_CN/huayan/medium/zh_CN-huayan-medium; do
  n=$(basename $v); get "$P/$v.onnx" "$n.onnx"; get "$P/$v.onnx.json" "$n.onnx.json"
done
ls -la "$D"
