/**
 * Cherry Bomb — main.js
 * Three.js disco ball · GSAP scroll · Custom cursor · 3D card tilt
 */

import * as THREE from 'three';
import { RoomEnvironment }   from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer }    from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }        from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }   from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── Capability detect ────────────────────────────────────────────────────────
const isMobile  = window.innerWidth < 768;
const isLowEnd  = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4;
const reduceQuality = isMobile || isLowEnd;

// ─── Scene setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('hero-canvas');
if (!canvas) throw new Error('Canvas not found');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !reduceQuality, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduceQuality ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050507);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.5, 6.5);

// Environment map for metallic reflections
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envMap = pmrem.fromScene(new THREE.RoomEnvironment()).texture;
scene.environment = envMap;

// ─── Disco ball ──────────────────────────────────────────────────────────────
function buildDiscoBall(radius = 1.65, tileCount = reduceQuality ? 220 : 580) {
  const group = new THREE.Group();

  // Instanced mirror tiles
  const tileGeo = new THREE.PlaneGeometry(0.095, 0.095);
  const tileMat = new THREE.MeshStandardMaterial({
    metalness: 1.0,
    roughness: 0.04,
    envMapIntensity: 2,
  });
  const mesh = new THREE.InstancedMesh(tileGeo, tileMat, tileCount);
  mesh.castShadow = false;

  const dummy   = new THREE.Object3D();
  const phi     = (1 + Math.sqrt(5)) / 2; // golden ratio

  const tileColors = [
    new THREE.Color(1,     0.96, 1   ),   // white
    new THREE.Color(1,     0.82, 0.92),   // blush pink
    new THREE.Color(0.88,  0.88, 1   ),   // cool blue
    new THREE.Color(1,     0.98, 0.8 ),   // warm gold
  ];

  for (let i = 0; i < tileCount; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / tileCount);
    const lon   = 2 * Math.PI * i / phi;

    dummy.position.set(
      radius * Math.sin(theta) * Math.cos(lon),
      radius * Math.cos(theta),
      radius * Math.sin(theta) * Math.sin(lon)
    );
    dummy.lookAt(0, 0, 0);
    dummy.rotateY(Math.PI);
    dummy.updateMatrix();

    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, tileColors[i % tileColors.length]);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  // Dark sphere underneath the tiles
  const baseGeo = new THREE.SphereGeometry(radius * 0.98, 32, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.4, roughness: 0.9 });
  group.add(new THREE.Mesh(baseGeo, baseMat));

  // Hanging wire
  const wireGeo = new THREE.CylinderGeometry(0.004, 0.004, 2, 6);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.2 });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.position.set(0, radius + 1, 0);
  group.add(wire);

  // Pink neon ring
  const ringGeo = new THREE.TorusGeometry(radius + 0.45, 0.025, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xFF1C8E });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 3;
  group.add(ring);

  // Second ring (red)
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.55, 0.018, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0xC8002C })
  );
  ring2.rotation.x = -Math.PI / 5;
  ring2.rotation.z = Math.PI / 4;
  group.add(ring2);

  return group;
}

const discoBall = buildDiscoBall();
discoBall.position.set(0, 1.2, 0);
scene.add(discoBall);

// ─── Colored orbit lights ────────────────────────────────────────────────────
const LIGHT_DEFS = [
  { color: 0xFF1C8E, intensity: 10, dist: 14, radius: 4.0, speed: 0.45, yOff:  1.5, phase: 0              },
  { color: 0xC8002C, intensity:  8, dist: 12, radius: 3.5, speed: 0.65, yOff: -0.5, phase: Math.PI * 0.6  },
  { color: 0xFF69B4, intensity:  7, dist: 12, radius: 4.2, speed: 0.38, yOff:  0.8, phase: Math.PI * 1.2  },
  { color: 0xFFFFFF, intensity:  4, dist: 16, radius: 5.5, speed: 0.28, yOff:  2.5, phase: Math.PI * 0.3  },
  { color: 0x4466FF, intensity:  4, dist: 11, radius: 3.0, speed: 0.55, yOff: -1.5, phase: Math.PI * 1.75 },
];

const orbitLights = LIGHT_DEFS.map(def => {
  const light = new THREE.PointLight(def.color, def.intensity, def.dist);
  light.userData = { ...def };
  scene.add(light);
  return light;
});

scene.add(new THREE.AmbientLight(0x111111, 3));

// ─── Floating particles ───────────────────────────────────────────────────────
function buildParticles(count = reduceQuality ? 120 : 320) {
  const geo       = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);

  const palette = [
    new THREE.Color(0xFF1C8E),
    new THREE.Color(0xFF69B4),
    new THREE.Color(0xFFFFFF),
    new THREE.Color(0xC8002C),
    new THREE.Color(0xFFD700),
  ];

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3    ] = (Math.random() - 0.5) * 22;
    positions[i3 + 1] = (Math.random() - 0.5) * 14;
    positions[i3 + 2] = (Math.random() - 0.5) * 10 - 4;

    const c = palette[i % palette.length];
    colors[i3    ] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new THREE.Points(geo, mat);
}

const particles = buildParticles();
scene.add(particles);

// ─── Post-processing bloom ────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

if (!reduceQuality) {
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.4,   // strength
    0.55,  // radius
    0.08   // threshold
  );
  composer.addPass(bloom);
}

// ─── Animation loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let scrollY = 0;

window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime();

  // Rotate ball
  discoBall.rotation.y  = t * 0.28;
  discoBall.position.y  = 1.2 + Math.sin(t * 0.5) * 0.12;

  // Orbit lights
  orbitLights.forEach(light => {
    const { radius, speed, yOff, phase } = light.userData;
    light.position.set(
      Math.cos(t * speed + phase) * radius,
      yOff + Math.sin(t * speed * 0.6 + phase) * 0.6,
      Math.sin(t * speed + phase) * radius
    );
  });

  // Drift particles upward, wrap
  const pos = particles.geometry.attributes.position.array;
  for (let i = 1; i < pos.length; i += 3) {
    pos[i] += 0.004;
    if (pos[i] > 7) pos[i] = -7;
  }
  particles.geometry.attributes.position.needsUpdate = true;
  particles.rotation.y = t * 0.018;

  // Scroll parallax on camera
  camera.position.y = 0.5 - scrollY * 0.0018;

  composer.render();
}

tick();

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ─── Custom cursor ────────────────────────────────────────────────────────────
const cursorRing = document.querySelector('.cursor');
const cursorDot  = document.querySelector('.cursor-dot');

if (cursorRing && cursorDot) {
  let mx = 0, my = 0, cx = 0, cy = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursorDot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;
  });

  (function trackRing() {
    cx += (mx - cx) * 0.12;
    cy += (my - cy) * 0.12;
    cursorRing.style.transform = `translate(${cx - 21}px, ${cy - 21}px)`;
    requestAnimationFrame(trackRing);
  })();

  const hoverTargets = 'a, button, .drink-card, .vibe-card, .req-item, .btn';
  document.querySelectorAll(hoverTargets).forEach(el => {
    el.addEventListener('mouseenter', () => cursorRing.classList.add('is-hovered'));
    el.addEventListener('mouseleave', () => cursorRing.classList.remove('is-hovered'));
  });
}

// ─── 3D card tilt ────────────────────────────────────────────────────────────
document.querySelectorAll('[data-tilt]').forEach(card => {
  let rafId;

  card.addEventListener('mousemove', e => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const r   = card.getBoundingClientRect();
      const x   = e.clientX - r.left;
      const y   = e.clientY - r.top;
      const cx  = r.width  / 2;
      const cy  = r.height / 2;
      const rX  = ((y - cy) / cy) * -13;
      const rY  = ((x - cx) / cx) *  13;
      card.style.transform = `perspective(1100px) rotateX(${rX}deg) rotateY(${rY}deg) scale3d(1.035,1.035,1.035) translateZ(15px)`;

      const glow = card.querySelector('.card-glow');
      if (glow) {
        glow.style.left = `${x - 110}px`;
        glow.style.top  = `${y - 110}px`;
        glow.style.opacity = '1';
      }
    });
  });

  card.addEventListener('mouseleave', () => {
    cancelAnimationFrame(rafId);
    card.style.transform = 'perspective(1100px) rotateX(0) rotateY(0) scale3d(1,1,1) translateZ(0)';
    const glow = card.querySelector('.card-glow');
    if (glow) glow.style.opacity = '0.5';
    card.style.transition = 'transform .55s cubic-bezier(0.16,1,0.3,1), box-shadow .35s, border-color .35s';
  });

  card.addEventListener('mouseenter', () => {
    card.style.transition = 'box-shadow .35s, border-color .35s';
  });
});

// ─── GSAP Scroll animations ───────────────────────────────────────────────────
function initGSAP() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    // Retry in case scripts haven't loaded yet
    setTimeout(initGSAP, 100);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Generic reveal for [data-reveal] elements
  document.querySelectorAll('[data-reveal]').forEach(el => {
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
      y: 0,
      opacity: 1,
      duration: 0.9,
      ease: 'power4.out',
    });
  });

  // Stagger drink cards
  gsap.from('.drink-card', {
    scrollTrigger: { trigger: '.drinks-grid', start: 'top 82%' },
    y: 70,
    opacity: 0,
    duration: 0.7,
    ease: 'power3.out',
    stagger: 0.12,
  });

  // Stagger vibe cards
  gsap.from('.vibe-card', {
    scrollTrigger: { trigger: '.vibe-grid', start: 'top 82%' },
    y: 60,
    opacity: 0,
    duration: 0.65,
    ease: 'power3.out',
    stagger: 0.1,
  });

  // Marquee pause on hover
  const track = document.querySelector('.marquee-track');
  if (track) {
    const marquee = document.querySelector('.marquee');
    marquee.addEventListener('mouseenter', () => track.style.animationPlayState = 'paused');
    marquee.addEventListener('mouseleave', () => track.style.animationPlayState = 'running');
  }

  // Nav background on scroll
  const nav = document.querySelector('.nav');
  ScrollTrigger.create({
    start: 'top -60px',
    onUpdate: self => nav.classList.toggle('scrolled', self.progress > 0),
  });
}

initGSAP();

// ─── Mobile nav ───────────────────────────────────────────────────────────────
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

// ─── Sparkle injection ────────────────────────────────────────────────────────
function injectSparkles(container, count = 12) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.style.cssText = `
      position: absolute;
      width: ${3 + Math.random() * 4}px;
      height: ${3 + Math.random() * 4}px;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      background: ${['#FF1C8E','#FFD700','#FFFFFF','#FF69B4'][Math.floor(Math.random()*4)]};
      border-radius: 50%;
      pointer-events: none;
      animation: sparkle-anim ${1.5 + Math.random() * 3}s ease-in-out ${Math.random() * 4}s infinite;
      opacity: 0;
    `;
    container.appendChild(s);
  }
}

// Inject sparkle keyframes dynamically
const sparkleStyle = document.createElement('style');
sparkleStyle.textContent = `
  @keyframes sparkle-anim {
    0%,100% { opacity: 0; transform: scale(0) rotate(0deg); }
    50%      { opacity: 1; transform: scale(1.4) rotate(180deg); }
  }
`;
document.head.appendChild(sparkleStyle);

const poster = document.querySelector('.poster');
if (poster) { poster.style.position = 'relative'; injectSparkles(poster, 16); }

const hero = document.querySelector('.hero-content');
if (hero) { hero.style.position = 'relative'; injectSparkles(hero, 10); }
