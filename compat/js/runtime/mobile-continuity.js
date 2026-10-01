(() => {
  'use strict';

  const media = els.audioPlayer;
  if (!media) return;
  let resumePending = false;
  const resumeIfUnexpected = () => {
    if (resumePending || state.appMode !== 'play' || !state.playing || !state.mediaUrl || !state.mediaReady || media.ended || !media.paused) return;
    resumePending = true;
    Promise.resolve(media.play()).catch(() => {}).finally(() => {
      resumePending = false;
    });
  };
  /* A browser/OS may suspend media briefly while entering fullscreen or rotating.  Explicit
     user pauses set state.playing=false first, so this never fights the pause button. */
  media.addEventListener('pause', () => {
    if (state.playing) queueMicrotask(resumeIfUnexpected);
  });
  document.addEventListener('fullscreenchange', () => setTimeout(resumeIfUnexpected, 0), {
    passive: true
  });
  document.addEventListener('webkitfullscreenchange', () => setTimeout(resumeIfUnexpected, 0), {
    passive: true
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(resumeIfUnexpected, 0);
  }, {
    passive: true
  });
})();
