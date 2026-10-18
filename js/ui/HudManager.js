/**
 * HudManager - Driving Zone style heads-up display:
 * round speedometer with gear + RPM, indicator lamps, mini-map, trip meter,
 * clock, FPS pill and toast messages. Pure DOM/SVG/2D-canvas (no WebGL cost).
 */
class HudManagerClass {
    constructor() {
        this.unit = 'kmh';
        this.maxKmh = 260;
        this.ready = false;
        this.el = {};
        this._lastDraw = 0;
        this._lastMini = 0;
        this._toastTimer = null;
        this.SWEEP = 270;
        this.START = 135; // gauge starts bottom-left
    }

    init() {
        if (this.ready) return;
        const $ = id => document.getElementById(id);
        this.el = {
            hud: $('game-hud'), speed: $('speed'), unitLabel: $('speed-unit-label'), gear: $('gear'),
            rpm: $('rpm'), rpmFill: $('rpm-fill'), needle: $('g-needle'), fill: $('g-fill'), track: $('g-track'),
            ticks: $('g-ticks'), clock: $('hud-clock'), trip: $('trip-km'), toast: $('hud-toast'),
            fpsPill: $('fps-pill'), fpsText: $('fps-text'), minimap: $('minimap'),
            lampSigL: $('lamp-sig-left'), lampSigR: $('lamp-sig-right'), lampLight: $('lamp-light'), lampBrake: $('lamp-brake'),
            btnLight: $('btn-light'), btnSigL: $('btn-sig-left'), btnSigR: $('btn-sig-right'),
            arrows: $('steer-arrows'), wheel: $('steer-wheel'), tiltHint: $('tilt-hint')
        };
        const d = this._arc(96);
        [this.el.track, this.el.fill].forEach(p => { if (p) { p.setAttribute('d', d); p.setAttribute('pathLength', '100'); } });
        if (this.el.fill) { this.el.fill.style.strokeDasharray = '100'; this.el.fill.style.strokeDashoffset = '100'; }
        this.mini = this.el.minimap ? this.el.minimap.getContext('2d') : null;
        this.buildTicks();
        this.ready = true;
    }

    _pt(angleDeg, r) {
        const a = angleDeg * Math.PI / 180;
        return [120 + r * Math.cos(a), 120 + r * Math.sin(a)];
    }

    _arc(r) {
        const [x1, y1] = this._pt(this.START, r);
        const [x2, y2] = this._pt(this.START + this.SWEEP, r);
        return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 1 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    }

    /** Rebuild the dial ticks for the current unit. */
    buildTicks() {
        const g = this.el.ticks;
        if (!g) return;
        const max = this.unit === 'mph' ? Math.round(this.maxKmh * 0.621371 / 20) * 20 : this.maxKmh;
        this.dialMax = max;
        const NS = 'http://www.w3.org/2000/svg';
        g.innerHTML = '';
        for (let v = 0; v <= max; v += 10) {
            const frac = v / max;
            const ang = this.START + this.SWEEP * frac;
            const major = v % 20 === 0;
            const [x1, y1] = this._pt(ang, 84);
            const [x2, y2] = this._pt(ang, major ? 74 : 79);
            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', x1); line.setAttribute('y1', y1);
            line.setAttribute('x2', x2); line.setAttribute('y2', y2);
            if (major) line.setAttribute('class', 'major');
            g.appendChild(line);
            if (v % 40 === 0) {
                const [tx, ty] = this._pt(ang, 62);
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', tx); t.setAttribute('y', ty);
                t.textContent = v;
                g.appendChild(t);
            }
        }
        if (this.el.unitLabel) this.el.unitLabel.textContent = this.unit === 'mph' ? 'MPH' : 'KM/H';
    }

    setUnit(unit) {
        this.unit = unit === 'mph' ? 'mph' : 'kmh';
        this.buildTicks();
    }

    setMaxSpeed(kmh) {
        this.maxKmh = Math.max(120, Math.ceil(kmh / 20) * 20 + 20);
        this.buildTicks();
    }

    show(visible) {
        if (this.el.hud) this.el.hud.classList.toggle('hidden', !visible);
    }

    /** Per-frame update (DOM writes are throttled to ~30 Hz). */
    update(s, now) {
        if (!this.ready) return;
        now = now || performance.now();
        if (now - this._lastDraw < 33) return;
        this._lastDraw = now;

        const shown = this.unit === 'mph' ? s.speedKmh * 0.621371 : s.speedKmh;
        const frac = Math.max(0, Math.min(1, shown / (this.dialMax || 260)));
        this.el.speed.textContent = Math.round(shown);
        this.el.needle.setAttribute('transform', `rotate(${(-135 + this.SWEEP * frac).toFixed(1)} 120 120)`);
        this.el.fill.style.strokeDashoffset = (100 - frac * 100).toFixed(1);

        this.el.gear.textContent = s.gear;
        const rpmFrac = Math.max(0, Math.min(1, s.rpm));
        this.el.rpmFill.style.width = (rpmFrac * 100).toFixed(0) + '%';
        this.el.rpm.textContent = (0.9 + rpmFrac * 6.1).toFixed(1);
        this.el.lampBrake.classList.toggle('on', !!s.handbrake);
    }

    setLamp(name, on) {
        const map = { sigL: this.el.lampSigL, sigR: this.el.lampSigR, light: this.el.lampLight };
        if (map[name]) map[name].classList.toggle('on', !!on);
        const btn = { sigL: this.el.btnSigL, sigR: this.el.btnSigR, light: this.el.btnLight }[name];
        if (btn) btn.classList.toggle('on', !!on);
    }

    setClock(hours) {
        const h = Math.floor(hours) % 24;
        const m = Math.floor((hours - Math.floor(hours)) * 60);
        this.el.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    setTrip(km) { if (this.el.trip) this.el.trip.textContent = km.toFixed(2); }

    setFps(fps, visible) {
        if (!this.el.fpsPill) return;
        this.el.fpsPill.hidden = !visible;
        if (visible) this.el.fpsText.textContent = Math.round(fps);
    }

    /** Switch between arrow buttons, steering wheel and tilt hint. */
    setSteerMode(mode) {
        const e = this.el;
        if (!e.arrows) return;
        e.arrows.hidden = mode !== 'buttons';
        e.wheel.hidden = mode !== 'wheel';
        e.tiltHint.hidden = mode !== 'tilt';
    }

    toast(msg) {
        const el = this.el.toast;
        if (!el) return;
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
    }

    /**
     * Mini-map: heading-up, 100 m radius. `path` is an array of [x,z] points,
     * `others` is an array of {x,z,color}.
     */
    drawMinimap(pos, heading, path, others, now) {
        if (!this.mini) return;
        now = now || performance.now();
        if (now - this._lastMini < 66) return;
        this._lastMini = now;
        const ctx = this.mini, W = 220, c = W / 2, scale = 1.1;
        ctx.clearRect(0, 0, W, W);
        ctx.save();
        ctx.translate(c, c);
        // forward = (-sin h, -cos h) in world; rotate so forward points up on the map
        ctx.rotate(heading + Math.PI);
        const toMap = (x, z) => [(x - pos.x) * scale, -(z - pos.z) * scale];

        if (path && path.length > 1) {
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 16;
            this._strokePath(ctx, path, toMap);
            ctx.strokeStyle = 'rgba(71,208,255,.9)'; ctx.lineWidth = 3.5;
            this._strokePath(ctx, path, toMap);
        }
        (others || []).forEach(o => {
            const [mx, my] = toMap(o.x, o.z);
            ctx.fillStyle = o.color || '#ff9f1c';
            ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();

        // player arrow stays fixed at the centre, pointing up
        ctx.save();
        ctx.translate(c, c);
        ctx.fillStyle = '#ff9f1c';
        ctx.strokeStyle = '#0a0d12'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 5); ctx.lineTo(-8, 9); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    _strokePath(ctx, path, toMap) {
        ctx.beginPath();
        let started = false;
        for (const p of path) {
            const [x, y] = toMap(p[0], p[1]);
            if (Math.abs(x) > 260 || Math.abs(y) > 260) { started = false; continue; }
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

window.HudManager = new HudManagerClass();
