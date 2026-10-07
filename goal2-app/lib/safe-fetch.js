// 取得の守り(SSRF 対策)と、HTML、リンク先の題名、画像の取得。
// server.js と一括処理(batch/)の両方が使う。内部のネットワークのアドレスを取りに行かせない。
const net = require("net");
const dns = require("dns");

function expandIpv6Groups(address) {
  const host = String(address || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes("::")) return host.split(":");
  const [head, tail] = host.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  return [...headParts, ...new Array(Math.max(0, missing)).fill("0"), ...tailParts];
}

function extractIpv4MappedAddress(address) {
  if (net.isIP(address) !== 6) return null;
  const groups = expandIpv6Groups(address);
  if (groups.length !== 8) return null;
  const isMapped = groups.slice(0, 5).every((group) => group === "0" || group === "") && groups[5] === "ffff";
  if (!isMapped) return null;
  const high = Number.parseInt(groups[6] || "0", 16);
  const low = Number.parseInt(groups[7] || "0", 16);
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(".");
}

function normalizeIpAddress(address) {
  const host = String(address || "").toLowerCase();
  const dottedMapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMapped) return dottedMapped[1];
  return extractIpv4MappedAddress(host) || host;
}

function isBlockedIpAddress(address) {
  const host = normalizeIpAddress(address);
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    return (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    );
  }
  if (ipVersion === 6) {
    return host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
  }
  return true;
}

function isBlockedHostLiteral(hostname) {
  const host = String(hostname || "").toLowerCase();
  return !host || host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal";
}

const DNS_LOOKUP_TIMEOUT_MS = 3000;

// dns.promises.lookup() has no built-in timeout and does not accept an AbortSignal
// (unlike fetch()), so a slow/unresponsive DNS server for one particular hostname can
// hang this call indefinitely. That in turn hangs assertFetchUrlAllowed() and everything
// that awaits it — including fetchWithSafeRedirects(), whose own AbortController-based
// timeout only covers the fetch() call itself, not this DNS step. Racing against a plain
// timer bounds the wait from our side even though the underlying OS-level lookup keeps
// running in the background and its result is simply discarded.
function dnsLookupWithTimeout(host, options) {
  return Promise.race([
    dns.promises.lookup(host, options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_LOOKUP_TIMEOUT_MS);
    }),
  ]);
}

async function assertFetchUrlAllowed(url) {
  if (!["http:", "https:"].includes(url.protocol) || isBlockedHostLiteral(url.hostname)) {
    const error = new Error("URL is not allowed");
    error.statusCode = 400;
    throw error;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedIpAddress(host)) {
      const error = new Error("URL is not allowed");
      error.statusCode = 400;
      throw error;
    }
    return;
  }
  let addresses;
  try {
    addresses = await dnsLookupWithTimeout(host, { all: true, verbatim: true });
  } catch {
    const error = new Error("Host could not be resolved");
    error.statusCode = 400;
    throw error;
  }
  if (!addresses.length || addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    const error = new Error("URL is not allowed");
    error.statusCode = 400;
    throw error;
  }
}

async function fetchWithSafeRedirects(targetUrl, fetchOptions, maxRedirects = 5) {
  let currentUrl = new URL(targetUrl);
  for (let redirectCount = 0; ; redirectCount += 1) {
    await assertFetchUrlAllowed(currentUrl);
    const response = await fetch(currentUrl, { ...fetchOptions, redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
      if (redirectCount >= maxRedirects) {
        const error = new Error("Too many redirects");
        error.statusCode = 400;
        throw error;
      }
      currentUrl = new URL(response.headers.get("location"), currentUrl);
      continue;
    }
    return response;
  }
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function extractPageTitle(html) {
  const source = String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const h1 = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const raw = h1?.[1] || title?.[1] || "";
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

async function fetchHtmlPage(targetUrl) {
  const url = new URL(targetUrl);
  await assertFetchUrlAllowed(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "goal3-content-extractor/0.1 (+content-scope-preview)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { ok: false, status: response.status, html: "", title: "", url: response.url || url.href };
    }
    const html = await response.text();
    return {
      ok: true,
      status: response.status,
      html: html.slice(0, 1500000),
      title: extractPageTitle(html),
      url: response.url || url.href,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLinkTitle(targetUrl) {
  const url = new URL(targetUrl);
  await assertFetchUrlAllowed(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "goal2-a11y-review/0.1 (+link-title-preview)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { ok: false, status: response.status, title: "" };
    }
    const html = await response.text();
    const title = extractPageTitle(html.slice(0, 300000));
    return { ok: Boolean(title), status: response.status, title };
  } finally {
    clearTimeout(timeout);
  }
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_CONTENT_TYPES = /^image\/(jpeg|png|webp|gif)/i;

async function fetchImageAsBase64(targetUrl) {
  const url = new URL(targetUrl);
  await assertFetchUrlAllowed(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
      headers: { "user-agent": "goal2-a11y-review/0.1 (+image-alt-preview)" },
    });
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
    if (!response.ok || !ALLOWED_IMAGE_CONTENT_TYPES.test(contentType)) {
      const error = new Error(`Unsupported or unreachable image (status ${response.status}, content-type ${contentType || "unknown"})`);
      error.statusCode = 400;
      throw error;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      const error = new Error("Image exceeds the 4MB size limit");
      error.statusCode = 413;
      throw error;
    }
    return { base64: Buffer.from(arrayBuffer).toString("base64"), mimeType: contentType };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  isBlockedIpAddress,
  assertFetchUrlAllowed,
  fetchWithSafeRedirects,
  decodeHtmlEntities,
  extractPageTitle,
  fetchHtmlPage,
  fetchLinkTitle,
  fetchImageAsBase64,
};
