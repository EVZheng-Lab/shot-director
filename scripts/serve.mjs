#!/usr/bin/env node
/**
 * serve.mjs — 分镜本的本地服务：静态页面 + 批注读写
 *
 *   PORT=3051 node scripts/serve.mjs      （服务控制台用 %PORT% 注入）
 *
 * 为什么不用纯静态：导演在页面上写的批注要**落到磁盘**，Agent 才能直接读到、按批注改出下一版。
 * 只存浏览器本地的话，批注困在那台电脑的浏览器里，Agent 看不见。
 *
 *   GET  /api/notes?doc=<片名>   → Output/notes/<片名>.json（没有就返回 {}）
 *   PUT  /api/notes?doc=<片名>   ← 整份批注 JSON（页面自动保存）
 *   其余路径                      → Output/ 下的静态文件
 *
 * 批注文件格式（Agent 读写同一份）：
 *   { "<组号或场号>": { "text": "导演意见", "ts": "ISO 时间", "version": 1,
 *                      "status": "open" | "done", "reply": "Agent 改了什么", "doneIn": 2 } }
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, normalize, sep } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Output');
const NOTES = join(OUT, 'notes');
const PORT = +process.env.PORT || 3051;
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const safeDoc = (d) => String(d || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);

createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/notes') {
    const doc = safeDoc(u.searchParams.get('doc'));
    if (!doc) { res.writeHead(400); return res.end('doc required'); }
    const f = join(NOTES, doc + '.json');
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
      return res.end(existsSync(f) ? readFileSync(f) : '{}');
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
      req.on('end', () => {
        try {
          const obj = JSON.parse(body);
          mkdirSync(NOTES, { recursive: true });
          const tmp = f + '.tmp';
          writeFileSync(tmp, JSON.stringify(obj, null, 1), 'utf8');
          renameSync(tmp, f);   // 先写临时文件再改名，写到一半断电也不会把整份批注弄坏
          res.writeHead(200, { 'Content-Type': TYPES['.json'] }); res.end('{"ok":true}');
        } catch (e) { res.writeHead(400); res.end('bad json'); }
      });
      return;
    }
    res.writeHead(405); return res.end();
  }
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const f = normalize(join(OUT, p));
  if (!f.startsWith(OUT + sep) && f !== OUT) { res.writeHead(403); return res.end(); }
  if (p === '/index.html' && !existsSync(f)) {
    // 没有首页时列出所有分镜本
    const list = readdirSync(OUT).filter((n) => n.endsWith('.html')).sort();
    res.writeHead(200, { 'Content-Type': TYPES['.html'] });
    return res.end('<meta charset="utf-8"><title>分镜本</title><body style="font:15px sans-serif;background:#0f1113;color:#e7e9ea;padding:24px"><h2>分镜本</h2>'
      + list.map((n) => `<p><a style="color:#c8975a" href="${encodeURI(n)}">${n}</a></p>`).join('') + '</body>');
  }
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(f));
}).listen(PORT, '0.0.0.0', () => console.log(`分镜本服务 http://0.0.0.0:${PORT}`));
