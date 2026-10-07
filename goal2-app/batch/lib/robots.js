// robots.txt を読み、巡回してよい URL かを決める。User-agent: * の組の Allow と Disallow だけを見る
// (長く当たる方を採る。同じ長さなら Allow)。Sitemap: の行も返す。

function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  const sitemaps = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === "user-agent") {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") current.rules.push({ allow: field === "allow", path: value });
  }
  const group = groups.find((g) => g.agents.includes("*"));
  return { rules: group ? group.rules.filter((rule) => rule.path) : [], sitemaps };
}

function patternToRegExp(path) {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

function isAllowedByRobots(robots, url) {
  if (!robots || !robots.rules.length) return true;
  const target = new URL(url);
  const path = `${target.pathname}${target.search}`;
  let best = null;
  for (const rule of robots.rules) {
    if (!patternToRegExp(rule.path).test(path)) continue;
    const length = rule.path.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) best = { length, allow: rule.allow };
  }
  return best ? best.allow : true;
}

// sitemap.xml の loc を返す。sitemapindex なら、子のサイトマップの URL を children に入れる。
function parseSitemap(xml) {
  const text = String(xml || "");
  const locs = [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  );
  if (/<sitemapindex[\s>]/i.test(text)) return { urls: [], children: locs };
  return { urls: locs, children: [] };
}

module.exports = { parseRobots, isAllowedByRobots, parseSitemap };
