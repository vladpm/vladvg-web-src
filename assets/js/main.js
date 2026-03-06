(() => {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let heroController = {
    destroy() {},
    setPaused() {}
  };

  let cursorController = {
    destroy() {},
    setPaused() {}
  };

  let typingController = {
    destroy() {},
    setPaused() {}
  };

  function isReducedMotion() {
    return reducedMotionQuery.matches;
  }

  function setYear() {
    const yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  }

  function setupSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href");

        if (!targetId || targetId === "#") {
          return;
        }

        const target = document.querySelector(targetId);
        if (!target) {
          return;
        }

        event.preventDefault();

        const header = document.querySelector(".site-header");
        const offset = header ? header.offsetHeight + 10 : 0;
        const y = target.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({
          top: y,
          behavior: isReducedMotion() ? "auto" : "smooth"
        });

        history.replaceState(null, "", targetId);
      });
    });
  }

  function setupRevealAnimations() {
    const revealElements = Array.from(document.querySelectorAll(".reveal"));

    if (!revealElements.length) {
      return;
    }

    if (isReducedMotion() || typeof IntersectionObserver === "undefined") {
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -7% 0px"
      }
    );

    revealElements.forEach((element) => observer.observe(element));
  }

  function initTypingHeadline() {
    const h2 = document.querySelector(".hero-subhead");
    const wordElement = document.getElementById("typed-word");
    if (!h2 || !wordElement) {
      return { destroy() {}, setPaused() {} };
    }

    const originalHTML = h2.innerHTML;
    const words = (wordElement.dataset.words || "plan,design,build,deploy")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
    const staticWord = wordElement.dataset.staticWord || "design";
    const finalText = h2.dataset.final || "I solve problems using technology.";

    if (!words.length || isReducedMotion()) {
      wordElement.textContent = staticWord;
      return { destroy() {}, setPaused() {} };
    }

    let wordIndex = 0;
    let characterIndex = 0;
    let mode = "typing";
    let elapsed = 0;
    let lastTimestamp = 0;
    let rafId = 0;
    let running = false;
    let isDone = false;

    const timings = {
      typing: 92,
      deleting: 58,
      holdTyped: 980,
      holdDeleted: 230,
      finalHold: 1400
    };

    function liveWordEl() { return document.getElementById("typed-word"); }

    function currentWord() { return words[wordIndex] || words[0]; }

    function drawWord() {
      const el = liveWordEl();
      if (el) el.textContent = currentWord().slice(0, characterIndex);
    }

    function triggerFinalFade() {
      isDone = true;
      stop();
      h2.style.transition = "opacity 0.52s ease";
      h2.style.opacity = "0";
      setTimeout(() => {
        h2.textContent = finalText;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            h2.style.opacity = "1";
          });
        });
      }, 560);
    }

    function applyTransitionStep() {
      if (mode === "typing") {
        characterIndex += 1;
        drawWord();
        if (characterIndex >= currentWord().length) {
          mode = wordIndex === words.length - 1 ? "finalHold" : "holdTyped";
        }
        return;
      }

      if (mode === "finalHold") {
        triggerFinalFade();
        return;
      }

      if (mode === "holdTyped") {
        mode = "deleting";
        return;
      }

      if (mode === "deleting") {
        characterIndex = Math.max(0, characterIndex - 1);
        drawWord();
        if (characterIndex === 0) mode = "holdDeleted";
        return;
      }

      wordIndex = (wordIndex + 1) % words.length;
      mode = "typing";
    }

    function durationForMode() { return timings[mode] || timings.typing; }

    function tick(timestamp) {
      if (!running) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      elapsed += timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      let safety = 0;
      while (elapsed >= durationForMode() && safety < 24 && !isDone) {
        elapsed -= durationForMode();
        applyTransitionStep();
        safety += 1;
      }
      if (!isDone) rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (running || document.hidden || isReducedMotion() || isDone) return;
      running = true;
      lastTimestamp = 0;
      rafId = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }

    function reset() {
      stop();
      isDone = false;
      wordIndex = 0;
      characterIndex = 0;
      mode = "typing";
      elapsed = 0;
      lastTimestamp = 0;
      h2.style.transition = "";
      h2.style.opacity = "";
      h2.innerHTML = originalHTML;
      const el = liveWordEl();
      if (el) el.textContent = "";
      start();
    }

    // Scroll-replay: when hero leaves viewport then returns, replay everything
    let wasOutOfView = false;
    let scrollObserver = null;
    const heroSection = document.querySelector(".hero");
    if (heroSection && "IntersectionObserver" in window) {
      scrollObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              wasOutOfView = true;
            } else if (wasOutOfView) {
              wasOutOfView = false;
              reset();
            }
          });
        },
        { threshold: 0.45 }
      );
      scrollObserver.observe(heroSection);
    }

    function handlePause() { stop(); }
    function handleResume() { start(); }

    window.addEventListener("site:pause-animations", handlePause);
    window.addEventListener("site:resume-animations", handleResume);

    const el = liveWordEl();
    if (el) el.textContent = "";
    start();

    return {
      destroy() {
        stop();
        if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
        window.removeEventListener("site:pause-animations", handlePause);
        window.removeEventListener("site:resume-animations", handleResume);
      },
      setPaused(paused) {
        if (paused) stop(); else start();
      }
    };
  }

  function cleanupControllers() {
    if (heroController && typeof heroController.destroy === "function") {
      heroController.destroy();
    }

    if (cursorController && typeof cursorController.destroy === "function") {
      cursorController.destroy();
    }

    if (typingController && typeof typingController.destroy === "function") {
      typingController.destroy();
    }
  }

  function initControllers() {
    const options = { reducedMotion: isReducedMotion() };

    if (typeof window.initHeroAnimation === "function") {
      heroController = window.initHeroAnimation(options);
    }

    if (typeof window.initCursorEffect === "function") {
      cursorController = window.initCursorEffect(options);
    }

    typingController = initTypingHeadline();
  }

  function onMotionPreferenceChange() {
    document.body.classList.toggle("reduced-motion", isReducedMotion());

    cleanupControllers();
    initControllers();

    if (isReducedMotion()) {
      document
        .querySelectorAll(".reveal")
        .forEach((element) => element.classList.add("is-visible"));
    }
  }

  function setupMotionPreferenceListener() {
    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", onMotionPreferenceChange);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(onMotionPreferenceChange);
    }
  }

  function setupVisibilityLifecycle() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.dispatchEvent(new Event("site:pause-animations"));
      } else {
        window.dispatchEvent(new Event("site:resume-animations"));
      }
    });
  }

  function init() {
    document.body.classList.toggle("reduced-motion", isReducedMotion());

    setYear();
    setupSmoothScroll();
    setupRevealAnimations();
    setupMotionPreferenceListener();
    setupVisibilityLifecycle();
    setupScrollHeader();
    setupMobileNav();
    initControllers();
  }

  function setupScrollHeader() {
    const header = document.querySelector(".site-header");
    if (!(header instanceof HTMLElement)) return;
    const sync = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
  }

  function setupMobileNav() {
    const root = document.documentElement;
    const navElement = document.querySelector(".nav");
    const navToggle = document.getElementById("nav-toggle");
    const navLinks = document.getElementById("nav-links");
    const mobileNavQuery = window.matchMedia("(max-width: 1024px)");

    if (!navElement || !navToggle || !navLinks) return;

    const closeNavMenu = () => {
      navElement.classList.remove("is-open");
      root.classList.remove("nav-open");
      document.body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    };

    navToggle.addEventListener("click", () => {
      const next = !navElement.classList.contains("is-open");
      navElement.classList.toggle("is-open", next);
      root.classList.toggle("nav-open", next);
      document.body.classList.toggle("nav-open", next);
      navToggle.setAttribute("aria-expanded", String(next));
    });

    document.addEventListener("click", (event) => {
      if (!mobileNavQuery.matches || !navElement.classList.contains("is-open")) return;
      if (!(event.target instanceof Node)) return;
      if (!navElement.contains(event.target)) closeNavMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navElement.classList.contains("is-open")) closeNavMenu();
    });

    const onQueryChange = (event) => { if (!event.matches) closeNavMenu(); };
    if (typeof mobileNavQuery.addEventListener === "function") {
      mobileNavQuery.addEventListener("change", onQueryChange);
    } else if (typeof mobileNavQuery.addListener === "function") {
      mobileNavQuery.addListener(onQueryChange);
    }

    navElement.querySelectorAll("a[href^='#']").forEach((anchor) => {
      anchor.addEventListener("click", closeNavMenu);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
