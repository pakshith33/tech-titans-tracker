/**
 * Parse a CricHeroes scorecard HTML page into match metadata + teams/players.
 * Browser-safe (no cheerio). Designed against saved scorecard HTML (Next.js DOM).
 */

export const SCORECARD_URL_RE =
  /^https:\/\/(www\.)?cricheroes\.com\/scorecard\/(\d+)(?:\/|$)/i;

export function assertScorecardUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("url is required");
  }
  const trimmed = url.trim();
  const m = trimmed.match(SCORECARD_URL_RE);
  if (!m) {
    throw new Error(
      "url must be a cricheroes.com scorecard link (…/scorecard/{id}/…)"
    );
  }
  return { url: trimmed, matchId: m[2] };
}

export function stripRoleSuffix(name) {
  return String(name || "")
    .replace(/\s*\((?:c|wk|captain|wicket[\s-]?keeper)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBasicEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    );
}

function htmlToLines(html) {
  const withoutScripts = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = withoutScripts
    .replace(/<\/(div|p|li|tr|h\d|section|article|td|th|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");
  return decodeBasicEntities(text)
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function buildPlayerIdIndex(html) {
  const index = new Map();
  const slugIndex = new Map();
  const re =
    /https?:\/\/(?:www\.)?cricheroes\.com\/player-profile\/(\d+)\/([^/"'?#]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    const slug = decodeURIComponent(m[2]).toLowerCase();
    if (!slugIndex.has(slug)) slugIndex.set(slug, id);
    const approxName = slug
      .replace(/-(?:c|wk)$/i, "")
      .split("-")
      .filter(Boolean)
      .join(" ");
    const key = approxName.toLowerCase();
    if (key && !index.has(key)) index.set(key, id);
  }
  return { byName: index, bySlug: slugIndex };
}

function lookupPlayerId(name, idIndex) {
  const cleaned = stripRoleSuffix(name);
  const key = cleaned.toLowerCase();
  if (idIndex.byName.has(key)) return idIndex.byName.get(key);

  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (idIndex.bySlug.has(slug)) return idIndex.bySlug.get(slug);

  for (const [s, id] of idIndex.bySlug.entries()) {
    const base = s.replace(/-(?:c|wk)$/i, "");
    if (base === slug) return id;
  }
  return null;
}

function parseDdMmYyyy(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function parseDayMonYy(s) {
  const m = String(s).match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})(?:\s|$)/);
  if (!m) return null;
  const months = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const mm = months[m[2].toLowerCase()];
  if (!mm) return null;
  const yy = Number(m[3]);
  const yyyy = yy >= 70 ? `19${m[3]}` : `20${m[3]}`;
  return `${yyyy}-${mm}-${m[1].padStart(2, "0")}`;
}

function extractDate(lines, html) {
  const idx = lines.findIndex((l) => /^Match Date$/i.test(l));
  if (idx >= 0 && lines[idx + 1]) {
    const iso = parseDdMmYyyy(lines[idx + 1]);
    if (iso) return iso;
  }
  const fromHtml = html.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (fromHtml) {
    const iso = parseDdMmYyyy(fromHtml[1]);
    if (iso) return iso;
  }
  for (const l of lines) {
    const iso = parseDayMonYy(l);
    if (iso) return iso;
  }
  return null;
}

function titleCaseMatchName(raw) {
  return String(raw)
    .split(/\s+vs\s+/i)
    .map((side) =>
      side
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    )
    .join(" vs ");
}

function extractMatchName(html, lines) {
  const titleMatch = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeBasicEntities(titleMatch[1]).replace(/\s+/g, " ").trim()
    : "";
  const beforeDash = title.split("|")[0].split("-")[0].trim();
  if (/\bvs\b/i.test(beforeDash)) {
    return titleCaseMatchName(beforeDash);
  }

  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    if (/^Toss:/i.test(lines[i]) && lines[i + 1] && lines[i + 3]) {
      const a = lines[i + 1];
      const b = lines[i + 3];
      if (a && b && !/^\(/.test(a) && !/^\(/.test(b)) {
        return `${a} vs ${b}`;
      }
    }
  }
  return null;
}

function isOversLine(line) {
  return /^\(\d+(?:\.\d+)?\s*Ov\.?\)$/i.test(line);
}

function findInningsStarts(lines) {
  let from = 0;
  const gallery = lines.findIndex((l) => /^gallery$/i.test(l));
  if (gallery >= 0) from = gallery + 1;

  const starts = [];
  for (let i = from; i < lines.length - 1; i++) {
    if (isOversLine(lines[i + 1]) && lines[i] && !isOversLine(lines[i])) {
      const name = lines[i];
      if (
        /^(summary|scorecard|commentary|analysis|heroes|mvp|teams|gallery|batters|bowlers)$/i.test(
          name
        )
      ) {
        continue;
      }
      starts.push({ teamName: name, index: i });
    }
  }
  return starts;
}

function parseYetToBat(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => stripRoleSuffix(p))
    .filter(Boolean);
}

function extractTeamPlayers(lines, startIndex, endIndex, idIndex) {
  const chunk = lines.slice(startIndex, endIndex);
  const battersIdx = chunk.findIndex((l) => /^Batters$/i.test(l));
  if (battersIdx < 0) return [];

  const names = [];
  const seen = new Set();

  const addName = (raw) => {
    const name = stripRoleSuffix(raw);
    if (!name) return;
    if (
      /^(batters|bowlers|extras|r|b|4s|6s|sr|min|o|m|w|eco|wd|nb|0s)$/i.test(name)
    ) {
      return;
    }
    if (/^\d/.test(name)) return;
    if (/^(c |b |lbw|run out|not out|retired)/i.test(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push({
      name,
      cricheroesPlayerId: lookupPlayerId(name, idIndex),
    });
  };

  for (let i = battersIdx + 1; i < chunk.length; i++) {
    const line = chunk[i];
    if (/^Extras$/i.test(line)) break;
    if (/^Fall Of Wickets/i.test(line)) break;
    if (/^Yet to Bat:/i.test(line)) break;
    if (/^Bowlers$/i.test(line)) break;

    if (
      i + 1 < chunk.length &&
      stripRoleSuffix(chunk[i]).toLowerCase() ===
        stripRoleSuffix(chunk[i + 1]).toLowerCase() &&
      !isOversLine(line)
    ) {
      addName(line);
    }
  }

  let yetRaw = null;
  const yetIdx = chunk.findIndex((l) => /^Yet to Bat:/i.test(l));
  if (yetIdx >= 0) {
    const sameLine = chunk[yetIdx].replace(/^Yet to Bat:\s*/i, "").trim();
    if (sameLine) yetRaw = sameLine;
    else if (
      chunk[yetIdx + 1] &&
      !/^Fall Of Wickets/i.test(chunk[yetIdx + 1])
    ) {
      yetRaw = chunk[yetIdx + 1];
    }
  }
  if (yetRaw) {
    for (const n of parseYetToBat(yetRaw)) addName(n);
  }

  return names;
}

/**
 * @param {string} html
 * @param {{ sourceUrl?: string, fileName?: string }} [opts]
 */
export function parseScorecardHtml(html, opts = {}) {
  if (!html || typeof html !== "string") {
    throw new Error("html is required");
  }

  let matchId = null;
  if (opts.sourceUrl) {
    try {
      matchId = assertScorecardUrl(opts.sourceUrl).matchId;
    } catch (_) {
      /* optional */
    }
  }
  if (!matchId) {
    const m = html.match(/\/scorecard\/(\d+)\//);
    if (m) matchId = m[1];
  }

  const lines = htmlToLines(html);
  const idIndex = buildPlayerIdIndex(html);
  const matchName = extractMatchName(html, lines);
  const date = extractDate(lines, html);
  const starts = findInningsStarts(lines);

  const uniqueStarts = [];
  for (const s of starts) {
    const prev = uniqueStarts[uniqueStarts.length - 1];
    if (prev && prev.teamName === s.teamName) {
      uniqueStarts[uniqueStarts.length - 1] = s;
      continue;
    }
    if (
      uniqueStarts.length >= 2 &&
      uniqueStarts.some((u) => u.teamName === s.teamName)
    ) {
      continue;
    }
    uniqueStarts.push(s);
  }

  let pair = uniqueStarts.slice(0, 2);
  for (let i = 0; i < starts.length - 1; i++) {
    if (starts[i].teamName !== starts[i + 1].teamName) {
      pair = [starts[i], starts[i + 1]];
    }
  }

  const teams = [];
  for (let t = 0; t < pair.length; t++) {
    const start = pair[t].index;
    const end = t + 1 < pair.length ? pair[t + 1].index : lines.length;
    let endIdx = end;
    if (t === pair.length - 1) {
      const stop = lines.findIndex(
        (l, idx) =>
          idx > start &&
          (/^Series Name$/i.test(l) ||
            /^Match Officials$/i.test(l) ||
            /^Player of(?: The)? Match$/i.test(l))
      );
      if (stop > start) endIdx = stop;
    }
    teams.push({
      name: pair[t].teamName,
      players: extractTeamPlayers(lines, start, endIdx, idIndex),
    });
  }

  return {
    matchId,
    matchName,
    date,
    teams,
    sourceUrl: opts.sourceUrl || null,
    fileName: opts.fileName || null,
  };
}
