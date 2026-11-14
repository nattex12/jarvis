/** Android marks TV mode in MainActivity's WebView user agent. ?tv=1 is a UI preview. */
export function isTelevision() {
  return (
    /JarvisTV\/1|Android TV|GoogleTV/i.test(navigator.userAgent) ||
    new URLSearchParams(window.location.search).get("tv") === "1"
  );
}

const controls =
  "button, a[href], input:not([type=hidden]), textarea, select, summary, [tabindex], [role=button], [role=switch]";
const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Prefer controls in the same row/column before diagonal controls. No edge wrapping. */
export function nextInDirection(origin, candidates, key) {
  const [dx, dy] = directions[key];
  const cx = (origin.left + origin.right) / 2;
  const cy = (origin.top + origin.bottom) / 2;
  return candidates
    .map((candidate) => {
      const r = candidate.rect;
      const x = (r.left + r.right) / 2 - cx;
      const y = (r.top + r.bottom) / 2 - cy;
      const forward = x * dx + y * dy;
      const cross = Math.abs(dx ? y : x);
      const beam = dx
        ? r.bottom > origin.top && r.top < origin.bottom
        : r.right > origin.left && r.left < origin.right;
      return {
        candidate,
        score: forward > 2 ? forward + cross * 2 + (beam ? 0 : 10000) : Infinity,
      };
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score)[0]?.candidate;
}

function visible(element) {
  return (
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden" &&
    !element.closest('[hidden], [inert], [aria-hidden="true"]')
  );
}

function focusable(scope) {
  return [...scope.querySelectorAll(controls)].filter(
    (el) => visible(el) && !el.matches(':disabled, [aria-disabled="true"], [tabindex="-1"]'),
  );
}

function dialogScope() {
  // Highest overlay first; DOM order breaks ties for nested/portalled dialogs.
  const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(
    visible,
  );
  const z = (el) => {
    let value = 0;
    for (let node = el; node; node = node.parentElement) {
      value = Math.max(value, Number.parseInt(getComputedStyle(node).zIndex) || 0);
    }
    return value;
  };
  return dialogs.sort((a, b) => z(a) - z(b)).at(-1) || document.body;
}

function focus(element) {
  if (!element) return;
  if (element.tabIndex < 0) element.tabIndex = 0;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** D-pad is TV-only. Android Back stays on the existing Tauri/useAndroidBack path. */
export function installTVNavigation() {
  document.documentElement.classList.add("tv-mode");
  let scope;
  const remembered = new WeakMap();
  const onFocus = (event) => {
    // React may autofocus a new dialog before MutationObserver sees its insertion.
    // Remember the opener as it gains focus, rather than reading activeElement later.
    if (scope === dialogScope() && scope?.contains(event.target))
      remembered.set(scope, event.target);
  };
  const ensureFocus = () => {
    const next = dialogScope();
    if (scope !== next) {
      scope = next;
    }
    const items = focusable(scope);
    if (!items.includes(document.activeElement)) {
      const previous = remembered.get(scope);
      focus(items.includes(previous) ? previous : items[0]);
    }
    return items;
  };
  const onKey = (event) => {
    if (!directions[event.key] && !["Enter", "Select"].includes(event.key)) return;
    const items = ensureFocus();
    const active = document.activeElement;
    // Preserve editing/selection keys, but allow vertical escape from field edges.
    if (active.matches('[contenteditable="true"]')) return;
    if (active.matches("textarea")) {
      const atStart = active.selectionStart === 0;
      const atEnd = active.selectionEnd === active.value.length;
      if (!(event.key === "ArrowUp" && atStart) && !(event.key === "ArrowDown" && atEnd)) return;
    }
    if (
      active.matches('select, input[type="range"]') &&
      ["ArrowLeft", "ArrowRight", "Enter", "Select"].includes(event.key)
    )
      return;
    if (
      active.matches("input") &&
      ["ArrowLeft", "ArrowRight", "Enter", "Select"].includes(event.key)
    )
      return;
    if (!directions[event.key]) {
      if (active.matches('button, a[href], summary, [role="button"], [role="switch"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) active.click();
      }
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const next = nextInDirection(
      active.getBoundingClientRect(),
      items
        .filter((el) => el !== active)
        .map((element) => ({ element, rect: element.getBoundingClientRect() })),
      event.key,
    );
    if (next) focus(next.element);
    else {
      // Long descriptions/chat histories must remain readable even without controls.
      for (let node = active.parentElement; node; node = node.parentElement) {
        if (
          /(auto|scroll)/.test(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight
        ) {
          node.scrollBy(0, directions[event.key][1] * node.clientHeight * 0.6);
          break;
        }
      }
    }
  };
  let frame;
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(ensureFocus);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["disabled", "hidden", "aria-hidden", "aria-disabled", "inert"],
  });
  window.addEventListener("keydown", onKey, true);
  document.addEventListener("focusin", onFocus);
  requestAnimationFrame(ensureFocus);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKey, true);
    document.removeEventListener("focusin", onFocus);
    document.documentElement.classList.remove("tv-mode");
  };
}
