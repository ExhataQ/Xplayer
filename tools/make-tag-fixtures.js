'use strict';

// Makes the small real audio files used by tools/tests/tag-parity.test.js (a quarter second of silence each, a few KB).
// Needs ffmpeg on PATH. Run once and commit the result; the tests never need ffmpeg.
//   node tools/make-tag-fixtures.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, 'tests', 'fixtures', 'audio');
fs.mkdirSync(out, { recursive: true });
const TAGS = ['title=Fixture Song', 'artist=Earth, Wind & Fire', 'album=Fixture Album', 'genre=Funk', 'track=7/13', 'comment=fixture comment', 'date=1977'];
const jobs = [
    ['tone.mp3', ['-c:a', 'libmp3lame', '-b:a', '64k', '-id3v2_version', '4', '-write_id3v1', '0'], true],
    ['tone.flac', ['-c:a', 'flac'], true],
    ['tone.ogg', ['-c:a', 'libvorbis', '-q:a', '0'], true],
    ['tone.opus', ['-c:a', 'libopus', '-b:a', '24k'], true],
    ['tone.wav', ['-c:a', 'pcm_s16le', '-ar', '8000'], false] // no ID3 chunk: a bare WAV, tags are created on the first save
];
for (const [name, codec, tagged] of jobs) {
    const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', '0.25', ...codec];
    if (tagged) for (const t of TAGS) args.push('-metadata', t);
    args.push(path.join(out, name));
    const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
    if (r.status !== 0) { console.error(name, r.stderr || r.error); process.exit(1); }
}
// A 1x1 PNG for the cover tests (fixed bytes, so no image tool is needed).
fs.writeFileSync(path.join(out, 'cover.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'));
console.log('written to', out);
