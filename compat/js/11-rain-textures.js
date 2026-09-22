const __RAIN_HOLD_SOURCE = {
  "hold_head": "assets/rain_hold_head.webp",
  "hold_body": "assets/rain_hold_body.webp",
  "hold_tail": "assets/rain_hold_tail.webp",
  "hold_double_head": "assets/rain_hold_double_head.webp",
  "hold_double_body": "assets/rain_hold_double_body.webp",
  "hold_double_tail": "assets/rain_hold_double_tail.webp",
  "exhold_head": "assets/rain_exhold_head.webp",
  "exhold_body": "assets/rain_exhold_body.webp",
  "exhold_tail": "assets/rain_exhold_tail.webp",
  "exhold_double_head": "assets/rain_exhold_double_head.webp",
  "exhold_double_body": "assets/rain_exhold_double_body.webp",
  "exhold_double_tail": "assets/rain_exhold_double_tail.webp"
};
const __rainHoldImgs = new Map();
function __rainHoldImg(name) {
  let im = __rainHoldImgs.get(name);
  if (im) return im;
  im = new Image();
  im.decoding = 'async';
  im.onload = () => render();
  im.src = __RAIN_HOLD_SOURCE[name];
  __rainHoldImgs.set(name, im);
  return im;
}
function __rainHoldTripleFor(key) {
  if (!['hold', 'hold_double', 'exhold', 'exhold_double'].includes(key)) return null;
  return {
    head: __rainHoldImg(key + '_head'),
    body: __rainHoldImg(key + '_body'),
    tail: __rainHoldImg(key + '_tail')
  };
}
