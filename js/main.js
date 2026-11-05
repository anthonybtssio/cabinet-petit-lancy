// Interactions de l'interface : apparitions, cartes en relief et lancement
// de la scène 3D. Sans JS, le contenu reste visible.
(function () {
    const root = document.documentElement;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    root.classList.add('js');

    /* ---------- Titres mot à mot ---------- */
    document.querySelectorAll('h1').forEach((h1) => {
        const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        let index = 0;
        nodes.forEach((node) => {
            const fragment = document.createDocumentFragment();
            node.textContent.split(/(\s+)/).forEach((part) => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    fragment.append(part);
                    return;
                }
                const word = document.createElement('span');
                word.className = 'word';
                word.style.setProperty('--i', index++);
                word.textContent = part;
                fragment.append(word);
            });
            node.replaceWith(fragment);
        });
        h1.classList.add('is-split');
    });

    /* ---------- Apparitions au scroll ---------- */
    const autoReveal = '.service-card, .info-card, .booking-card, .philosophy-section, .cta-box, ' +
        '.page-head, .section-head, .map-wrapper, .hours-note, .access-link';
    document.querySelectorAll(autoReveal).forEach((el) => el.classList.add('reveal'));

    document.querySelectorAll('.services-grid, .info-grid, .booking-options').forEach((grid) => {
        [...grid.children].forEach((child, i) => child.style.setProperty('--d', `${(i % 3) * 90}ms`));
    });

    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !motionQuery.matches) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
        reveals.forEach((el) => observer.observe(el));
    } else {
        reveals.forEach((el) => el.classList.add('is-in'));
    }

    /* ---------- En-tête et progression ---------- */
    const header = document.querySelector('header');
    let ticking = false;
    function onScroll() {
        ticking = false;
        const max = Math.max(1, root.scrollHeight - window.innerHeight);
        root.style.setProperty('--progress', Math.min(1, window.scrollY / max).toFixed(4));
        header?.classList.toggle('is-scrolled', window.scrollY > 24);
    }
    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(onScroll);
        }
    }, { passive: true });
    onScroll();

    // Sur mobile, garde le lien actif visible dans la barre défilante
    const nav = document.querySelector('nav');
    const active = document.querySelector('nav a.active');
    if (nav && active && nav.scrollWidth > nav.clientWidth) {
        nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    }

    /* ---------- Cartes en relief ---------- */
    function attachTilt(el, strength) {
        let targetX = 0;
        let targetY = 0;
        let x = 0;
        let y = 0;
        let raf = 0;

        const tick = () => {
            x += (targetX - x) * 0.14;
            y += (targetY - y) * 0.14;
            el.style.setProperty('--ry', `${x.toFixed(2)}deg`);
            el.style.setProperty('--rx', `${y.toFixed(2)}deg`);
            const moving = Math.abs(targetX - x) > 0.02 || Math.abs(targetY - y) > 0.02;
            raf = moving ? requestAnimationFrame(tick) : 0;
        };
        const start = () => {
            if (!raf) raf = requestAnimationFrame(tick);
        };

        el.addEventListener('pointermove', (e) => {
            const r = el.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            targetX = (px - 0.5) * strength;
            targetY = (0.5 - py) * strength;
            el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
            el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
            start();
        });
        el.addEventListener('pointerenter', (e) => {
            el.classList.add('is-hover');
            // Le matériel 3D réagit à la carte survolée
            window.dispatchEvent(new CustomEvent('studio:nudge', { detail: { x: e.clientX, y: e.clientY } }));
        });
        el.addEventListener('pointerleave', () => {
            el.classList.remove('is-hover');
            targetX = 0;
            targetY = 0;
            start();
        });
    }

    if (finePointer.matches && !motionQuery.matches) {
        document.querySelectorAll('.service-card, .info-card, .booking-card, .address-card')
            .forEach((el) => attachTilt(el, 11));
        document.querySelectorAll('.hero-image').forEach((el) => attachTilt(el, 15));
    }

    /* ---------- Scène 3D, chargée en dernier pour ne pas retarder le contenu ---------- */
    const saveData = navigator.connection && navigator.connection.saveData;
    if (!saveData) {
        const boot = () => {
            import('./studio3d.js')
                .then((scene) => scene.startStudio())
                .catch((error) => console.warn('Scène 3D indisponible :', error));
        };
        if (document.readyState === 'complete') boot();
        else window.addEventListener('load', boot, { once: true });
    }
})();
