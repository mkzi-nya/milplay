const __RAIN_HOLD_SOURCE = {
  "hold_head": "assets/rain_hold_head.png",
  "hold_body": "assets/rain_hold_body.png",
  "hold_tail": "assets/rain_hold_tail.png",
  "hold_double_head": "assets/rain_hold_double_head.png",
  "hold_double_body": "assets/rain_hold_double_body.png",
  "hold_double_tail": "assets/rain_hold_double_tail.png",
  "exhold_head": "assets/rain_exhold_head.png",
  "exhold_body": "assets/rain_exhold_body.png",
  "exhold_tail": "assets/rain_exhold_tail.png",
  "exhold_double_head": "assets/rain_exhold_double_head.png",
  "exhold_double_body": "assets/rain_exhold_double_body.png",
  "exhold_double_tail": "assets/rain_exhold_double_tail.png"
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
