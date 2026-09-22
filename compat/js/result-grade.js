(function (root) {
  'use strict';

  // Thresholds: milthm-calculator-web/js/milkloud.js recordBestLevel.
  // AP/FC variants: cha_newui.js getLevelIconName. F keeps its dedicated F asset.
  function grade(score, counts = {}, total = 0) {
    score = Number.isFinite(Number(score)) ? Number(score) : 0;
    const thresholds = [1010000, 1000000, 950000, 850000, 750000, 650000, 600000];
    let level = thresholds.findIndex(value => score >= value);
    if (level < 0) level = 7;
    const ap = total > 0 && !['g', 'n', 'b', 'm'].some(k => Number(counts[k]) > 0),
      fc = total > 0 && !['b', 'm'].some(k => Number(counts[k]) > 0);
    const icon = level === 0 || level >= 6 ? String(level) : String(level) + (ap ? '0' : fc ? '1' : '');
    return {
      level,
      name: ['R', 'M', 'SS', 'S', 'A', 'B', 'C', 'F'][level],
      icon,
      ap,
      fc
    };
  }
  root.MilResultGrade = grade;
  if (typeof module === 'object' && module.exports) module.exports = grade;
})(typeof window !== 'undefined' ? window : globalThis);
