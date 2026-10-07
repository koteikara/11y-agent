// 一括処理がエンジンのページ(public/engine.html)に足す道具。ページの中で動く。
// 本文抽出(window.goal3Engine)を使い、構造のハッシュ、本文のハッシュ、本文の範囲の案を作る。
// 決め方は docs/renewal/ARCHITECTURE.md の「取得とページの台帳」「構造の型と本文の範囲」。
(function () {
  "use strict";

  const MARK = "data-batch-mark";
  const FILE_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|txt|odt|ods|odp|jtd)(?:$|[?#])/i;

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  // ID とクラスの数字は、ページごとに変わることが多い(記事の番号など)。型が細かく割れないように伏せる。
  function maskDigits(value) {
    return value.replace(/[0-9]+/g, "#");
  }

  function elementSignature(element) {
    let signature = element.tagName.toLowerCase();
    if (element.id) signature += `#${maskDigits(element.id)}`;
    const classes = [...element.classList].map(maskDigits).sort();
    if (classes.length) signature += `.${classes.join(".")}`;
    return signature;
  }

  // 本文の要素の中身を1つの印に置き換え、文字を除いた要素の並びを作る。
  // 同じ並びが続く兄弟(メニューの項目、パンくずの段)は1つに潰す。
  function structureOf(element, contentElement) {
    if (element === contentElement) return "[本文]";
    const children = [];
    for (const child of element.children) {
      const childStructure = structureOf(child, contentElement);
      if (children[children.length - 1] !== childStructure) children.push(childStructure);
    }
    return `${elementSignature(element)}(${children.join(",")})`;
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  // 本文の範囲の案を、ほかのページでも当てはまる CSS セレクターで表す。ID、クラス、
  // ID のある先祖からの道の順に試し、文書の中で1つに決まるものを使う。
  function selectorFor(element) {
    const doc = element.ownerDocument;
    const unique = (selector) => {
      try {
        return doc.querySelectorAll(selector).length === 1 && doc.querySelector(selector) === element;
      } catch {
        return false;
      }
    };
    const tag = element.tagName.toLowerCase();
    if (tag === "body") return "body";
    if (element.id && unique(`#${cssEscape(element.id)}`)) return `#${cssEscape(element.id)}`;
    const classes = [...element.classList].filter((name) => !/[0-9]/.test(name));
    if (classes.length) {
      const byClass = `${tag}.${classes.map(cssEscape).join(".")}`;
      if (unique(byClass)) return byClass;
    }
    const steps = [];
    let current = element;
    while (current && current.tagName && current.tagName.toLowerCase() !== "body") {
      if (current !== element && current.id && unique(`#${cssEscape(current.id)}`)) {
        steps.unshift(`#${cssEscape(current.id)}`);
        return steps.join(" > ");
      }
      const currentTag = current.tagName.toLowerCase();
      const sameTag = [...(current.parentElement?.children || [])].filter((child) => child.tagName === current.tagName);
      steps.unshift(sameTag.length > 1 ? `${currentTag}:nth-of-type(${sameTag.indexOf(current) + 1})` : currentTag);
      current = current.parentElement;
    }
    steps.unshift("body");
    return steps.join(" > ");
  }

  function countReferences(html, baseUrl) {
    const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
    let base = null;
    try {
      base = baseUrl ? new URL(baseUrl) : null;
    } catch {
      base = null;
    }
    const resolve = (value) => {
      try {
        return new URL(value, base || undefined);
      } catch {
        return null;
      }
    };
    const images = [...doc.querySelectorAll("img[src]")].map((img) => img.getAttribute("src"));
    const links = [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    const files = links.filter((href) => FILE_EXTENSIONS.test(href));
    const externalLinks = links.filter((href) => {
      const url = resolve(href);
      return url && /^https?:$/.test(url.protocol) && base && url.host !== base.host;
    });
    return { images: images.length, files: files.length, links: links.length, externalLinks: externalLinks.length };
  }

  window.batchTools = {
    // 取得したページを1件調べる。本文は汎用の判定で選ぶ(型の範囲は、型のまとめのあとで決まる)。
    async inspectPage({ html, pageTitle, url }) {
      // goal3Engine.extract は、ヘッダーやナビゲーションを消した別の文書で本文を選ぶ。構造は消す前の
      // 文書で見たいので、要素に番号を付けた写しを渡し、選ばれた要素を番号で元の文書から探す。
      const parsed = new DOMParser().parseFromString(html || "", "text/html");
      parsed.querySelectorAll("*").forEach((element, index) => element.setAttribute(MARK, String(index)));
      const extraction = window.goal3Engine.extract(parsed.documentElement.outerHTML, pageTitle, url);
      const top = extraction.candidates[0] || null;
      const mark = top?.element?.getAttribute(MARK);
      const contentElement = mark != null ? parsed.querySelector(`[${MARK}="${mark}"]`) : null;
      const structure = parsed.body ? structureOf(parsed.body, contentElement) : "";
      const bodyText = normalizeText(top ? top.text : "");
      return {
        pageTitle: extraction.pageTitle,
        structureHash: structure ? (await sha256Hex(structure)).slice(0, 16) : null,
        bodyHash: bodyText ? (await sha256Hex(bodyText)).slice(0, 16) : null,
        bodyTextLength: bodyText.length,
        contentSelector: contentElement ? selectorFor(contentElement) : null,
        references: countReferences(top ? top.html : "", url),
      };
    },

    // 本文を抜き出す。selector があれば型の範囲で、無いか見つからなければ汎用の判定で抜く。
    async extractBody({ html, pageTitle, url, selector }) {
      if (selector) {
        const result = window.goal3Engine.extractAt(html, selector, pageTitle, url);
        if (result && normalizeText(result.candidate.text)) {
          return {
            method: "template",
            selector,
            pageTitle: result.pageTitle,
            html: result.candidate.html,
            bodyHash: (await sha256Hex(normalizeText(result.candidate.text))).slice(0, 16),
          };
        }
      }
      const extraction = window.goal3Engine.extract(html, pageTitle, url);
      const top = extraction.candidates[0];
      if (!top) return { method: "none", selector: null, pageTitle: extraction.pageTitle, html: "", bodyHash: null };
      return {
        method: selector ? "generic-fallback" : "generic",
        selector: selectorFor(top.element),
        pageTitle: extraction.pageTitle,
        html: top.html,
        bodyHash: (await sha256Hex(normalizeText(top.text))).slice(0, 16),
      };
    },

    // 型の範囲で抜いた本文と、汎用の判定で抜いた本文が食い違うか(型のまとめの「食い違いの数」)。
    async compareWithGeneric({ html, pageTitle, url, selector }) {
      const byTemplate = await this.extractBody({ html, pageTitle, url, selector });
      const byGeneric = await this.extractBody({ html, pageTitle, url, selector: null });
      return { matched: byTemplate.method === "template" && byTemplate.bodyHash === byGeneric.bodyHash, templateFound: byTemplate.method === "template" };
    },
  };
})();
