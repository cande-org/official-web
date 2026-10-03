// Treat version labels as exact decimals, without floating-point rounding.
export function nextLegalVersion(versions) {
  const numbers = versions.map(v => /^(\d+)(?:\.(\d+))?$/.exec(v.version.trim())).filter(Boolean);
  if (!numbers.length) return '1.0';
  const precision = Math.max(1, ...numbers.map(v => (v[2] || '').length));
  const scale = 10n ** BigInt(precision);
  const values = numbers.map(v => BigInt(v[1]) * scale + BigInt((v[2] || '').padEnd(precision, '0')));
  const latest = values.reduce((a, b) => a > b ? a : b);
  const next = latest + 10n ** BigInt(precision - 1);
  const fraction = (next % scale).toString().padStart(precision, '0').replace(/0+$/, '') || '0';
  return `${next / scale}.${fraction}`;
}

export function withLegalFooter(body, version, effectiveOn) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveOn);
  if (!version.trim() || !date || Number.isNaN(Date.parse(effectiveOn)) || new Date(effectiveOn).toISOString().slice(0, 10) !== effectiveOn) return body;
  let content = body.trimEnd();
  // Replace only standalone metadata at the end, never dates inside clauses.
  const tail = /(?:^|\r?\n)[ \t]*(?:버전|시행일)[ \t]*:[^\r\n]*$/;
  while (tail.test(content)) content = content.replace(tail, '').trimEnd();
  const footer = `버전: ${version.trim()}\n시행일: ${date[1]}년 ${Number(date[2])}월 ${Number(date[3])}일`;
  return content ? `${content}\n\n${footer}` : '';
}
