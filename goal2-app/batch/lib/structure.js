// 構造の型の判定。ページの構造は「要素の道」のハッシュの集まり(fetch.json の structurePaths)で持ち、
// 2つのページの集まりの重なり(Jaccard 係数)が similarity 以上なら、同じ型とみなす。
// 完全に同じ構造でまとめると、メニューの開き方や一部のページだけの部品で型が細かく割れるため
// (遠野市の試走で、97 ページが 29 の構造に割れた)。

function jaccard(a, b) {
  const setA = a instanceof Set ? a : new Set(a);
  const setB = b instanceof Set ? b : new Set(b);
  if (!setA.size && !setB.size) return 1;
  let inter = 0;
  for (const value of setA) if (setB.has(value)) inter += 1;
  return inter / (setA.size + setB.size - inter);
}

// ページを順に見て、いちばん似ている型(代表のページとの重なりが similarity 以上)に入れる。
// どの型にも当たらなければ、そのページを代表にして新しい型を作る。入れる順で結果が変わらないよう、
// 呼び出し側は移行管理 ID の順などの決まった順で渡す。
function clusterByStructure(items, similarity) {
  const clusters = [];
  for (const item of items) {
    const set = new Set(item.paths);
    let best = null;
    for (const cluster of clusters) {
      const score = jaccard(set, cluster.repSet);
      if (score >= similarity && (!best || score > best.score)) best = { cluster, score };
    }
    if (best) {
      best.cluster.members.push({ ...item, score: best.score });
    } else {
      clusters.push({ rep: item, repSet: set, members: [{ ...item, score: 1 }] });
    }
  }
  return clusters;
}

// 使える承認だけを返す。構造の取り方の版(structureVersion)が違う承認は使わない。取り方を変えると、
// 同じページでも構造の値が変わり、古い承認が別の型のページを引き取ってしまうため。
function usableApproved(approved, structureVersion) {
  return Object.entries(approved || {}).filter(
    ([, template]) => Array.isArray(template.paths) && template.structureVersion === structureVersion
  );
}

// 承認した型のうち、いちばん似ているものを返す。similarity に届かなければ null。
function matchApprovedTemplate(paths, approved, similarity, structureVersion) {
  const set = new Set(paths || []);
  let best = null;
  for (const [templateId, template] of usableApproved(approved, structureVersion)) {
    const score = jaccard(set, template.paths);
    if (score >= similarity && (!best || score > best.score)) best = { templateId, template, score };
  }
  return best;
}

module.exports = { jaccard, clusterByStructure, matchApprovedTemplate, usableApproved };
