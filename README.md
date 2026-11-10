# shot-director（分镜导演）

Claude Code Skill：把**剧本**变成一份**网页分镜本**——剧本拆成场、场拆成镜头组（一次生成 = 表格一行），每组判定该交给哪个视频模型，并按那个模型自己的写法把提示词写好，复制就能去生成。

一句话：**不是每个镜头都要用最贵的模型。** 空镜、物理特写、群演、主角对白、复杂调度，各交给合适（也更便宜）的模型，提示词各按各的手册写。

上游是同作者开源的副导演 Skill [ad-asset-bible](https://github.com/EVZheng-Lab/ad-asset-bible)（剧本 → 资产盘点）；分镜本里的资产编号全部继承它。

## 产出什么

| 东西 | 说明 |
|---|---|
| 网页分镜本（单个 HTML） | 顶部两个标签页：资产盘点（副导演的产出，嵌进来）/ 分镜本；点资产标签跳到盘点里那一行 |
| 每个镜头组一行 | 工艺（首帧生视频 / 参考生视频）、模型、派活理由、资产与挂载顺序、台词与演法、反应镜头、草图、视频提示词（一键复制）、导演批注栏 |
| 每场一张俯视平面图 | 谁站哪、朝哪、怎么走位、每个镜头的机位；点图放大，点机位跳到镜头组 |
| 要 LAYOUT 的镜头 | 一段给 Blender MCP 的提示词，复制给智能体就能在 Blender 里搭出灰模预演 |
| 按模型筛选 | 同一个模型的活一次做完（制片主任模式） |

## 模型分档（v1）

| 镜头是什么 | 交给谁 |
|---|---|
| 没有主角的空镜、物件特写 | 首帧生视频：生图模型出首帧，Omni 生视频；超过 10 秒的长空镜交 Wan 3.0 |
| 有物理过程的物件特写（弹壳落地、碎裂） | Wan 3.0 |
| 主角出镜但不说话；只出场一次的群演说话 | H3 |
| 主角说话（包括内心独白） | Seedance 2.0 |
| 多个对象的位置、路线、先后关系复杂 | Seedance 2.5 + Blender LAYOUT 预演 |

主角说话只交给 Seedance 一家，是为了全片主角声音一致。表里不写价格（各渠道报价不同）。

## 安装

```bash
git clone https://github.com/EVZheng-Lab/shot-director ~/.claude/skills/shot-director
```

或放在项目级 `.claude/skills/shot-director`。建议同时装上游 [ad-asset-bible](https://github.com/EVZheng-Lab/ad-asset-bible)。

**依赖**：Node.js 18+（build / serve 只用标准库，不用 npm install）。要做 LAYOUT 预演的话，另需 Blender + 一个 Blender MCP。

自检：

```bash
node ~/.claude/skills/shot-director/scripts/poses-gallery.mjs   # 生成草图姿势库预览页，能跑通说明脚本自定位没问题
```

## 用法

```
/shot-director <剧本路径> [集数范围]
```

或直接说：“把这个剧本做成分镜本”“按批注出下一版分镜”。前提：这部剧本已经跑过 ad-asset-bible。

流程：Agent 只写一份 JSON → `scripts/build.mjs` 自检并生成 `Output/分镜本-<片名>.html` → `PORT=3051 node scripts/serve.mjs` 打开页面 → 导演在页面上写批注（自动保存）→ 让 Agent 按批注出下一版（旧版 JSON 另存，不覆盖）。

## 设计要点

- **自检挡在交付前**：台词逐字核对原文（字不能改，只能加演法和断句）；有对白的多人组必须给反应镜头；首尾镜头的景别、角度、左右站位跨组对账（防越轴）；平面图投影到每台机位，和草图的左右顺序对账；人名运镜一场最多一个。
- **每个模型的提示词按各自官方手册写**：例如 Seedance 2.0 写得细、2.5 留余地；台词符号各家不同；全部中文（Omni 另附英文备用）。
- **草图和平面图是给人看的**，不进提示词：图标小人（57 个姿势），扫一眼就知道调度。
- **站位锚**：同一个多人阵型跨几个镜头组出现时，用 Blender 出一套静态站位图，这几组共用，站位不漂。
- **LAYOUT 小人**：`assets/blender/LAYOUT小人.blend` 自带无手脚 / 有手脚两种替身（正面朝 -Y，头和胸的橙色块 = 正面）。没装也行，Blender 提示词里写了用基本体现搭的约定。

## 已知局限

- 规则大多来自官方手册和少量实跑，各模型档位的成片效果没有大规模验证。
- 跨模型的画面差异靠场景图 / 角色图锚定 + 后期统一调色；要“一点都不差”就别用这套。
- 草图表达不了纯表情戏和动作过程。
- 仓库不带示例分镜本：示例用的是第三方短剧剧本，含原台词，不能公开。

## 版本

见 [CHANGELOG.md](CHANGELOG.md)。

## License

MIT。`assets/blender/` 里“有手脚”人偶改自 [desk-break](https://github.com/shlomorsh/desk-break) 的木头人偶（MIT，见 `assets/blender/LICENSE-desk-break.txt`）。
