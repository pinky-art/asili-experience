const countdown = document.querySelector("[data-event-date]");
const cursorLight = document.querySelector(".cursor-light");
const beatCanvas = document.querySelector(".beat-field");
const beatContext = beatCanvas?.getContext("2d");
const audioToggle = document.querySelector("[data-audio-toggle]");
let particles = [];
let beatFrame = 0;
let audioContext;
let audioMaster;
let beatTimer;
let beatStep = 0;

function createAudioGraph() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioMaster = audioContext.createGain();
  audioMaster.gain.value = 0.26;
  audioMaster.connect(audioContext.destination);
}

function triggerTone({ type = "sine", frequency = 80, duration = 0.12, gain = 0.12, slideTo }) {
  if (!audioContext || !audioMaster) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(envelope);
  envelope.connect(audioMaster);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function triggerNoise({ duration = 0.05, gain = 0.05, filterFrequency = 7200 }) {
  if (!audioContext || !audioMaster) return;

  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const envelope = audioContext.createGain();
  const now = audioContext.currentTime;

  filter.type = "highpass";
  filter.frequency.value = filterFrequency;
  envelope.gain.setValueAtTime(gain, now);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(audioMaster);
  source.start(now);
  source.stop(now + duration);
}

function playBeatStep() {
  const step = beatStep % 16;

  if (step % 4 === 0) {
    triggerTone({ type: "sine", frequency: 120, slideTo: 42, duration: 0.18, gain: 0.36 });
    triggerTone({ type: "triangle", frequency: step === 8 ? 62 : 48, duration: 0.22, gain: 0.12 });
  }

  if (step === 3 || step === 7 || step === 11 || step === 15) {
    triggerNoise({ duration: 0.045, gain: 0.035, filterFrequency: 8600 });
  }

  if (step === 4 || step === 12) {
    triggerNoise({ duration: 0.08, gain: 0.075, filterFrequency: 2400 });
  }

  if (step === 6 || step === 14) {
    triggerTone({ type: "square", frequency: 246, duration: 0.04, gain: 0.018 });
  }

  beatStep += 1;
}

async function toggleBeat(forceOn = false) {
  if (!audioToggle) return;

  if (!audioContext) {
    createAudioGraph();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const shouldStart = forceOn || !beatTimer;

  if (shouldStart) {
    if (!beatTimer) {
      playBeatStep();
      beatTimer = window.setInterval(playBeatStep, 60000 / 124 / 4);
    }
    audioToggle.textContent = "Beat On";
    audioToggle.setAttribute("aria-pressed", "true");
    document.body.classList.add("beat-is-on");
    return;
  }

  window.clearInterval(beatTimer);
  beatTimer = null;
  audioToggle.textContent = "Beat Off";
  audioToggle.setAttribute("aria-pressed", "false");
  document.body.classList.remove("beat-is-on");
}

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function updateCountdown() {
  if (!countdown) return;

  const target = new Date(countdown.dataset.eventDate).getTime();
  const remaining = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdown.querySelector("[data-days]").textContent = pad(days, 3);
  countdown.querySelector("[data-hours]").textContent = pad(hours);
  countdown.querySelector("[data-minutes]").textContent = pad(minutes);
  countdown.querySelector("[data-seconds]").textContent = pad(seconds);
}

updateCountdown();
setInterval(updateCountdown, 1000);

function syncHeader() {
  document.body.classList.toggle("is-scrolled", window.scrollY > 40);
}

function syncCursor(event) {
  if (!cursorLight) return;
  cursorLight.style.setProperty("--x", `${event.clientX}px`);
  cursorLight.style.setProperty("--y", `${event.clientY}px`);
}

function resizeBeatField() {
  if (!beatCanvas || !beatContext) return;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  beatCanvas.width = Math.floor(window.innerWidth * pixelRatio);
  beatCanvas.height = Math.floor(window.innerHeight * pixelRatio);
  beatCanvas.style.width = `${window.innerWidth}px`;
  beatCanvas.style.height = `${window.innerHeight}px`;
  beatContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const particleCount = Math.min(90, Math.max(36, Math.floor(window.innerWidth / 18)));
  particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    speed: 0.35 + Math.random() * 1.4,
    size: 1 + Math.random() * 2.4,
    hue: Math.random() > 0.5 ? 190 : 5,
    phase: Math.random() * Math.PI * 2,
  }));
}

function renderBeatField() {
  if (!beatCanvas || !beatContext) return;

  beatFrame += 0.018;
  beatContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach((particle, index) => {
    const pulse = 0.7 + Math.sin(beatFrame * 7 + particle.phase) * 0.45;
    particle.y -= particle.speed + pulse * 0.28;
    particle.x += Math.sin(beatFrame + particle.phase) * 0.34;

    if (particle.y < -12) {
      particle.y = window.innerHeight + 12;
      particle.x = Math.random() * window.innerWidth;
    }

    beatContext.beginPath();
    beatContext.fillStyle = `hsla(${particle.hue + pulse * 28}, 100%, 62%, ${0.18 + pulse * 0.22})`;
    beatContext.arc(particle.x, particle.y, particle.size * (1 + pulse), 0, Math.PI * 2);
    beatContext.fill();

    if (index % 11 === 0) {
      beatContext.strokeStyle = `hsla(${particle.hue}, 100%, 62%, 0.12)`;
      beatContext.beginPath();
      beatContext.moveTo(particle.x, particle.y);
      beatContext.lineTo(particle.x + Math.sin(beatFrame) * 48, particle.y + 70);
      beatContext.stroke();
    }
  });

  requestAnimationFrame(renderBeatField);
}

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });
window.addEventListener("pointermove", syncCursor, { passive: true });

if (beatCanvas && beatContext && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  resizeBeatField();
  renderBeatField();
  window.addEventListener("resize", resizeBeatField);
}

audioToggle?.addEventListener("click", () => toggleBeat());

const revealTargets = document.querySelectorAll(
  ".section-heading, .artist-card, .experience-grid article, .ticket-card, .guide-grid article, .info-grid dl"
);

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
}
