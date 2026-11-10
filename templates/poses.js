/* 姿势小人库 + 分镜草图（EV 11-08）
 * 图标小人，不是真人：头 + 粗线四肢，按角色上色；头上的橙点 = 脸朝向（沿用 LAYOUT 小人“橙色 = 正面”）。
 * 姿势用 2D 关节角定义，加一个姿势 = 在 POSES 里加一行。build.mjs 把本文件内联进分镜本页面；
 * scripts/poses-gallery.mjs 用它生成「姿势库」预览页。
 *
 * 角度约定（单位：度）：
 *   侧面姿势（view:'side'，默认脸朝右）：四肢角 0 = 竖直向下，正数 = 往脸的方向转（90 = 水平向前，180 = 竖直向上），
 *     负数 = 往背后转。arms/legs 各两条：[0] 近侧（实色）、[1] 远侧（淡色），每条 [上臂/大腿, 前臂/小腿]，都是绝对角。
 *     torso：躯干前倾角（0 = 直立，90 = 向前趴平）；head：低头角（正 = 低头，负 = 仰头）。
 *   正面姿势（view:'front'）：四肢角 0 = 竖直向下，正数 = 往外张开，负数 = 往身体中线收；[0] 画面左、[1] 画面右。
 */
(function (root) {
  var L = { torso: 2.7, neck: 0.15, headR: 0.62, upper: 1.45, fore: 1.35, thigh: 1.95, shin: 1.95 };
  var W = { limb: 0.62, torso: 1.05 };

  var POSES = {
    // —— 侧面 ——
    stand:      { label: '站', view: 'side', torso: 0, head: 0, arms: [[-6, 2], [6, 10]], legs: [[4, 0], [-4, 0]] },
    walk:       { label: '走', view: 'side', torso: 4, head: 0, arms: [[-28, -12], [26, 45]], legs: [[24, 4], [-20, -38]] },
    run:        { label: '跑', view: 'side', torso: 16, head: -4, arms: [[48, 125], [-55, 15]], legs: [[62, -8], [-35, -105]] },
    sit:        { label: '坐', view: 'side', torso: -3, head: 4, arms: [[22, 82], [18, 80]], legs: [[90, 0], [86, -4]], seat: true },
    kneel:      { label: '跪', view: 'side', torso: 0, head: 10, arms: [[4, 6], [-4, 4]], legs: [[0, -90], [-3, -92]] },
    kneel1:     { label: '单膝跪', view: 'side', torso: 4, head: 6, arms: [[30, 75], [-8, 0]], legs: [[90, 0], [0, -90]] },
    crouch:     { label: '蹲', view: 'side', torso: 28, head: -6, arms: [[62, 92], [55, 85]], legs: [[100, -25], [95, -30]] },
    lie:        { label: '躺', view: 'side', torso: 90, head: 0, arms: [[-88, -90], [-92, -90]], legs: [[-90, -90], [-88, -92]] },
    curl:       { label: '倒地蜷缩', view: 'side', torso: 92, head: 25, arms: [[10, 70], [20, 80]], legs: [[-30, -150], [-40, -160]] },
    fall:       { label: '摔倒', view: 'side', torso: -35, head: -10, arms: [[140, 165], [120, 150]], legs: [[45, 15], [20, -15]] },
    point:      { label: '指', view: 'side', torso: 0, head: 0, arms: [[88, 90], [-4, 4]], legs: [[4, 0], [-4, 0]] },
    raise:      { label: '举手/举物', view: 'side', torso: -2, head: -8, arms: [[172, 176], [-4, 4]], legs: [[4, 0], [-4, 0]] },
    give:       { label: '递东西', view: 'side', torso: 8, head: 6, arms: [[55, 82], [-4, 4]], legs: [[10, 0], [-6, 0]] },
    reach:      { label: '伸手拉/抓', view: 'side', torso: 18, head: 0, arms: [[78, 86], [70, 80]], legs: [[26, 0], [-22, -6]] },
    push:       { label: '推', view: 'side', torso: 14, head: 0, arms: [[72, 100], [68, 96]], legs: [[28, 2], [-30, -4]] },
    punch:      { label: '出拳/打', view: 'side', torso: 10, head: 0, arms: [[86, 90], [30, 150]], legs: [[30, 0], [-28, -6]] },
    hug:        { label: '拥抱', view: 'side', torso: 6, head: 8, arms: [[70, 125], [64, 118]], legs: [[6, 0], [-6, 0]] },
    bow:        { label: '低头', view: 'side', torso: 4, head: 38, arms: [[2, 8], [-2, 6]], legs: [[4, 0], [-4, 0]] },
    bowdeep:    { label: '鞠躬/行礼', view: 'side', torso: 55, head: 15, arms: [[60, 75], [56, 72]], legs: [[0, 0], [-4, 0]] },
    lookup:     { label: '仰头', view: 'side', torso: -4, head: -32, arms: [[-6, 2], [6, 8]], legs: [[4, 0], [-4, 0]] },
    coverface:  { label: '捂脸', view: 'side', torso: 12, head: 22, arms: [[55, 168], [50, 162]], legs: [[4, 0], [-4, 0]] },
    phone:      { label: '看手机/看手里', view: 'side', torso: 4, head: 30, arms: [[18, 120], [-4, 4]], legs: [[4, 0], [-4, 0]] },
    cower:      { label: '后退/躲', view: 'side', torso: -12, head: 12, arms: [[40, 150], [30, 140]], legs: [[18, 0], [-22, -4]] },
    // —— 11-08 第二批（v4 试跑缺的）——
    behind:     { label: '背手站', view: 'side', torso: -2, head: -4, arms: [[-16, 62], [-12, 58]], legs: [[4, 0], [-4, 0]] },
    leanover:   { label: '扶栏俯身往下看', view: 'side', torso: 38, head: 28, arms: [[58, 12], [52, 6]], legs: [[2, 0], [-6, 0]] },
    throw:      { label: '抛/扔', view: 'side', torso: -6, head: -6, arms: [[150, 130], [-35, -5]], legs: [[26, 0], [-26, -12]] },
    offer:      { label: '双手捧/托/接', view: 'side', torso: 10, head: 18, arms: [[38, 96], [34, 92]], legs: [[4, 0], [-4, 0]] },
    kowtow:     { label: '叩首/跪伏', view: 'side', torso: 78, head: 20, arms: [[70, 92], [64, 90]], legs: [[0, -90], [-3, -92]] },
    kneelback:  { label: '跪着后仰', view: 'side', torso: -24, head: -10, arms: [[-35, -12], [-28, -8]], legs: [[0, -90], [-3, -92]] },
    sitground:  { label: '瘫坐在地/撑地后蹭', view: 'side', torso: -22, head: 6, arms: [[-32, -22], [-26, -16]], legs: [[88, 92], [80, 86]] },
    swordup:    { label: '双手举剑过头', view: 'side', torso: -4, head: -6, arms: [[165, 172], [160, 168]], legs: [[20, 0], [-18, -4]] },
    covermouth: { label: '捂嘴', view: 'side', torso: 4, head: 10, arms: [[38, 166], [-4, 4]], legs: [[4, 0], [-4, 0]] },
    stomp:      { label: '跺脚', view: 'side', torso: 2, head: 4, arms: [[-22, -6], [22, 12]], legs: [[55, -15], [-3, 0]] },
    runwave:    { label: '边跑边招手', view: 'side', torso: 14, head: -6, arms: [[150, 172], [-55, 15]], legs: [[62, -8], [-35, -105]] },
    dragged:    { label: '被拽着走', view: 'side', torso: -16, head: 8, arms: [[95, 95], [-20, 0]], legs: [[32, 0], [-10, -22]] },
    linkarm:    { label: '挽胳膊/搀扶', view: 'side', torso: 2, head: 4, arms: [[22, 88], [-4, 4]], legs: [[6, 0], [-6, 0]] },
    barge:      { label: '撞肩/撞开', view: 'side', torso: 16, head: 0, arms: [[-12, 8], [10, 24]], legs: [[30, 0], [-26, -8]] },
    // —— 正面 ——
    stand_f:    { label: '站（正面）', view: 'front', torso: 0, head: 0, arms: [[8, 4], [8, 4]], legs: [[5, 0], [5, 0]] },
    handsup_f:  { label: '举双手', view: 'front', torso: 0, head: -6, arms: [[150, 176], [150, 176]], legs: [[8, 0], [8, 0]] },
    open_f:     { label: '张开双臂', view: 'front', torso: 0, head: 0, arms: [[95, 102], [95, 102]], legs: [[8, 0], [8, 0]] },
    wave_f:     { label: '挥手', view: 'front', torso: 0, head: 0, arms: [[8, 4], [118, 168]], legs: [[5, 0], [5, 0]] },
    hips_f:     { label: '叉腰', view: 'front', torso: 0, head: 0, arms: [[40, -45], [40, -45]], legs: [[9, 0], [9, 0]] },
    cross_f:    { label: '抱臂', view: 'front', torso: 0, head: 0, arms: [[12, -82], [12, -78]], legs: [[5, 0], [5, 0]] },
    cover_f:    { label: '捂脸（正面）', view: 'front', torso: 0, head: 14, arms: [[18, -162], [18, -162]], legs: [[4, 0], [4, 0]] },
    sit_f:      { label: '坐（正面）', view: 'front', torso: 0, head: 0, arms: [[10, -20], [10, -20]], legs: [[14, 2], [14, 2]], seat: true, short: 0.45 },
    behind_f:   { label: '背手站（正面）', view: 'front', torso: 0, head: -4, arms: [[10, -30], [10, -30]], legs: [[7, 0], [7, 0]] },
    lookup_f:   { label: '仰头（正面）', view: 'front', torso: 0, head: -28, arms: [[8, 4], [8, 4]], legs: [[5, 0], [5, 0]] },
    offer_f:    { label: '双手捧/托（正面）', view: 'front', torso: 0, head: 10, arms: [[16, -98], [16, -98]], legs: [[5, 0], [5, 0]] },
    scroll_f:   { label: '展开卷轴/圣旨', view: 'front', torso: 0, head: 6, arms: [[58, 92], [58, 92]], legs: [[6, 0], [6, 0]] },
    sword_f:    { label: '双手握剑垂在身前', view: 'front', torso: 0, head: 4, arms: [[12, -28], [12, -28]], legs: [[8, 0], [8, 0]] },
    fuli_f:     { label: '福礼（正面）', view: 'front', torso: 0, head: 12, arms: [[30, -40], [6, -60]], legs: [[3, -6], [3, -6]] },
    lookhand_f: { label: '低头看手里（正面）', view: 'front', torso: 0, head: 30, arms: [[10, -72], [10, -72]], legs: [[5, 0], [5, 0]] },
    shout_f:    { label: '双手拢嘴喊', view: 'front', torso: 0, head: -8, arms: [[28, -158], [28, -158]], legs: [[9, 0], [9, 0]] },
    pointdown_f:{ label: '往下指（正面）', view: 'front', torso: 0, head: 14, arms: [[8, 4], [38, 42]], legs: [[5, 0], [5, 0]] },
    laugh_f:    { label: '掩嘴笑', view: 'front', torso: 0, head: 6, arms: [[8, 4], [20, -166]], legs: [[5, 0], [5, 0]] },
    run_f:      { label: '跑（正面/背影往纵深）', view: 'front', torso: 0, head: 0, arms: [[28, -40], [24, 35]], legs: [[4, 0], [14, -30]], short: 1 },
    kneel_f:    { label: '跪（正面）', view: 'front', torso: 0, head: 12, arms: [[6, 2], [6, 2]], legs: [[10, 0], [10, 0]], short: 0.5, noShin: true }
  };

  function rad(d) { return d * Math.PI / 180; }

  // 关节位置（y 向上，脚底 = 0）
  function skeleton(p) {
    var front = p.view === 'front';
    var t = rad(p.torso || 0), hd = rad(p.head || 0);
    var up = front ? [0, 1] : [Math.sin(t), Math.cos(t)];
    var hip = [0, 0];
    var neck = [hip[0] + L.torso * up[0], hip[1] + L.torso * up[1]];
    var sh = [hip[0] + (L.torso - 0.2) * up[0], hip[1] + (L.torso - 0.2) * up[1]];
    var ht = front ? 0 : t + hd;
    var head = front ? [neck[0], neck[1] + L.neck + L.headR - (p.head || 0) * 0.006]
                     : [neck[0] + (L.neck + L.headR) * Math.sin(ht), neck[1] + (L.neck + L.headR) * Math.cos(ht)];
    function dir(a, side) {   // side: 0 侧面 / -1 正面画面左 / +1 正面画面右
      var s = Math.sin(rad(a)), c = Math.cos(rad(a));
      return front ? [side * s, -c] : [s, -c];
    }
    var limbs = [];
    var short = p.short || 1;
    (p.legs || []).forEach(function (lg, i) {
      var side = front ? (i === 0 ? -1 : 1) : 0;
      var o = front ? [side * 0.32, 0] : [0, 0];
      var a = [hip[0] + o[0], hip[1]];
      var d1 = dir(lg[0], side), k = [a[0] + L.thigh * short * d1[0], a[1] + L.thigh * short * d1[1]];
      var d2 = dir(lg[1], side), f = p.noShin ? k : [k[0] + L.shin * d2[0], k[1] + L.shin * d2[1]];
      limbs.push({ kind: 'leg', far: !front && i === 1, pts: p.noShin ? [a, k] : [a, k, f] });
    });
    (p.arms || []).forEach(function (am, i) {
      var side = front ? (i === 0 ? -1 : 1) : 0;
      var o = front ? [side * 0.62, 0] : [0, 0];
      var a = [sh[0] + o[0], sh[1]];
      var d1 = dir(am[0], side), e = [a[0] + L.upper * d1[0], a[1] + L.upper * d1[1]];
      var d2 = dir(am[1], side), w = [e[0] + L.fore * d2[0], e[1] + L.fore * d2[1]];
      limbs.push({ kind: 'arm', far: !front && i === 1, pts: [a, e, w] });
    });
    // 落地：最低点放到 0
    var minY = Infinity;
    limbs.forEach(function (l) { l.pts.forEach(function (q) { minY = Math.min(minY, q[1] - W.limb / 2); }); });
    minY = Math.min(minY, hip[1] - W.torso / 2, neck[1] - W.torso / 2, head[1] - L.headR);
    var dy = -minY;
    function sh2(q) { return [q[0], q[1] + dy]; }
    limbs.forEach(function (l) { l.pts = l.pts.map(sh2); });
    var sk = { front: front, hip: sh2(hip), neck: sh2(neck), head: sh2(head), headTilt: ht, limbs: limbs, seat: !!p.seat };
    sk.top = sk.head[1] + L.headR;
    var xs = [sk.head[0] - L.headR, sk.head[0] + L.headR];
    limbs.forEach(function (l) { l.pts.forEach(function (q) { xs.push(q[0] - W.limb / 2, q[0] + W.limb / 2); }); });
    sk.minX = Math.min.apply(null, xs); sk.maxX = Math.max.apply(null, xs);
    return sk;
  }

  function pl(pts, k, sx, sy) {
    return pts.map(function (q) { return (sx(q[0])).toFixed(2) + ',' + (sy(q[1])).toFixed(2); }).join(' ');
  }

  /* 画一个小人，返回 SVG 片段。
   * opt: { x, y（脚底中点的 SVG 坐标）, s（每单位多少像素）, color, face: 'right'|'left'|'front'|'back'|'fl'|'fr', name } */
  function figure(poseName, opt) {
    var p = POSES[poseName] || POSES.stand;
    var sk = skeleton(p);
    var face = opt.face || (p.view === 'front' ? 'front' : 'right');
    var mir = p.view !== 'front' && face === 'left' ? -1 : 1;
    var s = opt.s, X = opt.x, Y = opt.y;
    function sx(x) { return X + mir * x * s; }
    function sy(y) { return Y - y * s; }
    var col = opt.color || '#9aa4ae';
    var out = '<g>';
    if (sk.seat) {
      var hx = sk.hip[0] - (p.view === 'front' ? 1.0 : 1.2), hy = sk.hip[1] - 0.45;
      out += '<rect x="' + Math.min(sx(hx), sx(hx + 2.2)).toFixed(2) + '" y="' + sy(hy).toFixed(2) + '" width="' + (2.2 * s).toFixed(2) + '" height="' + (hy * s).toFixed(2) +
        '" fill="none" stroke="' + col + '" stroke-opacity=".45" stroke-width="' + (0.18 * s).toFixed(2) + '" rx="' + (0.2 * s).toFixed(2) + '"/>';
    }
    var line = function (l, w, op) {
      return '<polyline points="' + pl(l.pts, 0, sx, sy) + '" fill="none" stroke="' + col + '" stroke-opacity="' + op +
        '" stroke-width="' + (w * s).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    };
    sk.limbs.filter(function (l) { return l.far; }).forEach(function (l) { out += line(l, W.limb, 0.45); });
    out += line({ pts: [sk.hip, sk.neck] }, W.torso, 1);
    sk.limbs.filter(function (l) { return !l.far; }).forEach(function (l) { out += line(l, W.limb, 1); });
    out += '<circle cx="' + sx(sk.head[0]).toFixed(2) + '" cy="' + sy(sk.head[1]).toFixed(2) + '" r="' + (L.headR * s).toFixed(2) + '" fill="' + col + '"/>';
    // 脸朝向：橙点
    var mk = null, r = L.headR * 0.42;
    if (p.view !== 'front') {
      var a = sk.headTilt;
      mk = [sk.head[0] + (L.headR * 0.62) * Math.cos(a), sk.head[1] - (L.headR * 0.62) * Math.sin(a)];
    } else if (face === 'front') mk = [sk.head[0], sk.head[1] - (p.head || 0) * 0.012];
    else if (face === 'fl') mk = [sk.head[0] - L.headR * 0.45, sk.head[1]];
    else if (face === 'fr') mk = [sk.head[0] + L.headR * 0.45, sk.head[1]];
    if (mk) out += '<circle cx="' + sx(mk[0]).toFixed(2) + '" cy="' + sy(mk[1]).toFixed(2) + '" r="' + (r * s).toFixed(2) + '" fill="#f59e0b"/>';
    if (opt.name) {
      var fs = Math.max(9, Math.min(13, s * 0.9));
      out += '<text x="' + sx(sk.head[0]).toFixed(1) + '" y="' + (sy(sk.top) - fs * 0.5).toFixed(1) + '" text-anchor="middle" font-size="' + fs.toFixed(1) +
        '" fill="' + col + '" font-weight="600" paint-order="stroke" stroke="#0f1113" stroke-width="3">' + esc(opt.name) + '</text>';
    }
    return out + '</g>';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* 景别 → 画框里看到人身上的哪一段（单位：从头顶往下多少）。全景、远景看全身。 */
  var SPAN = { '中景': [4.4, 0.62], '近景': [2.9, 0.58], '特写': [1.7, 0.6], '大特写': [1.2, 0.78] };   // [头顶往下看到多少单位, 占画框高度的比例]

  /* 一个镜头的草图。shot: { n, size, move, cam（俯拍/仰拍/顶拍/主观，平视不写）, named（人名运镜）, figs:[{who,pose,face,x,s}], props:[{name,x,y}], note }
   * 全景/中景/远景里 2 人自动缩到 0.86、3 人 0.72、4 人以上 0.6，再乘上 s。
   * opt: { w, h, colorOf(who) } */
  function frame(shot, opt) {
    var w = opt.w, h = opt.h, size = shot.size || '中景', TOP = 16, BOT = 16;
    var out = '<svg viewBox="0 0 ' + w + ' ' + (h + TOP + BOT) + '" width="' + w + '" height="' + (h + TOP + BOT) + '" xmlns="http://www.w3.org/2000/svg" style="display:block">';
    out += '<text x="1" y="11" font-size="10" fill="#8b949e">' + esc((shot.n || '') + ' · ' + size) + '</text>';
    if (shot.move && !/固定/.test(shot.move)) out += '<text x="' + (w - 1) + '" y="11" text-anchor="end" font-size="10" fill="#22d3ee">' + esc(shot.move) + '</text>';
    // 人名放画框下面，按小人的左右位置排
    (shot.figs || []).forEach(function (f) {
      var fx = Math.max(14, Math.min(w - 14, (f.x == null ? 0.5 : f.x) * w));
      out += '<text x="' + fx + '" y="' + (h + TOP + 12) + '" text-anchor="middle" font-size="' + ((shot.figs || []).length >= 3 ? 8 : 10) + '" font-weight="600" fill="' + (opt.colorOf ? opt.colorOf(f.who) : '#9aa4ae') + '">' + esc(f.who) + '</text>';
    });
    out += '<g transform="translate(0,' + TOP + ')">';
    out += '<defs><clipPath id="cf' + (frame.k = (frame.k || 0) + 1) + '"><rect width="' + w + '" height="' + h + '"/></clipPath></defs>';
    out += '<rect width="' + w + '" height="' + h + '" fill="#14171a" stroke="#3a4048" rx="3"/>';
    out += '<g clip-path="url(#cf' + frame.k + ')">';
    var figs = shot.figs || [];
    var ground = null;
    if (size === '远景') ground = h * 0.80;
    else if (size === '全景') ground = h * 0.93;
    if (ground !== null) out += '<line x1="0" x2="' + w + '" y1="' + ground + '" y2="' + ground + '" stroke="#2c3238" stroke-width="1"/>';
    figs.forEach(function (f) {
      var sk = skeleton(POSES[f.pose] || POSES.stand);
      var crowd = (size === '全景' || size === '中景' || size === '远景') ? (figs.length >= 4 ? 0.6 : figs.length === 3 ? 0.72 : figs.length === 2 ? 0.86 : 1) : 1;
      var rel = (f.s || 1) * crowd, s, y;
      if (size === '远景') { s = h * 0.20 / 8.2 * rel; y = ground; }
      else if (size === '全景') { s = h * 0.80 / 8.2 * rel; y = ground; }
      else { var sp = SPAN[size] || SPAN['中景']; s = h * sp[1] / sp[0] * rel; y = h * (1 - sp[1]) * 0.55 + sk.top * s; }
      out += figure(f.pose, { x: (f.x == null ? 0.5 : f.x) * w, y: y, s: s, color: opt.colorOf ? opt.colorOf(f.who) : null, face: f.face });
    });
    (shot.props || []).forEach(function (p) {
      var px = (p.x == null ? 0.5 : p.x) * w, py = (p.y == null ? 0.7 : p.y) * h;
      out += '<rect x="' + (px - 9) + '" y="' + (py - 6) + '" width="18" height="12" rx="2" fill="none" stroke="#cbd5e1" stroke-dasharray="3 2"/>' +
        '<text x="' + px + '" y="' + (py + 20) + '" text-anchor="middle" font-size="10" fill="#cbd5e1">' + esc(p.name) + '</text>';
    });
    if (!figs.length && !(shot.props || []).length) out += '<text x="' + w / 2 + '" y="' + h / 2 + '" text-anchor="middle" font-size="11" fill="#6b7480">空镜</text>';
    if (shot.cam && !/^平/.test(shot.cam)) out += '<text x="4" y="' + (h - 5) + '" font-size="10" font-weight="600" fill="#fbbf24">' + esc(shot.cam) + '</text>';
    if (shot.named) out += '<text x="' + (w / 2) + '" y="' + (h - 5) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#f472b6">★ ' + esc(shot.named) + '</text>';
    out += moveIcon(shot.move, w, h);
    out += '</g></g>';
    return out + '</svg>';
  }

  /* 运镜图标：叠在画框上（半透明青色） */
  function moveIcon(m, w, h) {
    if (!m || /固定/.test(m)) return '';
    var c = '#22d3ee', o = '', sw = 1.6;
    function arrow(x1, y1, x2, y2) {
      var a = Math.atan2(y2 - y1, x2 - x1), k = 6;
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + sw + '"/>' +
        '<polyline points="' + (x2 - k * Math.cos(a - 0.5)) + ',' + (y2 - k * Math.sin(a - 0.5)) + ' ' + x2 + ',' + y2 + ' ' + (x2 - k * Math.cos(a + 0.5)) + ',' + (y2 - k * Math.sin(a + 0.5)) +
        '" fill="none" stroke="' + c + '" stroke-width="' + sw + '"/>';
    }
    var m0 = String(m);
    if (/推|push|变焦|zoom in/i.test(m0) && !/拉/.test(m0)) {
      o += arrow(6, 20, 20, 32) + arrow(w - 6, 20, w - 20, 32) + arrow(6, h - 6, 20, h - 18) + arrow(w - 6, h - 6, w - 20, h - 18);
    } else if (/拉|pull/i.test(m0)) {
      o += arrow(20, 32, 6, 20) + arrow(w - 20, 32, w - 6, 20) + arrow(20, h - 18, 6, h - 6) + arrow(w - 20, h - 18, w - 6, h - 6);
    } else if (/环绕|orbit|绕/i.test(m0)) {
      o += '<ellipse cx="' + w / 2 + '" cy="' + (h - 16) + '" rx="' + (w * 0.38) + '" ry="7" fill="none" stroke="' + c + '" stroke-width="' + sw + '" stroke-dasharray="4 3"/>' +
        arrow(w * 0.5 + w * 0.3, h - 10, w * 0.5 + w * 0.38, h - 16);
    } else if (/手持|晃/.test(m0)) {
      o += '<polyline points="8,' + (h - 10) + ' 16,' + (h - 16) + ' 24,' + (h - 8) + ' 32,' + (h - 16) + ' 40,' + (h - 10) + '" fill="none" stroke="' + c + '" stroke-width="' + sw + '"/>';
    } else if (/升|上摇|crane up|tilt up/i.test(m0)) {
      o += arrow(w - 10, h - 14, w - 10, 26);
    } else if (/降|下摇|tilt down/i.test(m0)) {
      o += arrow(w - 10, 26, w - 10, h - 14);
    } else if (/左/.test(m0)) {
      o += arrow(w - 12, h - 10, 12, h - 10);
    } else if (/摇|移|跟|甩|右|pan|track/i.test(m0)) {
      o += arrow(12, h - 10, w - 12, h - 10);
    }
    return o;
  }

  /* ===== 平面图（每场必画）/ 站位锚（EV 11-09）=====
   * b: { name, area, ratio, marks:[{name,x,y,w,h}], top:[{who,x,y,face,to:[x,y],toFace}], cams:[{at,x,y,aim,fov,after}] }。
   * x 向右、y 向下（0–1）；ratio = 图的宽高比（默认 1.3，街道这种狭长场地可以写 2）。
   * face / aim：'N' 'S' 'E' 'W' 'NE'…（N = 俯视图上方）或角度（0 = N，顺时针）。
   * to：这个人在这一段里走到哪（画虚线箭头）；cams.after = true 表示这台机位拍的是走完之后。 */
  function dirVec(d) {
    var deg = typeof d === 'number' ? d : ({ N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 })[String(d || 'N').toUpperCase()];
    if (deg == null) deg = 0;
    var r = rad(deg); return [Math.sin(r), -Math.cos(r)];
  }
  function camLabel(at) { return String(at).replace(/^\S*-(G\d+)\s*Shot0?/, '$1·').replace(/^\S*-(G\d+)\s+(\S+)\s*秒$/, '$1·$2s'); }
  function topView(b, opt) {
    var w = opt.w || 420, h = opt.h || Math.round(w / (b.ratio || 1.3)), pad = 16, iw = w - pad * 2, ih = h - pad * 2;
    function X(x) { return +(pad + x * iw).toFixed(1); } function Y(y) { return +(pad + y * ih).toFixed(1); }
    var lab = function (x, y, s, col, anchor) {
      return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '" font-size="10" fill="' + col + '" paint-order="stroke" stroke="#14171a" stroke-width="3">' + esc(s) + '</text>';
    };
    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg" style="display:block;max-width:100%;height:auto">' +
      '<defs><marker id="mv" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e5e7eb"/></marker></defs>';
    out += '<rect x="1" y="1" width="' + (w - 2) + '" height="' + (h - 2) + '" fill="#14171a" stroke="#3a4048" rx="4"/>';
    out += lab(w - 10, 14, 'N↑', '#4b5563', 'end');
    (b.marks || []).forEach(function (m) {
      out += '<rect x="' + X(m.x) + '" y="' + Y(m.y) + '" width="' + (m.w * iw).toFixed(1) + '" height="' + (m.h * ih).toFixed(1) + '" fill="#1f252b" stroke="#3a4048"/>' +
        '<text x="' + (X(m.x) + 3) + '" y="' + (Y(m.y) + 11) + '" font-size="9" fill="#6b7480">' + esc(m.name) + '</text>';
    });
    /* 人走位：虚线箭头 + 终点空心圈 */
    (b.top || []).forEach(function (t) {
      if (!t.to) return;
      var col = opt.colorOf ? opt.colorOf(t.who) : '#9aa4ae';
      out += '<line x1="' + X(t.x) + '" y1="' + Y(t.y) + '" x2="' + X(t.to[0]) + '" y2="' + Y(t.to[1]) + '" stroke="' + col + '" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#mv)"/>' +
        '<circle cx="' + X(t.to[0]) + '" cy="' + Y(t.to[1]) + '" r="6" fill="none" stroke="' + col + '" stroke-width="1.4" stroke-dasharray="2 2"/>';
    });
    /* 机位：扇形 + 组号·镜头号；挤在一处的标签依次往外挪 */
    var used = [];
    (b.cams || []).forEach(function (c) {
      var v = dirVec(c.aim), px = X(c.x), py = Y(c.y), L = 24, sp = rad((c.fov || 50) / 2);
      var a1 = [v[0] * Math.cos(sp) - v[1] * Math.sin(sp), v[0] * Math.sin(sp) + v[1] * Math.cos(sp)];
      var a2 = [v[0] * Math.cos(-sp) - v[1] * Math.sin(-sp), v[0] * Math.sin(-sp) + v[1] * Math.cos(-sp)];
      var lx = px - v[0] * 10, ly = py - v[1] * 10 + 3, k = 0;
      while (used.some(function (u) { return Math.abs(u[0] - lx) < 26 && Math.abs(u[1] - ly) < 10; }) && k++ < 8) ly += (ly > h / 2 ? -11 : 11);
      used.push([lx, ly]);
      out += '<g class="cam" data-at="' + esc(c.at) + '" style="cursor:pointer"><title>' + esc(c.at + (c.after ? '（走位之后）' : '') + (c.note ? '：' + c.note : '')) + '</title>' +
        '<path d="M' + px + ',' + py + ' L' + (px + a1[0] * L).toFixed(1) + ',' + (py + a1[1] * L).toFixed(1) + ' L' + (px + a2[0] * L).toFixed(1) + ',' + (py + a2[1] * L).toFixed(1) + ' Z" fill="#22d3ee" fill-opacity=".14" stroke="#22d3ee" stroke-width="1"/>' +
        '<circle cx="' + px + '" cy="' + py + '" r="3" fill="#22d3ee"/>' + lab(lx.toFixed(1), ly.toFixed(1), camLabel(c.at), '#22d3ee') + '</g>';
    });
    (b.top || []).forEach(function (t) {
      var v = dirVec(t.face), px = X(t.x), py = Y(t.y), col = opt.colorOf ? opt.colorOf(t.who) : '#9aa4ae';
      out += '<circle cx="' + px + '" cy="' + py + '" r="6" fill="' + col + '"/>' +
        '<circle cx="' + (px + v[0] * 5).toFixed(1) + '" cy="' + (py + v[1] * 5).toFixed(1) + '" r="2.4" fill="#f59e0b"/>' + lab(px, py + 17, t.who, col);
      if (t.to && t.toFace) {
        var v2 = dirVec(t.toFace);
        out += '<circle cx="' + (X(t.to[0]) + v2[0] * 5).toFixed(1) + '" cy="' + (Y(t.to[1]) + v2[1] * 5).toFixed(1) + '" r="2" fill="#f59e0b" fill-opacity=".7"/>';
      }
    });
    return out + '</svg>';
  }
  /* 从某台机位看，平面图里的人从左到右的顺序（只算机位前方的人；同名的取平均位置；cam.after 用走位终点） */
  function orderFrom(b, cam) {
    var v = dirVec(cam.aim), r = [-v[1], v[0]], acc = {};
    (b.top || []).forEach(function (t) {
      var x = cam.after && t.to ? t.to[0] : t.x, y = cam.after && t.to ? t.to[1] : t.y;
      var dx = x - cam.x, dy = y - cam.y;
      if (dx * v[0] + dy * v[1] <= 0) return;
      (acc[t.who] = acc[t.who] || []).push(dx * r[0] + dy * r[1]);
    });
    return Object.keys(acc).map(function (k) { return { who: k, p: acc[k].reduce(function (a, c) { return a + c; }, 0) / acc[k].length }; })
      .sort(function (a, c) { return a.p - c.p; }).map(function (o) { return o.who; });
  }

  root.SketchKit = { POSES: POSES, figure: figure, frame: frame, skeleton: skeleton, topView: topView, orderFrom: orderFrom, camLabel: camLabel };
})(typeof window !== 'undefined' ? window : globalThis);
