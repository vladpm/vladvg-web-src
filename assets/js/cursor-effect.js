(() => {
  class CursorEffect {
    constructor(glow, options = {}) {
      this.glow = glow;
      this.reducedMotion = Boolean(options.reducedMotion);
      this.hasFinePointer = window.matchMedia("(pointer:fine)").matches;

      this.running = false;
      this.rafId = null;

      this.pointer = {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.5,
        targetX: window.innerWidth * 0.5,
        targetY: window.innerHeight * 0.5,
        active: false
      };

      this.halfGlowSize = this.glow.offsetWidth / 2 || 130;

      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerOut = this.handlePointerOut.bind(this);
      this.handlePointerLeave = this.handlePointerLeave.bind(this);
      this.handleResize = this.handleResize.bind(this);
      this.handlePause = this.handlePause.bind(this);
      this.handleResume = this.handleResume.bind(this);
      this.handleVisibility = this.handleVisibility.bind(this);
      this.render = this.render.bind(this);

      if (this.reducedMotion || !this.hasFinePointer) {
        this.glow.style.display = "none";
        return;
      }

      this.attachEvents();
      this.start();
    }

    attachEvents() {
      window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
      window.addEventListener("pointerdown", this.handlePointerMove, { passive: true });
      window.addEventListener("mouseout", this.handlePointerOut);
      document.addEventListener("mouseleave", this.handlePointerLeave);
      window.addEventListener("blur", this.handlePointerLeave);
      window.addEventListener("resize", this.handleResize, { passive: true });
      window.addEventListener("site:pause-animations", this.handlePause);
      window.addEventListener("site:resume-animations", this.handleResume);
      document.addEventListener("visibilitychange", this.handleVisibility);
    }

    detachEvents() {
      window.removeEventListener("pointermove", this.handlePointerMove);
      window.removeEventListener("pointerdown", this.handlePointerMove);
      window.removeEventListener("mouseout", this.handlePointerOut);
      document.removeEventListener("mouseleave", this.handlePointerLeave);
      window.removeEventListener("blur", this.handlePointerLeave);
      window.removeEventListener("resize", this.handleResize);
      window.removeEventListener("site:pause-animations", this.handlePause);
      window.removeEventListener("site:resume-animations", this.handleResume);
      document.removeEventListener("visibilitychange", this.handleVisibility);
    }

    handleVisibility() {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    }

    handleResize() {
      this.halfGlowSize = this.glow.offsetWidth / 2 || 130;
      this.pointer.targetX = Math.min(this.pointer.targetX, window.innerWidth);
      this.pointer.targetY = Math.min(this.pointer.targetY, window.innerHeight);
    }

    emitPointer(active) {
      window.dispatchEvent(
        new CustomEvent("hero:pointermove", {
          detail: {
            x: this.pointer.targetX,
            y: this.pointer.targetY,
            clientX: this.pointer.targetX,
            clientY: this.pointer.targetY,
            active
          }
        })
      );
    }

    handlePointerMove(event) {
      this.pointer.targetX = event.clientX;
      this.pointer.targetY = event.clientY;

      if (!this.pointer.active) {
        this.pointer.x = this.pointer.targetX;
        this.pointer.y = this.pointer.targetY;
      }

      this.pointer.active = true;
      this.glow.classList.add("active");
      this.emitPointer(true);
    }

    handlePointerOut(event) {
      if (!event.relatedTarget) {
        this.handlePointerLeave();
      }
    }

    handlePointerLeave() {
      this.pointer.active = false;
      this.glow.classList.remove("active");
      this.emitPointer(false);
    }

    start() {
      if (this.running || this.reducedMotion || !this.hasFinePointer || document.hidden) {
        return;
      }

      this.running = true;
      this.rafId = requestAnimationFrame(this.render);
    }

    pause() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    resume() {
      this.start();
    }

    handlePause() {
      this.pause();
    }

    handleResume() {
      this.resume();
    }

    render() {
      if (!this.running) {
        return;
      }

      this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.18;
      this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.18;

      const x = this.pointer.x - this.halfGlowSize;
      const y = this.pointer.y - this.halfGlowSize;
      this.glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      this.rafId = requestAnimationFrame(this.render);
    }

    destroy() {
      this.pause();
      this.detachEvents();
    }
  }

  window.initCursorEffect = function initCursorEffect(options = {}) {
    try {
      const glow = document.getElementById("cursor-glow");

      if (!glow) {
        return {
          destroy() {},
          setPaused() {}
        };
      }

      const instance = new CursorEffect(glow, options);

      return {
        destroy: () => instance.destroy(),
        setPaused: (paused) => {
          if (paused) {
            instance.pause();
          } else {
            instance.resume();
          }
        }
      };
    } catch (error) {
      return {
        destroy() {},
        setPaused() {}
      };
    }
  };
})();
