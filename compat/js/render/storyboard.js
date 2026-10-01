(() => {
  'use strict';

  function dims(img) {
    return {
      w: Number((img == null ? void 0 : img.naturalWidth) || (img == null ? void 0 : img.width) || 0),
      h: Number((img == null ? void 0 : img.naturalHeight) || (img == null ? void 0 : img.height) || 0)
    };
  }
  function storyColor(rt, sb, sec, alpha) {
    const c = rgbaFromUint(rt.sbValue(sb, COLOR, sec));
    c[3] = Math.max(0, Math.min(255, c[3] * alpha));
    return c;
  }
  const basePrecompute = precompute;
  precompute = function (rt) {
    basePrecompute(rt);
    rt.__storyByLayer = [[], [], []];
    for (const sb of rt.storyboards || []) if (rt.__storyByLayer[sb.layer]) rt.__storyByLayer[sb.layer].push(sb);
  };
  drawStoryboardLayer = function (rt, layer, sec, w, h, distorted = false) {
    var _rt$__storyByLayer;
    if (!rt || !rt.storyboards) return;
    const list = ((_rt$__storyByLayer = rt.__storyByLayer) == null ? void 0 : _rt$__storyByLayer[layer]) || rt.storyboards;
    for (const sb of list) {
      if (sb.layer !== layer || !!sb.distorted !== !!distorted) continue;
      const hidden = isItemHidden('storyboard', sb.index);
      if (hidden && !state.showHidden) continue;
      const alpha = rt.sbValue(sb, TRANSPARENCY, sec);
      if (alpha <= .001) continue;
      const posX = milX(rt.sbValue(sb, POS_X, sec), w),
        posY = milY(rt.sbValue(sb, POS_Y, sec), h),
        relX = milX(rt.sbValue(sb, REL_X, sec), w),
        relY = milY(rt.sbValue(sb, REL_Y, sec), h),
        center = localToScreen(w, h, posX + relX, posY + relY),
        scale = rt.sbValue(sb, SIZE, sec),
        rotDeg = rt.sbValue(sb, ROTATION, sec),
        sw = rt.sbValue(sb, SB_WIDTH, sec),
        sh = rt.sbValue(sb, SB_HEIGHT, sec),
        color = storyColor(rt, sb, sec, hidden ? Math.min(.45, alpha) : alpha);
      if (sb.type === 0) {
        const img = storyImage(sb.data);
        if (!img) continue;
        const d = dims(img);
        if (!d.w || !d.h) continue;
        let tw = milX(d.w, w) * scale * sw,
          th = tw / Math.max(1, d.w) * d.h * sh;
        tw = clamp(Math.abs(tw), .01, w * 4);
        th = clamp(Math.abs(th), .01, h * 4);
        if (center.x < -tw || center.x > w + tw || center.y < -th || center.y > h + th) continue;
        __milDrawRotTinted(img, center.x, center.y, tw, th, rotDeg, 1, color);
        if (hidden) drawHiddenHalo(center.x, center.y, Math.max(tw, th) / 2);
        if (state.appMode !== 'play') state.inspectHit.push({
          kind: 'storyboard',
          label: '故事板',
          id: sb.index,
          hiddenKey: itemKey('storyboard', sb.index),
          sb,
          x: center.x,
          y: center.y,
          w: tw,
          h: th,
          rot: rotDeg
        });
      } else if (sb.type === 1) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotDeg * Math.PI / 180);
        ctx.scale(scale * sw, scale * sh);
        ctx.globalAlpha *= color[3] / 255;
        ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.max(1, milX(33.75, w))}px ui-sans-serif,system-ui,-apple-system,"Segoe UI","PingFang SC",sans-serif`;
        ctx.fillText(String(sb.data || ''), 0, 0);
        ctx.restore();
      }
    }
  };
})();
