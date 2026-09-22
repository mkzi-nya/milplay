(function (global) {
  'use strict';

  if (!global.globalThis) global.globalThis = global;

  if (!Array.prototype.at) {
    Array.prototype.at = function (index) {
      var i = Number(index) || 0;
      if (i < 0) i = this.length + i;
      return i < 0 || i >= this.length ? undefined : this[i];
    };
  }

  if (!Array.prototype.flat) {
    Array.prototype.flat = function (depth) {
      var result = [], level = depth === undefined ? 1 : Number(depth);
      function append(list, current) {
        for (var i = 0; i < list.length; i++) {
          var value = list[i];
          if (Array.isArray(value) && current > 0) append(value, current - 1);
          else result.push(value);
        }
      }
      append(this, level);
      return result;
    };
  }

  if (!String.prototype.matchAll) {
    String.prototype.matchAll = function (regexp) {
      var source = String(this), flags = regexp.flags.indexOf('g') >= 0 ? regexp.flags : regexp.flags + 'g';
      var re = new RegExp(regexp.source, flags), matches = [], match;
      while ((match = re.exec(source))) {
        matches.push(match);
        if (match[0] === '') re.lastIndex++;
      }
      return matches[Symbol.iterator]();
    };
  }

  if (!global.ResizeObserver) {
    global.ResizeObserver = function (callback) {
      var observed = [];
      this.observe = function (element) {
        observed.push(element);
        callback([{ target: element }]);
      };
      this.disconnect = function () {};
      this.unobserve = function () {};
      global.addEventListener('resize', function () {
        if (observed.length) callback(observed.map(function (element) { return { target: element }; }));
      });
    };
  }

  /* iOS 12 Safari has Touch Events but not the Pointer Events used by gameplay. */
  if (!('onpointerdown' in global)) {
    var activeTouches = {};
    var pointerTarget = function (touch) { return activeTouches[touch.identifier] || touch.target || document; };
    var makePointerEvent = function (type, original, touch) {
      var event;
      try { event = new Event(type, { bubbles: true, cancelable: true }); }
      catch (error) { event = document.createEvent('Event'); event.initEvent(type, true, true); }
      var values = {
        pointerId: touch.identifier + 1,
        pointerType: 'touch',
        isPrimary: touch.identifier === 0,
        button: 0,
        buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        clientX: touch.clientX, clientY: touch.clientY,
        pageX: touch.pageX, pageY: touch.pageY,
        screenX: touch.screenX, screenY: touch.screenY,
        pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : 0.5,
        width: touch.radiusX || 1, height: touch.radiusY || 1,
        originalEvent: original,
      };
      Object.keys(values).forEach(function (key) {
        try { Object.defineProperty(event, key, { configurable: true, value: values[key] }); } catch (error) {}
      });
      return event;
    };
    var relayTouch = function (type, original) {
      var changed = original.changedTouches || [];
      for (var i = 0; i < changed.length; i++) {
        var touch = changed[i], target = pointerTarget(touch);
        if (type === 'pointerdown') activeTouches[touch.identifier] = target;
        if (target && target.dispatchEvent) target.dispatchEvent(makePointerEvent(type, original, touch));
        if (type === 'pointerup' || type === 'pointercancel') delete activeTouches[touch.identifier];
      }
    };
    document.addEventListener('touchstart', function (event) { relayTouch('pointerdown', event); }, true);
    document.addEventListener('touchmove', function (event) { relayTouch('pointermove', event); }, true);
    document.addEventListener('touchend', function (event) { relayTouch('pointerup', event); }, true);
    document.addEventListener('touchcancel', function (event) { relayTouch('pointercancel', event); }, true);
    var elementPrototype = global.Element && global.Element.prototype;
    if (elementPrototype) {
      if (!elementPrototype.setPointerCapture) elementPrototype.setPointerCapture = function () {};
      if (!elementPrototype.releasePointerCapture) elementPrototype.releasePointerCapture = function () {};
      if (!elementPrototype.hasPointerCapture) elementPrototype.hasPointerCapture = function () { return false; };
    }
  }
}(window));
