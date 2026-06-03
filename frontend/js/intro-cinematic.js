/** ~20s bartender loop — lie detection + memory are the hook, not card mechanics. */



const ROASTS = [

  "Kunal claims he's winning.\nThe scoreboard disagrees.",

  "Nandini denied having the card.\nBold move.",

  'Interesting.',

  "The cards aren't the problem.\nIt's the decisions.",

];



const SCENES = [

  { id: 'roast', at: 0, roast: 0 },

  { id: 'roast', at: 3400, roast: 1 },

  { id: 'player', at: 6800, name: 'Nandini', text: 'Nope.' },

  { id: 'roast', at: 8600, roast: 2 },

  { id: 'lie', at: 10800 },

  { id: 'finale', at: 13800 },

];



const LOOP_MS = 19500;

const TYPE_MS = 26;



function $(sel, root = document) {

  return root.querySelector(sel);

}



function prefersReducedMotion() {

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;

}



function buildCardRain(container, count = 14) {

  container.replaceChildren();

  const colors = ['sc-red', 'sc-yellow', 'sc-green', 'sc-blue'];

  const ranks = ['A', 'K', 'Q', 'J', '7', '9'];

  for (let i = 0; i < count; i++) {

    const card = document.createElement('div');

    card.className = `cinematic-rain-card ${colors[i % colors.length]}`;

    card.setAttribute('aria-hidden', 'true');

    card.innerHTML = `<span>${ranks[i % ranks.length]}</span>`;

    card.style.setProperty('--rain-i', String(i));

    card.style.setProperty('--rain-x', `${(i / count) * 100}%`);

    card.style.setProperty('--rain-delay', `${i * 0.18}s`);

    card.style.setProperty('--rain-dur', `${2.4 + (i % 5) * 0.35}s`);

    container.appendChild(card);

  }

}



export function initIntroCinematic(rootEl) {

  if (!rootEl) return { play: () => {}, stop: () => {} };



  const demoSection = rootEl.closest('.intro-demo-section');

  const progressFill = document.getElementById('demo-progress-fill');

  const stage = $('.cinematic-stage', rootEl);

  const roastText = $('.cinematic-roast-text', rootEl);

  const playerName = $('.cinematic-player-name', rootEl);

  const playerText = $('.cinematic-player-text', rootEl);

  const rain = $('.cinematic-cards-rain', rootEl);

  const scenes = {

    roast: $('.cinematic-scene[data-scene="roast"]', rootEl),

    player: $('.cinematic-scene[data-scene="player"]', rootEl),

    lie: $('.cinematic-scene[data-scene="lie"]', rootEl),

    finale: $('.cinematic-scene[data-scene="finale"]', rootEl),

  };



  let timers = [];

  let typeTimer = null;

  let loopTimer = null;

  let progressTimer = null;

  let playStart = 0;

  let playing = false;



  function setPlaying(on) {

    playing = on;

    demoSection?.classList.toggle('is-playing', on);

  }



  function updateProgress() {

    if (!progressFill || !playing) return;

    const pct = Math.min(100, ((Date.now() - playStart) / LOOP_MS) * 100);

    progressFill.style.width = `${pct}%`;

  }



  function clearAll() {

    timers.forEach(clearTimeout);

    timers = [];

    clearTimeout(typeTimer);

    typeTimer = null;

    clearTimeout(loopTimer);

    loopTimer = null;

    clearInterval(progressTimer);

    progressTimer = null;

  }



  function setScene(name) {

    Object.entries(scenes).forEach(([key, el]) => {

      if (!el) return;

      const on = key === name;

      el.classList.toggle('active', on);

      el.classList.remove('enter');

      if (on) {

        void el.offsetWidth;

        el.classList.add('enter');

        if (key === 'lie') {

          const title = $('.cinematic-lie-title', el);

          if (title) {

            title.style.animation = 'none';

            void title.offsetWidth;

            title.style.animation = '';

          }

        }

      }

    });

    stage?.classList.toggle('shake', name === 'lie');

    rootEl.classList.toggle('finale', name === 'finale');

  }



  function typeRoast(text, { instant = false } = {}) {

    if (!roastText) return;

    clearTimeout(typeTimer);

    roastText.textContent = '';

    roastText.classList.remove('typed');

    if (instant || prefersReducedMotion()) {

      roastText.textContent = text;

      roastText.classList.add('typed');

      return;

    }

    let i = 0;

    const tick = () => {

      roastText.textContent = text.slice(0, i);

      i += 1;

      if (i <= text.length) {

        typeTimer = setTimeout(tick, TYPE_MS);

      } else {

        roastText.classList.add('typed');

      }

    };

    tick();

  }



  function setPlayer({ name, text }) {

    if (playerName) playerName.textContent = `${name}:`;

    if (playerText) playerText.textContent = `"${text}"`;

  }



  function runScene(scene) {

    const { id, roast, name, text } = scene;

    setScene(id);

    if (id === 'roast' && typeof roast === 'number') {

      typeRoast(ROASTS[roast]);

    }

    if (id === 'player' && name) {

      setPlayer({ name, text });

    }

    if (id === 'finale' && rain) buildCardRain(rain, 10);

  }



  function play() {

    clearAll();

    setPlaying(true);

    playStart = Date.now();

    rootEl.classList.add('playing');

    rootEl.setAttribute('aria-hidden', 'false');

    if (progressFill) progressFill.style.width = '0%';

    progressTimer = setInterval(updateProgress, 120);



    if (prefersReducedMotion()) {

      setScene('finale');

      typeRoast(ROASTS[3], { instant: true });

      if (rain) buildCardRain(rain, 6);

      return;

    }



    runScene(SCENES[0]);

    SCENES.slice(1).forEach((scene) => {

      timers.push(setTimeout(() => runScene(scene), scene.at));

    });



    loopTimer = setTimeout(() => {

      if (playing) play();

    }, LOOP_MS);

  }



  function stop() {

    setPlaying(false);

    clearAll();

    rootEl.classList.remove('playing', 'finale');

    rootEl.setAttribute('aria-hidden', 'true');

    if (progressFill) progressFill.style.width = '0%';

    setScene('roast');

    stage?.classList.remove('shake');

    if (rain) rain.replaceChildren();

  }



  buildCardRain(rain, 0);



  const observer = new IntersectionObserver(

    ([entry]) => {

      if (entry.isIntersecting && !playing) play();

      else if (!entry.isIntersecting && playing) stop();

    },

    { threshold: 0.25 },

  );

  observer.observe(rootEl);



  return { play, stop, destroy: () => { observer.disconnect(); stop(); } };

}

