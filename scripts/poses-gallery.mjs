// 姿势库预览页：node scripts/poses-gallery.mjs → Output/姿势库.html
// 每个姿势画一格；下面再画几格示例镜头（景别、过肩、运镜图标），用来审小人画得像不像。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(ROOT, 'templates', 'poses.js'), 'utf8');
globalThis.window = globalThis;
new Function(js)();
const K = globalThis.SketchKit;

const cell = (name, p) => {
  const sk = K.skeleton(p);
  const s = 12, w = 150, h = 140;
  const fig = K.figure(name, { x: w / 2 - ((sk.minX + sk.maxX) / 2) * s, y: h - 14, s, color: '#60a5fa' });
  return `<figure><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><line x1="0" x2="${w}" y1="${h - 14}" y2="${h - 14}" stroke="#2c3238"/>${fig}</svg><figcaption><b>${p.label}</b><code>${name}</code></figcaption></figure>`;
};

const COL = { 沈云卿: '#60a5fa', 沈云乔: '#f472b6', 慕若安: '#34d399' };
const colorOf = (n) => COL[n] || '#9aa4ae';
const demo = [
  { n: 'Shot01', size: '远景', move: '固定', figs: [{ who: '沈云卿', pose: 'walk', x: 0.35 }, { who: '沈云乔', pose: 'stand', face: 'left', x: 0.62 }] },
  { n: 'Shot02', size: '全景', move: '缓慢推近', figs: [{ who: '沈云乔', pose: 'point', face: 'right', x: 0.32 }, { who: '沈云卿', pose: 'cower', face: 'left', x: 0.7 }] },
  { n: 'Shot03', size: '中景', move: '固定', figs: [{ who: '沈云卿', pose: 'stand_f', face: 'fr', x: 0.5 }] },
  { n: 'Shot04', size: '近景', move: '手持', figs: [{ who: '沈云卿', pose: 'bow', face: 'left', x: 0.5 }] },
  { n: 'Shot05', size: '特写', move: '固定', figs: [{ who: '沈云乔', pose: 'stand_f', face: 'front', x: 0.5 }] },
  { n: 'Shot06', size: '近景', move: '固定', figs: [{ who: '沈云乔', pose: 'stand_f', face: 'back', x: 0.2, s: 1.35 }, { who: '沈云卿', pose: 'stand_f', face: 'fl', x: 0.68 }] },
  { n: 'Shot07', size: '全景', move: '迈克尔·贝环绕', figs: [{ who: '慕若安', pose: 'stand_f', x: 0.5 }] },
  { n: 'Shot08', size: '中景', move: '固定', figs: [{ who: '沈云卿', pose: 'give', x: 0.22 }, { who: '慕若安', pose: 'reach', face: 'left', x: 0.8 }], props: [{ name: '剑', x: 0.52, y: 0.62 }] },
];
const frames = demo.map((s) => `<div class="fr">${K.frame(s, { w: 132, h: 235, colorOf })}</div>`).join('');
const side = Object.entries(K.POSES).filter(([, p]) => p.view !== 'front').map(([n, p]) => cell(n, p)).join('');
const front = Object.entries(K.POSES).filter(([, p]) => p.view === 'front').map(([n, p]) => cell(n, p)).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>姿势库 · 分镜草图小人</title>
<style>
body{margin:0;padding:20px 16px;background:#0f1113;color:#e6e9ec;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px;color:#cbd5e1}
p{color:#8b949e;margin:0 0 8px;max-width:820px}
.grid{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;background:#171a1d;border:1px solid #2a2f35;border-radius:8px;padding:6px}
figcaption{display:flex;justify-content:space-between;gap:6px;font-size:13px;padding:0 4px}
figcaption code{color:#6b7480;font-size:12px}
.fr{background:#171a1d;border:1px solid #2a2f35;border-radius:8px;padding:6px}
</style></head><body>
<h1>姿势库</h1>
<p>分镜本里每个镜头的草图用这套图标小人拼。头上的橙点 = 脸朝向（侧面在脸那侧；正面在脸中间；背面没有橙点；四分之三侧在偏左/偏右）。颜色区分角色，远侧手脚画淡色。</p>
<h2>侧面（默认脸朝右，可镜像朝左）</h2><div class="grid">${side}</div>
<h2>正面（脸朝前 / 背对 / 四分之三侧）</h2><div class="grid">${front}</div>
<h2>示例镜头（竖屏 9:16）：远景 · 全景 · 中景 · 近景 · 特写 · 过肩 · 运镜图标 · 道具</h2><div class="grid">${frames}</div>
</body></html>`;
const out = join(ROOT, 'Output', '姿势库.html');
writeFileSync(out, html, 'utf8');
console.log(out);
