// 旧サイト、FTP、CMS からの取得(docs/renewal/ARCHITECTURE.md の「取得の守り」)。
// 取りに行ってよいのは、案件の設定で名前を挙げたサーバーだけ。内部のネットワークのアドレスは、
// privateHosts に挙げたサーバーを除いて取りに行かない(lib/safe-fetch.js の守りと同じ判定)。
const dns = require("dns");
const net = require("net");
const { isBlockedIpAddress } = require("../../lib/safe-fetch");

const USER_AGENT = "a11y-migration-batch/0.1 (+content-migration)";
const DNS_TIMEOUT_MS = 3000;
const MAX_REDIRECTS = 5;

function fetchError(reason, message, extra = {}) {
  const error = new Error(message);
  error.reason = reason;
  return Object.assign(error, extra);
}

function hostMatches(host, list) {
  const target = String(host || "").toLowerCase();
  return list.some((entry) => String(entry || "").toLowerCase() === target);
}

async function lookupAll(host) {
  return Promise.race([
    dns.promises.lookup(host, { all: true, verbatim: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_TIMEOUT_MS)),
  ]);
}

async function assertAllowed(url, rules) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw fetchError("blocked", `http と https 以外は取りに行かない: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // host と hostname:port の両方で照らす(取込環境が決まったポートで動くことがあるため)。
  if (!hostMatches(url.hostname, rules.allowedHosts) && !hostMatches(url.host, rules.allowedHosts)) {
    // 転送先が許可外のときに、どこへ飛んだかを台帳に残せるよう、URL を持たせる。
    throw fetchError("not-allowed-host", `案件の設定の取りに行ってよいサーバーに無い: ${url.host}`, { meta: { finalUrl: url.href } });
  }
  const allowPrivate = hostMatches(url.hostname, rules.privateHosts) || hostMatches(url.host, rules.privateHosts);
  if (allowPrivate) return;
  let addresses;
  if (net.isIP(host)) {
    addresses = [{ address: host }];
  } else {
    try {
      addresses = await lookupAll(host);
    } catch {
      throw fetchError("dns", `サーバーの名前を引けない: ${url.host}`);
    }
  }
  if (!addresses.length || addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    throw fetchError("blocked", `内部のネットワークのアドレスなので取りに行かない: ${url.host}`);
  }
}

// 文字コードは、応答の Content-Type、HTML の meta の順に見る。どちらにも無ければ UTF-8 とする。
function detectCharset(contentType, bytes) {
  const fromHeader = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType || "");
  if (fromHeader) return fromHeader[1].toLowerCase();
  const head = Buffer.from(bytes.subarray(0, 4096)).toString("latin1");
  const fromMeta =
    /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head) || /<meta[^>]+content\s*=\s*["'][^"']*charset=([\w.:-]+)/i.exec(head);
  return fromMeta ? fromMeta[1].toLowerCase() : "utf-8";
}

function decode(bytes, charset) {
  try {
    return { text: new TextDecoder(charset, { fatal: false }).decode(bytes), charset };
  } catch {
    // 知らない名前の文字コードは UTF-8 として読み、台帳に元の名前を残す。
    return { text: new TextDecoder("utf-8").decode(bytes), charset: `utf-8 (宣言: ${charset})` };
  }
}

async function readLimited(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw fetchError("too-large", `大きさの上限(${maxBytes} バイト)を超えた`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

const isHtmlType = (contentType) => /text\/html|application\/xhtml\+xml/i.test(contentType);

// HTML のページを1件取る。条件付きの取得(etag、lastModified)を渡すと、変わっていなければ notModified を返す。
// accept を渡すと、HTML 以外の種類も読む(巡回で robots.txt と sitemap.xml を読むときなど)。
async function fetchPage(targetUrl, rules, { etag, lastModified, accept = isHtmlType } = {}) {
  let url = new URL(targetUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), rules.timeoutMs);
  try {
    for (let redirects = 0; ; redirects += 1) {
      await assertAllowed(url, rules);
      const headers = { "user-agent": USER_AGENT, accept: accept === isHtmlType ? "text/html,application/xhtml+xml" : "*/*" };
      if (etag) headers["if-none-match"] = etag;
      if (lastModified) headers["if-modified-since"] = lastModified;
      let response;
      try {
        response = await fetch(url, { headers, redirect: "manual", signal: controller.signal });
      } catch (error) {
        throw fetchError(controller.signal.aborted ? "timeout" : "network", `取得できない: ${error.cause?.code || error.message}`);
      }
      // 読まない応答の本文は捨てる。捨てないと接続が残り、取得が終わってもプロセスが閉じない
      // (遠野市の試走で、404 の応答を読まずにいたら、取得のあとにプロセスが残った)。
      const discard = () => response.body?.cancel().catch(() => {});
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
        await discard();
        if (redirects >= MAX_REDIRECTS) throw fetchError("redirects", "転送が多すぎる");
        url = new URL(response.headers.get("location"), url);
        continue;
      }
      const meta = {
        status: response.status,
        finalUrl: url.href,
        contentType: response.headers.get("content-type") || "",
        lastModified: response.headers.get("last-modified") || null,
        etag: response.headers.get("etag") || null,
      };
      if (response.status === 304) {
        await discard();
        return { ...meta, notModified: true };
      }
      if (!response.ok) {
        await discard();
        throw fetchError("http-status", `HTTP ${response.status}`, { meta });
      }
      if (!accept(meta.contentType)) {
        await discard();
        throw fetchError("not-html", `HTML ではない: ${meta.contentType || "種類なし"}`, { meta });
      }
      let bytes;
      try {
        bytes = await readLimited(response, rules.maxBytes);
      } catch (error) {
        if (error.reason) throw error;
        // 本文の読み込みの途中でも、時間切れなら timeout としてやり直しの対象にする。
        throw fetchError(controller.signal.aborted ? "timeout" : "network", `読み込みの途中で止まった: ${error.cause?.code || error.name}`, { meta });
      }
      const { text, charset } = decode(bytes, detectCharset(meta.contentType, bytes));
      return { ...meta, notModified: false, html: text, charset, bytes: bytes.byteLength };
    }
  } finally {
    clearTimeout(timer);
  }
}

// 間隔と同時数を守って、順に処理する。worker は1件ずつ呼ばれる。
async function runPaced(items, { intervalMs, concurrency }, worker) {
  let next = 0;
  let lastStart = 0;
  const gate = async () => {
    const wait = lastStart + intervalMs - Date.now();
    lastStart = Math.max(Date.now(), lastStart + intervalMs);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };
  const lanes = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await gate();
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

module.exports = { fetchPage, runPaced, detectCharset, assertAllowed, isHtmlType };
