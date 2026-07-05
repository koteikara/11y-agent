(function () {
  "use strict";

  const els = {
    sourceUrlInput: document.getElementById("sourceUrlInput"),
    pageTitleInput: document.getElementById("pageTitleInput"),
    fullHtmlInput: document.getElementById("fullHtmlInput"),
    fetchUrlButton: document.getElementById("fetchUrlButton"),
    extractButton: document.getElementById("extractButton"),
    resetButton: document.getElementById("resetButton"),
    goal3Loading: document.getElementById("goal3Loading"),
    goal3LoadingText: document.getElementById("goal3LoadingText"),
    candidateSummary: document.getElementById("candidateSummary"),
    candidateCount: document.getElementById("candidateCount"),
    candidateList: document.getElementById("candidateList"),
    candidateDetail: document.getElementById("candidateDetail"),
    detailSummary: document.getElementById("detailSummary"),
    contentPreview: document.getElementById("contentPreview"),
    sourcePreviewFrame: document.getElementById("sourcePreviewFrame"),
    sourcePreviewStatus: document.getElementById("sourcePreviewStatus"),
    extractedHtmlOutput: document.getElementById("extractedHtmlOutput"),
    sendGoal2Button: document.getElementById("sendGoal2Button"),
    copyHtmlButton: document.getElementById("copyHtmlButton"),
  };

  const state = {
    candidates: [],
    selectedId: null,
  };

  bindEvents();
  render();

  function bindEvents() {
    els.fetchUrlButton.addEventListener("click", fetchSourceUrl);
    els.extractButton.addEventListener("click", extractCandidates);
    els.resetButton.addEventListener("click", reset);
    els.copyHtmlButton.addEventListener("click", () => copyText(selectedCandidate()?.html || ""));
    els.sendGoal2Button.addEventListener("click", sendToGoal2);
  }

  async function fetchSourceUrl() {
    const url = els.sourceUrlInput.value.trim();
    if (!url) {
      setSummary("旧ページURLを入力してください。", "未取得");
      return;
    }
    setSummary("旧ページHTMLを取得しています。", "取得中");
    setLoading(true, "URLからHTMLを取得しています…");
    try {
      const response = await fetch(`/api/fetch-html?${new URLSearchParams({ url }).toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "取得できませんでした");
      }
      els.fullHtmlInput.value = payload.html || "";
      if (!els.pageTitleInput.value.trim() && payload.title) {
        els.pageTitleInput.value = payload.title;
      }
      setSummary("取得しました。候補抽出を実行できます。", "取得済");
    } catch (error) {
      setSummary(`取得に失敗しました: ${error.message}`, "エラー");
    } finally {
      setLoading(false);
    }
  }

  async function extractCandidates() {
    const html = els.fullHtmlInput.value.trim();
    if (!html) {
      setSummary("旧ページHTMLを貼り付けるか、URLから取得してください。", "未抽出");
      return;
    }
    setLoading(true, "本文候補を抽出しています…");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const document = new DOMParser().parseFromString(html, "text/html");
      const pageTitle = els.pageTitleInput.value.trim() || pageTitleFromDocument(document);
      if (!els.pageTitleInput.value.trim() && pageTitle) {
        els.pageTitleInput.value = pageTitle;
      }

      const candidates = buildContentCandidates(document, pageTitle);
      state.candidates = candidates;
      state.selectedId = candidates[0]?.id || null;
      render();
    } finally {
      setLoading(false);
    }
  }

  function buildContentCandidates(document, pageTitle) {
    const body = document.body;
    if (!body) return [];
    sanitizeDocument(body);
    const containers = candidateContainers(body);
    const candidates = containers
      .map((element, index) => buildCandidate(element, index, pageTitle))
      .filter((candidate) => candidate.textLength >= 30 || candidate.parts.headings > 0 || candidate.parts.tables > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    return dedupeCandidates(candidates).slice(0, 5);
  }

  function sanitizeDocument(root) {
    root.querySelectorAll("script,style,noscript,template,svg,canvas").forEach((element) => element.remove());
    root.querySelectorAll("header,footer,nav,aside,form").forEach((element) => {
      if (isLikelyContentBlock(element)) return;
      element.remove();
    });
  }

  function candidateContainers(body) {
    const elements = [...body.querySelectorAll("main,article,section,div,td")].filter((element) => {
      if (!element.children.length && normalizeText(element.textContent).length < 80) return false;
      if (isMostlyTemplateText(element)) return false;
      return (
        normalizeText(element.textContent).length >= 40 ||
        element.querySelector("h2,h3,p,table,img,a[href]") ||
        hasMultipleSubstantiveChildren(element) ||
        isMixedContentContainer(element)
      );
    });
    return [body, ...elements];
  }

  function buildCandidate(element, index, pageTitle) {
    const clone = cleanContentClone(element, pageTitle);
    const html = cleanHtml(clone.innerHTML || clone.outerHTML);
    const text = normalizeText(clone.textContent);
    const links = clone.querySelectorAll("a").length;
    const parts = {
      headings: clone.querySelectorAll("h2,h3,h4,h5,h6").length,
      paragraphs: clone.querySelectorAll("p,li,dd").length,
      tables: clone.querySelectorAll("table").length,
      tableRows: clone.querySelectorAll("tr").length,
      images: clone.querySelectorAll("img,figure").length,
      fileLinks: clone.querySelectorAll('a[href$=".pdf"],a[href$=".doc"],a[href$=".docx"],a[href$=".xls"],a[href$=".xlsx"]').length,
      h1Removed: element.querySelectorAll("h1").length,
    };
    parts.isFileListContent = isFileListContent(clone, parts);
    parts.isNewsListContent = isNewsListContent(clone, parts);
    const linkDensity = text.length ? links / Math.max(1, text.length / 80) : 99;
    const excluded = exclusionSummary(element, clone);
    const score = scoreCandidate({ textLength: text.length, links, linkDensity, parts, excluded, element });
    return {
      id: `goal3_cand_${String(index + 1).padStart(3, "0")}`,
      label: candidateLabel(element, index),
      score,
      textLength: text.length,
      linkDensity,
      parts,
      excluded,
      html,
      path: domPath(element),
      element,
    };
  }

  function cleanContentClone(element, pageTitle) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("h1").forEach((heading) => heading.remove());
    clone.querySelectorAll("*").forEach((node) => {
      if (isStrictBreadcrumbTrail(node)) node.remove();
    });
    clone.querySelectorAll("*").forEach((node) => {
      if (isTemplateUtilityElement(node)) node.remove();
    });
    clone.querySelectorAll("a,button").forEach((node) => {
      if (isPageTopText(node.textContent)) node.remove();
    });
    clone.querySelectorAll("*").forEach((node) => {
      if (isSkipToContentText(node.textContent) && !node.children.length) node.remove();
    });
    clone.querySelectorAll("*").forEach((node) => {
      if (isSignatureBlock(node)) node.remove();
    });
    clone.querySelectorAll("*").forEach((node) => {
      if (isFeedbackSection(node)) node.remove();
    });
    removeEmptyElements(clone);
    if (pageTitle) {
      [...clone.querySelectorAll("h2,h3,h4,p,div,span")].forEach((node) => {
        if (isPageTitleDuplicate(node, pageTitle)) node.remove();
      });
    }
    removeLeadingTemplateFragments(clone, pageTitle);
    removeDuplicateLeadingFragments(clone);
    return clone;
  }

  function scoreCandidate(candidate) {
    let score = 0;
    score += Math.min(45, Math.floor(candidate.textLength / 35));
    score += Math.min(18, candidate.parts.headings * 4);
    score += Math.min(12, candidate.parts.paragraphs * 2);
    score += Math.min(10, candidate.parts.tables * 5);
    score += Math.min(16, candidate.parts.tableRows);
    score += Math.min(8, candidate.parts.images * 2);
    score += Math.min(candidate.parts.isFileListContent ? 28 : 7, candidate.parts.fileLinks * 4);
    if (candidate.parts.paragraphs >= 4 && candidate.parts.tables >= 1) score += 12;
    if (candidate.parts.fileLinks >= 3 && candidate.parts.tables >= 1) score += 10;
    if (hasMultipleSubstantiveChildren(candidate.element)) score += 12;
    if (isMixedContentContainer(candidate.element)) score += 10;
    if (candidate.parts.isFileListContent || candidate.parts.isNewsListContent) {
      score += 14;
      if (candidate.linkDensity > 6) score -= 8;
    } else {
      if (candidate.linkDensity > 3) score -= 20;
      if (candidate.linkDensity > 5) score -= 25;
    }
    if (isMostlyTemplateText(candidate.element)) score -= 40;
    if (candidate.excluded.signature > 0) score += 2;
    if (candidate.parts.h1Removed > 0) score += 2;
    return Math.max(0, score);
  }

  function isNewsListContent(root, parts) {
    const text = normalizeText(root.textContent);
    const links = root.querySelectorAll("a").length;
    const datedItems = (text.match(/(?:令和|平成)?[0-9０-９]{1,4}年[0-9０-９]{1,2}月[0-9０-９]{1,2}日/g) || []).length;
    const yearItems = (text.match(/(?:令和|平成)?[0-9０-９]{4}年|20[0-9]{2}年/g) || []).length;
    return Boolean(
      links >= 5 &&
        (parts.headings > 0 || parts.paragraphs > 3) &&
        /お知らせ|ニュース|新着|一覧|年度|市政|弘前|news/i.test(text) &&
        datedItems + yearItems >= 3
    );
  }

  function isFileListContent(root, parts) {
    if (parts.fileLinks < 3) return false;
    const text = normalizeText(root.textContent);
    return /入札|契約|公告|結果|資料|申請書|様式|ダウンロード|PDF|令和|年度/.test(text);
  }

  function exclusionSummary(original, clone) {
    return {
      h1: original.querySelectorAll("h1").length,
      pageTop: [...original.querySelectorAll("a,button")].filter((node) => isPageTopText(node.textContent)).length,
      skipToContent: [...original.querySelectorAll("*")].filter((node) => isSkipToContentText(node.textContent) && !node.children.length).length,
      utility: [...original.querySelectorAll("*")].filter(isTemplateUtilityElement).length,
      signature: [...original.querySelectorAll("*")].filter(isSignatureBlock).length,
      feedback: [...original.querySelectorAll("*")].filter(isFeedbackSection).length,
      removedText: Math.max(0, normalizeText(original.textContent).length - normalizeText(clone.textContent).length),
    };
  }

  function isLikelyContentBlock(element) {
    const text = normalizeText(element.textContent);
    return text.length > 300 && (element.querySelector("h2,h3,p,table") || hasMultipleSubstantiveChildren(element));
  }

  function hasMultipleSubstantiveChildren(element) {
    const substantiveChildren = [...element.children].filter((child) => {
      const text = normalizeText(child.textContent);
      if (text.length < 80) return false;
      if (isStrictBreadcrumbTrail(child) || isTemplateUtilityElement(child) || isSignatureBlock(child)) return false;
      return Boolean(child.querySelector("h2,h3,h4,p,table,ul,ol") || text.length >= 180);
    });
    return substantiveChildren.length >= 2;
  }

  function isMixedContentContainer(element) {
    const text = normalizeText(element.textContent);
    if (text.length < 200) return false;
    const paragraphs = element.querySelectorAll("p,li,dd").length;
    const tables = element.querySelectorAll("table").length;
    const fileLinks = element.querySelectorAll('a[href$=".pdf"],a[href$=".doc"],a[href$=".docx"],a[href$=".xls"],a[href$=".xlsx"]').length;
    return (paragraphs >= 4 && tables >= 1) || (tables >= 1 && fileLinks >= 3);
  }

  function isMostlyTemplateText(element) {
    const text = normalizeText(element.textContent);
    if (!text) return true;
    if (isStrictBreadcrumbTrail(element)) return true;
    const fileLinks = element.querySelectorAll('a[href$=".pdf"],a[href$=".doc"],a[href$=".docx"],a[href$=".xls"],a[href$=".xlsx"]').length;
    if (fileLinks >= 3 && /入札|契約|公告|結果|資料|令和|年度/.test(text)) {
      return false;
    }
    const templateWords = [
      "ページトップ",
      "本文へ",
      "ここから本文",
      "検索",
      "サイトマップ",
      "文字サイズ",
      "背景色",
      "パンくず",
      "現在位置",
      "ページ番号",
      "更新日",
      "印刷",
      "このページを評価",
      "SNS",
      "シェア",
    ];
    const hits = templateWords.filter((word) => text.includes(word)).length;
    const links = element.querySelectorAll("a").length;
    return hits >= 3 || (links >= 12 && text.length < links * 35);
  }

  function isPageTopText(text) {
    return /ページ(?:の)?トップ|先頭へ|page\s*top|pagetop|上へ戻る|トップへ戻る/i.test(normalizeText(text));
  }

  function isSkipToContentText(text) {
    return /^(ここから本文です。?|ここから本文|本文ここから|本文へ|本文に移動|本文へ移動|本文まで移動)$/i.test(normalizeText(text));
  }

  function isTemplateUtilityElement(element) {
    const text = normalizeText(element.textContent);
    if (!text) return false;
    if (isAdobeReaderNotice(text)) return true;
    if (text.length > 260) return false;
    if (element.querySelector("h2,h3,h4,table,img,figure,iframe")) return false;
    if (isSkipToContentText(text) || isPageTopText(text)) return true;
    if (/^(現在位置|パンくず|ホーム\s*[>＞]|トップページ\s*[>＞])/.test(text)) return true;
    if (/^(ページ番号|ページID|記事ID|記事番号)\s*[:：]?\s*[0-9０-９-]+/.test(text)) return true;
    if (/^(更新日|公開日|掲載日)[:：]?\s*(令和|平成|20[0-9]{2}|[0-9０-９]{1,2}年)/.test(text)) return true;
    if (/^(印刷|印刷する|このページを印刷|印刷用ページを表示する)$/.test(text)) return true;
    if (/^(文字サイズ|背景色|閲覧支援|Foreign Language|Select Language)/i.test(text)) return true;
    return isNavigationCluster(element);
  }

  function isAdobeReaderNotice(text) {
    const normalized = normalizeText(text);
    return /PDFの閲覧|PDFファイルの閲覧|Adobe\s*Acrobat\s*Reader|Adobe社の無償のソフトウェア|Adobe Readerダウンロード/i.test(
      normalized
    );
  }

  function isNavigationCluster(element) {
    const text = normalizeText(element.textContent);
    const links = element.querySelectorAll("a").length;
    if (links < 5 || !text) return false;
    if (element.querySelector("p,table,img,figure,iframe")) return false;
    const fileLinks = element.querySelectorAll('a[href$=".pdf"],a[href$=".doc"],a[href$=".docx"],a[href$=".xls"],a[href$=".xlsx"]').length;
    if (fileLinks >= 2) return false;
    if (isNewsListContent(element, { headings: element.querySelectorAll("h2,h3,h4,h5,h6").length, paragraphs: element.querySelectorAll("p,li,dd").length })) {
      return false;
    }
    const menuWords = /分類で探す|組織で探す|目的で探す|くらし|市政|事業者|観光|検索|メニュー|サイト内検索|ホーム/.test(text);
    return menuWords || text.length < links * 28;
  }

  function removeLeadingTemplateFragments(root, pageTitle) {
    let current = firstMeaningfulChild(root);
    while (current && isLeadingTemplateFragment(current, pageTitle)) {
      const next = nextMeaningfulSibling(current);
      current.remove();
      current = next;
    }
    removeEmptyElements(root);
  }

  function removeDuplicateLeadingFragments(root) {
    const seen = new Set();
    let current = firstMeaningfulChild(root);
    while (current) {
      if (current.nodeType !== Node.ELEMENT_NODE) {
        current = nextMeaningfulSibling(current);
        continue;
      }
      const text = normalizeText(current.textContent);
      if (!text) {
        current = nextMeaningfulSibling(current);
        continue;
      }
      if (isStrictBreadcrumbTrail(current) || isTemplateUtilityElement(current) || isNavigationCluster(current)) {
        const key = `crumb:${text}`;
        if (seen.has(key)) {
          const next = nextMeaningfulSibling(current);
          current.remove();
          current = next;
          continue;
        }
        seen.add(key);
      }
      if (!isStrictBreadcrumbTrail(current) && !isTemplateUtilityElement(current) && !isNavigationCluster(current)) {
        break;
      }
      current = nextMeaningfulSibling(current);
    }
    removeEmptyElements(root);
  }

  function isLeadingTemplateFragment(element, pageTitle) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const text = normalizeText(element.textContent);
    if (!text) return true;
    if (element.matches("h1")) return true;
    if (isPageTitleDuplicate(element, pageTitle)) return true;
    if (isTemplateUtilityElement(element) || isSignatureBlock(element) || isFeedbackSection(element)) return true;
    if (isNavigationCluster(element)) return true;
    if (isNewsListContent(element, { headings: element.querySelectorAll("h2,h3,h4,h5,h6").length, paragraphs: element.querySelectorAll("p,li,dd").length })) {
      return false;
    }
    if (isFileListContent(element, { fileLinks: element.querySelectorAll('a[href$=".pdf"],a[href$=".doc"],a[href$=".docx"],a[href$=".xls"],a[href$=".xlsx"]').length })) {
      return false;
    }
    const links = element.querySelectorAll("a").length;
    const hasContentStructure = element.querySelector("h2,h3,h4,h5,h6,p,table,img,figure,iframe");
    if (links >= 3 && text.length < links * 34 && !hasContentStructure) return true;
    if (/^(分類で探す|組織で探す|目的で探す|ホーム|トップページ|メニュー|検索)/.test(text)) return true;
    return false;
  }

  function firstMeaningfulChild(root) {
    return [...root.childNodes].find((node) => {
      if (node.nodeType === Node.TEXT_NODE) return normalizeText(node.textContent);
      return node.nodeType === Node.ELEMENT_NODE;
    });
  }

  function isBreadcrumbTrail(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const text = normalizeText(element.textContent);
    if (!text) return false;
    const linkCount = element.querySelectorAll("a").length;
    const separatorCount = (text.match(/[>＞»›]/g) || []).length;
    const breadcrumbWords = /^(現在の位置|現在位置|パンくず|ホーム|トップページ)/.test(text);
    const breadcrumbStructure = separatorCount >= 2 && linkCount >= 2;
    return breadcrumbWords || breadcrumbStructure || (/^トップ/.test(text) && linkCount >= 2) || (/^ホーム/.test(text) && linkCount >= 2);
  }

  function isStrictBreadcrumbTrail(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const text = normalizeText(element.textContent);
    if (!text) return false;
    if (element.querySelector("h1,h2,h3,h4,h5,h6,table,figure,img")) return false;
    const linkCount = element.querySelectorAll("a").length;
    const separatorCount = (text.match(/[>＞»›]/g) || []).length;
    const breadcrumbWords = /^(現在の位置|現在位置|パンくず)/.test(text);
    const breadcrumbStructure = separatorCount >= 2 && linkCount >= 2;
    const shortTrail = /^(ホーム|トップページ)/.test(text) && separatorCount >= 1 && linkCount >= 1;
    return (breadcrumbWords && linkCount >= 1) || breadcrumbStructure || shortTrail;
  }

  function nextMeaningfulSibling(node) {
    let current = node.nextSibling;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE && !normalizeText(current.textContent)) {
        const next = current.nextSibling;
        current.remove();
        current = next;
        continue;
      }
      if (current.nodeType === Node.ELEMENT_NODE || normalizeText(current.textContent)) return current;
      current = current.nextSibling;
    }
    return null;
  }

  function isPageTitleDuplicate(element, pageTitle) {
    const text = normalizeText(element.textContent);
    if (!text || text !== normalizeText(pageTitle)) return false;
    if (element.querySelector("a,img,table,iframe")) return false;
    return text.length <= 120;
  }

  function isSignatureBlock(element) {
    const text = normalizeText(element.textContent);
    if (!text || text.length > 1000) return false;
    const hasSignatureLabel = /このページに関するお問い合わせ|担当課|お問い合わせ先|問合せ先|お問い合わせ/.test(text);
    const hasContact = /電話|TEL|Fax|FAX|メール|E-?mail|住所|所在地|部署|課$|課 |係/.test(text);
    const looksLikeContactSection =
      /^お問い合わせ/.test(text) ||
      /このページに関するお問い合わせ/.test(text) ||
      (element.querySelector("h2,h3,h4") && hasSignatureLabel);
    const contentContext = /受付窓口|申請先|提出先|手続き場所|開示の実施方法/.test(text);
    return hasSignatureLabel && (hasContact || looksLikeContactSection) && !contentContext;
  }

  function dedupeCandidates(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = hashText(candidate.html);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function render() {
    renderCandidateList();
    renderSelectedCandidate();
  }

  function renderCandidateList() {
    els.candidateList.innerHTML = "";
    if (!state.candidates.length) {
      els.candidateSummary.textContent = "旧ページHTMLを取得または貼り付けて、候補抽出を実行してください。";
      els.candidateCount.textContent = "未抽出";
      return;
    }
    els.candidateSummary.textContent = "スコア順に本文候補を表示しています。ID/CLASSだけでは確定していません。";
    els.candidateCount.textContent = `${state.candidates.length}件`;
    state.candidates.forEach((candidate, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `candidate-item ${candidate.id === state.selectedId ? "selected" : "unresolved"}`;
      button.setAttribute("aria-selected", String(candidate.id === state.selectedId));
      button.innerHTML = `
        <div class="candidate-title">${escapeHtml(index === 0 ? `おすすめ: ${candidate.label}` : candidate.label)}</div>
        <div class="candidate-subtitle">スコア ${candidate.score} / 文字 ${candidate.textLength}</div>
      `;
      button.addEventListener("click", () => {
        state.selectedId = candidate.id;
        render();
      });
      els.candidateList.appendChild(button);
    });
  }

  function renderSelectedCandidate() {
    const candidate = selectedCandidate();
    els.sendGoal2Button.disabled = !candidate;
    els.copyHtmlButton.disabled = !candidate;
    if (!candidate) {
      els.candidateDetail.className = "detail-empty";
      els.candidateDetail.textContent = "候補はまだありません。";
      els.contentPreview.textContent = "抽出候補を選択してください。";
      els.sourcePreviewStatus.textContent = "元ページの中で抽出対象になった範囲を強調表示します。";
      els.sourcePreviewFrame.srcdoc = "";
      els.extractedHtmlOutput.value = "";
      return;
    }
    els.detailSummary.textContent = `${candidate.label} / ${candidate.path}`;
    els.candidateDetail.className = "detail-block";
    els.candidateDetail.innerHTML = `
      <section class="detail-summary-card">
        <h3>抽出根拠</h3>
        <ul class="change-summary">
          <li>本文量: ${candidate.textLength}文字</li>
          <li>見出し: ${candidate.parts.headings}件、段落/リスト: ${candidate.parts.paragraphs}件</li>
          <li>表: ${candidate.parts.tables}件、画像: ${candidate.parts.images}件、ファイルリンク: ${candidate.parts.fileLinks}件</li>
          ${candidate.parts.isFileListContent ? "<li>ファイルリンク中心の本文として評価しています。</li>" : ""}
          ${candidate.parts.isNewsListContent ? "<li>日付・年度付きのお知らせ一覧本文として評価しています。</li>" : ""}
          <li>除外: h1 ${candidate.excluded.h1}件、本文開始マーカー ${candidate.excluded.skipToContent}件、ページトップ ${candidate.excluded.pageTop}件、テンプレート補助 ${candidate.excluded.utility}件、署名候補 ${candidate.excluded.signature}件</li>
        </ul>
      </section>
    `;
    els.contentPreview.innerHTML = candidate.html || "抽出できる本文がありません。";
    sanitizePreview(els.contentPreview);
    renderSourcePreview(candidate);
    els.extractedHtmlOutput.value = candidate.html;
  }

  function selectedCandidate() {
    return state.candidates.find((candidate) => candidate.id === state.selectedId) || null;
  }

  function sendToGoal2() {
    const candidate = selectedCandidate();
    if (!candidate) return;
    localStorage.setItem(
      "goal3.toGoal2",
      JSON.stringify({
        html: candidate.html,
        pageTitle: els.pageTitleInput.value.trim(),
        oldUrl: els.sourceUrlInput.value.trim(),
      })
    );
    window.location.href = "/";
  }

  function reset() {
    state.candidates = [];
    state.selectedId = null;
    els.sourceUrlInput.value = "";
    els.pageTitleInput.value = "";
    els.fullHtmlInput.value = "";
    setSummary("旧ページHTMLを取得または貼り付けて、候補抽出を実行してください。", "未抽出");
    render();
  }

  function setSummary(message, count) {
    els.candidateSummary.textContent = message;
    els.candidateCount.textContent = count;
  }

  function setLoading(isLoading, message = "処理中です…") {
    els.goal3Loading.hidden = !isLoading;
    els.goal3LoadingText.textContent = message;
    els.fetchUrlButton.disabled = isLoading;
    els.extractButton.disabled = isLoading;
    els.resetButton.disabled = isLoading;
  }

  function pageTitleFromDocument(document) {
    return normalizeText(document.querySelector("h1")?.textContent || document.title || "");
  }

  function candidateLabel(element, index) {
    const tag = element.tagName.toLowerCase();
    return `${tag}候補 ${index + 1}`;
  }

  function domPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName !== "HTML") {
      const sameTag = [...(current.parentElement?.children || [])].filter((child) => child.tagName === current.tagName);
      const index = sameTag.indexOf(current) + 1;
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }
    return `/${parts.join("/")}`;
  }

  function isFeedbackSection(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const text = normalizeText(element.textContent);
    const hasFormControls = Boolean(element.querySelector("input,select,textarea,button,label"));
    if ((!text && !hasFormControls) || text.length > 2000) return false;
    if (!/アンケート|このページに関するアンケート|このページの内容は分かりやすかったですか|参考になりましたか|役に立ちましたか/.test(text)) {
      return false;
    }
    return Boolean(
      /アンケート|分かりやすかった|参考になった|役に立った|役に立ちましたか|はい|いいえ|送信|回答/.test(text) &&
        !element.querySelector("table")
    );
  }

  function renderSourcePreview(candidate) {
    if (!candidate?.element) {
      els.sourcePreviewStatus.textContent = "抽出位置の確認に必要な元ページ要素を保持できていません。候補を再抽出してください。";
      els.sourcePreviewFrame.srcdoc = "";
      return;
    }
    els.sourcePreviewStatus.textContent = `元ページ全体の見取り図の中で、抽出対象のおおよその位置を強調表示しています。`;
    els.sourcePreviewFrame.srcdoc = buildSourcePreviewHtmlForCandidate(candidate.element);
  }

  function buildSourcePreviewHtmlForCandidate(element) {
    const previewDoc = document.implementation.createHTMLDocument("goal3-source-preview");
    const wrapper = previewDoc.createElement("div");
    wrapper.className = "goal3-source-overview";
    const stage = previewDoc.createElement("div");
    stage.className = "goal3-source-stage";
    const viewport = previewDoc.createElement("div");
    viewport.className = "goal3-source-viewport";
    const page = buildSourceOverviewNode(element, previewDoc);
    viewport.appendChild(page);
    stage.appendChild(viewport);
    wrapper.appendChild(stage);

    const context = previewDoc.createElement("div");
    context.className = "goal3-source-context";
    collectSourcePreviewNodes(element).forEach((item) => {
      const container = previewDoc.createElement("section");
      container.className = `goal3-source-block ${item.kind}`;
      const label = previewDoc.createElement("div");
      label.className = "goal3-source-label";
      label.textContent = item.kind === "target" ? "抽出対象" : item.kind === "before" ? "直前の文脈" : "直後の文脈";
      container.appendChild(label);
      const content = previewDoc.createElement("div");
      content.className = "goal3-source-content";
      const clone = item.node.cloneNode(true);
      sanitizePreview(clone);
      normalizeSourcePreviewNode(clone, previewDoc);
      content.appendChild(clone);
      container.appendChild(content);
      context.appendChild(container);
    });
    wrapper.appendChild(context);
    const baseHref = escapeHtml(els.sourceUrlInput.value.trim() || "/");
    return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <base href="${baseHref}" />
    <style>
      :root { color-scheme: light; }
      body { margin: 0; padding: 20px; font: 15px/1.75 "Segoe UI", "Hiragino Sans", sans-serif; background: #f8fbfa; color: #24303a; }
      img { max-width: 100%; height: auto; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #cfd9df; padding: 8px 10px; vertical-align: top; }
      a { color: #2457b8; }
      body { margin: 0; padding: 20px; font: 15px/1.75 "Segoe UI", "Hiragino Sans", sans-serif; background: #f8fbfa; color: #24303a; }
      img { max-width: 100%; height: auto; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #cfd9df; padding: 8px 10px; vertical-align: top; }
      a { color: #2457b8; }
      .goal3-source-overview { display: grid; gap: 18px; }
      .goal3-source-stage { padding: 16px; border: 1px solid #d7e1e7; border-radius: 18px; background: linear-gradient(180deg, #ffffff 0%, #f3f8f7 100%); }
      .goal3-source-viewport { overflow: auto; border: 1px solid #dde6ea; border-radius: 14px; background: #fff; }
      .goal3-source-page { min-width: 980px; padding: 18px; transform: scale(.58); transform-origin: top left; width: 1724px; }
      .goal3-source-scope { outline: 6px solid #ff7a59; box-shadow: 0 0 0 10px rgba(255, 122, 89, 0.18); border-radius: 12px; background: rgba(255, 244, 199, 0.62); }
      .goal3-source-context { display: grid; gap: 16px; }
      .goal3-source-block { border: 1px solid #d7e1e7; border-radius: 16px; background: #fff; overflow: hidden; }
      .goal3-source-block.before,
      .goal3-source-block.after { opacity: 0.82; }
      .goal3-source-block.target { border-color: #ff7a59; box-shadow: 0 0 0 4px rgba(255, 122, 89, 0.14); }
      .goal3-source-label { padding: 10px 14px; font-weight: 700; background: #eef4f7; color: #425466; }
      .goal3-source-block.target .goal3-source-label { background: #fff1eb; color: #b64e2f; }
      .goal3-source-content { padding: 16px; }
      .goal3-source-content * { max-width: 100%; }
      .goal3-source-embed { padding: 14px 16px; border: 1px dashed #9bb3c6; border-radius: 12px; background: #eef4f7; color: #567; }
    </style>
  </head>
  <body>${wrapper.innerHTML}</body>
</html>`;
  }

  function buildSourceOverviewNode(element, previewDoc) {
    const scope = nearestPreviewScope(element);
    const clone = scope.cloneNode(true);
    sanitizePreview(clone);
    normalizeSourcePreviewNode(clone, previewDoc);
    markPreviewTarget(clone, element);
    const page = previewDoc.createElement("div");
    page.className = "goal3-source-page";
    page.appendChild(clone);
    return page;
  }

  function nearestPreviewScope(element) {
    let current = element;
    let best = element;
    while (current && current.parentElement) {
      const text = normalizeText(current.textContent);
      if (text.length >= 220) best = current;
      if (current.matches("main,article,section,div,td") && text.length >= 400) {
        best = current;
      }
      if (text.length >= 1800) {
        return current;
      }
      current = current.parentElement;
    }
    return best;
  }

  function markPreviewTarget(scopeClone, originalElement) {
    const path = pathFromAncestor(originalElement, nearestPreviewScope(originalElement));
    const target = resolveRelativePath(scopeClone, path);
    if (target) target.classList.add("goal3-source-scope");
  }

  function pathFromAncestor(element, ancestor) {
    const parts = [];
    let current = element;
    while (current && current !== ancestor) {
      const parent = current.parentElement;
      if (!parent) break;
      const sameTag = [...parent.children].filter((child) => child.tagName === current.tagName);
      parts.unshift(`${current.tagName.toLowerCase()}[${sameTag.indexOf(current) + 1}]`);
      current = parent;
    }
    return parts;
  }

  function resolveRelativePath(root, parts) {
    let current = root;
    for (const segment of parts) {
      const match = segment.match(/^([a-z0-9_-]+)\[(\d+)\]$/i);
      if (!match || !current) return null;
      const [, tagName, indexText] = match;
      const matches = [...current.children].filter((child) => child.tagName.toLowerCase() === tagName.toLowerCase());
      current = matches[Number(indexText) - 1] || null;
    }
    return current;
  }

  function collectSourcePreviewNodes(element) {
    const items = [];
    const previous = nearestMeaningfulSibling(element, "previous");
    const next = nearestMeaningfulSibling(element, "next");
    if (previous) items.push({ kind: "before", node: previous });
    items.push({ kind: "target", node: element });
    if (next) items.push({ kind: "after", node: next });
    return items;
  }

  function nearestMeaningfulSibling(element, direction) {
    let current = direction === "previous" ? element.previousElementSibling : element.nextElementSibling;
    while (current) {
      const text = normalizeText(current.textContent);
      if (text.length >= 40 || current.querySelector("h2,h3,h4,p,table,ul,ol,img,figure")) {
        return current;
      }
      current = direction === "previous" ? current.previousElementSibling : current.nextElementSibling;
    }
    return null;
  }

  function normalizeSourcePreviewNode(node, previewDoc) {
    node.querySelectorAll("script,style,noscript,template,object,embed").forEach((element) => element.remove());
    node.querySelectorAll("iframe").forEach((element) => {
      const placeholder = previewDoc.createElement("div");
      placeholder.className = "goal3-source-embed";
      placeholder.textContent = element.getAttribute("title") || element.getAttribute("src") || "埋め込み要素";
      element.replaceWith(placeholder);
    });
  }

  function removeEmptyElements(root) {
    [...root.querySelectorAll("*")]
      .reverse()
      .forEach((element) => {
        if (!normalizeText(element.textContent) && !element.querySelector("img,iframe,table,video,audio")) {
          element.remove();
        }
      });
  }

  function sanitizePreview(root) {
    root.querySelectorAll("script,object,embed").forEach((element) => element.remove());
    root.querySelectorAll("*").forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (name.startsWith("on")) element.removeAttribute(attribute.name);
        if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
          element.setAttribute(attribute.name, "#");
        }
      });
    });
  }

  function cleanHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    sanitizePreview(template.content);
    return template.innerHTML.trim();
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hashText(text) {
    let hash = 0;
    for (let index = 0; index < String(text).length; index += 1) {
      hash = (hash * 31 + String(text).charCodeAt(index)) >>> 0;
    }
    return hash.toString(16);
  }

  async function copyText(text) {
    await navigator.clipboard?.writeText(text);
  }
})();
