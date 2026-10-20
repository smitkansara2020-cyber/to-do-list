import { describe, expect, it, vi, beforeEach } from "vitest";
import { animateDashboard } from "./dashboard-reveal";

describe("animateDashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns no-op cleanup when root is null", () => {
    const cleanup = animateDashboard(null);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("handles reduced motion preference cleanly", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const root = document.createElement("div");
    root.className = "dashboard dashboard-preparing";

    const cleanup = animateDashboard(root);
    expect(root.classList.contains("dashboard-preparing")).toBe(false);
    cleanup();
  });

  it("animates surfaces and notes with correct timing and easing", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Element.prototype.animate = vi.fn().mockReturnValue({
      startTime: null,
      cancel: vi.fn(),
      finished: Promise.resolve(),
    });

    const root = document.createElement("div");
    root.className = "dashboard dashboard-preparing";

    // 2 widget reveals
    for (let i = 0; i < 2; i++) {
      const reveal = document.createElement("div");
      reveal.className = "widget-reveal";
      reveal.getBoundingClientRect = vi.fn().mockReturnValue({
        bottom: 500,
        top: 100,
        left: 0,
        right: 400,
        width: 400,
        height: 400,
      });

      const surface = document.createElement("div");
      surface.className = "widget-surface";
      surface.animate = vi.fn().mockReturnValue({
        startTime: null,
        cancel: vi.fn(),
        finished: Promise.resolve(),
      });

      const note = document.createElement("div");
      note.className = "note-motion";
      note.getBoundingClientRect = vi.fn().mockReturnValue({
        bottom: 300,
        top: 200,
        left: 50,
        right: 250,
        width: 200,
        height: 100,
      });
      note.animate = vi.fn().mockReturnValue({
        startTime: null,
        cancel: vi.fn(),
        finished: Promise.resolve(),
      });

      surface.appendChild(note);
      reveal.appendChild(surface);
      root.appendChild(reveal);
    }

    const cleanup = animateDashboard(root);

    expect(root.classList.contains("dashboard-preparing")).toBe(false);

    const surfaces = root.querySelectorAll<HTMLElement>(".widget-surface");
    expect(surfaces[0]!.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
      expect.objectContaining({
        delay: 150,
        duration: 950,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "both",
      }),
    );

    const notes = root.querySelectorAll<HTMLElement>(".note-motion");
    // distance = 500 (bottom) - 200 (top) + 12 = 312px
    expect(notes[0]!.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(312px)" }, { transform: "translateY(0)" }],
      expect.objectContaining({
        delay: 1180,
        duration: 800,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "both",
      }),
    );
    expect(notes[1]!.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(312px)" }, { transform: "translateY(0)" }],
      expect.objectContaining({
        delay: 1180 + 140,
        duration: 800,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "both",
      }),
    );

    cleanup();
  });
});
