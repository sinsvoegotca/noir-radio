
"use strict";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const clamp = (n,a,b) => Math.min(b, Math.max(a,n));

let audio = null;

function createAudio(){
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  master.gain.value = 0.7;
  master.connect(analyser);
  analyser.connect(ctx.destination);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = Math.random()*2-1;

  return { ctx, master, analyser, noiseBuffer };
}

function env(g, t0, a=0.002, d=0.12, s=0.0){
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1.0, t0 + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, s), t0 + a + d);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + 0.22);
}

function playKick(t){
  const { ctx, master } = audio;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  env(g, t, 0.001, 0.10, 0.0001);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.25);
}

function playSnare(t){
  const { ctx, master, noiseBuffer } = audio;
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;

  const g = ctx.createGain();
  env(g, t, 0.001, 0.08, 0.0001);

  n.connect(bp);
  bp.connect(g);
  g.connect(master);

  n.start(t);
  n.stop(t + 0.18);

  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.09);
  env(og, t, 0.001, 0.06, 0.0001);
  o.connect(og);
  og.connect(master);
  o.start(t);
  o.stop(t + 0.14);
}

function playHat(t){
  const { ctx, master, noiseBuffer } = audio;
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  hp.Q.value = 0.6;

  const g = ctx.createGain();
  env(g, t, 0.001, 0.03, 0.0001);

  n.connect(hp);
  hp.connect(g);
  g.connect(master);

  n.start(t);
  n.stop(t + 0.06);
}

function playSynth(t, freq=220, type="sawtooth"){
  const { ctx, master } = audio;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1200;
  lp.Q.value = 0.9;

  o.type = type;
  o.frequency.setValueAtTime(freq, t);

  env(g, t, 0.002, 0.14, 0.06);

  o.connect(lp);
  lp.connect(g);
  g.connect(master);

  o.start(t);
  o.stop(t + 0.42);
}

function playPadSound(pad){
  if(!audio) return;
  const t = audio.ctx.currentTime + 0.001;
  const kind = pad.kind;

  if(kind === "kick") playKick(t);
  else if(kind === "snare") playSnare(t);
  else if(kind === "hat") playHat(t);
  else if(kind === "synth") playSynth(t, pad.freq, pad.wave);
  else if(kind === "tone") playSynth(t, pad.freq, pad.wave);
  else if(kind === "bass") playSynth(t, pad.freq, "square");
  else playSynth(t, pad.freq || 220, pad.wave || "sawtooth");
}
const PADS = [
  { id:"K1", name:"Kick", kind:"kick", hint:"sub hit" },
  { id:"S1", name:"Snare", kind:"snare", hint:"noise snap" },
  { id:"H1", name:"Hat", kind:"hat", hint:"short bright" },
  { id:"SY1", name:"Synth A", kind:"synth", freq:220, wave:"sawtooth", hint:"lead" },

  { id:"K2", name:"Kick 2", kind:"kick", hint:"alt" },
  { id:"S2", name:"Snare 2", kind:"snare", hint:"alt" },
  { id:"H2", name:"Hat 2", kind:"hat", hint:"alt" },
  { id:"SY2", name:"Synth B", kind:"synth", freq:277.18, wave:"triangle", hint:"tone" },

  { id:"B1", name:"Bass", kind:"bass", freq:110, hint:"square" },
  { id:"T1", name:"Tone 1", kind:"tone", freq:329.63, wave:"sine", hint:"soft" },
  { id:"T2", name:"Tone 2", kind:"tone", freq:392.00, wave:"triangle", hint:"edge" },
  { id:"T3", name:"Tone 3", kind:"tone", freq:466.16, wave:"sawtooth", hint:"sharp" },

  { id:"DR1", name:"Drone", kind:"tone", freq:55.0, wave:"sawtooth", hint:"low" },
  { id:"DR2", name:"Drone 2", kind:"tone", freq:73.42, wave:"triangle", hint:"mid" },
  { id:"FX1", name:"FX Rise", kind:"tone", freq:246.94, wave:"sine", hint:"sweep" },
  { id:"FX2", name:"FX Bit", kind:"tone", freq:523.25, wave:"square", hint:"glitch" }
];

const TRACKS = [
  { key:"kick", name:"KICK" },
  { key:"snare", name:"SNARE" },
  { key:"hat", name:"HAT" },
  { key:"synth", name:"SYNTH" }
];

const STEPS = 16;

let lockedPad = {
  kick: PADS[0],
  snare: PADS[1],
  hat: PADS[2],
  synth: PADS[3]
};

let seq = load("nr_seq", defaultSeq());
let playing = false;
let stepIndex = 0;
let timer = null;

renderPads();
renderSeq();
bindUI();
initViz();

function renderPads(){
  const el = $("#pads");
  el.innerHTML = PADS.map(p => `
    <button class="pad" type="button" data-id="${p.id}">
      <span class="dot" aria-hidden="true"></span>
      <div class="t">${p.id} • ${p.name}</div>
      <div class="p">${p.hint}</div>
    </button>
  `).join("");

  $$(".pad", el).forEach(b => b.addEventListener("click", (e) => {
    const p = PADS.find(x => x.id === b.dataset.id);
    if(!p) return;

    if(e.shiftKey){
      const track = inferTrack(p);
      if(track){
        lockedPad[track] = p;
        flashStatus(`Locked: ${track.toUpperCase()} → ${p.id}`);
        paintLocks();
      }else{
        flashStatus("Этот пад нельзя привязать к дорожке");
      }
      return;
    }

    playPadSound(p);
  }));

  paintLocks();
}

function inferTrack(p){
  if(p.kind === "kick") return "kick";
  if(p.kind === "snare") return "snare";
  if(p.kind === "hat") return "hat";
  if(p.kind === "synth" || p.kind === "tone" || p.kind === "bass") return "synth";
  return null;
}

function paintLocks(){
  $$(".pad").forEach(b => b.classList.remove("lock"));
  Object.values(lockedPad).forEach(p => {
    const btn = document.querySelector(`.pad[data-id="${p.id}"]`);
    if(btn) btn.classList.add("lock");
  });
}

function defaultSeq(){
  const s = {};
  TRACKS.forEach(t => s[t.key] = Array(STEPS).fill(false));
  [0,4,8,12].forEach(i => s.kick[i] = true);
  [4,12].forEach(i => s.snare[i] = true);
  [2,6,10,14].forEach(i => s.hat[i] = true);
  [0,7,9,15].forEach(i => s.synth[i] = true);
  return s;
}

function renderSeq(){
  const wrap = $("#seq");
  wrap.innerHTML = TRACKS.map(t => {
    const steps = seq[t.key].map((on, i) => `
      <button class="step ${on?"on":""}" type="button" data-track="${t.key}" data-step="${i}" aria-label="${t.name} step ${i+1}"></button>
    `).join("");
    return `
      <div class="track">
        <div class="trackName">${t.name}</div>
        ${steps}
      </div>
    `;
  }).join("");

  $$(".step", wrap).forEach(b => b.addEventListener("click", () => {
    const tr = b.dataset.track;
    const i = Number(b.dataset.step);
    seq[tr][i] = !seq[tr][i];
    save("nr_seq", seq);
    b.classList.toggle("on", seq[tr][i]);
  }));
}

function bindUI(){
  const bpm = $("#bpm");
  const bpmVal = $("#bpmVal");
  bpm.addEventListener("input", () => bpmVal.textContent = bpm.value);

  const master = $("#master");
  const masterVal = $("#masterVal");
  master.addEventListener("input", () => {
    masterVal.textContent = master.value + "%";
    if(audio) audio.master.gain.value = Number(master.value)/100;
  });

  $("#startBtn").addEventListener("click", async () => {
    if(!audio){
      audio = createAudio();
      await audio.ctx.resume();
      audio.master.gain.value = Number(master.value)/100;
      $("#status").textContent = "Audio: ON";
      flashStatus("Audio started");
    }
    start();
  });

  $("#stopBtn").addEventListener("click", stop);

  $("#randomize").addEventListener("click", () => {
    TRACKS.forEach(t => {
      seq[t.key] = Array(STEPS).fill(false).map((_,i) => Math.random() < (t.key==="hat" ? 0.35 : 0.22));
    });
    save("nr_seq", seq);
    renderSeq();
    flashStatus("Randomized");
  });

  $("#clearSeq").addEventListener("click", () => {
    TRACKS.forEach(t => seq[t.key] = Array(STEPS).fill(false));
    save("nr_seq", seq);
    renderSeq();
    flashStatus("Cleared");
  });

  $("#panic").addEventListener("click", () => {
    if(!audio) return;
    audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
    audio.master.gain.setValueAtTime(Number(master.value)/100, audio.ctx.currentTime);
    flashStatus("Panic");
  });

  $("#presetA").addEventListener("click", () => applyPreset("neon"));
  $("#presetB").addEventListener("click", () => applyPreset("noir"));
  $("#presetC").addEventListener("click", () => applyPreset("drone"));

  $("#savePreset").addEventListener("click", () => {
    const pack = {
      locked: Object.fromEntries(Object.entries(lockedPad).map(([k,v]) => [k, v.id])),
      seq
    };
    localStorage.setItem("nr_user_preset", JSON.stringify(pack));
    flashStatus("Saved");
  });

  $("#loadPreset").addEventListener("click", () => {
    const raw = localStorage.getItem("nr_user_preset");
    if(!raw) { flashStatus("Нет сохранённого пресета"); return; }
    try{
      const pack = JSON.parse(raw);
      if(pack.seq) seq = pack.seq;
      if(pack.locked){
        Object.keys(lockedPad).forEach(k => {
          const id = pack.locked[k];
          const p = PADS.find(x => x.id === id);
          if(p) lockedPad[k] = p;
        });
      }
      save("nr_seq", seq);
      renderSeq();
      paintLocks();
      flashStatus("Loaded");
    }catch(_){
      flashStatus("Ошибка загрузки");
    }
  });

  $("#clearPreset").addEventListener("click", () => {
    localStorage.removeItem("nr_user_preset");
    flashStatus("Preset cleared");
  });
}

function start(){
  if(playing) return;
  if(!audio){
    flashStatus("Сначала Start (включает audio)");
    return;
  }
  playing = true;
  $("#startBtn").disabled = true;
  $("#stopBtn").disabled = false;

  stepIndex = 0;
  schedule();
  flashStatus("Play");
}

function stop(){
  playing = false;
  $("#startBtn").disabled = false;
  $("#stopBtn").disabled = true;
  clearInterval(timer);
  timer = null;
  clearPlayhead();
  flashStatus("Stop");
}

function schedule(){
  const bpm = Number($("#bpm").value);
  const stepMs = (60_000 / bpm) / 4; 
  clearInterval(timer);
  timer = setInterval(tick, stepMs);
}

function tick(){
  if(!playing || !audio) return;
  const t = audio.ctx.currentTime;


  setPlayhead(stepIndex);

  if(seq.kick[stepIndex]) playPadSound(lockedPad.kick);
  if(seq.snare[stepIndex]) playPadSound(lockedPad.snare);
  if(seq.hat[stepIndex]) playPadSound(lockedPad.hat);
  if(seq.synth[stepIndex]) playPadSound(lockedPad.synth);

  stepIndex = (stepIndex + 1) % STEPS;
  schedule();
}

function clearPlayhead(){
  $$(".step.playhead").forEach(s => s.classList.remove("playhead"));
}

function setPlayhead(i){
  clearPlayhead();
  $$(".step").forEach(s => {
    if(Number(s.dataset.step) === i) s.classList.add("playhead");
  });
}

function applyPreset(name){
  if(name === "neon"){
    lockedPad.kick = PADS.find(p=>p.id==="K1");
    lockedPad.snare = PADS.find(p=>p.id==="S1");
    lockedPad.hat = PADS.find(p=>p.id==="H1");
    lockedPad.synth = PADS.find(p=>p.id==="SY1");
    seq = defaultSeq();
    $("#bpm").value = "128";
    $("#bpmVal").textContent = "128";
  } else if(name === "noir"){
    lockedPad.kick = PADS.find(p=>p.id==="K2");
    lockedPad.snare = PADS.find(p=>p.id==="S2");
    lockedPad.hat = PADS.find(p=>p.id==="H2");
    lockedPad.synth = PADS.find(p=>p.id==="B1");
    seq = defaultSeq();
    seq.hat = seq.hat.map((v,i)=> i%2===0 ? v : false);
    $("#bpm").value = "112";
    $("#bpmVal").textContent = "112";
  } else { 
    lockedPad.kick = PADS.find(p=>p.id==="K1");
    lockedPad.snare = PADS.find(p=>p.id==="S1");
    lockedPad.hat = PADS.find(p=>p.id==="H1");
    lockedPad.synth = PADS.find(p=>p.id==="DR1");
    TRACKS.forEach(t => seq[t.key] = Array(STEPS).fill(false));
    [0,8].forEach(i => seq.kick[i] = true);
    [4,12].forEach(i => seq.snare[i] = true);
    [0,2,4,6,8,10,12,14].forEach(i => seq.hat[i] = true);
    [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].forEach(i => seq.synth[i] = i%2===0);
    $("#bpm").value = "76";
    $("#bpmVal").textContent = "76";
  }

  save("nr_seq", seq);
  renderSeq();
  paintLocks();
  flashStatus(`Preset: ${name}`);
}

function save(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function load(key, fallback){
  const raw = localStorage.getItem(key);
  if(!raw) return fallback;
  try{
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : fallback;
  }catch(_){
    return fallback;
  }
}

let stTimer = null;
function flashStatus(text){
  const el = $("#status");
  el.textContent = text;
  clearTimeout(stTimer);
  stTimer = setTimeout(() => {
    el.textContent = playing ? "Play" : (audio ? "Audio: ON" : "Нажми Start, затем любые пэды");
  }, 1800);
}

function initViz(){
  const c = $("#viz");
  const ctx = c.getContext("2d");
  let W=0,H=0,dpr=1;

  function fit(){
    dpr = window.devicePixelRatio || 1;
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    c.width = W; c.height = H;
    c.style.width = "100%"; c.style.height = "100%";
  }
  window.addEventListener("resize", fit);
  fit();

  function draw(t){
    ctx.clearRect(0,0,W,H);

    const g = ctx.createRadialGradient(W*0.35, H*0.25, 0, W*0.5, H*0.45, Math.max(W,H)*0.8);
    g.addColorStop(0, "rgba(255,46,214,.14)");
    g.addColorStop(0.45, "rgba(40,247,255,.10)");
    g.addColorStop(1, "rgba(7,7,11,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    if(audio){
      const an = audio.analyser;
      const arr = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(arr);

      const bars = 84;
      const step = Math.floor(arr.length / bars);
      const baseY = H*0.72;

      for(let i=0;i<bars;i++){
        const v = arr[i*step] / 255;
        const x = (i/(bars-1)) * W;
        const h = v * (H*0.35);
        ctx.lineWidth = Math.max(1, 2*dpr);

        ctx.strokeStyle = `rgba(${Math.floor(40+215*v)}, ${Math.floor(120+80*v)}, ${Math.floor(220)}, ${0.22+0.30*v})`;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, baseY - h);
        ctx.stroke();
      }

      const w = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(w);
      ctx.strokeStyle = "rgba(182,255,60,.18)";
      ctx.lineWidth = 2*dpr;
      ctx.beginPath();
      for(let i=0;i<w.length;i+=6){
        const x = (i/(w.length-1))*W;
        const y = H*0.28 + ((w[i]-128)/128) * (H*0.08);
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
