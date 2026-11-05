const safeText = text => String(text || '').replace(/-->/g, '→').replace(/[<>]/g, '').replace(/\r/g, '');
export function vttTime(seconds) {
  const ms = Math.max(0, Math.round(Number(seconds) * 1000) || 0);
  return `${String(Math.floor(ms / 3600000)).padStart(2,'0')}:${String(Math.floor(ms / 60000) % 60).padStart(2,'0')}:${String(Math.floor(ms / 1000) % 60).padStart(2,'0')}.${String(ms % 1000).padStart(3,'0')}`;
}
export function captionsVtt(cues, track = 'native') {
  return 'WEBVTT\n\n' + (cues || []).filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start && c[track]).map((c,i) => `${i+1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${safeText(c[track])}\n`).join('\n');
}
export function videoMetadata(scenes) {
  return {
    chapters: scenes.filter((s,i) => !i || s.lessonScene !== scenes[i-1].lessonScene).map(s => ({title:s.title, start:s.start})),
    captions: scenes.map(s => ({start:s.audioStart,end:s.audioEnd,target:s.nativeSpeech ? '' : s.say,native:s.nativeSpeech ? s.say : s.say_uz}))
  };
}
