// 全局事件源：ring tile 颜色 / chart 曲线 / chart 区段标注 都从这里读
//
// 模型：
//   - 6 天总时长被等分成 360 个 tile，每个 tile = 24 分钟
//   - 事件跨度 4–6 个 tile（约 1.6–2.4 小时），事件之间可能紧挨着也可能有 1–2 tile 空档
//   - 事件类型 = pink | orange | blue | green，与 MiddlePills 4 个分类一一对应

const TOTAL_SEC = 6 * 86400;
export const TILE_COUNT = 360;
export const TILE_SEC = TOTAL_SEC / TILE_COUNT;   // 1440

export const EVENT_TYPES = ["pink", "orange", "blue", "green"];

export const EVENT_TYPE_INFO = {
  pink: {
    label: "宽频振荡抑制",
    textColor: "#B23DA8",
    zoneColor: "rgba(178, 61, 168, 0.18)",
    guideColor: "rgba(178, 61, 168, 0.6)",
    affects: "purple",
  },
  orange: {
    label: "一次调频",
    textColor: "#DC7635",
    zoneColor: "rgba(220, 118, 53, 0.18)",
    guideColor: "rgba(220, 118, 53, 0.6)",
    affects: "cyan",
  },
  blue: {
    label: "快速电压控制",
    textColor: "#1DBDF1",
    zoneColor: "rgba(29, 189, 241, 0.16)",
    guideColor: "rgba(29, 189, 241, 0.6)",
    affects: "purple",
  },
  green: {
    label: "惯量响应",
    textColor: "#00E564",
    zoneColor: "rgba(0, 229, 100, 0.16)",
    guideColor: "rgba(0, 229, 100, 0.6)",
    affects: "cyan",
  },
};

// ============== 工具 ==============
function hash01(n) {
  let h = n | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// ============== 演示区间（tile 220-241，紧挨着的 4 种类型事件） ==============
const DEMO_LAYOUT = [
  { type: "pink",   span: 5, gap: 0 },   // 220..225 → 紧挨橙
  { type: "orange", span: 5, gap: 1 },   // 225..230, 然后空 1
  { type: "blue",   span: 4, gap: 1 },   // 231..235, 然后空 1
  { type: "green",  span: 5, gap: 0 },   // 236..241
];
const DEMO_START = 220;

// ============== 事件生成（缓存：相同 seed 返回相同结果） ==============
let _eventsCache = null;
let _eventsCacheSeed = null;
let _tileMapCache = null;

function generateAllEvents(seed) {
  const out = [];
  let tile = 0;
  let i = 0;

  // 先把 demo 区间填好（事件强制锚定在 220..241）
  const demoEnd = (() => {
    let t = DEMO_START;
    for (const d of DEMO_LAYOUT) {
      const endT = Math.min(t + d.span, TILE_COUNT);
      out.push({
        idx: out.length,
        type: d.type,
        startTile: t,
        endTile: endT,
        tStart: t * TILE_SEC,
        tEnd: endT * TILE_SEC,
        amp: 1.0,
        isDemo: true,
      });
      t = endT + d.gap;
    }
    return t;
  })();

  while (tile < TILE_COUNT) {
    // 跳过 demo 区
    if (tile >= DEMO_START && tile < demoEnd) {
      tile = demoEnd;
      continue;
    }
    const r1 = hash01(i * 374761393 + seed * 31);
    const r2 = hash01(i * 668265263 + seed * 53);
    const r3 = hash01(i * 1597334677 + seed * 71);
    const r4 = hash01(i * 2147483647 + seed * 97);
    i++;

    // 25% 长事件（4–6 tile）/ 15% 短事件（1–2 tile）/ 60% 空档（5–14 tile）
    let span = 0;
    if (r1 < 0.25) {
      span = 4 + Math.floor(r3 * 3);        // 4..6 tile
    } else if (r1 < 0.40) {
      span = 1 + Math.floor(r3 * 2);        // 1..2 tile
    }
    if (span > 0) {
      const type = EVENT_TYPES[Math.floor(r2 * EVENT_TYPES.length) % EVENT_TYPES.length];
      let endTile = tile + span;
      if (tile < DEMO_START && endTile > DEMO_START) endTile = DEMO_START;
      if (endTile > TILE_COUNT) endTile = TILE_COUNT;
      if (endTile <= tile) break;
      out.push({
        idx: out.length,
        type,
        startTile: tile,
        endTile,
        tStart: tile * TILE_SEC,
        tEnd: endTile * TILE_SEC,
        amp: 0.6 + r4 * 0.4,
      });
      tile = endTile;
    } else {
      // 60% 空档：5–14 tile
      tile += 5 + Math.floor(r4 * 10);
    }
  }
  // 按起始 tile 排序（demo 在中间，需排序后才能给 ring 正确的 tile→event 索引）
  out.sort((a, b) => a.startTile - b.startTile);
  return out;
}

function getAllEvents(seed = 1) {
  if (_eventsCacheSeed !== seed || !_eventsCache) {
    _eventsCache = generateAllEvents(seed);
    _eventsCacheSeed = seed;
    _tileMapCache = null;
  }
  return _eventsCache;
}

function getTileMap(seed) {
  if (_eventsCacheSeed !== seed || !_tileMapCache) {
    const events = getAllEvents(seed);
    _tileMapCache = new Array(TILE_COUNT).fill(null);
    for (const ev of events) {
      for (let i = ev.startTile; i < ev.endTile && i < TILE_COUNT; i++) {
        _tileMapCache[i] = ev;
      }
    }
  }
  return _tileMapCache;
}

// ============== 公共 API ==============

// 给定 tile idx，返回覆盖它的事件（或 null）
// ratio 参数已无效（保留以保持原签名兼容），覆盖密度由 generateAllEvents 中的概率控制
export function eventForTile(idx, _ratio = 0.3, seed = 1) {
  if (idx < 0 || idx >= TILE_COUNT) return null;
  return getTileMap(seed)[idx];
}

// 给定绝对时间，找到当前激活的事件；filter 非 null 时只返回匹配类型
export function eventAt(absT, { seed = 1, filter = null } = {}) {
  const idx = Math.floor(absT / TILE_SEC);
  if (idx < 0 || idx >= TILE_COUNT) return null;
  const ev = getTileMap(seed)[idx];
  if (!ev) return null;
  if (filter && ev.type !== filter) return null;
  if (absT < ev.tStart || absT > ev.tEnd) return null;
  return ev;
}

// 视窗内可见事件（用于渲染 zone + 锚点）
export function visibleEvents(viewStart, span, { seed = 1, filter = null } = {}) {
  const viewEnd = viewStart + span;
  const events = getAllEvents(seed);
  const out = [];
  for (const ev of events) {
    if (filter && ev.type !== filter) continue;
    if (ev.tEnd < viewStart || ev.tStart > viewEnd) continue;
    out.push(ev);
  }
  return out;
}

// ============== 波形：每事件类型独立形态 ==============

export function eventPurpleY(absT, ev) {
  const u = (absT - ev.tStart) / (ev.tEnd - ev.tStart);
  if (u < 0 || u > 1) return 0;
  const taper = smoothstep(0, 0.05, u) * (1 - smoothstep(0.95, 1, u));
  switch (ev.type) {
    case "pink": {
      const damp = Math.exp(-u * 1.4);
      const swing =
        -120 * Math.sin(u * Math.PI * 0.9) +
        220 * Math.sin(u * Math.PI * 1.6 + 0.4);
      return -swing * damp * (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4) * taper * ev.amp;
    }
    case "blue": {
      const spike = 200 * Math.exp(-Math.pow((u - 0.5) * 5, 2));
      return -spike * taper * ev.amp;
    }
    default:
      return 0;
  }
}

export function eventCyanY(absT, ev) {
  const u = (absT - ev.tStart) / (ev.tEnd - ev.tStart);
  if (u < 0 || u > 1) return 0;
  const taper = smoothstep(0, 0.05, u) * (1 - smoothstep(0.95, 1, u));
  switch (ev.type) {
    case "orange": {
      const drop    = 220 * Math.exp(-Math.pow((u - 0.18) * 3.0, 2));
      const recover = 200 * Math.exp(-Math.pow((u - 0.85) * 3.5, 2)) * (u > 0.4 ? 1 : 0);
      return (drop - recover) * taper * ev.amp;
    }
    case "green": {
      return -90 * Math.sin(u * Math.PI) * taper * ev.amp;
    }
    default:
      return 0;
  }
}
