(() => {
  class NeuralField {
    constructor(targetCanvas, container, options = {}) {
      this.canvas = targetCanvas;
      this.container = container;
      this.context = this.canvas.getContext("2d", { alpha: true });

      this.particles = [];
      this.maxDistance = options.maxDistance ?? 120;
      this.frameId = 0;
      this.lastTimestamp = 0;

      this.pageVisible = !document.hidden;
      this.heroVisible = true;
      this.externallyPaused = false;

      this.observer = null;
      this.width = 0;
      this.height = 0;
      this.pixelRatio = 1;

      this.mobileResizeQuery = window.matchMedia("(max-width: 860px)");
      this.reducedMotion = Boolean(options.reducedMotion);
      this.observeVisibility = Boolean(options.observeVisibility);
      this.reactsToPointer = Boolean(options.reactsToPointer);

      this.minParticles = options.minParticles ?? 30;
      this.maxParticles = options.maxParticles ?? 86;
      this.particleDensityDivisor = options.particleDensityDivisor ?? 18000;
      this.velocityScale = options.velocityScale ?? 0.38;
      this.minRadius = options.minRadius ?? 0.7;
      this.maxRadius = options.maxRadius ?? 2.4;
      this.maxDistanceMin = options.maxDistanceMin ?? 96;
      this.maxDistanceMax = options.maxDistanceMax ?? 168;
      this.maxDistanceViewportFactor = options.maxDistanceViewportFactor ?? 0.13;

      this.lineAlpha = options.lineAlpha ?? 0.24;
      this.secondaryLineAlpha = options.secondaryLineAlpha ?? 0.11;
      this.lineColor = options.lineColor ?? [132, 174, 255];
      this.secondaryLineColor = options.secondaryLineColor ?? [146, 122, 255];
      this.nodeColor = options.nodeColor ?? [201, 223, 255];
      this.nodeAlpha = options.nodeAlpha ?? 0.92;
      this.layerOpacity = options.layerOpacity ?? 1;

      this.pointerRadius = options.pointerRadius ?? 176;
      this.pointer = {
        x: 0,
        y: 0,
        active: false,
        strength: 0
      };

      this.onResize = this.onResize.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.onExternalPause = this.onExternalPause.bind(this);
      this.onExternalResume = this.onExternalResume.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.render = this.render.bind(this);
    }

    init() {
      if (!this.context) {
        return;
      }

      this.resize();
      this.createParticles();
      this.drawFrame(16);

      window.addEventListener("resize", this.onResize, { passive: true });
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      window.addEventListener("site:pause-animations", this.onExternalPause);
      window.addEventListener("site:resume-animations", this.onExternalResume);

      if (this.reactsToPointer) {
        window.addEventListener("hero:pointermove", this.onPointerMove);
      }

      if (this.observeVisibility && "IntersectionObserver" in window) {
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              this.heroVisible = entry.isIntersecting;
              if (this.heroVisible) {
                this.start();
              } else {
                this.stop();
              }
            });
          },
          {
            threshold: 0.08
          }
        );

        this.observer.observe(this.container);
      }

      if (!this.reducedMotion) {
        this.start();
      }
    }

    destroy() {
      this.stop();
      window.removeEventListener("resize", this.onResize);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      window.removeEventListener("site:pause-animations", this.onExternalPause);
      window.removeEventListener("site:resume-animations", this.onExternalResume);

      if (this.reactsToPointer) {
        window.removeEventListener("hero:pointermove", this.onPointerMove);
      }

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.context) {
        this.context.clearRect(0, 0, this.width, this.height);
      }
    }

    onResize() {
      const previousWidth = this.width;
      const previousHeight = this.height;
      this.resize();

      if (this.particles.length === 0) {
        this.createParticles();
        this.drawFrame(16);
        return;
      }

      const shouldPreserveParticles =
        this.mobileResizeQuery.matches && previousWidth > 0 && previousHeight > 0;

      if (shouldPreserveParticles) {
        const widthScale = this.width / previousWidth;
        const heightScale = this.height / previousHeight;

        this.particles.forEach((particle) => {
          particle.x = Math.max(0, Math.min(this.width, particle.x * widthScale));
          particle.y = Math.max(0, Math.min(this.height, particle.y * heightScale));
        });
      } else {
        this.createParticles();
      }

      this.drawFrame(16);
    }

    onVisibilityChange() {
      this.pageVisible = !document.hidden;
      if (this.pageVisible) {
        this.start();
      } else {
        this.stop();
      }
    }

    onExternalPause() {
      this.externallyPaused = true;
      this.stop();
    }

    onExternalResume() {
      this.externallyPaused = false;
      this.start();
    }

    onPointerMove(event) {
      const detail = event.detail || {};
      const hasClientX = typeof detail.clientX === "number";
      const hasClientY = typeof detail.clientY === "number";

      if (!hasClientX || !hasClientY) {
        this.pointer.active = false;
        return;
      }

      const bounds = this.canvas.getBoundingClientRect();
      this.pointer.x = detail.clientX - bounds.left;
      this.pointer.y = detail.clientY - bounds.top;
      this.pointer.active = Boolean(detail.active);
    }

    start() {
      if (
        !this.context ||
        this.frameId ||
        this.reducedMotion ||
        !this.pageVisible ||
        !this.heroVisible ||
        this.externallyPaused
      ) {
        return;
      }

      this.lastTimestamp = 0;
      this.frameId = requestAnimationFrame(this.render);
    }

    stop() {
      if (!this.frameId) {
        return;
      }

      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }

    resize() {
      this.width = Math.max(1, this.container.clientWidth);
      this.height = Math.max(1, this.container.clientHeight);
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      this.canvas.width = Math.floor(this.width * this.pixelRatio);
      this.canvas.height = Math.floor(this.height * this.pixelRatio);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      if (this.context) {
        this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      }

      this.maxDistance = Math.max(
        this.maxDistanceMin,
        Math.min(this.maxDistanceMax, this.width * this.maxDistanceViewportFactor)
      );
    }

    createParticles() {
      const area = this.width * this.height;
      const desiredCount = Math.max(
        this.minParticles,
        Math.min(this.maxParticles, Math.floor(area / this.particleDensityDivisor))
      );

      this.particles = Array.from({ length: desiredCount }, () => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * this.velocityScale,
        vy: (Math.random() - 0.5) * this.velocityScale,
        radius: Math.random() * (this.maxRadius - this.minRadius) + this.minRadius
      }));
    }

    drawPointerHalo() {
      if (!this.reactsToPointer || !this.pointer.active || this.reducedMotion || !this.context) {
        return;
      }

      const inRange =
        this.pointer.x > -220 &&
        this.pointer.x < this.width + 220 &&
        this.pointer.y > -220 &&
        this.pointer.y < this.height + 220;

      if (!inRange) {
        return;
      }

      const halo = this.context.createRadialGradient(
        this.pointer.x,
        this.pointer.y,
        0,
        this.pointer.x,
        this.pointer.y,
        210
      );

      halo.addColorStop(0, "rgba(49, 107, 255, 0.19)");
      halo.addColorStop(0.32, "rgba(123, 77, 255, 0.11)");
      halo.addColorStop(1, "rgba(17, 195, 255, 0)");

      this.context.fillStyle = halo;
      this.context.beginPath();
      this.context.arc(this.pointer.x, this.pointer.y, 210, 0, Math.PI * 2);
      this.context.fill();
    }

    drawFrame(delta) {
      if (!this.context) {
        return;
      }

      const speedFactor = Math.min(delta, 32) / 16;
      const maxDistanceSquared = this.maxDistance * this.maxDistance;
      const farDistance = this.maxDistance * 1.72;
      const farDistanceSquared = farDistance * farDistance;

      this.context.clearRect(0, 0, this.width, this.height);
      this.context.save();
      this.context.globalAlpha = this.layerOpacity;

      this.pointer.strength += ((this.pointer.active ? 1 : 0) - this.pointer.strength) * 0.08;

      this.drawPointerHalo();

      for (let index = 0; index < this.particles.length; index += 1) {
        const particle = this.particles[index];

        particle.x += particle.vx * speedFactor;
        particle.y += particle.vy * speedFactor;

        if (particle.x <= 0 || particle.x >= this.width) {
          particle.vx *= -1;
          particle.x = Math.max(0, Math.min(this.width, particle.x));
        }

        if (particle.y <= 0 || particle.y >= this.height) {
          particle.vy *= -1;
          particle.y = Math.max(0, Math.min(this.height, particle.y));
        }

        if (this.reactsToPointer && this.pointer.active) {
          const dxPointer = particle.x - this.pointer.x;
          const dyPointer = particle.y - this.pointer.y;
          const distanceToPointer = Math.hypot(dxPointer, dyPointer);

          if (distanceToPointer > 0 && distanceToPointer < this.pointerRadius) {
            const influence =
              (1 - distanceToPointer / this.pointerRadius) * 0.045 * this.pointer.strength;
            particle.vx += (dxPointer / distanceToPointer) * influence;
            particle.vy += (dyPointer / distanceToPointer) * influence;
          }
        }

        particle.vx *= 0.998;
        particle.vy *= 0.998;

        for (let next = index + 1; next < this.particles.length; next += 1) {
          const other = this.particles[next];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared <= maxDistanceSquared) {
            const alpha = (1 - distanceSquared / maxDistanceSquared) * this.lineAlpha;
            this.context.strokeStyle = `rgba(${this.lineColor[0]}, ${this.lineColor[1]}, ${this.lineColor[2]}, ${alpha.toFixed(3)})`;
            this.context.lineWidth = 1;
            this.context.beginPath();
            this.context.moveTo(particle.x, particle.y);
            this.context.lineTo(other.x, other.y);
            this.context.stroke();
          } else if (distanceSquared <= farDistanceSquared) {
            const alpha =
              (1 - (distanceSquared - maxDistanceSquared) / (farDistanceSquared - maxDistanceSquared)) *
              this.secondaryLineAlpha;
            this.context.strokeStyle = `rgba(${this.secondaryLineColor[0]}, ${this.secondaryLineColor[1]}, ${this.secondaryLineColor[2]}, ${alpha.toFixed(3)})`;
            this.context.lineWidth = 0.8;
            this.context.beginPath();
            this.context.moveTo(particle.x, particle.y);
            this.context.lineTo(other.x, other.y);
            this.context.stroke();
          }
        }

        this.context.fillStyle = `rgba(${this.nodeColor[0]}, ${this.nodeColor[1]}, ${this.nodeColor[2]}, ${this.nodeAlpha})`;
        this.context.beginPath();
        this.context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        this.context.fill();
      }

      this.context.restore();
    }

    render(timestamp) {
      if (!this.pageVisible || !this.heroVisible || this.externallyPaused || this.reducedMotion) {
        this.frameId = 0;
        return;
      }

      const delta = this.lastTimestamp ? timestamp - this.lastTimestamp : 16;
      this.lastTimestamp = timestamp;
      this.drawFrame(delta);

      this.frameId = requestAnimationFrame(this.render);
    }
  }

  function createField(canvasId, container, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !container) {
      return null;
    }

    const field = new NeuralField(canvas, container, options);
    field.init();
    return field;
  }

  window.initHeroAnimation = function initHeroAnimation(options = {}) {
    try {
      const reducedMotion = Boolean(options.reducedMotion);
      const instances = [];

      const siteField = createField("site-network", document.documentElement, {
        reducedMotion,
        observeVisibility: false,
        reactsToPointer: true,
        minParticles: 32,
        maxParticles: 86,
        particleDensityDivisor: 24000,
        velocityScale: 0.2,
        minRadius: 0.7,
        maxRadius: 1.9,
        maxDistanceMin: 90,
        maxDistanceMax: 138,
        maxDistanceViewportFactor: 0.1,
        lineAlpha: 0.2,
        secondaryLineAlpha: 0.08,
        lineColor: [113, 162, 255],
        secondaryLineColor: [140, 124, 255],
        nodeColor: [185, 216, 255],
        nodeAlpha: 0.84,
        layerOpacity: 0.85,
        pointerRadius: 164
      });

      if (siteField) {
        instances.push(siteField);
      }

      const heroContainer = document.querySelector(".hero");
      const heroField = createField("hero-network", heroContainer, {
        reducedMotion,
        observeVisibility: true,
        reactsToPointer: true,
        minParticles: 34,
        maxParticles: 96,
        particleDensityDivisor: 18000,
        velocityScale: 0.38,
        minRadius: 0.7,
        maxRadius: 2.4,
        maxDistanceMin: 96,
        maxDistanceMax: 162,
        maxDistanceViewportFactor: 0.13,
        lineAlpha: 0.25,
        secondaryLineAlpha: 0.1,
        lineColor: [118, 168, 255],
        secondaryLineColor: [145, 126, 255],
        nodeColor: [198, 223, 255],
        nodeAlpha: 0.93,
        layerOpacity: 1,
        pointerRadius: 182
      });

      if (heroField) {
        instances.push(heroField);
      }

      if (!instances.length) {
        return {
          destroy() {},
          setPaused() {}
        };
      }

      return {
        destroy: () => {
          instances.forEach((instance) => instance.destroy());
        },
        setPaused: (paused) => {
          instances.forEach((instance) => {
            if (paused) {
              instance.onExternalPause();
            } else {
              instance.onExternalResume();
            }
          });
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
