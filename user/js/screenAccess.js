const DESKTOP_ACCESS_QUERY = "(min-width: 900px), (hover: hover) and (pointer: fine)";
const TOUCH_POINTER_QUERY = "(pointer: coarse)";

let accessQuery;
let blocker;
let accessAllowed;

export function setupScreenAccessGuard({ onAllowed, onBlocked } = {}) {
  accessQuery = window.matchMedia(DESKTOP_ACCESS_QUERY);
  blocker = createAccessBlocker();

  const applyAccessState = () => {
    const nextAllowed = hasDesktopAccess();
    if (nextAllowed === accessAllowed) return;

    accessAllowed = nextAllowed;
    if (accessAllowed) {
      allowDesktopScreen();
      onAllowed?.();
      return;
    }

    blockPhoneScreen();
    onBlocked?.();
  };

  accessQuery.addEventListener("change", applyAccessState);
  window.addEventListener("resize", applyAccessState);
  window.addEventListener("orientationchange", applyAccessState);
  applyAccessState();
}

function createAccessBlocker() {
  const existingBlocker = document.querySelector("#screenAccessBlocker");
  if (existingBlocker) return existingBlocker;

  const element = document.createElement("section");
  element.className = "screen-access-blocker";
  element.id = "screenAccessBlocker";
  element.hidden = true;
  element.setAttribute("role", "alert");
  element.setAttribute("aria-live", "assertive");
  element.innerHTML = `
    <div class="screen-access-panel">
      <img src="/assets/image/logo.png" alt="CPMS">
      <h1>Desktop Access Required</h1>
      <p>This system is available on laptop or larger screens only. Please open CPMS on a laptop, desktop, or external display.</p>
    </div>
  `;
  document.body.prepend(element);
  return element;
}

function hasDesktopAccess() {
  return accessQuery.matches && !isPhoneLikeScreen();
}

function isPhoneLikeScreen() {
  const shortestScreenSide = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight,
  );
  const hasTouchPointer = window.matchMedia(TOUCH_POINTER_QUERY).matches || navigator.maxTouchPoints > 0;

  return (
    window.innerWidth < 768 ||
    (hasTouchPointer && window.innerHeight < 540) ||
    (hasTouchPointer && shortestScreenSide < 700)
  );
}

function blockPhoneScreen() {
  document.body.classList.add("screen-access-blocked");
  blocker.hidden = false;
  document.querySelector(".page-shell")?.setAttribute("hidden", "");
  document.querySelector("#userLoginScreen")?.setAttribute("hidden", "");
  document.querySelectorAll(".modal").forEach((modal) => { modal.hidden = true; });
}

function allowDesktopScreen() {
  document.body.classList.remove("screen-access-blocked");
  blocker.hidden = true;
}
