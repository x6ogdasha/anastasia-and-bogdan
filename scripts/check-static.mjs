import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'public/index.html',
  'public/app.js',
  'public/assets/couple-new-v2.png',
  'public/assets/couple-program-v3.png',
  'public/assets/couple-original.png',
  'public/assets/bad-script-regular.ttf',
  'public/assets/neucha-regular.ttf',
];

await Promise.all(requiredFiles.map((file) => access(file)));
const html = await readFile('public/index.html', 'utf8');

for (const marker of [
  'id="rsvpForm"',
  'src="app.js"',
  'name="attendance"',
  'name="drink"',
  'animation: vinyl-spin 7s linear infinite',
  '@keyframes vinyl-spin',
]) {
  if (!html.includes(marker)) throw new Error(`В index.html отсутствует ${marker}`);
}

console.log('Static invitation files are complete.');
