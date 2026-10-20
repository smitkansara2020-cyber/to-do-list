/**
 * Call once after the dashboard's final layout is mounted and measured.
 * Returns cleanup; use it when a component unmounts.
 * Run again only when deliberately replaying the entrance.
 */
export function animateDashboard(root: HTMLElement | null): () => void {
  if (!root) return () => {};

  const surfaces = [...root.querySelectorAll<HTMLElement>('.widget-reveal > .widget-surface')];
  const notes = [...root.querySelectorAll<HTMLElement>('.note-motion')];
  const animations: Animation[] = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (reduceMotion.matches || typeof Element.prototype.animate !== 'function') {
    root.classList.remove('dashboard-preparing');
    return () => {};
  }

  // Measure BEFORE applying entrance transforms.
  const noteDistances = notes.map(note => {
    const viewport = note.closest<HTMLElement>('.widget-reveal');
    if (!viewport) return null;
    return Math.max(0,
      viewport.getBoundingClientRect().bottom -
      note.getBoundingClientRect().top + 12
    );
  });

  try {
    // Every widget starts together. 100% means its OWN height, never 100vh.
    for (const surface of surfaces) {
      animations.push(surface.animate([
        { transform: 'translateY(100%)' },
        { transform: 'translateY(0)' }
      ], {
        delay: 150,
        duration: 950,
        easing: 'cubic-bezier(.22, 1, .36, 1)',
        fill: 'both'
      }));
    }

    // Notes start after the widgets settle. Their containing widget clips them.
    notes.forEach((note, index) => {
      if (noteDistances[index] === null) return;
      animations.push(note.animate([
        { transform: `translateY(${noteDistances[index]}px)` },
        { transform: 'translateY(0)' }
      ], {
        delay: 1180 + index * 140,
        duration: 800,
        easing: 'cubic-bezier(.22, 1, .36, 1)',
        fill: 'both'
      }));
    });

    // Use one timeline origin so all widget reveals are synchronized.
    const timeline = (document as unknown as { timeline?: { currentTime?: number | CSSNumberish | null } }).timeline;
    const start = timeline?.currentTime;
    if (start !== null && start !== undefined) {
      animations.forEach(animation => {
        try {
          animation.startTime = start;
        } catch {
          // ignore if setting startTime is unsupported
        }
      });
    }
  } catch (error) {
    animations.forEach(animation => animation.cancel());
    console.error('Dashboard entrance could not start:', error);
  } finally {
    root.classList.remove('dashboard-preparing');
  }

  // Release animation transforms after completion. This helps popovers and
  // positioned descendants behave normally once the entrance is finished.
  animations.forEach(animation => {
    animation.finished.then(() => animation.cancel()).catch(() => {});
  });

  const finishImmediately = (event: MediaQueryListEvent) => {
    if (event.matches) animations.forEach(animation => animation.cancel());
  };
  reduceMotion.addEventListener('change', finishImmediately);

  return () => {
    reduceMotion.removeEventListener('change', finishImmediately);
    animations.forEach(animation => animation.cancel());
    root.classList.remove('dashboard-preparing');
  };
}
