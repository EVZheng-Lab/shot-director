#!/usr/bin/env node
/**
 * build.mjs — 分镜本 JSON → 自包含 HTML（并做交付前的客观自检）
 *
 *   node scripts/build.mjs <分镜JSON> "<片名>" [--script <剧本纯文本.txt>]
 *   → Output/分镜本-<片名>.html                 （最新版，导演在这一页上批注）
 *   → Output/versions/分镜本-<片名>-v<N>.html   （每一版留档，N = meta.version）
 *
 * Human in the loop：导演在页面批注（scripts/serve.mjs 把批注存到 Output/notes/<片名>.json），
 * Agent 读批注 → 另存新版 JSON（meta.version +1，写 meta.changes）→ 重跑本脚本 →
 * 在批注文件里把处理过的条目标成 status:"done"、写 reply 和 doneIn。旧版 JSON 不覆盖。
 *
 * 只拦**客观错误**（台词漏了、tag 拼错、时长超上限、提示词混进内部编号……）。
 * 分镜好不好是主观的，交给 EV 看页面判断，脚本不碰。
 *
 * 资产 tag 一律继承 ad-asset-bible 的盘点 JSON（meta.bible 指向它）：
 * 分镜里出现的每个 @tag 都必须能在那份盘点里查到，下游才知道哪份资产用在了哪些镜头组。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = join(ROOT, 'templates', 'report-shell.html');
const OUTDIR = join(ROOT, 'Output');

/* 草图小人库（EV 11-08）：浏览器和这里共用 templates/poses.js */
globalThis.window = globalThis;
new Function(readFileSync(join(ROOT, 'templates', 'poses.js'), 'utf8'))();
const POSE_NAMES = Object.keys(globalThis.SketchKit.POSES);
const FACES = ['right', 'left', 'front', 'back', 'fl', 'fr'];
const SKETCH_SIZES = ['远景', '全景', '中景', '近景', '特写', '大特写'];
/* 人名运镜（EV 11-08）：名单只维护一处——references/09-人名运镜.md 第二节表格的第一列 */
const NAMED = (() => {
  const md = readFileSync(join(ROOT, 'references', '09-人名运镜.md'), 'utf8');
  const sec = md.slice(md.indexOf('## 二'), md.indexOf('## 三'));
  return sec.split(/\r?\n/).filter((l) => /^\|/.test(l) && !/^\|\s*(名字|---)/.test(l)).map((l) => l.split('|')[1].trim());
})();

/* ===== 模型与工艺 =====
 * 时长上限来自 15 期调研 Q60/Q61（2026-11-06）。Omni 按 EV 说的“单次固定 10 秒”取上限 10。
 * 首帧生视频与参考生视频在 Seedance / H3 / Wan 的 API 里互斥（官方原文），所以每个模型只登记它在本 Skill 里被派的工艺。 */
const MODELS = {
  omni: { name: 'Omni',   min: 3, max: 10, crafts: ['i2v'] },
  wan3: { name: 'Wan3.0', min: 2, max: 30, crafts: ['i2v', 'r2v'] },
  h3:   { name: 'H3',     min: 4, max: 15, crafts: ['r2v'] },
  sd20: { name: 'SD2.0',  min: 4, max: 15, crafts: ['r2v'] },
  sd25: { name: 'SD2.5',  min: 4, max: 30, crafts: ['r2v'] },
};
const CRAFTS = ['i2v', 'r2v'];
const LAYOUT_LEVELS = ['full', 'static', 'set'];
const GRID_CELLS = ['左上', '右上', '左下', '右下'];

/* 提示词里不许出现内部编号：模型没有上下文，看不懂场号组号（EV 11-06）。
   @imageN / @videoN 这类挂载引用要保留，不算。 */
const INTERNAL_ID_RE = /(?<![\d@\w\[])\d{1,3}-\d{1,2}[A-Z]?(?:-G\d+)?(?![\ds]|\s*[秒sS])|(?<![A-Za-z])G\d{1,2}(?![\d])/;
/* 挂了参考图就不写外观（EV 习惯）。只抓最露骨的服装描写。 */
const LOOK_RE = /身穿|穿着|穿一[件身套]|wearing|dressed in/i;
const REF_RE = /@(image|video|audio)(\d+)/g;

const args = process.argv.slice(2);
const scriptIdx = args.indexOf('--script');
const scriptPath = scriptIdx >= 0 ? args[scriptIdx + 1] : null;
const pos = args.filter((a, i) => !(scriptIdx >= 0 && (i === scriptIdx || i === scriptIdx + 1)));
const [jsonPath, titleArg] = pos;
if (!jsonPath) { console.error('用法：node scripts/build.mjs <分镜JSON> "<片名>" [--script <剧本.txt>]'); process.exit(2); }

const D = JSON.parse(readFileSync(jsonPath, 'utf8'));
const title = titleArg || D.meta?.title || '未命名';
const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);

/* ===== 资产盘点：tag → 名称 ===== */
const names = {};
let bibleOk = false;
if (D.meta?.bible && existsSync(D.meta.bible)) {
  const B = JSON.parse(readFileSync(D.meta.bible, 'utf8'));
  for (const k of ['assets', 'outfits', 'props']) for (const a of B[k] || []) {
    names[a.tag] = a.name;
    for (const v of a.variants || []) names[v.tag] = `${a.name} · ${v.name}`;
  }
  for (const c of B.characters || []) names[c.tag] = c.name;
  bibleOk = true;
} else {
  E(`meta.bible 指向的资产盘点不存在：${D.meta?.bible || '（没写）'} —— 分镜的资产 tag 必须继承副导演的盘点`);
}
const sceneOf = {};   // tag → 盘点里登记的场次
if (bibleOk) {
  const B0 = JSON.parse(readFileSync(D.meta.bible, 'utf8'));
  for (const k of ['assets', 'outfits', 'props']) for (const a of B0[k] || []) {
    sceneOf[a.tag] = a.scenes || [];
    for (const v of a.variants || []) sceneOf[v.tag] = v.scenes || [];
  }
}
const charBase = new Set();
if (bibleOk) { const B = JSON.parse(readFileSync(D.meta.bible, 'utf8')); for (const c of B.characters || []) charBase.add(c.tag); }
function checkTag(t, where) {
  if (!bibleOk || !t || !t.startsWith('@')) return;
  if (charBase.has(t)) E(`${where}：${t} 是角色底档，出图单元是“角色 + 一套服装”，要用 @char_<人>_<服装>`);
  else if (!names[t]) E(`${where}：${t} 在资产盘点里查不到（拼错了，或者该先让副导演补建）`);
}

/* ===== meta ===== */
for (const k of ['title', 'script', 'bible', 'aspect', 'stylePrefix']) if (!D.meta?.[k]) E(`meta.${k} 必填`);
const VER = D.meta?.version ?? 1;
if (!Number.isInteger(VER) || VER < 1) E('meta.version 要是从 1 开始的整数');
if (VER > 1 && !D.meta?.changes) E('第 2 版起 meta.changes 必填：这一版按批注改了什么');
/* EV 11-07：提示词一律中文（Skill 给大陆用户，方便读改）。Omni 官方只评估过英文，
   所以 Omni 组可以另附英文备用版 promptEn，有它就必须有英文前缀。 */
const hasEn = (D.groups || []).some((g) => g.promptEn);
if (hasEn && !D.meta?.stylePrefixEn) E('有英文备用提示词（promptEn）时 meta.stylePrefixEn 必填');

/* ===== 场 ===== */
const sceneIds = new Set();
for (const s of D.scenes || []) {
  const w = `场 ${s.id}`;
  if (!s.id) { E('有一场没写 id'); continue; }
  if (sceneIds.has(s.id)) E(`${w}：场号重复`);
  sceneIds.add(s.id);
  for (const k of ['name', 'loc', 'summary', 'splitReason']) if (!s[k]) E(`${w}：${k} 必填`);
  if (!s.anchor?.from || !s.anchor?.to) E(`${w}：原文锚点 anchor.from / anchor.to 必填（逐字摘原句）`);
  if (!(s.cast || []).length) W(`${w}：cast 为空（没有主要角色的场？确认一下）`);
  checkTag(s.loc, `${w} 地点`);
  for (const t of s.cast || []) checkTag(t, `${w} 演员`);
}
if (!sceneIds.size) E('scenes[] 至少要有一场');

/* ===== 镜头组 ===== */
const groupIds = new Set(), scenesWithGroups = new Set();
const namedUse = [];   // 人名运镜：一场最多一个（EV 11-08）
for (const g of D.groups || []) {
  const w = `镜头组 ${g.id}`;
  if (!g.id) { E('有一个镜头组没写 id'); continue; }
  if (groupIds.has(g.id)) E(`${w}：组号重复`);
  groupIds.add(g.id);
  if (!sceneIds.has(g.scene)) E(`${w}：scene=${g.scene} 不在 scenes[] 里`);
  scenesWithGroups.add(g.scene);

  const m = MODELS[g.model];
  if (!m) { E(`${w}：model=${g.model} 不认识（只认 ${Object.keys(MODELS).join(' / ')}）`); continue; }
  if (!CRAFTS.includes(g.craft)) E(`${w}：craft=${g.craft} 只能是 i2v / r2v`);
  else if (!m.crafts.includes(g.craft)) E(`${w}：${m.name} 在本 Skill 里不派 ${g.craft}`);
  if (typeof g.dur !== 'number' || g.dur < m.min || g.dur > m.max) E(`${w}：时长 ${g.dur} 秒超出 ${m.name} 单次范围 ${m.min}–${m.max} 秒`);
  if (!g.reason) E(`${w}：派活理由 reason 必填`);
  if (!g.prompt) { E(`${w}：视频提示词必填`); continue; }

  // 工艺字段
  if (g.craft === 'i2v') {
    if (!g.frame?.prompt) E(`${w}：首帧生视频必须给首帧生图提示词 frame.prompt`);
    for (const t of g.frame?.refs || []) checkTag(t, `${w} 首帧参考图`);
    if (g.frame?.mode === 'grid' && !GRID_CELLS.includes(g.frame.cell)) E(`${w}：宫格首帧必须写取哪一格（${GRID_CELLS.join(' / ')}）`);
    if ((g.refs || []).some((r) => /^@audio/.test(r.n))) E(`${w}：首帧生视频挂不了参考音频（官方互斥）`);
    if ((g.lines || []).length) W(`${w}：首帧档有台词——首帧模式锁不了声音，确认要这么派`);
  } else if (g.frame) E(`${w}：参考生视频不该有 frame（首帧和参考互斥）`);
  if (g.layout) {
    if (!LAYOUT_LEVELS.includes(g.layout.level)) E(`${w}：layout.level 只能是 ${LAYOUT_LEVELS.join(' / ')}`);
    if (!g.layout.prompt) E(`${w}：要 LAYOUT 就必须给 Blender MCP 提示词`);
  }

  // 资产
  for (const t of g.assets || []) checkTag(t, `${w} 资产`);
  const bs = (D.scenes || []).find((x) => x.id === g.scene)?.bibleScene || g.scene;
  for (const t of g.assets || []) if (sceneOf[t] && sceneOf[t].length && !sceneOf[t].includes(bs)) W(`${w}：${t} 在资产盘点里没登记场次 ${bs}（副导演漏登，还是用错了资产？）`);
  const assetSet = new Set(g.assets || []);
  // 挂载编号：从 1 连续；提示词里出现的和 refs 一一对应
  const declared = {};
  for (const r of g.refs || []) {
    const mm = /^@(image|video|audio)(\d+)$/.exec(r.n || '');
    if (!mm) { E(`${w}：挂载编号 ${r.n} 写法不对（@image1 / @video1 / @audio1）`); continue; }
    (declared[mm[1]] = declared[mm[1]] || []).push(+mm[2]);
    if (r.tag?.startsWith('@')) { checkTag(r.tag, `${w} 挂载 ${r.n}`); if (!assetSet.has(r.tag)) E(`${w}：挂载 ${r.n}=${r.tag} 不在这一组的 assets 里`); }
  }
  for (const [kind, ns] of Object.entries(declared)) {
    const sorted = [...ns].sort((a, b) => a - b);
    sorted.forEach((n, i) => { if (n !== i + 1) E(`${w}：@${kind} 编号要从 1 连续（现在是 ${sorted.join(',')}）`); });
  }
  const used = new Set([...g.prompt.matchAll(REF_RE)].map((x) => `@${x[1]}${x[2]}`));
  for (const r of g.refs || []) if (r.n && !used.has(r.n)) E(`${w}：挂了 ${r.n} 但提示词里没提到它`);
  for (const u of used) if (!(g.refs || []).some((r) => r.n === u)) E(`${w}：提示词里写了 ${u}，挂载顺序里没有`);

  // 提示词卫生
  // 场可以覆盖全局前缀（Shotlist 的 per-scene override：日景改掉夜景光线那一句）
  const sc = (D.scenes || []).find((x) => x.id === g.scene) || {};
  const prefix = sc.stylePrefix || D.meta?.stylePrefix;
  if (prefix && !g.prompt.startsWith(prefix)) E(`${w}：视频提示词没有以全局风格前缀开头`);
  if (g.promptEn) {
    if (g.model !== 'omni') E(`${w}：英文备用版只给 Omni，其它模型一律中文`);
    const pe = sc.stylePrefixEn || D.meta?.stylePrefixEn;
    if (pe && !g.promptEn.startsWith(pe)) E(`${w}：英文备用版没有以英文前缀开头`);
  }
  const idHit = INTERNAL_ID_RE.exec(g.prompt);
  if (idHit) E(`${w}：视频提示词里混进了内部编号“${idHit[0]}”——模型看不懂，删掉`);
  if (/屏幕|消息|短信|邮件|招牌|牌匾|横幅|信上|写着|字样/.test(g.prompt.replace(/“[^”]*”|\{[^}]*\}/g, '')) && !g.textRisk) W(`${w}：提示词里像有画面文字，确认的话填 textRisk（页面会标渲染风险）`);
  if (LOOK_RE.test(g.prompt) && (g.refs || []).some((r) => /^@char_/.test(r.tag || ''))) W(`${w}：挂了角色图，提示词里却像在写服装（${LOOK_RE.exec(g.prompt)[0]}）——挂图不写外观`);
  if (g.model === 'omni') {
    if (!/单镜头|一镜到底|不切镜|single continuous shot/i.test(g.prompt) && !/\[\s*0\s*-\s*\d+\s*s\s*\]|0\s*[-–]\s*\d+\s*秒/.test(g.prompt)) E(`${w}：Omni 默认会自己切镜——单镜头要写“单镜头，一镜到底，不切镜”，多镜头要用 [0-3s] 这样的时间码写分镜`);
    if (!/首帧|starting frame/i.test(g.prompt)) W(`${w}：Omni 首帧档建议写明“以这张图作为视频首帧”`);
  }
  if (g.model === 'wan3' && g.craft === 'i2v' && !/单镜头|一镜到底|多镜头|镜头\s*1|Shot0?1/.test(g.prompt)) W(`${w}：Wan3.0 会擅自切镜——首行写明“生成单镜头/一镜到底”，或写清分镜`);

  // 台词要导（EV 11-08）：标点、断句、中间插动作都可以，字不能动——提示词里的台词按顺序连起来要包含每一句
  if ((g.lines || []).length) {
    const said = norm([...g.prompt.matchAll(g.model === 'sd20' ? /\{([^}]*)\}/g : /“([^”]*)”/g)].map((x) => x[1]).join(''));
    let from = 0;
    for (const l of g.lines) {
      const t = norm(l.text);
      if (!t) continue;
      const k = said.indexOf(t, from);
      if (k >= 0) { from = k + t.length; continue; }
      (l.note ? W : E)(`${w}：台词在提示词里对不上（字被改了、没写进去，或台词符号用错）——${l.who}：${String(l.text).slice(0, 30)}`);
    }
  }

  // 反应镜头（EV 11-08，03 第四节之二）
  const charRefs = (g.refs || []).filter((r) => /^@char_/.test(r.tag || ''));
  if (g.craft === 'r2v' && (g.lines || []).length && charRefs.length >= 2 && !(g.reactions || []).length && !g.noReaction)
    E(`${w}：有台词、两个以上角色，却没有反应镜头——登记 reactions[]，或写 noReaction 说明为什么不给`);
  const shotText = {};
  for (const p of g.prompt.split(/(?=Shot\d+)/)) { const mm = /^Shot(\d+)/.exec(p); if (mm) shotText[+mm[1]] = p; }
  for (const r of g.reactions || []) {
    const p = shotText[+(/\d+/.exec(r.shot || '') || [])[0]];
    if (!p) { E(`${w}：reactions 登记的 ${r.shot} 在提示词里找不到`); continue; }
    if (r.who && !p.includes(r.who)) E(`${w}：${r.shot} 登记为 ${r.who} 的反应镜头，镜头里却没写到 ${r.who}`);
    if (/\{[^}]+\}|“[^”]+”/.test(p) && !/画外|背对镜头/.test(p)) W(`${w}：${r.shot} 是 ${r.who} 的反应镜头，里面有台词——如果是别人的台词垫在他脸上，要写明“画外”“嘴唇紧闭”（过肩写“背对镜头，嘴看不见”），不然模型会让他张嘴`);
  }

  // 草图（EV 11-08，03 第七节）：每个 Shot 一格，姿势取自姿势库；首尾格的左右和 edge 对账
  if (!(g.shots || []).length) E(`${w}：没有草图数据 shots[]（每个 Shot 一格，03 第七节）`);
  else {
    const nShot = Object.keys(shotText).length;
    if (nShot && g.shots.length !== nShot) E(`${w}：草图 ${g.shots.length} 格，提示词里有 ${nShot} 个 Shot，要一一对应`);
    g.shots.forEach((sh, i) => {
      const ws = `${w} 草图 ${sh.n || i + 1}`;
      if (sh.named) {
        if (!NAMED.includes(sh.named)) E(`${ws}：人名运镜“${sh.named}”不在 09 的运镜表里（名字照表第一列写）`);
        else if (!(shotText[i + 1] || g.prompt).includes(sh.named.replace('·', '·'))) W(`${ws}：登记了人名运镜“${sh.named}”，对应的 Shot 提示词里没写到这个名字（写法：中文名（英文名）：画面描述）`);
        if (!sh.namedWhy) E(`${ws}：用人名运镜要写 namedWhy——这一刻为什么配得上`);
        namedUse.push({ g: g.id, scene: g.scene, name: sh.named });
      }
      if (sh.cam && !/^(平视|俯拍|仰拍|顶拍|主观)$/.test(sh.cam)) E(`${ws}：cam 只能是 平视 / 俯拍 / 仰拍 / 顶拍 / 主观`);
      if (!SKETCH_SIZES.includes(sh.size)) E(`${ws}：景别“${sh.size}”只能是 ${SKETCH_SIZES.join(' / ')}`);
      for (const f of sh.figs || []) {
        if (!POSE_NAMES.includes(f.pose)) E(`${ws}：姿势“${f.pose}”不在姿势库里（可用：${POSE_NAMES.join(' ')}）`);
        if (f.face && !FACES.includes(f.face)) E(`${ws}：face 只能是 ${FACES.join(' / ')}`);
        if (typeof f.x !== 'number' || f.x < 0 || f.x > 1) E(`${ws}：${f.who} 的位置 x 要写 0–1（0 = 画面最左）`);
      }
    });
    const lrOf = (sh) => (sh.figs || []).slice().sort((a, b) => a.x - b.x).map((f) => f.who);
    const cmp = (sh, lr, k) => {
      const o = lrOf(sh).filter((n) => (lr || []).includes(n)), l = (lr || []).filter((n) => o.includes(n));
      if (o.join('|') !== l.join('|')) W(`${w}：草图${k}格从左到右是 ${lrOf(sh).join('、')}，edge 写的是 ${(lr || []).join('、')}，对不上`);
    };
    if (g.edge?.first) cmp(g.shots[0], g.edge.first.lr, '首');
    if (g.edge?.last) cmp(g.shots[g.shots.length - 1], g.edge.last.lr, '尾');
  }
}
for (const s of sceneIds) if (!scenesWithGroups.has(s)) E(`场 ${s}：一个镜头组都没有`);

/* ===== 平面图 + 站位锚（EV 11-09，03 第四节之三）=====
 * 每一场都要有平面图 blocking：俯视站位 + 场地固定物 + 这一场每个 Shot 的机位。一个阵型一张，阵型变了另起一张。
 * 平面图的意义是让组和组之间的左右、前后关系有据可查：草图里人的左右顺序要和“从这台机位看平面图”的顺序一致。
 * 同一多人阵型跨两个以上镜头组的，再标 anchor:true 做站位锚：写 Blender 静态站位提示词，相关组挂同一套站位图。 */
const chainOfB = (sid) => { const out = [sid]; let cur = (D.scenes || []).find((x) => x.id === sid); while (cur?.continues) { out.unshift(cur.continues); cur = (D.scenes || []).find((x) => x.id === cur.continues); } return out; };
const camOf = {};   // "组号 ShotNN" → 平面图
for (const sc of D.scenes || []) for (const b of sc.blocking || []) {
  const isAnchor = b.anchor === true || (b.anchor === undefined && !!b.prompt);
  const wb = `场 ${sc.id} ${isAnchor ? '站位锚' : '平面图'}“${b.name || b.id}”`;
  if (!b.id || !b.name) E(`${wb}：id、name 必填`);
  if (!(b.top || []).length) E(`${wb}：top[]（俯视站位）必填`);
  if (isAnchor && !b.prompt) E(`${wb}：要给 Blender MCP 提示词（静态站位，每台机位出一张站位图）`);
  if (!(b.cams || []).length) E(`${wb}：cams[] 必填——这一场哪几个 Shot 按这张图拍、机位在哪`);
  for (const t of b.top || []) {
    if ([t.x, t.y].some((v) => typeof v !== 'number' || v < 0 || v > 1)) E(`${wb}：${t.who} 的 x、y 要写 0–1`);
    if (t.to && !(Array.isArray(t.to) && t.to.length === 2 && t.to.every((v) => typeof v === 'number' && v >= 0 && v <= 1))) E(`${wb}：${t.who} 的 to 写成 [x, y]（0–1）`);
  }
  const groupsHit = new Set();
  for (const c of b.cams || []) {
    const mm = /^(\S+)\s+(.+)$/.exec(c.at || '');   // Omni 的分段写“组号 0–4 秒”
    if (!mm) { E(`${wb}：cams.at 写成“组号 ShotNN”或“组号 0–4 秒”（现在是“${c.at}”）`); continue; }
    if ([c.x, c.y].some((v) => typeof v !== 'number' || v < 0 || v > 1)) E(`${wb}：机位 ${c.at} 的 x、y 要写 0–1`);
    if (camOf[c.at]) E(`${wb}：${c.at} 已经画在“${camOf[c.at]}”上了，一个 Shot 只画一台机位`);
    camOf[c.at] = b.name;
    const g = (D.groups || []).find((x) => x.id === mm[1]);
    if (!g) { E(`${wb}：${mm[1]} 不是镜头组`); continue; }
    if (g.scene !== sc.id && !chainOfB(g.scene).includes(sc.id)) E(`${wb}：${mm[1]} 不在这一场`);
    groupsHit.add(g.id);
    const sh = (g.shots || []).find((x) => x.n === mm[2]);
    if (!sh) { E(`${wb}：${g.id} 的草图里没有 ${mm[2]}`); continue; }
    const want = globalThis.SketchKit.orderFrom(b, c);
    const have = (sh.figs || []).slice().sort((p, q) => p.x - q.x).map((f) => f.who).filter((n) => want.includes(n)).filter((n, i, arr) => i === 0 || arr[i - 1] !== n);
    const want2 = want.filter((n) => have.includes(n));
    if (have.join('|') !== want2.join('|')) E(`${wb}：${c.at} 的草图从左到右是 ${have.join('、')}，按平面图从这台机位看应该是 ${want2.join('、')}——草图、提示词和平面图对齐`);
    const off = (sh.figs || []).filter((f) => !(b.top || []).some((t) => t.who === f.who)).map((f) => f.who);
    if (off.length) W(`${wb}：${c.at} 的草图里有 ${[...new Set(off)].join('、')}，平面图上没有这个人`);
  }
  if (isAnchor) for (const gid of groupsHit) {
    const g = (D.groups || []).find((x) => x.id === gid);
    const r = (g.refs || []).find((x) => /站位图/.test(x.tag || '') && String(x.tag).includes(b.name));
    if (!r) E(`镜头组 ${gid}：要按站位锚“${b.name}”拍，挂载里没有它的站位图（refs 加一条，tag 写“站位图·${b.name}·<机位>”）`);
    else if (!new RegExp(r.n + '\\s*是[^。]*站位图').test(g.prompt)) E(`镜头组 ${gid}：挂了站位图 ${r.n}，提示词里要写明“${r.n} 是……站位图：只参考位置、前后排、朝向和机位构图……”`);
  }
}
/* 每一场都要有平面图；每个 Shot 都要在它这一场（或被集边界切开的上一段）的平面图上有机位 */
for (const sc of D.scenes || []) {
  const chain = chainOfB(sc.id);
  if (!chain.some((sid) => ((D.scenes || []).find((x) => x.id === sid)?.blocking || []).length)) E(`场 ${sc.id}：没有平面图（blocking），每一场都要画`);
}
for (const g of D.groups || []) (g.shots || []).forEach((sh, i) => {
  const at = `${g.id} ${sh.n || 'Shot' + String(i + 1).padStart(2, '0')}`;
  if (!camOf[at]) E(`镜头组 ${g.id}：${sh.n} 没画在平面图上——在这一场的 blocking 里给它加一台机位`);
});

{
  const rootOf = (sid) => { let cur = (D.scenes || []).find((x) => x.id === sid); while (cur?.continues) cur = (D.scenes || []).find((x) => x.id === cur.continues) || null; return cur?.id || sid; };
  const per = {};
  for (const u of namedUse) (per[rootOf(u.scene)] = per[rootOf(u.scene)] || []).push(u);
  for (const [sid, us] of Object.entries(per)) if (us.length > 1) E(`场 ${sid}：人名运镜一场最多一个，现在有 ${us.length} 个（${us.map((u) => `${u.g} ${u.name}`).join('、')}）`);
}

/* ===== 镜头组之间的衔接（EV 11-07）=====
 * 同一场里，上一组尾镜和下一组首镜直接剪在一起：景别至少隔一级、水平角度变化 > 30°、不越轴。 */
const SIZES = ['远景', '全景', '中景', '近景', '特写'];
const sizeIdx = (x) => { const i = SIZES.indexOf(String(x || '').replace('大特写', '特写')); return i; };
for (const g of D.groups || []) {
  const w = `镜头组 ${g.id}`;
  const e = g.edge;
  if (!e?.first || !e?.last) { E(`${w}：edge 必填（首镜、尾镜的景别 size、角度 angle、左右站位 lr），用来查组间衔接`); continue; }
  for (const [k, v] of [['首镜', e.first], ['尾镜', e.last]]) {
    if (sizeIdx(v.size) < 0) E(`${w}：${k}景别“${v.size}”只能是 ${SIZES.join(' / ')}`);
    if (typeof v.angle !== 'number' || v.angle < -180 || v.angle > 180) E(`${w}：${k}角度要写成 0–180 的数字（正面 0、斜侧 30、侧面 90、斜背 150、背面 180）`);
    if (!Array.isArray(v.lr)) E(`${w}：${k} lr 要写成从左到右的人名数组（空镜写 []）`);
  }
}
// 被集边界切开的同一场：后一场写 "continues": "<上一集末场号>"，两场当成一场查（交界 + 轴线）
const chainOf = (sid) => { const out = [sid]; let cur = (D.scenes || []).find((x) => x.id === sid);
  while (cur?.continues) { out.unshift(cur.continues); cur = (D.scenes || []).find((x) => x.id === cur.continues); } return out; };
const heads = [...sceneIds].filter((sid) => !(D.scenes || []).some((x) => x.continues === sid));
for (const s of heads) {
  const chain = chainOf(s);
  const gs = (D.groups || []).filter((g) => chain.includes(g.scene) && g.edge?.first && g.edge?.last)
    .sort((a, b) => chain.indexOf(a.scene) - chain.indexOf(b.scene));
  const order = {};   // 这场里每一对人的左右关系，第一次出现时定下
  const checkLR = (g, lr, where) => {
    for (let i = 0; i < lr.length; i++) for (let j = i + 1; j < lr.length; j++) {
      const a = lr[i], b = lr[j], key = [a, b].sort().join('|'), rel = a < b ? 'ab' : 'ba';
      if (!order[key]) order[key] = { rel, at: g.id };
      else if (order[key].rel !== rel) {
        if (g.axisChange) order[key] = { rel, at: g.id };
        else E(`镜头组 ${g.id}：${where}越轴——${a} 在 ${b} 左边，和 ${order[key].at} 定下的左右关系相反（确实要换边就写 axisChange 说明理由）`);
      }
    }
  };
  gs.forEach((g, i) => {
    checkLR(g, g.edge.first.lr || [], '首镜');
    checkLR(g, g.edge.last.lr || [], '尾镜');
    if (i === 0) return;
    const p = gs[i - 1].edge.last, c = g.edge.first, w = `${gs[i - 1].id} → ${g.id}`;
    // 景别、角度两条只管“同一主体”接同一主体（跳切）；换了主拍对象（正反打、切到插入特写）不查。subject 没填就照查。
    if (p.subject && c.subject && p.subject !== c.subject) return;
    const ds = Math.abs(sizeIdx(p.size) - sizeIdx(c.size));
    if (sizeIdx(p.size) >= 0 && sizeIdx(c.size) >= 0 && ds < 2) E(`${w}：交界处景别 ${p.size} 接 ${c.size}，至少要隔一级`);
    if (typeof p.angle === 'number' && typeof c.angle === 'number' && Math.abs(Math.abs(p.angle) - Math.abs(c.angle)) <= 30 && !((p.lr || []).length === 0 && (c.lr || []).length === 0)) E(`${w}：交界处角度 ${p.angle}° 接 ${c.angle}°，变化要大于 30°`);
  });
}

/* ===== 台词全覆盖（给了剧本纯文本才查）=====
 * 分镜漏台词已经发生过两次。按每场的原文锚点切出剧本片段，抽出“角色：台词”，
 * 逐句核对是否落在这一场的某个镜头组里。 */
function norm(s) { return String(s).replace(/（[^）]*）|\([^)]*\)/g, '').replace(/[\s，。,.!！?？…、“”"'‘’：:；;~—\-]/g, ''); }
let covered = 0;
if (scriptPath) {
  if (!existsSync(scriptPath)) E(`--script 指向的文件不存在：${scriptPath}`);
  else {
    const raw = readFileSync(scriptPath, 'utf8');
    for (const s of D.scenes || []) {
      if (!s.anchor?.from || !s.anchor?.to) continue;
      const a = raw.indexOf(s.anchor.from), b = raw.indexOf(s.anchor.to, Math.max(a, 0));
      if (a < 0) { E(`场 ${s.id}：起始锚点在剧本里找不到（要逐字摘原句）`); continue; }
      if (b < 0) { E(`场 ${s.id}：结束锚点在剧本里找不到（要逐字摘原句）`); continue; }
      const seg = raw.slice(a, b + s.anchor.to.length);
      // 抽台词：一行里可能有好几句（“△动作。甲：……乙：……”），说话人可能带空格后缀（“沈云卿 OS”“男人 1”），
      // 动作行有的剧本用 △、有的用 Δ。逐行按“说话人：”切段；折行的台词接回上一句。
      const SPK = /(?:^|(?<=[。！？!?…」”）)\s]))([^\s△Δ▲【：:（(，。！？、“”]{1,8}(?:\s?(?:OS|VO|os|vo|Os|\d{1,2}))?)(?:（[^）]*）|\([^)]*\))?\s*[：:]/g;
      const knownSpk = new Set([...seg.matchAll(/(?:^|\n)\s*([^\s△Δ▲【：:（(，。！？、“”]{1,8}?)(?:\s?(?:OS|VO|os|vo|\d{1,2}))?(?:（[^）]*）)?\s*[：:]/g)].map((m) => m[1]).filter((n) => n !== '人物'));
      const utter = [];
      for (const raw of seg.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
        let ln = raw;
        if (/^人物\s*[：:]/.test(raw)) {
          // “人物：……群众若干沈昭：好好好”——排版把换行吃掉了，台词粘在人物表后面。
          // 用剧本里其它地方出现过的说话人名去认粘住的那一个。
          const body = raw.replace(/^人物\s*[：:]/, '');
          const c = body.search(/[：:]/);
          if (c < 0) continue;
          const before = body.slice(0, c).replace(/（[^）]*）$/, '');
          const who = [...knownSpk].filter((n) => before.endsWith(n)).sort((x, y) => y.length - x.length)[0];
          if (!who) continue;
          ln = who + body.slice(c);
        }
        const hits = [...ln.matchAll(SPK)].filter((m) => !/^(人物|字幕|画外)$/.test(m[1]));
        if (!hits.length) {
          if (utter.length && !/^[△Δ▲【]|^\d+-\d+|^人物/.test(ln) && !/[：:]/.test(ln)
            && !/[。？！?!…」”）)]$/.test(utter[utter.length - 1].text.replace(/（[^）]*）$/, ''))) utter[utter.length - 1].text += ln;
          continue;
        }
        hits.forEach((m, i) => {
          const start = m.index + m[0].length;
          let end = i + 1 < hits.length ? hits[i + 1].index : ln.length;
          const d = ln.slice(start, end).search(/[△Δ▲]/);   // 台词后面接着动作行就截断
          if (d >= 0) end = start + d;
          const text = ln.slice(start, end).trim();
          if (text) utter.push({ who: m[1].trim(), text });
        });
      }
      // 按顺序一一对上：每句原文要消耗掉一句不同的分镜台词（防止短句“没事吧？”被长句里的同样几个字顶替）
      const have = [];
      for (const l of (D.groups || []).filter((g) => g.scene === s.id).flatMap((g) => g.lines || [])) {
        if (l.cont && have.length) have[have.length - 1] += norm(l.text);   // 长台词拆到两组：后半句标 cont，拼回前半句
        else have.push(norm(l.text));
      }
      const same = (h, t) => h === t || (t.length >= 6 && h.length >= 6 && (h.includes(t) || t.includes(h))) || (t.length >= 10 && h.slice(0, 10) === t.slice(0, 10));
      covered += utter.length;
      let p = 0;
      for (const u of utter) {
        const t = norm(u.text);
        if (t.length < 1) continue;
        let j = p; while (j < have.length && !same(have[j], t)) j++;
        if (j < have.length) { p = j + 1; continue; }
        const k = have.findIndex((h) => same(h, t));
        if (k >= 0) W(`场 ${s.id}：台词顺序和剧本不一致——${u.who}：${u.text.slice(0, 30)}`);
        else E(`场 ${s.id}：台词没分到任何镜头组——${u.who}：${u.text.slice(0, 30)}`);
      }
    }
  }
  console.log(`台词核对：剧本里抽出 ${covered} 句，逐句查过`);
} else W('没给 --script，跳过“台词全覆盖”检查');

/* ===== 输出 ===== */
for (const w of warns) console.log('⚠ ' + w);
if (errors.length) {
  for (const e of errors) console.log('✗ ' + e);
  console.log(`\n自检没过：${errors.length} 处错误。改 JSON 再跑，不要绕过。`);
  process.exit(1);
}
const shell = readFileSync(SHELL, 'utf8');
const payload = JSON.stringify({ ...D, doc: title, assetNames: names }).replace(/<\//g, '<\\/');
const posesJs = readFileSync(join(ROOT, 'templates', 'poses.js'), 'utf8').replace(/<\//g, '<\\/');
/* 资产盘点标签页（EV 11-09）：把副导演出的资产盘点页面整份嵌进来，页面顶部两个标签页切换。
 * 默认找 <盘点JSON 上两级>/Output/资产盘点-<盘点JSON 名去掉“-盘点”>.html；找不到可在 meta.bibleHtml 里写明路径。 */
let bibleHtml = '';
if (D.meta?.bible) {
  const guess = join(dirname(dirname(D.meta.bible)), 'Output', '资产盘点-' + basename(D.meta.bible, '.json').replace(/-盘点$/, '') + '.html');
  const bh = D.meta.bibleHtml || guess;
  if (existsSync(bh)) {
    bibleHtml = readFileSync(bh, 'utf8');
    if (statSync(bh).mtimeMs < statSync(D.meta.bible).mtimeMs) console.log(`⚠ 资产盘点页面比盘点 JSON 旧，先在 ad-asset-bible 里重新出页面：${bh}`);
  } else console.log(`⚠ 没找到资产盘点页面（${bh}），“资产盘点”标签页会空着；在 meta.bibleHtml 里写明路径`);
}
const biblePayload = JSON.stringify(bibleHtml).replace(/<\//g, '<\/');
const html = shell.replace('{{DATA_JSON}}', () => payload).replace('{{POSES_JS}}', () => posesJs).replace('{{BIBLE_HTML}}', () => biblePayload).replaceAll('{{TITLE}}', title);
mkdirSync(OUTDIR, { recursive: true });
const outFile = join(OUTDIR, `分镜本-${title}.html`);
writeFileSync(outFile, html, 'utf8');
mkdirSync(join(OUTDIR, 'versions'), { recursive: true });
const verFile = join(OUTDIR, 'versions', `分镜本-${title}-v${VER}.html`);
writeFileSync(verFile, html, 'utf8');
const cnt = {}; for (const g of D.groups) cnt[g.model] = (cnt[g.model] || 0) + 1;
console.log(`✓ ${D.scenes.length} 场 · ${D.groups.length} 个镜头组（${Object.entries(cnt).map(([k, v]) => `${MODELS[k].name} ${v}`).join(' / ')}）`);
console.log(`→ ${outFile}（第 ${VER} 版，留档 ${verFile}）`);
const nf = join(OUTDIR, 'notes', `${title.replace(/[\\/:*?"<>|]/g, '_')}.json`);
if (existsSync(nf)) {
  const N = JSON.parse(readFileSync(nf, 'utf8'));
  const open = Object.entries(N).filter(([, n]) => n.text && n.status !== 'done');
  const gone = open.filter(([id]) => !groupIds.has(id) && !sceneIds.has(id));
  console.log(`批注：还有 ${open.length} 条没处理` + (gone.length ? `；其中 ${gone.length} 条对应的组号这一版已经没有了（${gone.map(([id]) => id).join('、')}），处理后记得标 done` : ''));
}
console.log(`P="file:///${outFile.replace(/\\/g, '/')}"`);
