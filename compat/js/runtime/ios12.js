(function (global) {
  'use strict';

  if (!global.globalThis) global.globalThis = global;
  if (global.Blob && global.FileReader) {
    ['text', 'arrayBuffer'].forEach(function (method) {
      if (Blob.prototype[method]) return;
      Blob.prototype[method] = function () {
        var blob = this;
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () {
            resolve(reader.result);
          };
          reader.onerror = function () {
            reject(reader.error);
          };
          reader.onabort = function () {
            reject(new Error('File read aborted'));
          };
          reader[method === 'text' ? 'readAsText' : 'readAsArrayBuffer'](blob);
        });
      };
    });
  }
  if (!Array.prototype.at) {
    Array.prototype.at = function (index) {
      var i = Number(index) || 0;
      if (i < 0) i = this.length + i;
      return i < 0 || i >= this.length ? undefined : this[i];
    };
  }
  if (!String.prototype.at) {
    String.prototype.at = function (index) {
      var i = Math.trunc(Number(index)) || 0;
      if (i < 0) i = this.length + i;
      return i < 0 || i >= this.length ? undefined : this.charAt(i);
    };
  }
  if (!Array.prototype.flat) {
    Array.prototype.flat = function (depth) {
      var result = [],
        level = depth === undefined ? 1 : Number(depth);
      function append(list, current) {
        for (var i = 0; i < list.length; i++) {
          var value = list[i];
          if (Array.isArray(value) && current > 0) append(value, current - 1);else result.push(value);
        }
      }
      append(this, level);
      return result;
    };
  }
  if (!String.prototype.matchAll) {
    String.prototype.matchAll = function (regexp) {
      var source = String(this),
        flags = regexp.flags.indexOf('g') >= 0 ? regexp.flags : regexp.flags + 'g';
      var re = new RegExp(regexp.source, flags),
        matches = [],
        match;
      while (match = re.exec(source)) {
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
        callback([{
          target: element
        }]);
      };
      this.disconnect = function () {};
      this.unobserve = function () {};
      global.addEventListener('resize', function () {
        if (observed.length) callback(observed.map(function (element) {
          return {
            target: element
          };
        }));
      });
    };
  }

  /* iOS 12 Safari has Touch Events but not the Pointer Events used by gameplay. */
  if (!('onpointerdown' in global)) {
    var activeTouches = {};
    var pointerTarget = function (touch) {
      return activeTouches[touch.identifier] || touch.target || document;
    };
    var makePointerEvent = function (type, original, touch, isPrimary) {
      var event;
      try {
        event = new Event(type, {
          bubbles: true,
          cancelable: true
        });
      } catch (error) {
        event = document.createEvent('Event');
        event.initEvent(type, true, true);
      }
      var values = {
        pointerId: touch.identifier + 1,
        pointerType: 'touch',
        /* iOS 12 recycles touch identifiers, so a lone finger is frequently NOT
           identifier 0. The DOM contract is "the first active pointer of this type",
           not "identifier 0": gameplay and the HUD reject any event with
           isPrimary===false, which silently killed the pause button and seek bar.
           Derive primary from the live touch count instead. */
        isPrimary: !!isPrimary,
        button: 0,
        buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        clientX: touch.clientX,
        clientY: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY,
        screenX: touch.screenX,
        screenY: touch.screenY,
        pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : 0.5,
        width: touch.radiusX || 1,
        height: touch.radiusY || 1,
        originalEvent: original
      };
      Object.keys(values).forEach(function (key) {
        try {
          Object.defineProperty(event, key, {
            configurable: true,
            value: values[key]
          });
        } catch (error) {}
      });
      return event;
    };
    var relayTouch = function (type, original) {
      var changed = original.changedTouches || [];
      /* A pointer is primary when it is the only active touch (or the one already
         being tracked), matching how the browser flags the lead finger. */
      var activeCount = 0;
      for (var id in activeTouches) {
        if (Object.prototype.hasOwnProperty.call(activeTouches, id)) activeCount++;
      }
      for (var i = 0; i < changed.length; i++) {
        var touch = changed[i],
          target = pointerTarget(touch),
          primary = false;
        if (type === 'pointerdown') {
          primary = activeCount === 0;
          activeTouches[touch.identifier] = target;
          activeCount++;
        } else {
          primary = Object.prototype.hasOwnProperty.call(activeTouches, touch.identifier) && activeCount === 1;
        }
        if (target && target.dispatchEvent) target.dispatchEvent(makePointerEvent(type, original, touch, primary));
        if (type === 'pointerup' || type === 'pointercancel') {
          delete activeTouches[touch.identifier];
          activeCount = Math.max(0, activeCount - 1);
        }
      }
    };
    document.addEventListener('touchstart', function (event) {
      relayTouch('pointerdown', event);
    }, true);
    document.addEventListener('touchmove', function (event) {
      relayTouch('pointermove', event);
    }, true);
    document.addEventListener('touchend', function (event) {
      relayTouch('pointerup', event);
    }, true);
    document.addEventListener('touchcancel', function (event) {
      relayTouch('pointercancel', event);
    }, true);
    var elementPrototype = global.Element && global.Element.prototype;
    if (elementPrototype) {
      if (!elementPrototype.setPointerCapture) elementPrototype.setPointerCapture = function () {};
      if (!elementPrototype.releasePointerCapture) elementPrototype.releasePointerCapture = function () {};
      if (!elementPrototype.hasPointerCapture) elementPrototype.hasPointerCapture = function () {
        return false;
      };
    }
  }

  /* iOS 12 has no touch-action support and ignores user-scalable=no, so pinch / double-tap
   * zoom of the playfield can only be stopped by cancelling the raw touch stream. This is
   * installed from the very first script (before any app code) and keyed off the body
   * data-mode, so gameplay protection cannot be lost to a later script error. */
  function isPlayMode() {
    var body = document.body;
    return !!body && body.getAttribute('data-mode') === 'play';
  }
  function inPlayfield(target) {
    var wrap = document.getElementById('stageWrap');
    if (wrap) {
      if (wrap.classList && (wrap.classList.contains('playExpanded') || wrap.classList.contains('nativePlayFullscreen'))) return true;
      if (wrap.contains && target && wrap.contains(target)) return true;
    }
    var root = document.documentElement;
    return !!(root && root.classList && root.classList.contains('playFullscreenLocked'));
  }
  function onControl(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('button, input, select, textarea, a, label');
  }
  function blockGesture(event) {
    if (!isPlayMode() || !inPlayfield(event.target) || onControl(event.target)) return;
    if (event.cancelable === false) return;
    event.preventDefault();
  }
  document.addEventListener('touchstart', blockGesture, {
    capture: true,
    passive: false
  });
  document.addEventListener('gesturestart', blockGesture, {
    capture: true,
    passive: false
  });
  document.addEventListener('gesturechange', blockGesture, {
    capture: true,
    passive: false
  });
  document.addEventListener('gestureend', blockGesture, {
    capture: true,
    passive: false
  });
  document.addEventListener('touchmove', function (event) {
    if (!isPlayMode() || onControl(event.target)) return;
    /* Single-touch moves must stay free for the seek bar / scrollable UI; multi-touch is
     * always a pinch. */
    if (event.touches && event.touches.length > 1 && event.cancelable !== false && inPlayfield(event.target)) event.preventDefault();
  }, {
    capture: true,
    passive: false
  });

  /* iOS Safari cannot hide its browser chrome from a normal page: the only supported way
   * to drop the status bar is running as an installed web app. Once launched standalone
   * (navigator.standalone / display-mode) the page owns the entire screen, so expose that
   * as a class plus real safe-area variables the layout can consume. */
  function detectStandalone() {
    var standalone = false;
    try {
      standalone = global.navigator && global.navigator.standalone === true || global.matchMedia && global.matchMedia('(display-mode: standalone)').matches || global.matchMedia && global.matchMedia('(display-mode: fullscreen)').matches;
    } catch (error) {}
    var root = document.documentElement;
    if (!root || !root.classList) return;
    root.classList.toggle('is-standalone', !!standalone);
    root.classList.toggle('is-ios-standalone', !!standalone && /iP(hone|ad|od)/.test(global.navigator && global.navigator.userAgent || ''));
  }
  detectStandalone();
  document.addEventListener('DOMContentLoaded', detectStandalone);
  if (global.matchMedia) {
    try {
      global.matchMedia('(display-mode: standalone)').addListener(detectStandalone);
    } catch (error) {}
  }
})(window);
