import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type CursorPoint = { x: number; y: number };

export function useMobileCursor() {
  const debug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cursorDebug");
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const pointRef = useRef<CursorPoint>({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  const commitPosition = () => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const cursor = cursorRef.current;
      if (!cursor) return;
      const { x, y } = pointRef.current;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      cursor.dataset.visible = "true";
    });
  };

  const updatePosition = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const landscape = target.closest('[data-orientation="landscape"]') !== null;

    if (landscape) {
      pointRef.current = {
        x: bounds.height === 0 ? 0 : ((bounds.bottom - event.clientY) / bounds.height) * target.offsetWidth,
        y: bounds.width === 0 ? 0 : ((event.clientX - bounds.left) / bounds.width) * target.offsetHeight,
      };
    } else {
      pointRef.current = {
        x: bounds.width === 0 ? 0 : ((event.clientX - bounds.left) / bounds.width) * target.offsetWidth,
        y: bounds.height === 0 ? 0 : ((event.clientY - bounds.top) / bounds.height) * target.offsetHeight,
      };
    }

    commitPosition();
  };

  const setActive = (active: boolean) => {
    if (cursorRef.current) cursorRef.current.dataset.active = active ? "true" : "false";
  };

  const hide = () => {
    if (!cursorRef.current) return;
    cursorRef.current.dataset.active = "false";
    cursorRef.current.dataset.visible = "false";
  };

  return {
    cursorHandlers: {
      onPointerEnter: updatePosition,
      onPointerMove: updatePosition,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        updatePosition(event);
        setActive(true);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        updatePosition(event);
        setActive(false);
      },
      onPointerCancel: hide,
      onPointerLeave: hide,
    },
    cursorDebug: debug,
    cursorElement: (
      <div
        ref={cursorRef}
        className="mobile-cursor"
        data-active="false"
        data-debug={debug ? "true" : "false"}
        data-visible="false"
        data-testid="mobile-cursor"
        style={{ transform: "translate3d(0, 0, 0) translate(-50%, -50%)" }}
      >
        {debug ? <span className="mobile-cursor-hotspot" aria-hidden="true" /> : null}
      </div>
    ),
  };
}
