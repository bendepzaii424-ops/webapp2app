/**
 * Virtual Mouse Overlay
 * Duoc inject vao WebView cua app sau khi trang tai xong (onPageFinished).
 * Bien toan bo man hinh thanh mot trackpad: vuot = di chuyen con tro,
 * cham nhe = click trai, nut R Click = mo context menu, 2 ngon = cuon.
 */
(function () {
  if (window.__vmInstalled) return;
  window.__vmInstalled = true;

  const STATE = {
    enabled: false,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    lastTouchX: null,
    lastTouchY: null,
    touchStartTime: 0,
    moved: false,
    twoFinger: false,
    lastTwoFingerY: null,
  };

  const SENSITIVITY = 1.4; // he so nhay khi vuot ngon tay (trackpad-style)
  const TAP_MOVE_THRESHOLD = 8; // px - duoi nguong nay coi la "tap" chu khong phai "keo"
  const TAP_TIME_THRESHOLD = 300; // ms

  function createElements() {
    const cursor = document.createElement("div");
    cursor.id = "vm-cursor";
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M3 2l6.5 18 2.5-7.5L19.5 10 3 2z" fill="white" stroke="black" stroke-width="1"/></svg>';
    document.body.appendChild(cursor);

    const toggle = document.createElement("div");
    toggle.id = "vm-toggle";
    toggle.textContent = "M";
    toggle.title = "Mouse";
    document.body.appendChild(toggle);

    const bar = document.createElement("div");
    bar.id = "vm-controlbar";
    bar.innerHTML =
      '<div class="vm-btn" id="vm-lclick">L Click</div>' +
      '<div class="vm-btn" id="vm-rclick">R Click</div>' +
      '<div class="vm-btn" id="vm-scrollup">Scroll ↑</div>' +
      '<div class="vm-btn" id="vm-scrolldown">Scroll ↓</div>';
    document.body.appendChild(bar);

    const hint = document.createElement("div");
    hint.id = "vm-trackpad-hint";
    hint.textContent = "Vuot man hinh de di chuyen chuot";
    document.body.appendChild(hint);

    return { cursor, toggle, bar, hint };
  }

  const els = createElements();

  function updateCursorPosition() {
    STATE.x = Math.max(0, Math.min(window.innerWidth, STATE.x));
    STATE.y = Math.max(0, Math.min(window.innerHeight, STATE.y));
    els.cursor.style.transform = `translate(${STATE.x}px, ${STATE.y}px)`;
  }

  function setEnabled(on) {
    STATE.enabled = on;
    els.cursor.classList.toggle("vm-active", on);
    els.toggle.classList.toggle("vm-on", on);
    els.bar.classList.toggle("vm-visible", on);
    if (on) {
      els.hint.classList.add("vm-show");
      setTimeout(() => els.hint.classList.remove("vm-show"), 1800);
      updateCursorPosition();
    }
  }

  els.toggle.addEventListener("click", () => setEnabled(!STATE.enabled));

  // --- Mo phong click/context menu tai vi tri con tro ---
  function dispatchClickAt(x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target) return;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new MouseEvent("mousedown", opts));
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("mouseup", opts));
    target.dispatchEvent(new MouseEvent("click", opts));
  }

  function dispatchContextMenuAt(x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target) return;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    target.dispatchEvent(new MouseEvent("contextmenu", opts));
  }

  function scrollAt(x, y, deltaY) {
    const target = document.elementFromPoint(x, y) || document.scrollingElement || document.body;
    let el = target;
    // Tim phan tu cuon duoc gan nhat (co the la con hoac cha)
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) break;
      el = el.parentElement;
    }
    (el || window).scrollBy({ top: deltaY, behavior: "auto" });
  }

  els.bar.querySelector("#vm-lclick").addEventListener("click", () => dispatchClickAt(STATE.x, STATE.y));
  els.bar.querySelector("#vm-rclick").addEventListener("click", () => dispatchContextMenuAt(STATE.x, STATE.y));
  els.bar.querySelector("#vm-scrollup").addEventListener("click", () => scrollAt(STATE.x, STATE.y, -200));
  els.bar.querySelector("#vm-scrolldown").addEventListener("click", () => scrollAt(STATE.x, STATE.y, 200));

  // --- Trackpad: toan bo man hinh (tru vung nut dieu khien) la vung vuot ---
  function isOnControl(target) {
    return els.toggle.contains(target) || els.bar.contains(target);
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!STATE.enabled) return;
      if (isOnControl(e.target)) return;

      if (e.touches.length === 2) {
        STATE.twoFinger = true;
        STATE.lastTwoFingerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        e.preventDefault();
        return;
      }

      STATE.twoFinger = false;
      STATE.moved = false;
      STATE.touchStartTime = Date.now();
      STATE.lastTouchX = e.touches[0].clientX;
      STATE.lastTouchY = e.touches[0].clientY;
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!STATE.enabled) return;
      if (isOnControl(e.target)) return;
      e.preventDefault();

      if (STATE.twoFinger && e.touches.length === 2) {
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const deltaY = STATE.lastTwoFingerY - midY;
        scrollAt(STATE.x, STATE.y, deltaY * 1.5);
        STATE.lastTwoFingerY = midY;
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - STATE.lastTouchX;
      const dy = touch.clientY - STATE.lastTouchY;

      if (Math.abs(dx) > TAP_MOVE_THRESHOLD || Math.abs(dy) > TAP_MOVE_THRESHOLD) {
        STATE.moved = true;
      }

      STATE.x += dx * SENSITIVITY;
      STATE.y += dy * SENSITIVITY;
      updateCursorPosition();

      STATE.lastTouchX = touch.clientX;
      STATE.lastTouchY = touch.clientY;
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (!STATE.enabled) return;
      if (isOnControl(e.target)) return;

      if (STATE.twoFinger) {
        STATE.twoFinger = false;
        return;
      }

      const elapsed = Date.now() - STATE.touchStartTime;
      // Cham nhe, khong keo dai => tap-click tai vi tri con tro hien tai
      if (!STATE.moved && elapsed < TAP_TIME_THRESHOLD) {
        dispatchClickAt(STATE.x, STATE.y);
      }
    },
    { passive: false }
  );

  updateCursorPosition();
})();
