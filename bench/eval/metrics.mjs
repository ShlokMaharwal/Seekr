export function metrics(ids, grades, k = 10) {
  const top = ids.slice(0, k);
  const relevant = top.filter(id => (grades[id] ?? 0) > 0).length;
  const first = top.findIndex(id => (grades[id] ?? 0) > 0);
  const dcg = values => values.reduce((sum, grade, i) => sum + (2 ** grade - 1) / Math.log2(i + 2), 0);
  const ideal = dcg(Object.values(grades).sort((a, b) => b - a).slice(0, k));
  return { precision: relevant / k, mrr: first < 0 ? 0 : 1 / (first + 1), ndcg: ideal ? dcg(top.map(id => grades[id] ?? 0)) / ideal : 0 };
}
