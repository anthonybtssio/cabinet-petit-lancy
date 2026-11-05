// Studio de rééducation en 3D : matériel de physiothérapie procédural, animé par
// une petite physique en pixels écran (rebonds, collisions, élastiques à pincer).
import * as THREE from './vendor/three.module.min.js';

const COLORS = {
    tomato: 0xef5a3c,
    cobalt: 0x2a45e0,
    marigold: 0xf6b52e,
    sage: 0x6fb08f,
    blush: 0xf49c8f,
    navy: 0x17233f,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Géométrie : chaque objet tient dans un rayon d'environ 1 ---------- */

function clay(color, options = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0, ...options });
}

function mesh(geometry, material, setup) {
    const m = new THREE.Mesh(geometry, material);
    if (setup) setup(m);
    return m;
}

function makeBall(color) {
    const g = new THREE.Group();
    const material = clay(color, { roughness: 0.5 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material));
    // Soudures et valve du ballon de gymnastique
    for (const tilt of [0, Math.PI / 3, -Math.PI / 3]) {
        g.add(mesh(new THREE.TorusGeometry(1, 0.008, 6, 80), clay(color, { roughness: 0.7 }), (m) => {
            m.rotation.x = Math.PI / 2;
            m.rotation.y = tilt;
        }));
    }
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.06, 16), clay(COLORS.navy), (m) => { m.position.y = 1; }));
    return g;
}

function makeDome(color) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(1, 44, 20, 0, Math.PI * 2, 0, Math.PI / 2), clay(color), (m) => {
        m.scale.y = 0.72;
        m.position.y = -0.22;
    }));
    g.add(mesh(new THREE.CylinderGeometry(1.03, 1.06, 0.16, 44), clay(COLORS.navy), (m) => { m.position.y = -0.3; }));
    return g;
}

function makeRoller(color) {
    const profile = [new THREE.Vector2(0.001, -1)];
    for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const groove = 0.03 * Math.cos(t * Math.PI * 16);
        profile.push(new THREE.Vector2(0.48 + groove, -1 + t * 2));
    }
    profile.push(new THREE.Vector2(0.001, 1));
    return new THREE.Group().add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), clay(color, { roughness: 0.62 })));
}

function makeDumbbell(color) {
    const g = new THREE.Group();
    const plate = clay(color, { flatShading: true });
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.3, 16), clay(COLORS.navy)));
    for (const side of [-1, 1]) {
        g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 6), plate, (m) => { m.position.y = side * 0.72; }));
        g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 6), plate, (m) => { m.position.y = side * 0.5; }));
    }
    return g;
}

function makeSpikyBall(color) {
    const g = new THREE.Group();
    const material = clay(color);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.66, 28, 20), material));
    const count = 64;
    const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.34, 10), material, count);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
        const y = 1 - (2 * (i + 0.5)) / count;
        const ring = Math.sqrt(1 - y * y);
        const a = i * Math.PI * (3 - Math.sqrt(5));
        dir.set(Math.cos(a) * ring, y, Math.sin(a) * ring);
        q.setFromUnitVectors(up, dir);
        m.compose(dir.clone().multiplyScalar(0.77), q, one);
        spikes.setMatrixAt(i, m);
    }
    spikes.frustumCulled = false;
    g.add(spikes);
    return g;
}

function makeLoopBand(color) {
    const geometry = new THREE.TorusGeometry(0.86, 0.065, 10, 72);
    geometry.scale(1, 1, 3.4);
    return new THREE.Group().add(new THREE.Mesh(geometry, clay(color, { roughness: 0.4, side: THREE.DoubleSide })));
}

const MAKERS = {
    ball: makeBall,
    dome: makeDome,
    roller: makeRoller,
    dumbbell: makeDumbbell,
    spiky: makeSpikyBall,
    loop: makeLoopBand,
};

function softShadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(23,35,63,0.42)');
    gradient.addColorStop(0.6, 'rgba(23,35,63,0.16)');
    gradient.addColorStop(1, 'rgba(23,35,63,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}

/* ---------- Composition ---------- */

// Objets qui flottent sur les marges et défilent en parallaxe
const AMBIENT = [
    { kind: 'ball', color: 'cobalt', r: 84, fx: 0.035, fy: 0.3, p: 0.42 },
    { kind: 'dumbbell', color: 'tomato', r: 72, fx: 0.965, fy: 0.62, p: 0.6 },
    { kind: 'dome', color: 'sage', r: 76, fx: 0.05, fy: 0.86, p: 0.5 },
    { kind: 'spiky', color: 'blush', r: 50, fx: 0.955, fy: 0.16, p: 0.74 },
    { kind: 'loop', color: 'marigold', r: 66, fx: 0.025, fy: 0.05, p: 0.66 },
    { kind: 'roller', color: 'cobalt', r: 74, fx: 0.975, fy: 0.98, p: 0.36 },
    { kind: 'ball', color: 'tomato', r: 58, fx: 0.94, fy: 0.42, p: 0.84 },
];

// Objets fixés à un élément de la page (position relative à son cadre)
const ANCHORED = [
    { selector: '.hero-image', kind: 'ball', color: 'tomato', size: 0.3, ax: -0.06, ay: 0.84 },
    { selector: '.hero-image', kind: 'spiky', color: 'cobalt', size: 0.12, ax: -0.13, ay: 0.3 },
    { selector: '.hero-image', kind: 'dome', color: 'sage', size: 0.2, ax: 1.03, ay: 0.05 },
    { selector: '.philosophy-image', kind: 'ball', color: 'cobalt', size: 0.27, ax: 0.35, ay: 0.4, of: 'minSide' },
    { selector: '.philosophy-image', kind: 'dome', color: 'marigold', size: 0.2, ax: 0.73, ay: 0.72, of: 'minSide' },
    { selector: '.philosophy-image', kind: 'dumbbell', color: 'tomato', size: 0.17, ax: 0.77, ay: 0.25, of: 'minSide' },
    { selector: '.philosophy-image', kind: 'spiky', color: 'blush', size: 0.08, ax: 0.2, ay: 0.82, of: 'minSide' },
];

function pageRect(el) {
    let left = 0;
    let top = 0;
    let node = el;
    while (node) {
        left += node.offsetLeft;
        top += node.offsetTop;
        node = node.offsetParent;
    }
    return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}

/* ---------- Élastique : corde vibrante rendue en ruban torsadé ---------- */

class Band {
    constructor(color, config) {
        this.n = 60;
        this.u = new Float32Array(this.n);
        this.v = new Float32Array(this.n);
        this.config = config;
        this.positions = new Float32Array(this.n * 2 * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        const index = [];
        for (let i = 0; i < this.n - 1; i++) {
            const a = i * 2;
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        geometry.setIndex(index);
        this.geometry = geometry;
        this.mesh = new THREE.Mesh(geometry, clay(color, { side: THREE.DoubleSide, roughness: 0.5 }));
        this.mesh.frustumCulled = false;
        this.y = 0;
    }

    update(dt, ctx) {
        const { n, u, v } = this;
        const { width, height, scrollY, pointer, time, frozen } = ctx;
        const span = height + 240;
        const raw = this.config.fy * span - scrollY * this.config.p;
        this.y = ((raw % span) + span) % span - 120;

        if (!frozen) {
            const dx = (width + 160) / (n - 1);
            const steps = 2;
            const h = dt / steps;
            const c2 = (520 / dx) ** 2;
            for (let s = 0; s < steps; s++) {
                for (let i = 1; i < n - 1; i++) {
                    v[i] += (c2 * (u[i - 1] + u[i + 1] - 2 * u[i]) - 1.5 * v[i]) * h;
                }
                for (let i = 1; i < n - 1; i++) u[i] += v[i] * h;
            }
            // Le pointeur pince l'élastique quand il le traverse
            if (pointer.presence > 0.5) {
                const i = Math.round((pointer.x + 80) / dx);
                if (i > 1 && i < n - 2) {
                    const lineY = this.lineY(i, time) + u[i];
                    if (Math.abs(pointer.y - lineY) < 30) {
                        const push = clamp(pointer.vy, -2600, 2600) * 0.16;
                        for (let k = -2; k <= 2; k++) v[i + k] += push * (1 - Math.abs(k) / 3);
                    }
                }
            }
        }

        const half = this.config.w * ctx.bandScale * 0.5;
        const stepX = (width + 160) / (n - 1);
        for (let i = 0; i < n; i++) {
            const twist = i * 0.21 + (frozen ? 0 : time * 0.5) + this.config.phase;
            const x = -80 + i * stepX - width / 2;
            const y = height / 2 - (this.lineY(i, time) + u[i]);
            const a = i * 6;
            this.positions[a] = x;
            this.positions[a + 1] = y + Math.cos(twist) * half;
            this.positions[a + 2] = -60 + Math.sin(twist) * half;
            this.positions[a + 3] = x;
            this.positions[a + 4] = y - Math.cos(twist) * half;
            this.positions[a + 5] = -60 - Math.sin(twist) * half;
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }

    lineY(i, time) {
        const t = i / (this.n - 1);
        return this.y + Math.sin(t * Math.PI * 2 + this.config.phase + time * 0.15) * this.config.sag;
    }
}

/* ---------- Scène ---------- */

export function startStudio() {
    const canvas = document.createElement('canvas');
    canvas.className = 'studio-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
        canvas.remove();
        return false;
    }

    const scene = new THREE.Scene();
    const FOV = 26;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 8000);

    scene.add(new THREE.HemisphereLight(0xfffaf0, 0xe8d9c3, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.75);
    key.position.set(-0.5, 0.9, 1);
    scene.add(key);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let noMotion = motionQuery.matches;
    const shadowTexture = softShadowTexture();
    const bodies = [];

    function addBody(spec, anchorEl) {
        const inner = MAKERS[spec.kind](COLORS[spec.color]);
        inner.quaternion.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
        // L'étirement suit la vitesse ; `counter` annule cette rotation pour l'objet lui-même
        const outer = new THREE.Group();
        const counter = new THREE.Group();
        counter.add(inner);
        outer.add(counter);
        const shadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: shadowTexture, depthWrite: false, depthTest: false }));
        shadow.renderOrder = -1;
        scene.add(shadow, outer);
        bodies.push({
            spec, anchorEl, rect: null, inner, counter, outer, shadow,
            r: spec.r || 50, x: 0, y: 0, vx: 0, vy: 0, homeX: 0, homeY: 0,
            sq: 0, sqV: 0, phase: Math.random() * Math.PI * 2,
            spin: new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5 + 0.2, (Math.random() - 0.5) * 0.3),
            idleSpin: new THREE.Vector3(),
            placed: false,
        });
    }

    const narrowStart = window.innerWidth <= 880;
    AMBIENT.slice(0, narrowStart ? 4 : AMBIENT.length).forEach((spec) => addBody(spec));
    ANCHORED.forEach((spec) => {
        const el = document.querySelector(spec.selector);
        if (el) addBody(spec, el);
    });
    bodies.forEach((b) => b.idleSpin.copy(b.spin));

    const bands = [
        new Band(COLORS.tomato, { fy: 0.26, p: 0.3, w: 15, sag: 34, phase: 0.6 }),
        new Band(COLORS.cobalt, { fy: 0.78, p: 0.46, w: 12, sag: 46, phase: 2.6 }),
    ];
    bands.forEach((band) => scene.add(band.mesh));

    const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, presence: 0, lastX: 0, lastY: 0 };
    let width = 1;
    let height = 1;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let sizeFactor = 1;
    let narrow = false;
    let dirty = true;

    function measure() {
        for (const b of bodies) {
            if (!b.anchorEl) continue;
            const rect = pageRect(b.anchorEl);
            b.rect = rect;
            const reference = b.spec.of === 'minSide' ? Math.min(rect.width, rect.height) : rect.width;
            b.r = b.spec.size * reference;
        }
        bodies.forEach((b) => {
            if (!b.anchorEl) b.r = b.spec.r * sizeFactor;
        });
        dirty = true;
    }

    function resize() {
        const box = canvas.getBoundingClientRect();
        width = Math.max(1, box.width);
        height = Math.max(1, box.height);
        narrow = width <= 880;
        sizeFactor = narrow ? 0.58 : clamp(width / 1440, 0.72, 1.15);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // À z = 0, une unité du monde vaut exactement un pixel CSS
        camera.position.z = height / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
        camera.updateProjectionMatrix();
        measure();
    }

    function shock(x, y, strength, radius) {
        for (const b of bodies) {
            const dx = b.x - x;
            const dy = b.y - y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > radius) continue;
            const f = (1 - d / radius) * strength;
            b.vx += (dx / d) * f;
            b.vy += (dy / d) * f - f * 0.3;
            b.sqV += f * 0.006;
            b.spin.x += (dy / d) * f * 0.006;
            b.spin.y += (dx / d) * f * 0.006;
        }
        dirty = true;
    }

    window.addEventListener('resize', resize);
    window.addEventListener('load', measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    motionQuery.addEventListener('change', (e) => { noMotion = e.matches; dirty = true; });
    window.addEventListener('scroll', () => { dirty = true; }, { passive: true });
    window.addEventListener('pointermove', (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.presence = e.pointerType === 'touch' ? 0 : 1;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.presence = 0; });
    window.addEventListener('pointerdown', (e) => {
        if (!noMotion) shock(e.clientX, e.clientY, 1500, 420);
    }, { passive: true });
    window.addEventListener('studio:nudge', (e) => {
        if (!noMotion) shock(e.detail.x, e.detail.y, 420, 620);
    });

    const dq = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    let time = 0;
    let lastScroll = window.scrollY;
    let previous = performance.now();
    let frames = 0;
    let slowFrames = 0;

    function computeHome(b, scrollY) {
        if (b.anchorEl) {
            const { rect, spec } = b;
            if (!rect) return;
            b.homeX = rect.left + rect.width * spec.ax;
            b.homeY = rect.top + rect.height * spec.ay - scrollY;
            return;
        }
        const margin = b.r * 2 + 40;
        const span = height + margin * 2;
        const raw = b.spec.fy * span - scrollY * b.spec.p;
        const home = (((raw % span) + span) % span) - margin;
        // Bouclage hors écran : téléporte l'objet sans le faire traverser la page
        if (b.placed && Math.abs(home - b.homeY) > span / 2) b.y += home > b.homeY ? span : -span;
        b.homeY = home;
        const fx = narrow ? (b.spec.fx < 0.5 ? 0.01 : 0.99) : b.spec.fx;
        b.homeX = fx * width;
    }

    function step(dt) {
        const scrollY = window.scrollY;
        const scrollDelta = scrollY - lastScroll;
        lastScroll = scrollY;

        pointer.vx = dt > 0 ? (pointer.x - pointer.lastX) / dt : 0;
        pointer.vy = dt > 0 ? (pointer.y - pointer.lastY) / dt : 0;
        pointer.lastX = pointer.x;
        pointer.lastY = pointer.y;

        for (const b of bodies) {
            computeHome(b, scrollY);
            if (!b.placed) {
                b.x = b.homeX;
                b.y = noMotion ? b.homeY : b.homeY - height - Math.random() * 400;
                b.placed = true;
            }
            if (noMotion) {
                b.x = b.homeX;
                b.y = b.homeY;
                b.vx = b.vy = b.sq = b.sqV = 0;
                continue;
            }

            const anchored = !!b.anchorEl;
            const k = anchored ? 30 : 15;
            const floatY = Math.sin(time * 0.7 + b.phase) * (anchored ? 5 : 12);
            const floatX = Math.cos(time * 0.5 + b.phase) * (anchored ? 3 : 8);
            let ax = (b.homeX + floatX - b.x) * k - b.vx * 3.1;
            let ay = (b.homeY + floatY - b.y) * k - b.vy * 3.1;

            // Le pointeur repousse et lance les objets
            if (pointer.presence > 0.5) {
                const dx = b.x - pointer.x;
                const dy = b.y - pointer.y;
                const d = Math.hypot(dx, dy) || 1;
                const reach = b.r + 120;
                if (d < reach) {
                    const f = (1 - d / reach) ** 2 * 7000;
                    ax += (dx / d) * f + pointer.vx * 0.5;
                    ay += (dy / d) * f + pointer.vy * 0.5;
                    b.spin.y += pointer.vx * 0.00022;
                    b.spin.x += pointer.vy * 0.00022;
                }
            }

            b.vx += ax * dt;
            b.vy += ay * dt;
            b.spin.x += clamp(scrollDelta, -80, 80) * 0.0012;
        }

        // Collisions souples entre objets
        if (!noMotion) {
            for (let i = 0; i < bodies.length; i++) {
                for (let j = i + 1; j < bodies.length; j++) {
                    const a = bodies[i];
                    const b = bodies[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const min = (a.r + b.r) * 0.92;
                    const d2 = dx * dx + dy * dy;
                    if (d2 >= min * min || d2 === 0) continue;
                    const d = Math.sqrt(d2);
                    const nx = dx / d;
                    const ny = dy / d;
                    const overlap = (min - d) / 2;
                    a.x -= nx * overlap;
                    a.y -= ny * overlap;
                    b.x += nx * overlap;
                    b.y += ny * overlap;
                    const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                    if (closing > 0) {
                        const impulse = closing * 0.82;
                        a.vx -= nx * impulse;
                        a.vy -= ny * impulse;
                        b.vx += nx * impulse;
                        b.vy += ny * impulse;
                        a.sqV += closing * 0.004;
                        b.sqV += closing * 0.004;
                    }
                }
            }
        }

        for (const b of bodies) {
            if (!noMotion) {
                b.x += b.vx * dt;
                b.y += b.vy * dt;

                // Déformation élastique, type ballon
                const speed = Math.hypot(b.vx, b.vy);
                const stretch = Math.min(0.14, speed / 9000);
                b.sqV += (stretch - b.sq) * 130 * dt - b.sqV * 9 * dt;
                b.sq = clamp(b.sq + b.sqV * dt, -0.24, 0.24);

                // La rotation revient doucement à son régime calme
                b.spin.lerp(b.idleSpin, Math.min(1, dt * 0.9));
                const w = b.spin.length();
                if (w > 1e-4) {
                    axis.copy(b.spin).divideScalar(w);
                    dq.setFromAxisAngle(axis, w * dt);
                    b.inner.quaternion.premultiply(dq);
                }
            }

            const visible = b.y > -b.r * 3 && b.y < height + b.r * 3;
            b.outer.visible = b.shadow.visible = visible;
            if (!visible) continue;

            const wx = b.x - width / 2;
            const wy = height / 2 - b.y;
            b.outer.position.set(wx, wy, 0);
            const heading = Math.atan2(-b.vy, b.vx || 1e-4);
            b.outer.rotation.z = heading;
            b.counter.rotation.z = -heading;
            b.outer.scale.set(b.r * (1 + b.sq), b.r * (1 - b.sq), b.r);

            const shadowSize = b.r * 2.75;
            b.shadow.position.set(wx + b.r * 0.2, wy - b.r * 0.34, -b.r * 1.7);
            b.shadow.scale.set(shadowSize, shadowSize * 0.92, 1);
        }

        const context = {
            width, height, scrollY, pointer, time, frozen: noMotion, bandScale: narrow ? 0.7 : 1,
        };
        bands.forEach((band) => band.update(dt, context));
    }

    function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden) {
            previous = now;
            return;
        }
        const dt = Math.min(1 / 30, (now - previous) / 1000);
        previous = now;

        if (noMotion) {
            if (!dirty) return;
            dirty = false;
            step(0);
            renderer.render(scene, camera);
            return;
        }

        time += dt;
        frames++;
        if (frames > 45 && dt > 0.03) slowFrames++;
        if (frames > 45 && frames % 90 === 0) {
            if (slowFrames > 45 && dpr > 1) {
                dpr = 1;
                resize();
            }
            slowFrames = 0;
        }
        step(dt);
        renderer.render(scene, camera);
    }

    resize();
    step(0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return true;
}
