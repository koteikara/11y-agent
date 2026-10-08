// 一括処理がエンジンのページ(public/engine.html)に足す道具。ページの中で動く。
// 本文抽出(window.goal3Engine)を使い、構造(要素の道の集まり)、本文のハッシュ、本文の範囲の案を作る。
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

  // メニューで今いる項目に付く状態のクラス(globalPrimaryMenuSelected、current など)は、末尾を落として
  // ほかの項目と同じ名前にする。遠野市の試走で、これがあると同じテンプレートのページが別の構造になった。
  const STATE_SUFFIX = /(selected|current|active|open|on|over|hover|stay)$/i;

  function elementSignature(element) {
    let signature = element.tagName.toLowerCase();
    if (element.id) signature += `#${maskDigits(element.id)}`;
    const classes = [...new Set([...element.classList].map((name) => maskDigits(name).replace(STATE_SUFFIX, "")).filter(Boolean))].sort();
    if (classes.length) signature += `.${classes.join(".")}`;
    return signature;
  }

  // 構造は、body から深さ STRUCTURE_DEPTH までの「要素の道」(body>div#wrap>div.main のような並び)の集まりで表す。
  // 文字と、文の中の要素(a、span など)は見ない。型のまとめは、この集まりの重なりで似ているページを
  // まとめる(一部のページだけにある部品や、メニューの開き方の違いで割れないようにするため)。
  // 汎用の判定が選んだ本文の要素には頼らない。遠野市の試走で、汎用の判定がページ全体を本文に選んだ
  // ページは構造のほとんどが外れ、同じ作りのページが別の型になった。本文の中の違いは、深さの上限と、
  // 重なりで比べることで吸収する。
  // 構造の取り方の版。取り方を変えたら上げる。承認した型は、同じ版の構造とだけ比べる。
  // 上げたら、巡回が残す analysis.json も作り直させるため、commands/crawl.js の ANALYSIS_VERSION も上げる。
  const STRUCTURE_VERSION = 2;
  const STRUCTURE_DEPTH = 6;
  // 文の中の要素と、本文を作る要素(段落、見出し、表、リストなど)は、構造に入れず、中にも入らない。
  // 本文の作りはページごとに違うので、入れると同じテンプレートのページが別の型になる(本文が浅い所に
  // あるサイトで起きた)。テンプレートの骨組みは、div や header などの入れ物の並びで見る。
  const SKIP_TAGS = new Set([
    "script", "style", "noscript", "template", "link", "meta", "br", "wbr", "img", "picture", "source",
    "span", "a", "strong", "em", "b", "i", "u", "small", "font", "label", "input", "button", "select", "option", "textarea",
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "table", "ul", "ol", "dl", "li", "blockquote", "pre", "figure", "hr", "iframe",
  ]);

  function structurePathsOf(body) {
    const paths = new Set();
    const walk = (element, prefix, depth) => {
      for (const child of element.children) {
        if (SKIP_TAGS.has(child.tagName.toLowerCase())) continue;
        const path = `${prefix}>${elementSignature(child)}`;
        paths.add(path);
        if (depth < STRUCTURE_DEPTH) walk(child, path, depth + 1);
      }
    };
    walk(body, "body", 1);
    return [...paths].sort();
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  // 本文の範囲の案を、ほかのページでも当てはまる CSS セレクターで表す。ID、クラス、
  // ID のある先祖からの道の順に試し、文書の中で1つに決まるものを使う。
  function selectorFor(element) {
    const doc = element.ownerDocument;
    const unique = (selector, target = element) => {
      try {
        return doc.querySelectorAll(selector).length === 1 && doc.querySelector(selector) === target;
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
      if (current !== element && current.id && unique(`#${cssEscape(current.id)}`, current)) {
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
      const paths = parsed.body ? structurePathsOf(parsed.body) : [];
      const structurePaths = await Promise.all(paths.map(async (path) => (await sha256Hex(path)).slice(0, 10)));
      const bodyText = normalizeText(top ? top.text : "");
      return {
        pageTitle: extraction.pageTitle,
        structureHash: paths.length ? (await sha256Hex(paths.join("\n"))).slice(0, 16) : null,
        structurePaths,
        structureVersion: STRUCTURE_VERSION,
        bodyHash: bodyText ? (await sha256Hex(bodyText)).slice(0, 16) : null,
        bodyTextLength: bodyText.length,
        contentSelector: contentElement ? selectorFor(contentElement) : null,
        references: countReferences(top ? top.html : "", url),
      };
    },

    // 本文を抜き出す。selector があれば型の範囲で、無いか見つからなければ汎用の判定で抜く。
    async extractBody({ html, pageTitle, url, selector, exclude = [] }) {
      if (selector) {
        const result = window.goal3Engine.extractAt(html, selector, pageTitle, url, exclude);
        if (result && normalizeText(result.candidate.text)) {
          return {
            method: "template",
            selector,
            pageTitle: result.pageTitle,
            html: result.candidate.html,
            textLength: normalizeText(result.candidate.text).length,
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

    // コンテンツパターンの抽出用。ページの構造(要素の道の集まり)だけを返す。本文の抽出はしない。
    async structureOnly({ html }) {
      const parsed = new DOMParser().parseFromString(html || "", "text/html");
      const paths = parsed.body ? structurePathsOf(parsed.body) : [];
      return {
        structurePaths: await Promise.all(paths.map(async (path) => (await sha256Hex(path)).slice(0, 10))),
        structureVersion: STRUCTURE_VERSION,
      };
    },

    // 巡回用。ページの題名(title 要素)と、ページの中のリンク先(絶対 URL、# 以降は落とす)を返す。
    // a と area の href、frame と iframe の src を見る。本文のハッシュは重複のページを見つけるのに使う。
    async pageLinks({ html, url }) {
      const parsed = new DOMParser().parseFromString(html || "", "text/html");
      const base = parsed.querySelector("base[href]")?.getAttribute("href");
      let baseUrl = url;
      try {
        if (base) baseUrl = new URL(base, url).href;
      } catch {
        baseUrl = url;
      }
      const links = new Set();
      const scriptLinks = new Set();
      // スクリプトの中から拾った URL。どこで見つけたかを数えるため、要素のリンクと分ける。
      const addScript = (value) => {
        const href = add(value);
        if (href) scriptLinks.add(href);
      };
      const scriptUrls = (code) => {
        if (!code) return [];
        const found = [];
        const pattern = /(?:location(?:\.href)?\s*=|location\.(?:assign|replace)\(|window\.open\(|open\()\s*['"]([^'"]+)['"]/gi;
        for (const match of String(code).matchAll(pattern)) found.push(match[1]);
        return found;
      };
      const add = (value) => {
        if (!value) return null;
        try {
          const target = new URL(value.trim(), baseUrl);
          if (!/^https?:$/.test(target.protocol)) return null;
          target.hash = "";
          // すでに見つけた URL は、二度目として数えない(スクリプトの中で見つけた数を正しく出すため)。
          if (links.has(target.href)) return null;
          links.add(target.href);
          return target.href;
        } catch {
          // 書き方の誤ったリンクは飛ばす。
          return null;
        }
      };
      // リンクを探す場所は、WebCopy に倣って広く取る。Website Explorer で取りこぼすのは、メニューを
      // スクリプトで作るサイトが多い(2026-10-07 ユーザー)。
      // 1. 要素のリンク: a、area の href、frame、iframe の src、link の next、prev、alternate。
      parsed.querySelectorAll("a[href],area[href]").forEach((element) => {
        const href = element.getAttribute("href");
        if (/^\s*javascript:/i.test(href)) scriptUrls(href).forEach(addScript);
        else add(href);
      });
      parsed.querySelectorAll("frame[src],iframe[src]").forEach((element) => add(element.getAttribute("src")));
      parsed.querySelectorAll('link[rel~="next" i][href],link[rel~="prev" i][href],link[rel~="alternate" i][href]').forEach((element) =>
        add(element.getAttribute("href"))
      );
      // 2. 自動の転送: meta refresh の url=。
      parsed.querySelectorAll('meta[http-equiv="refresh" i][content]').forEach((element) => {
        const match = /url\s*=\s*['"]?([^'";]+)/i.exec(element.getAttribute("content"));
        if (match) add(match[1]);
      });
      // 3. スクリプトの中: onclick などと、ページの中の script の、location.href = '…'、window.open('…') などの文字列。
      parsed.querySelectorAll("[onclick],[ondblclick],[onchange],[onmousedown],[onkeypress]").forEach((element) => {
        for (const name of ["onclick", "ondblclick", "onchange", "onmousedown", "onkeypress"]) {
          scriptUrls(element.getAttribute(name)).forEach(addScript);
        }
      });
      parsed.querySelectorAll("script:not([src])").forEach((element) => scriptUrls(element.textContent).forEach(addScript));
      // 4. 選ぶメニュー: option の value が URL のもの(select で別のページへ移るメニュー)。
      parsed.querySelectorAll("select option[value]").forEach((element) => {
        const value = element.getAttribute("value");
        if (/^(https?:\/\/|\/|\.\.?\/)|\.(html?|php|aspx?|jsp|cfm)(\?|$)/i.test(value || "")) addScript(value);
      });
      const hasScripts = Boolean(parsed.querySelector("script"));
      const title = normalizeText(parsed.querySelector("title")?.textContent || "");
      parsed.querySelectorAll("script,style,noscript,template").forEach((element) => element.remove());
      const text = normalizeText(parsed.body?.textContent || "");
      return {
        title,
        links: [...links],
        scriptLinks: [...scriptLinks],
        hasScripts,
        bodyHash: text ? (await sha256Hex(text)).slice(0, 16) : null,
        robotsNoFollow: /nofollow/i.test(parsed.querySelector('meta[name="robots" i]')?.getAttribute("content") || ""),
      };
    },

    // 範囲の中の、ID かクラスを持つ要素(範囲から4段まで)を、セレクターと中身のハッシュで返す。
    // 型のまとめが、型の多くのページで中身が同じ要素(印刷のボタンなどのテンプレートの部品)を見つけ、
    // 範囲から除く案にするのに使う。中身の数字は伏せる(ページの番号を含むリンクなど)。
    async partsInside({ html, selector }) {
      const parsed = new DOMParser().parseFromString(html || "", "text/html");
      let root = null;
      try {
        root = selector === "body" ? parsed.body : parsed.querySelector(selector);
      } catch {
        root = null;
      }
      if (!root) return null;
      const parts = [];
      const walk = async (element, depth) => {
        for (const child of element.children) {
          const tag = child.tagName.toLowerCase();
          const classes = [...child.classList].filter((name) => !/[0-9]/.test(name));
          let partSelector = null;
          if (child.id && !/[0-9]/.test(child.id)) partSelector = `#${cssEscape(child.id)}`;
          else if (classes.length) partSelector = `${tag}.${classes.map(cssEscape).join(".")}`;
          if (partSelector) {
            const content = maskDigits(child.outerHTML.replace(/\s+/g, " "));
            parts.push({ selector: partSelector, hash: (await sha256Hex(content)).slice(0, 12) });
          }
          if (depth < 4) await walk(child, depth + 1);
        }
      };
      await walk(root, 1);
      return parts;
    },

    // ページの文字を、段落や表のセルなどのかたまりごとに分けて返す。body 全体と、selectors の各要素の分。
    // 型のまとめが、型の多くのページに共通するかたまり(ヘッダー、メニュー、フッター)と、ページごとに
    // 違うかたまり(本文)を見分け、本文の範囲の案を選ぶのに使う。かたまりはハッシュにして返す。
    async textBlocks({ html, selectors }) {
      const parsed = new DOMParser().parseFromString(html || "", "text/html");
      parsed.querySelectorAll("script,style,noscript,template").forEach((element) => element.remove());
      const BLOCK = /^(p|li|td|th|h[1-6]|dt|dd|caption|figcaption|pre|blockquote|div|section|article|aside|header|footer|nav|main|ul|ol|dl|table|tr|form|address)$/i;
      const blocksOf = async (root) => {
        if (!root) return null;
        const texts = new Map();
        const walker = parsed.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = normalizeText(node.nodeValue);
          if (!text) continue;
          let block = node.parentElement;
          while (block && block !== root && !BLOCK.test(block.tagName)) block = block.parentElement;
          const key = block || root;
          texts.set(key, `${texts.get(key) || ""} ${text}`);
        }
        const blocks = [];
        for (const text of texts.values()) {
          const value = normalizeText(text);
          blocks.push({ hash: (await sha256Hex(value)).slice(0, 12), length: value.length });
        }
        return blocks;
      };
      const perSelector = {};
      for (const selector of selectors) {
        let element = null;
        try {
          element = selector === "body" ? parsed.body : parsed.querySelector(selector);
        } catch {
          element = null;
        }
        perSelector[selector] = await blocksOf(element);
      }
      return { body: await blocksOf(parsed.body), perSelector };
    },

    // 移行管理シートの下書き用。題名、h1、パンくず、問い合わせ先、本文のリンクの割合を返す。
    // パンくずと問い合わせ先は、案件の設定のセレクターがあればそれで、無ければよくある名前と見出しで探す。
    // 見つけ方(どの要素か)も返し、下書きの理由の列に出す。
    async sheetFacts({ html, url, breadcrumbSelector = null, contactSelector = null }) {
      const parsed = new DOMParser().parseFromString(html || "", "text/html");
      parsed.querySelectorAll("script,style,noscript,template").forEach((element) => element.remove());
      const title = normalizeText(parsed.querySelector("title")?.textContent || "");
      const h1 = normalizeText(parsed.querySelector("h1")?.textContent || "");
      const pick = (selector) => {
        if (!selector) return null;
        try {
          return parsed.querySelector(selector);
        } catch {
          return null;
        }
      };
      const nameOf = (element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.classList.length ? `.${[...element.classList].join(".")}` : ""}`;

      // パンくず: 項目(リンクか li)が2つ以上ある、名前がそれらしい要素。名前は語の単位で合わせる
      // (body の path-node や、所在地の #location に当てないため)。body と html は候補にしない。
      const BREADCRUMB_NAME = /(^|[\s_-])(pankuzu|breadcrumbs?|bread|topicpath|topic_path|crumbs?|current_path)($|[\s_-])|breadcrumb|pankuzu|topicpath/i;
      // 区切りの文字。「/」は項目の名前(保健/医療)にも使われるので、前後に空白があるときだけ区切りとみなす。
      const CRUMB_SEPARATOR = /\s*(?:>|＞|›|»|＼|→)\s*|\s+\/\s+/;
      const crumbItems = (element) => {
        const items = [...element.querySelectorAll("li")].map((li) => normalizeText(li.textContent)).filter(Boolean);
        if (items.length >= 2) return items;
        // li が無いときは、リンクの文字と、区切りで分けた文字の多い方を使う。最後の項目(今のページ)は
        // リンクでないことが多く、リンクだけを集めると今のページが抜ける(下のページがみなカテゴリになる)。
        const links = [...element.querySelectorAll("a")].map((a) => normalizeText(a.textContent)).filter(Boolean);
        const parts = normalizeText(element.textContent).split(CRUMB_SEPARATOR).map(normalizeText).filter(Boolean);
        const list = parts.length > links.length ? parts : links;
        return list.length >= 2 ? list : [];
      };
      let breadcrumb = null;
      const breadcrumbCandidates = breadcrumbSelector
        ? [pick(breadcrumbSelector)].filter(Boolean)
        : [
            ...parsed.querySelectorAll('[itemtype*="BreadcrumbList"], nav[aria-label*="パンくず"], nav[aria-label*="breadcrumb" i]'),
            ...[...parsed.querySelectorAll("[id],[class]")].filter(
              (element) => !/^(body|html)$/i.test(element.tagName) && BREADCRUMB_NAME.test(`${element.id} ${element.className}`)
            ),
          ];
      for (const element of breadcrumbCandidates) {
        const items = crumbItems(element).map((item) => item.replace(/^(現在の位置|現在地|現在位置)\s*[:：]?\s*/, "")).filter(Boolean);
        if (items.length >= 2 && items.join("").length < 300) {
          // 最後の項目が題名にも h1 にも含まれなければ、今のページが抜けているかもしれないので印を付ける。
          const last = items[items.length - 1].replace(/\s+/g, "");
          const current = `${title}${h1}`.replace(/\s+/g, "");
          breadcrumb = { items, found: breadcrumbSelector ? `設定 ${breadcrumbSelector}` : nameOf(element), lastIsCurrent: Boolean(last) && current.includes(last) };
          break;
        }
      }

      // 問い合わせ先: 名前がそれらしい要素か、「お問い合わせ」の見出しのあとの文字から、担当の部署の名前を取る。
      // 部署の名前として受け取るのは、課や室などの単位の語で終わるものだけにする(本文の文や住所、ヘッダーの
      // 「お問い合わせ」のリンクの並びを拾わないため。遠野市では、単位の語が無いものの中に本文の文があった)。
      const CONTACT_NAME = /(contact|toiawase|otoiawase|inquiry|section_info|sectioninfo|signature|shomei|tantou|tanto)/i;
      // 見出しとみなすのは、文字が見出しの言い回しそのもののときだけ(本文の「詳しくはお問い合わせください」に当てない)。
      const CONTACT_HEADING = /^(このページ(の(情報|内容))?に関する)?(お)?問い?合わ?せ(先)?(は(こちら)?)?[:：]?$|^(担当課|担当部署|担当|所管課)[:：]?$/;
      const DEPARTMENT_UNIT = /(課|室|局|係|班|担当|センター|館|所|園|校|事務局|委員会|部)(\s|$)/;
      const STOP = /(電話|TEL|Tel|ＴＥＬ|ファクス|ファックス|FAX|Fax|ＦＡＸ|〒|住所|所在地|メール|E-?mail|Ｅメール|内線|〔|【)/;
      // 段落や行の区切りを空白にして、要素の文字を取る(textContent は段落の文字を区切りなしにつなぐ)。
      const blockText = (element) => {
        const copy = element.cloneNode(true);
        copy.querySelectorAll("p,div,li,dt,dd,br,tr,td,th,h1,h2,h3,h4,h5,h6,address,section").forEach((block) => block.after(" / "));
        return normalizeText(copy.textContent);
      };
      const HEADING_WORDS = /(このページに関する)?(お問い?合わ?せ先?|問い?合わ?せ先|担当課|担当部署)(は)?/g;
      const departmentOf = (element) => {
        const cleaned = blockText(element)
          .replace(HEADING_WORDS, " ")
          .replace(/^[\s:：/]+/, "");
        // 電話や住所が始まる所までを取る。部と課が別の行に書かれていることがある(遠野市は「総務企画部」の
        // 次の行に「経営企画課」)ので、行の区切りは空白にしてつなぐ。
        return nameFrom(cleaned.split(STOP)[0].replace(/\s*\/\s*/g, " "));
      };
      const nameFrom = (text) => {
        const cleaned = normalizeText(text).replace(/^[\s:：]+/, "");
        const head = cleaned.split(STOP)[0];
        const name = normalizeText(head).replace(/[、,。:：\s]+$/, "");
        return name && name.length <= 60 && DEPARTMENT_UNIT.test(name) && !/[。、]/.test(name) ? name : null;
      };
      let contact = null;
      const contactElements = contactSelector
        ? [pick(contactSelector)].filter(Boolean)
        : [...parsed.querySelectorAll("[id],[class]")].filter((element) => CONTACT_NAME.test(`${element.id} ${element.className}`));
      for (const element of contactElements) {
        const department = departmentOf(element);
        if (department) {
          contact = { department, found: contactSelector ? `設定 ${contactSelector}` : nameOf(element) };
          break;
        }
      }
      if (!contact && !contactSelector) {
        const headings = [...parsed.querySelectorAll("h2,h3,h4,h5,h6,dt,th,strong,p")].filter((element) =>
          CONTACT_HEADING.test(normalizeText(element.textContent).replace(/[「」『』\s]/g, ""))
        );
        for (const heading of headings) {
          const next = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
          const department = next ? departmentOf(next) : null;
          if (department) {
            contact = { department, found: `見出し「${normalizeText(heading.textContent).slice(0, 20)}」のあと` };
            break;
          }
        }
      }

      // 本文(汎用の判定で選んだ要素)の文字の量と、そのうちリンクの文字の割合。カテゴリのページ(下のページへの
      // リンクだけ)かを見分けるのに使う。
      const extraction = window.goal3Engine.extract(parsed.documentElement.outerHTML, title, url);
      const top = extraction.candidates[0] || null;
      let bodyText = 0;
      let linkText = 0;
      let links = 0;
      if (top?.element) {
        bodyText = normalizeText(top.element.textContent).length;
        top.element.querySelectorAll("a[href]").forEach((a) => {
          links += 1;
          linkText += normalizeText(a.textContent).length;
        });
      }
      return {
        title,
        h1,
        breadcrumb,
        contact,
        body: { textLength: bodyText, linkTextLength: linkText, links, forms: parsed.querySelectorAll("form").length },
      };
    },

    // 型の範囲で抜いた本文と、汎用の判定で抜いた本文が食い違うか(型のまとめの「食い違いの数」)。
    async compareWithGeneric({ html, pageTitle, url, selector, exclude = [] }) {
      const byTemplate = await this.extractBody({ html, pageTitle, url, selector, exclude });
      const byGeneric = await this.extractBody({ html, pageTitle, url, selector: null });
      return {
        matched: byTemplate.method === "template" && byTemplate.bodyHash === byGeneric.bodyHash,
        templateFound: byTemplate.method === "template",
        textLength: byTemplate.method === "template" ? byTemplate.textLength : 0,
      };
    },
  };
})();
