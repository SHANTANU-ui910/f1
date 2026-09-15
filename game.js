/* ============================================================
   UNO//F1  –  COMPLETE GAME ENGINE  v2.0
   Multiplayer (PeerJS WebRTC) + AI + F1 Theme + Animations
   ============================================================ */
'use strict';

// ══════════════════════════════════════════════════════════════
//  TEAM CONFIG
// ══════════════════════════════════════════════════════════════
const TEAMS = {
  ferrari:  { name: 'Ferrari',  color: '#E8002D', label: 'FERRARI' },
  mercedes: { name: 'Mercedes', color: '#00D2BE', label: 'MERCEDES' },
  redbull:  { name: 'Red Bull', color: '#3671C6', label: 'RED BULL' },
  mclaren:  { name: 'McLaren',  color: '#FF8000', label: 'MCLAREN' },
  alpine:   { name: 'Alpine',   color: '#0093CC', label: 'ALPINE' },
  aston:    { name: 'Aston',    color: '#358C75', label: 'ASTON' },
  williams: { name: 'Williams', color: '#005AFF', label: 'WILLIAMS' },
  haas:     { name: 'Haas',     color: '#B6BABD', label: 'HAAS' },
};
const AI_TEAMS = ['redbull','mclaren','alpine','aston','williams','haas','mercedes'];
const AI_NAMES = ['VERSTAPPEN','NORRIS','ALONSO','VETTEL','RUSSELL','MAGNUSSEN','HAMILTON','LECLERC','SAINZ','PIASTRI'];

// ══════════════════════════════════════════════════════════════
//  AUDIO ENGINE (Web Audio API – no external files)
// ══════════════════════════════════════════════════════════════
const Audio = (() => {
  let ctx = null; let on = true;
  const go = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (f, t, dur, g = 0.28, d = 0) => {
    if (!on) return;
    try {
      const c = go(), osc = c.createOscillator(), gn = c.createGain();
      osc.connect(gn); gn.connect(c.destination);
      osc.type = t; osc.frequency.value = f; osc.detune.value = d;
      gn.gain.setValueAtTime(g, c.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.start(); osc.stop(c.currentTime + dur);
    } catch {}
  };
  const noise = (dur, g = 0.09, lo = 600, hi = 2000) => {
    if (!on) return;
    try {
      const c = go(), buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
      const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
      f.type = 'bandpass'; f.frequency.value = (lo+hi)/2; f.Q.value = 1;
      src.buffer = buf; src.connect(f); f.connect(gn); gn.connect(c.destination);
      gn.gain.setValueAtTime(g, c.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.start(); src.stop(c.currentTime + dur);
    } catch {}
  };

  const FX = {
    cardPlay: () => { tone(520,  'triangle', 0.14, 0.22); noise(0.1, 0.06); },
    cardDraw: () => { noise(0.12, 0.09); tone(260, 'triangle', 0.12, 0.08); },
    hover:    () => tone(680, 'sine', 0.05, 0.05),
    skip:     () => { tone(880,'square',0.08,0.14); tone(560,'square',0.14,0.14,-250); },
    reverse:  () => { tone(420,'sawtooth',0.08,0.18); tone(640,'sawtooth',0.12,0.18); },
    draw2:    () => { [0,90].forEach(d=>setTimeout(()=>noise(0.1,0.1),d)); },
    draw4:    () => { [0,75,150,225].forEach(d=>setTimeout(()=>noise(0.1,0.1),d)); },
    wild:     () => { [380,480,580,680,820].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.1,0.18),i*45)); },
    uno:      () => { [600,800,1000,800,1200].forEach((f,i)=>setTimeout(()=>tone(f,'square',0.09,0.22),i*55)); },
    win:      () => { [523,659,784,1047,1319,1568].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.28,0.28),i*90)); },
    lose:     () => { [400,340,280,240].forEach((f,i)=>setTimeout(()=>tone(f,'sawtooth',0.18,0.2),i*90)); },
    error:    () => tone(180, 'square', 0.15, 0.22),
    click:    () => tone(720, 'sine', 0.06, 0.1),
    connect:  () => { [440,550,660].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.12,0.18),i*70)); },
    penalty:  () => { [200,240,200].forEach((f,i)=>setTimeout(()=>tone(f,'sawtooth',0.14,0.22),i*90)); },
  };

  return {
    play: name => { if (on && FX[name]) FX[name](); },
    toggle: () => { on = !on; return on; },
    isOn: () => on
  };
})();

// ══════════════════════════════════════════════════════════════
//  PARTICLE / FX SYSTEM
// ══════════════════════════════════════════════════════════════
const FX = (() => {
  const canvas = document.getElementById('fx-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let raf = null;

  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize(); window.addEventListener('resize', resize);

  const burst = (x, y, color, n = 8) => {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y, color,
        vx: (Math.random()-0.5)*9,
        vy: (Math.random()-0.5)*9 - 2,
        life: 1, decay: 0.018 + Math.random()*0.03,
        r: 3 + Math.random()*6,
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
        rot: Math.random()*Math.PI*2,
        rotV: (Math.random()-0.5)*0.2
      });
    }
    if (!raf) tick();
  };

  const speedLine = (x, y, vx, color) => {
    particles.push({
      x, y, vx, vy: 0, color, life: 1,
      decay: 0.08, r: 2, shape: 'line',
      len: 20 + Math.random()*30
    });
    if (!raf) tick();
  };

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);

    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;

      if (p.shape === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.r;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.len * Math.sign(p.vx || 1), p.y);
        ctx.stroke();
      } else if (p.shape === 'rect') {
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.restore();
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.18; p.life -= p.decay;
      if (p.rot !== undefined) p.rot += p.rotV;
    });

    if (particles.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0,0,canvas.width,canvas.height); }
  };

  return { burst, speedLine };
})();

// ══════════════════════════════════════════════════════════════
//  WIN CANVAS (checkered confetti)
// ══════════════════════════════════════════════════════════════
function launchWinConfetti() {
  const canvas = document.getElementById('win-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;

  let pieces = [];
  const colors = ['#E10600','#1E88E5','#43A047','#FDD835','#9C27B0','#FF5722','#00D2BE','#FF8000'];

  for (let i = 0; i < 100; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height,
      w: 8 + Math.random()*12, h: 5 + Math.random()*8,
      color: colors[Math.floor(Math.random()*colors.length)],
      vx: (Math.random()-0.5)*4, vy: 2 + Math.random()*4,
      rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.2,
      life: 1
    });
  }

  const loop = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter(p => p.y < canvas.height && p.life > 0);
    pieces.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
    });
    if (pieces.length) requestAnimationFrame(loop);
  };
  loop();
}

// ══════════════════════════════════════════════════════════════
//  UNO CARD ENGINE
// ══════════════════════════════════════════════════════════════
const COLORS   = ['red','blue','green','yellow'];
const VALS     = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];
const CARD_HEX = { red:'#FF0038', blue:'#0077FF', green:'#00E676', yellow:'#FFD700', wild:'#E040FB' };

function createDeck() {
  const d = []; let id = 0;
  COLORS.forEach(c => VALS.forEach(v => { const n = v==='0'?1:2; for(let i=0;i<n;i++) d.push({id:id++,c,v}); }));
  for(let i=0;i<4;i++) { d.push({id:id++,c:'wild',v:'wild'}); d.push({id:id++,c:'wild',v:'wild4'}); }
  return d;
}

const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; };

const cardLabel = card => ({skip:'⊘',reverse:'↺',draw2:'+2',wild:'W',wild4:'+4'})[card.v] ?? card.v;

const isWild = card => card.v==='wild' || card.v==='wild4';

function canPlay(card, topCard, curColor, rules) {
  if (!card) return false;
  if (isWild(card)) return true;
  if (curColor && card.c === curColor) return true;
  if (topCard && card.v === topCard.v) return true;
  return false;
}

// ══════════════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════════════
let G = {}; // Global game state
let aiTimer = null;

function initGame(cfg) {
  if (aiTimer) clearTimeout(aiTimer);

  const { mode, ffaCount = 4, handLimit = 7, rules, playerName, playerTeam } = cfg;

  let players = [];
  switch(mode) {
    case '1v1':
      players = [
        { id:0, name:playerName, isHuman:true, team:playerTeam, hand:[], gameTeam:0 },
        { id:1, name:'HAMILTON', isHuman:false, team:AI_TEAMS[0], hand:[], gameTeam:1 }
      ];
      break;
    case '2v2':
      players = [
        { id:0, name:playerName, isHuman:true, team:playerTeam, hand:[], gameTeam:0 },
        { id:1, name:'NORRIS', isHuman:false, team:AI_TEAMS[1], hand:[], gameTeam:1 },
        { id:2, name:'VERSTAPPEN', isHuman:false, team:AI_TEAMS[0], hand:[], gameTeam:0 },
        { id:3, name:'RUSSELL', isHuman:false, team:AI_TEAMS[4], hand:[], gameTeam:1 },
      ];
      break;
    case '4v4':
      players = [
        { id:0, name:playerName, isHuman:true, team:playerTeam, hand:[], gameTeam:0 },
        { id:1, name:'NORRIS', isHuman:false, team:'mclaren', hand:[], gameTeam:1 },
        { id:2, name:'VERSTAPPEN', isHuman:false, team:'redbull', hand:[], gameTeam:0 },
        { id:3, name:'RUSSELL', isHuman:false, team:'mercedes', hand:[], gameTeam:1 },
        { id:4, name:'ALONSO', isHuman:false, team:'alpine', hand:[], gameTeam:0 },
        { id:5, name:'HAMILTON', isHuman:false, team:'ferrari', hand:[], gameTeam:1 },
        { id:6, name:'LECLERC', isHuman:false, team:'ferrari', hand:[], gameTeam:0 },
        { id:7, name:'SAINZ', isHuman:false, team:'williams', hand:[], gameTeam:1 },
      ];
      break;
    default: { // ffa
      players = [{ id:0, name:playerName, isHuman:true, team:playerTeam, hand:[], gameTeam:0 }];
      for (let i=1;i<ffaCount;i++) players.push({
        id:i, name:AI_NAMES[i-1]||`AI${i}`, isHuman:false,
        team:AI_TEAMS[(i-1)%AI_TEAMS.length], hand:[], gameTeam:i
      });
    }
  }

  const rawDeck = shuffle(createDeck());
  let di = 0;
  players.forEach(p => { for(let i=0;i<handLimit;i++) p.hand.push(rawDeck[di++]); });

  // Find valid first top card
  let ti = di;
  while (ti < rawDeck.length && isWild(rawDeck[ti])) ti++;
  const topCard = rawDeck[ti];
  rawDeck.splice(ti, 1);

  G = {
    cfg, players,
    deck: rawDeck.slice(di),
    discardPile: [topCard],
    topCard, curColor: topCard.c,
    curIdx: 0, dir: 1,
    pending: 0,
    over: false,
    drawnThis: false,
    unoAble: false, unoCalled: false,
    turns: 0,
    t0: Date.now(),
    isMultiplayer: false,
    myIdx: 0,
    lapNum: 1
  };

  applyFirstCard(topCard);
}

function cp() { return G.players[G.curIdx]; }
function nextIdx(from = G.curIdx, skip = 0) {
  const n = G.players.length; let i = from;
  for (let s=0; s<=skip; s++) i = ((i+G.dir)%n+n)%n;
  return i;
}

function drawCards(idx, count, silent=false) {
  const p = G.players[idx];
  for (let i=0;i<count;i++) {
    if (!G.deck.length) reshuffleDeck();
    if (!G.deck.length) break;
    p.hand.push(G.deck.pop());
  }
  if (!silent) Audio.play('cardDraw');
}

function reshuffleDeck() {
  if (G.discardPile.length <= 1) return;
  const top = G.discardPile.at(-1);
  G.deck = shuffle(G.discardPile.slice(0,-1));
  G.deck.forEach(c => { if(isWild(c)) c.c='wild'; });
  G.discardPile = [top];
  toast('♻️ Deck reshuffled!');
}

function applyFirstCard(card) {
  if (card.v==='reverse') G.dir=-1;
  if (card.v==='skip') G.curIdx = nextIdx();
  if (card.v==='draw2') { drawCards(nextIdx(),2,true); G.curIdx = nextIdx(); }
}

function applyEffect(card) {
  let skip = 0;
  if (card.v==='reverse') {
    G.dir *= -1;
    if (G.players.length===2) skip=1;
  } else if (card.v==='skip') {
    skip=1;
  } else if (card.v==='draw2') {
    if (G.cfg.rules.stacking && G.pending>0) { G.pending+=2; }
    else { G.pending = G.pending>0 ? (drawCards(nextIdx(),G.pending),0) : 2; skip = G.pending>0?0:1; }
    if (!G.pending && G.cfg.rules.stacking===false) skip=1;
    G.pending = G.pending || 2; skip = 0; // always leave pending for next
  } else if (card.v==='wild4') {
    if (G.cfg.rules.noMercy && G.pending>0) { G.pending+=4; }
    else { G.pending = G.pending>0 ? (drawCards(nextIdx(),G.pending),0) : 4; }
    G.pending = G.pending || 4;
  }
  G.curIdx = nextIdx(G.curIdx, skip);
}

// ── HUMAN ACTION: PLAY ──
function humanPlay(cardId, chosenColor=null) {
  if (G.over) return;
  if (Number(G.curIdx) !== Number(G.myIdx)) {
    toast("❌ Not your turn!", "t-red");
    return;
  }

  const p = G.players[G.myIdx];
  if (!p) return;
  const ci = p.hand.findIndex(c=>c.id===cardId);
  if (ci===-1) return;
  const card = p.hand[ci];

  // Must clear pending draw if can't stack
  if (G.pending>0) {
    const canStack = (card.v==='draw2' && (G.cfg?.rules?.stacking??true)) || (card.v==='wild4' && (G.cfg?.rules?.noMercy??false));
    if (!canStack) { forceDrawPending(); return; }
  }

  if (!canPlay(card, G.topCard, G.curColor, G.cfg.rules)) {
    shakeCard(cardId); Audio.play('error'); toast('❌ Cannot play that card!','t-red'); return;
  }

  if (isWild(card) && !chosenColor) { showColorPicker(cardId); return; }

  // Guest in multiplayer mode: delegate move to Host
  if (G.isMultiplayer && !MP.getIsHost()) {
    Audio.play('cardPlay'); cardSFX(card);
    MP.sendMove({ type:'PLAY_CARD', cardId, chosenColor });
    return;
  }

  // Host (or Solo mode): Authoritative execution
  G.curColor = chosenColor || card.c;
  p.hand.splice(ci, 1);
  G.discardPile.push(card); G.topCard = card;
  G.drawnThis = false;

  Audio.play('cardPlay'); cardSFX(card);

  // UNO logic
  if (p.hand.length===1) {
    G.unoAble=true; G.unoCalled=false;
    setTimeout(()=>{
      if(G.unoAble && !G.unoCalled) {
        drawCards(G.myIdx,2,true); Audio.play('penalty'); toast('⚠️ Forgot UNO! +2 penalty!','t-red');
        G.unoAble=false; renderGame();
        if (G.isMultiplayer && MP.getIsHost()) MP.broadcastGameState();
      }
    }, 3500);
  } else { G.unoAble=false; }

  if (!p.hand.length) { endGame(G.myIdx); if (G.isMultiplayer && MP.getIsHost()) MP.broadcastGameState(); return; }
  if (G.cfg.rules.sevenZero && card.v==='7') { openSwapSelect(G.myIdx); return; }
  if (G.cfg.rules.sevenZero && card.v==='0') { rotateAllHands(); }

  // Turn advancement
  if (card.v==='draw2') { G.pending = (G.cfg?.rules?.stacking && G.pending>0) ? G.pending+2 : 2; G.curIdx = nextIdx(); }
  else if (card.v==='wild4') { G.pending = (G.cfg?.rules?.noMercy && G.pending>0) ? G.pending+4 : 4; G.curIdx = nextIdx(); }
  else if (card.v==='reverse') { G.dir*=-1; G.curIdx = nextIdx(G.curIdx, G.players.length===2?1:0); }
  else if (card.v==='skip') { G.curIdx = nextIdx(G.curIdx,1); }
  else { G.curIdx = nextIdx(); }

  G.turns++; G.lapNum = Math.ceil(G.turns / G.players.length);

  if (G.isMultiplayer && MP.getIsHost()) {
    MP.broadcastGameState();
  }

  renderGame();
  scheduleAI();
}

function forceDrawPending() {
  if (G.isMultiplayer && !MP.getIsHost()) {
    toast('📥 Drawing pending penalty cards...', 't-red');
    MP.sendMove({ type: 'FORCE_DRAW_PENDING' });
    return;
  }
  drawCards(G.myIdx, G.pending); G.pending=0; G.drawnThis=true;
  toast(`Drew ${G.pending || 'pending'} cards!`,'t-red');
  G.curIdx = nextIdx(); G.turns++;
  if (G.isMultiplayer && MP.getIsHost()) MP.broadcastGameState();
  renderGame(); scheduleAI();
}

let pendingDrawnCard = null;

function humanDraw(autoExpired = false) {
  if (G.over || Number(G.curIdx) !== Number(G.myIdx) || G.drawnThis) return;
  if (G.pending > 0) { forceDrawPending(); return; }

  if (G.isMultiplayer && !MP.getIsHost()) {
    toast('📥 Drawing card from deck...', 't-gold');
    MP.sendMove({ type: 'DRAW_CARD' });
    return;
  }

  // Host (or Solo mode) draws from master deck
  drawCards(G.myIdx, 1);
  G.drawnThis = true;
  const p = G.players[G.myIdx];
  const drawnCard = p ? p.hand.at(-1) : null;

  if (G.isMultiplayer && MP.getIsHost()) {
    const isPlayable = drawnCard ? canPlay(drawnCard, G.topCard, G.curColor, G.cfg.rules) : false;
    MP.broadcastGameState({ forPlayer: G.myIdx, card: drawnCard, isPlayable });
  } else {
    renderGame();
  }

  if (drawnCard) {
    const playable = canPlay(drawnCard, G.topCard, G.curColor, G.cfg.rules);
    const forcePlayRule = G.cfg?.rules?.forcePlay ?? true;

    if (playable && (forcePlayRule || autoExpired)) {
      toast('⚡ Force Play: Auto-playing drawn card!');
      setTimeout(() => humanPlay(drawnCard.id), 300);
    } else if (playable) {
      showDrawnChoiceModal(drawnCard);
    } else {
      toast(`📥 Drew ${cardLabel(drawnCard)} (${drawnCard.c.toUpperCase()}) — card kept in hand.`);
    }
  }
}

function showDrawnChoiceModal(card) {
  pendingDrawnCard = card;
  const preview = document.getElementById('drawn-card-preview');
  if (preview) {
    const lbl = cardLabel(card);
    const cls = CARD_CSS_MAP[isWild(card) ? 'wild' : card.c];
    preview.className = `game-card ${cls}`;
    preview.innerHTML = `<span class="corner-tl">${lbl}</span><span class="center-val">${lbl}</span><span class="corner-br">${lbl}</span>`;
  }
  document.getElementById('ov-drawn-choice').style.display = 'flex';
}

function humanPass() {
  if (G.over || Number(G.curIdx) !== Number(G.myIdx) || !G.drawnThis) return;
  if (G.isMultiplayer && !MP.getIsHost()) {
    MP.sendMove({ type: 'PASS' });
    return;
  }
  G.drawnThis = false; G.curIdx = nextIdx(); G.turns++;
  if (G.isMultiplayer && MP.getIsHost()) MP.broadcastGameState();
  renderGame(); scheduleAI();
}

function callUno() {
  if (!G.unoAble) { Audio.play('error'); toast('No UNO needed right now!','t-red'); return; }
  G.unoCalled = true; G.unoAble = false;
  Audio.play('uno'); toast('🗣️ UNO!', 't-gold');
  if (G.isMultiplayer && !MP.getIsHost()) {
    MP.sendMove({ type: 'CALL_UNO' });
    return;
  }
  if (G.isMultiplayer && MP.getIsHost()) MP.broadcastGameState();
}

function cardSFX(card) {
  const sfx = {skip:'skip',reverse:'reverse',draw2:'draw2',wild4:'draw4',wild:'wild'};
  if (sfx[card.v]) Audio.play(sfx[card.v]);
}

function rotateAllHands() {
  const hands = G.players.map(p=>[...p.hand]);
  G.players.forEach((p,i) => {
    const from = G.dir===1 ? (i-1+G.players.length)%G.players.length : (i+1)%G.players.length;
    p.hand = hands[from];
  });
  toast('🔄 0 card — all hands rotated!');
}

function endGame(winIdx) {
  G.over=true; stopTurnTimer(); if(aiTimer) clearTimeout(aiTimer);
  const ovDrawn = document.getElementById('ov-drawn-choice');
  if (ovDrawn) ovDrawn.style.display = 'none';
  const winner = G.players[winIdx];
  const humanWins = winner ? winner.isHuman : false;
  Audio.play(humanWins?'win':'lose');

  const elapsed = Math.round((Date.now()-G.t0)/1000);
  const mins = Math.floor(elapsed/60), secs = elapsed%60;

  document.getElementById('win-trophy').textContent = humanWins ? '🏆' : '💀';
  document.getElementById('win-title').textContent  = humanWins ? '🏆 RACE WON!' : '🏁 RACE OVER';
  document.getElementById('win-title').style.color  = humanWins ? '#FFD700' : '#ff8a80';
  document.getElementById('win-sub').textContent    = humanWins ? `Outstanding drive, ${G.players[0].name}!` : `${winner ? winner.name : 'Opponent'} crosses the finish line!`;

  const statsEl = document.getElementById('win-stats-grid');
  statsEl.innerHTML = `
    <div class="wsg-item"><div class="wsg-val">${mins}:${String(secs).padStart(2,'0')}</div><div class="wsg-lbl">RACE TIME</div></div>
    <div class="wsg-item"><div class="wsg-val">${G.turns}</div><div class="wsg-lbl">TURNS PLAYED</div></div>
    <div class="wsg-item"><div class="wsg-val">${G.lapNum}</div><div class="wsg-lbl">LAPS</div></div>
    <div class="wsg-item"><div class="wsg-val">${winner ? winner.name : 'Driver'}</div><div class="wsg-lbl">WINNER</div></div>
  `;

  document.getElementById('screen-win').style.display='flex';
  if (humanWins) launchWinConfetti();
}

// ══════════════════════════════════════════════════════════════
//  AI ENGINE
// ══════════════════════════════════════════════════════════════
function scheduleAI() {
  if (G.over || cp().isHuman) return;
  const delay = 700 + Math.random()*800;
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = setTimeout(runAI, delay);
}

function runAI() {
  if (G.over || cp().isHuman) return;
  const p = cp();
  setAIThinking(G.curIdx, true);

  setTimeout(()=>{
    setAIThinking(G.curIdx, false);

    // Force draw pending
    if (G.pending>0) {
      const stackCard = p.hand.find(c=>
        (c.v==='draw2' && G.cfg.rules.stacking) || (c.v==='wild4' && G.cfg.rules.noMercy)
      );
      if (stackCard) { aiPlay(p, stackCard); return; }
      drawCards(G.curIdx, G.pending); G.pending=0;
      Audio.play('cardDraw');
      G.curIdx = nextIdx(); G.turns++;
      renderGame(); scheduleAI(); return;
    }

    const playable = p.hand.filter(c=>canPlay(c,G.topCard,G.curColor,G.cfg.rules));
    if (!playable.length) {
      drawCards(G.curIdx,1); Audio.play('cardDraw');
      G.curIdx=nextIdx(); G.turns++;
      renderGame(); scheduleAI(); return;
    }

    // Score cards
    const scored = playable.map(c=>{
      let s=0;
      if(c.v==='wild4') s=p.hand.length<=3?95:28;
      else if(c.v==='wild') s=p.hand.length<=3?80:22;
      else if(['skip','draw2'].includes(c.v)) s=70;
      else if(c.v==='reverse') s=55;
      else { const n=parseInt(c.v)||5; s=50+n; }
      const cc = p.hand.filter(h=>h.c===c.c).length;
      s += cc*4;
      return {c,s};
    }).sort((a,b)=>b.s-a.s);

    aiPlay(p, scored[0].c);
  }, 350);
}

function aiPlay(p, card) {
  const idx = p.hand.findIndex(c=>c.id===card.id);
  if(idx===-1) { G.curIdx=nextIdx(); G.turns++; renderGame(); scheduleAI(); return; }
  p.hand.splice(idx,1);

  if (isWild(card)) {
    const cc={}; COLORS.forEach(c=>cc[c]=0);
    p.hand.forEach(c=>{if(c.c!=='wild')cc[c.c]++;});
    G.curColor = Object.entries(cc).sort((a,b)=>b[1]-a[1])[0][0];
  } else { G.curColor=card.c; }

  G.discardPile.push(card); G.topCard=card;
  Audio.play('cardPlay'); cardSFX(card);

  if(p.hand.length===1) { toast(`🗣️ ${p.name}: UNO!`,'t-gold'); Audio.play('uno'); }
  if(!p.hand.length) { endGame(G.curIdx); return; }
  if(G.cfg.rules.sevenZero && card.v==='0') rotateAllHands();

  if(card.v==='draw2') { G.pending=(G.cfg.rules.stacking&&G.pending>0)?G.pending+2:2; G.curIdx=nextIdx(); }
  else if(card.v==='wild4') { G.pending=(G.cfg.rules.noMercy&&G.pending>0)?G.pending+4:4; G.curIdx=nextIdx(); }
  else if(card.v==='reverse') { G.dir*=-1; G.curIdx=nextIdx(G.curIdx,G.players.length===2?1:0); }
  else if(card.v==='skip') { G.curIdx=nextIdx(G.curIdx,1); }
  else { G.curIdx=nextIdx(); }

  G.turns++; G.lapNum=Math.ceil(G.turns/G.players.length);
  if (G.isMultiplayer && MP.getIsHost()) MP.broadcastGameState();
  renderGame(); scheduleAI();
}

function setAIThinking(idx, show) {
  const slots = document.querySelectorAll('.opp-slot');
  slots.forEach(s=>{
    if(parseInt(s.dataset.idx)===idx) {
      const t = s.querySelector('.opp-ai-think');
      if(show && !t) { const d=document.createElement('div'); d.className='opp-ai-think'; d.innerHTML='<div class="think-dot"></div><div class="think-dot"></div><div class="think-dot"></div>'; s.appendChild(d); }
      else if(!show && t) t.remove();
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  TURN TIMER (15s F1 Pit Stop Clock)
// ══════════════════════════════════════════════════════════════
let turnTimerInterval = null;
let turnSecondsLeft = 15;
const TURN_LIMIT_SECS = 15;
let lastTurnIdx = null;

function stopTurnTimer() {
  if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
}

function startTurnTimer() {
  stopTurnTimer();
  if (G.over) return;
  turnSecondsLeft = TURN_LIMIT_SECS;
  updateTimerUI();

  turnTimerInterval = setInterval(() => {
    if (G.over) { stopTurnTimer(); return; }
    turnSecondsLeft--;
    updateTimerUI();

    if (turnSecondsLeft === 4 && Number(G.curIdx) === Number(G.myIdx)) {
      Audio.play('hover');
    }

    if (turnSecondsLeft <= 0) {
      stopTurnTimer();
      onTurnTimerExpired();
    }
  }, 1000);
}

function updateTimerUI() {
  const textEl = document.getElementById('timer-sec-text');
  const pathEl = document.getElementById('timer-ring-path');
  const badgeEl = document.getElementById('turn-timer-badge');
  if (!textEl || !pathEl || !badgeEl) return;

  textEl.textContent = Math.max(0, turnSecondsLeft);
  const ratio = Math.max(0, turnSecondsLeft) / TURN_LIMIT_SECS;
  const strokeDash = 88;
  pathEl.style.strokeDashoffset = strokeDash * (1 - ratio);

  if (turnSecondsLeft <= 4) {
    badgeEl.classList.add('urgent');
    pathEl.setAttribute('stroke', '#FF0038');
  } else {
    badgeEl.classList.remove('urgent');
    pathEl.setAttribute('stroke', '#FFD700');
  }
}

function onTurnTimerExpired() {
  if (G.over) return;
  const isMyTurn = Number(G.curIdx) === Number(G.myIdx);
  if (!isMyTurn) return;

  toast('⏱️ Pit Stop Timer Expired!', 't-red');
  Audio.play('penalty');

  const ovChoice = document.getElementById('ov-drawn-choice');
  if (ovChoice && ovChoice.style.display !== 'none') ovChoice.style.display = 'none';

  if (G.pending > 0) {
    forceDrawPending();
  } else if (G.drawnThis) {
    humanPass();
  } else {
    humanDraw(true);
  }
}

// ══════════════════════════════════════════════════════════════
//  RENDER ENGINE
// ══════════════════════════════════════════════════════════════
const CARD_CSS_MAP = { red:'c-red', blue:'c-blue', green:'c-green', yellow:'c-yellow', wild:'c-wild' };

function renderGame() {
  renderTopCard();
  renderOpponents();
  renderHand();
  renderHUD();
  updateColorBand();

  if (lastTurnIdx !== G.curIdx) {
    lastTurnIdx = G.curIdx;
    startTurnTimer();
  }
}

let lastRenderedTopCardId = null;

function renderTopCard() {
  const el = document.getElementById('top-card');
  const card = G.topCard;
  if (!el || !card) return;

  const lbl = cardLabel(card);
  const colorKey = isWild(card) ? 'wild' : (card.c || G.curColor || 'wild');
  const cls = CARD_CSS_MAP[colorKey] || CARD_CSS_MAP[G.curColor] || 'c-wild';

  const isNewCard = lastRenderedTopCardId !== card.id;
  lastRenderedTopCardId = card.id;

  el.className = `game-card ${cls}${isNewCard ? ' top-card-anim' : ''}`;
  el.innerHTML = `<span class="corner-tl">${lbl}</span><span class="center-val">${lbl}</span><span class="corner-br">${lbl}</span>`;

  if (isNewCard) {
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        FX.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, CARD_HEX[G.curColor] || '#fff', 12);
      }
    } catch {}
    setTimeout(() => el.classList.remove('top-card-anim'), 450);
  }

  const strip = document.getElementById('status-strip');
  if (strip) {
    strip.textContent = `MATCH ${(G.curColor||'').toUpperCase()} OR '${lbl}'`;
  }
}

function renderOpponents() {
  const grid = document.getElementById('opponents-grid');
  grid.innerHTML='';
  const opponents = G.players.filter((p,i)=>i!==G.myIdx);

  opponents.forEach(p=>{
    const isActive = G.curIdx===p.id;
    const teamCfg = TEAMS[p.team] || TEAMS.haas;
    const slot = document.createElement('div');
    slot.className = `opp-slot${isActive?' active-turn':''}`;
    slot.dataset.idx = p.id;

    // Team tag
    const teamTag = document.createElement('div');
    teamTag.className='opp-team-tag';
    teamTag.textContent=teamCfg.label;
    teamTag.style.cssText=`background:${teamCfg.color}22;border:1px solid ${teamCfg.color}55;color:${teamCfg.color}`;
    slot.appendChild(teamTag);

    const nameEl=document.createElement('div'); nameEl.className='opp-name'; nameEl.textContent=p.name; slot.appendChild(nameEl);

    // Mini card backs
    const cardsRow=document.createElement('div'); cardsRow.className='opp-cards-row';
    const cardCount = p.hand ? p.hand.length : (p.handCount || 0);
    const shown=Math.min(cardCount,7);
    for(let i=0;i<shown;i++) { const mc=document.createElement('div'); mc.className='opp-mini-card'; cardsRow.appendChild(mc); }
    slot.appendChild(cardsRow);

    const countEl=document.createElement('div'); countEl.className='opp-card-num'+(cardCount===1?' uno-alert':'');
    countEl.textContent=cardCount===1?'⚠️ UNO!':`${cardCount} cards`;
    slot.appendChild(countEl);

    grid.appendChild(slot);
  });
}

function renderHand() {
  const container=document.getElementById('hand-container');
  const me=G.players[G.myIdx];
  if (!me) return;
  const isMyTurn=Number(G.curIdx)===Number(G.myIdx) && !G.over;

  // Track new cards to animate
  const prev=new Set(Array.from(container.querySelectorAll('[data-card-id]')).map(e=>e.dataset.cardId));

  container.innerHTML='';
  const teamCfg=TEAMS[me.team]||TEAMS.ferrari;

  me.hand.forEach((card,idx)=>{
    const playable=isMyTurn&&canPlay(card,G.topCard,G.curColor,G.cfg.rules);
    const mustDraw=G.pending>0&&!((card.v==='draw2'&&(G.cfg?.rules?.stacking??true))||(card.v==='wild4'&&(G.cfg?.rules?.noMercy??false)));

    const wrap=document.createElement('div');
    wrap.className=`hand-card-wrap ${CARD_CSS_MAP[isWild(card)?'wild':card.c]}${playable&&!mustDraw?' playable':' not-playable'}${!prev.has(String(card.id))?' just-drawn':''}`;
    wrap.dataset.cardId=card.id;
    wrap.style.animationDelay=`${idx*25}ms`;

    const flipper=document.createElement('div'); flipper.className='card-flipper';
    const front=document.createElement('div');
    front.className=`card-front ${CARD_CSS_MAP[isWild(card)?'wild':card.c]}`;
    const lbl=cardLabel(card);
    front.innerHTML=`<span class="card-corner-tl">${lbl}</span><span class="card-center">${lbl}</span><span class="card-corner-br">${lbl}</span>`;
    flipper.appendChild(front);
    wrap.appendChild(flipper);

    wrap.addEventListener('click',()=>{
      if (!isMyTurn) {
        Audio.play('error');
        const activePlayer = G.players[G.curIdx];
        toast(`🏎️ Waiting for ${activePlayer ? activePlayer.name : 'Host'}'s turn...`, 't-red');
        shakeCard(card.id);
        return;
      }
      if (mustDraw) {
        Audio.play('error');
        toast(`⚠️ Draw +${G.pending} cards or play a +2/+4 stack!`, 't-red');
        shakeCard(card.id);
        return;
      }
      if (!playable) {
        Audio.play('error');
        toast(`❌ Card doesn't match ${G.curColor.toUpperCase()} or '${cardLabel(G.topCard)}'!`, 't-red');
        shakeCard(card.id);
        return;
      }
      Audio.play('click');
      const rect=wrap.getBoundingClientRect();
      FX.burst(rect.left+rect.width/2, rect.top+rect.height/2, CARD_HEX[card.c]||'#fff',12);
      wrap.classList.add('playing');
      setTimeout(()=>humanPlay(card.id), 250);
    });

    wrap.addEventListener('mouseenter',()=>{ if(isMyTurn && playable && !mustDraw) Audio.play('hover'); });

    container.appendChild(wrap);
  });

  // Update info bar
  document.getElementById('dock-name').textContent=me.name;
  document.getElementById('dock-count').textContent=`${me.hand.length} card${me.hand.length!==1?'s':''}`;
  document.getElementById('dock-team').textContent=teamCfg.label;
  document.getElementById('dock-team').style.cssText=`background:${teamCfg.color}22;border:1px solid ${teamCfg.color}55;color:${teamCfg.color};padding:2px 8px;border-radius:8px;font-family:var(--ff-head);font-size:9px;letter-spacing:1px;`;
  document.getElementById('driver-dot').style.background=teamCfg.color;

  // UNO button
  const unoBtn=document.getElementById('btn-uno');
  unoBtn.style.display=(G.unoAble&&G.curIdx===G.myIdx)?'inline-block':'none';

  // Draw/Pass
  document.getElementById('btn-draw').style.display=isMyTurn&&!G.drawnThis?'inline-flex':'none';
  document.getElementById('btn-pass').style.display=isMyTurn&&G.drawnThis?'inline-flex':'none';

  // Pending draw badge
  const pdb=document.getElementById('pending-draw-badge');
  const pdbn=document.getElementById('pdb-num');
  if(G.pending>0) { pdb.style.display='flex'; pdbn.textContent=`+${G.pending}`; }
  else pdb.style.display='none';
}

function renderHUD() {
  const isMyTurn=G.curIdx===G.myIdx;
  const p=G.players[G.curIdx];
  const ticker=document.getElementById('turn-ticker');
  const ttText=document.getElementById('tt-text');

  if(isMyTurn) {
    ticker.className='turn-ticker';
    ttText.textContent=G.pending>0?`⚠️ DRAW +${G.pending} or STACK`:'⚡ YOUR TURN';
  } else {
    ticker.className='turn-ticker waiting';
    ttText.textContent=`${p.name}'s turn`;
  }

  document.getElementById('lap-num').textContent=G.lapNum||1;

  // Direction arc
  const arc=document.getElementById('dir-arc');
  const tip=document.getElementById('dir-tip');
  const dtxt=document.getElementById('dir-txt');
  if(G.dir===1) {
    arc.setAttribute('d','M 28 8 A 20 20 0 1 1 8 28');
    tip.setAttribute('points','5,22 13,28 5,34');
    dtxt.textContent='CW';
  } else {
    arc.setAttribute('d','M 28 8 A 20 20 0 0 0 8 28');
    tip.setAttribute('points','5,22 13,28 5,34');
    dtxt.textContent='CCW';
  }

  document.getElementById('draw-pile').querySelector('.pile-badge').textContent=(G.deckCount!==undefined)?G.deckCount:G.deck.length;
  document.getElementById('hud-mode').textContent=G.cfg.mode.toUpperCase()+' RACE';
}

function updateColorBand() {
  const band=document.getElementById('color-band');
  const hex=CARD_HEX[G.curColor]||'#888';
  band.style.background=hex;
  band.style.boxShadow=`0 0 16px ${hex}80`;
}

// Discard pile top-card animation (added via CSS class)
const dcStyle=document.createElement('style');
dcStyle.textContent=`
@keyframes top-card-anim{from{transform:translateY(-16px) scale(0.9) rotate(-4deg);opacity:0.6}to{transform:none;opacity:1}}
.top-card-anim{animation:top-card-anim 0.35s var(--ease-spring)!important}
`;
document.head.appendChild(dcStyle);

// ══════════════════════════════════════════════════════════════
//  SWAP SELECT (7-0 rule placeholder)
// ══════════════════════════════════════════════════════════════
function openSwapSelect(fromIdx) {
  // Simple: swap with the player who has fewest cards (AI-like)
  const target = G.players.reduce((best,p,i)=>{ if(i===fromIdx) return best; if(!best||p.hand.length<G.players[best].hand.length) return i; return best; },null);
  if (target!==null) {
    const tmp=G.players[fromIdx].hand;
    G.players[fromIdx].hand=G.players[target].hand;
    G.players[target].hand=tmp;
    toast(`🔀 Swapped hands with ${G.players[target].name}!`,'t-gold');
  }
  G.curIdx=nextIdx(); G.turns++;
  renderGame(); scheduleAI();
}

// ══════════════════════════════════════════════════════════════
//  COLOR PICKER
// ══════════════════════════════════════════════════════════════
let pendingCardId=null;
function showColorPicker(cardId) {
  pendingCardId=cardId;
  document.getElementById('ov-color').style.display='flex';
}
document.querySelectorAll('.col-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const color=btn.dataset.color;
    document.getElementById('ov-color').style.display='none';
    if(pendingCardId!==null) humanPlay(pendingCardId,color);
    pendingCardId=null;
  });
});

// Shake a hand card
function shakeCard(cardId) {
  const el=document.querySelector(`[data-card-id="${cardId}"]`);
  if(!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(()=>el.classList.remove('shake'),500);
}

// ══════════════════════════════════════════════════════════════
//  MULTIPLAYER (PeerJS WebRTC)
// ══════════════════════════════════════════════════════════════
const MP = (() => {
  let peer=null, hostConn=null, clientConns=[], isHost=false, roomCode='';
  let localInfo={ name:'Driver', team:'ferrari' };
  let connectedPlayers=[]; // [{id, name, team, conn}]
  let pendingCB=null;

  function genCode() {
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c='';
    for(let i=0;i<6;i++) { if(i===3) c+='-'; c+=chars[Math.floor(Math.random()*chars.length)]; }
    return c;
  }

  function setStatus(msg, show=true) {
    const el=document.getElementById('lobby-status');
    const msg2=document.getElementById('lobby-status-msg');
    el.style.display=show?'flex':'none';
    msg2.textContent=msg;
  }

  function createRoom(name, team, mode, onReady) {
    isHost=true; localInfo={name,team};
    roomCode=genCode();
    pendingCB=onReady;

    setStatus('Connecting to signaling server...');
    peer=new Peer('unof1-'+roomCode.replace('-',''), { debug: 0 });

    peer.on('open',()=>{
      setStatus('',false);
      connectedPlayers=[{ id:0, name, team, isHost:true }];
      showWaiting();
      document.getElementById('display-room-code').textContent=roomCode;
      renderWaitingList();
      toast('🏁 Room created! Share the code.','t-green');
      Audio.play('connect');
    });

    peer.on('connection', conn=>{
      conn.on('open',()=>{
        const slot={ id:connectedPlayers.length, name:'?', team:'haas', conn, isHost:false };
        clientConns.push(conn);
        conn._slot=slot;
        connectedPlayers.push(slot);

        conn.on('data', data=>{
          if(data.type==='JOIN_INFO') {
            slot.name=data.name; slot.team=data.team;
            renderWaitingList();
            broadcastToAll({ type:'ROOM_STATE', players:connectedPlayers.map(p=>({id:p.id,name:p.name,team:p.team,isHost:p.isHost})) });
            toast(`🏎️ ${data.name} joined!`,'t-green');
          }
          if(data.type==='MOVE') { processHostMove(slot.id, data.move); }
        });

        conn.on('close',()=>{
          connectedPlayers=connectedPlayers.filter(p=>p.conn!==conn);
          clientConns=clientConns.filter(c=>c!==conn);
          renderWaitingList();
        });
      });
    });

    peer.on('error',e=>{ setStatus('Connection error: '+e.type); toast('❌ Connection error','t-red'); });
  }

  function joinRoom(code, name, team) {
    isHost=false; localInfo={name,team};
    roomCode=code.toUpperCase();
    setStatus('Connecting...');

    peer=new Peer(undefined, { debug:0 });
    peer.on('open',()=>{
      hostConn=peer.connect('unof1-'+roomCode.replace('-',''), { reliable:true });
      hostConn.on('open',()=>{
        hostConn.send({ type:'JOIN_INFO', name, team });
        setStatus('',false);
        showWaiting();
        document.getElementById('display-room-code').textContent=roomCode;
        toast('🏎️ Connected to room!','t-green');
        Audio.play('connect');
      });
      hostConn.on('data', data=>handleGuestData(data));
      hostConn.on('close',()=>toast('❌ Disconnected from host','t-red'));
    });
    peer.on('error',e=>{ setStatus('Failed to join: '+e.type,true); toast('❌ Room not found or invalid code','t-red'); });
  }

  function broadcastToAll(data) {
    clientConns.forEach(c=>{ try{c.send(data);}catch{} });
  }
  function sendToHost(data) {
    try { hostConn.send(data); } catch {}
  }

  function sendMove(move) {
    if(isHost) { /* host processes locally already */ }
    else sendToHost({ type:'MOVE', move });
  }

  function processHostMove(playerId, move) {
    const pId = Number(playerId);
    if (Number(G.curIdx) !== pId) return; // verify it is Guest's turn

    const realMyIdx = G.myIdx;
    G.myIdx = pId;

    if (move.type === 'PLAY_CARD') {
      humanPlay(move.cardId, move.chosenColor);
    }
    else if (move.type === 'DRAW_CARD') {
      drawCards(pId, 1);
      const drawnCard = G.players[pId]?.hand.at(-1);
      const isPlayable = drawnCard ? canPlay(drawnCard, G.topCard, G.curColor, G.cfg.rules) : false;
      G.drawnThis = true;
      broadcastGameState({ forPlayer: pId, card: drawnCard, isPlayable });
    }
    else if (move.type === 'FORCE_DRAW_PENDING') {
      forceDrawPending();
    }
    else if (move.type === 'PASS') {
      humanPass();
    }
    else if (move.type === 'CALL_UNO') {
      callUno();
    }

    G.myIdx = realMyIdx;
  }

  function broadcastGameState(drawnInfo = null) {
    if(!isHost) return;
    const pub={ type:'GAME_STATE', state:{
      players:G.players.map(p=>({id:p.id,name:p.name,team:p.team,handCount:p.hand.length})),
      topCard:G.topCard, curColor:G.curColor, curIdx:G.curIdx,
      dir:G.dir, pending:G.pending, deckCount:G.deck.length,
      turns:G.turns, lapNum:G.lapNum, over:G.over
    }};
    // Send each client their private hand
    clientConns.forEach((conn)=>{
      const slot = conn._slot || connectedPlayers.find(p=>p.conn===conn);
      if(!slot) return;
      const pid=slot.id;
      const hand=G.players[pid]?.hand||[];
      const msg = { ...pub, myHand: hand };
      if (drawnInfo && Number(drawnInfo.forPlayer) === Number(pid)) {
        msg.drawnCardInfo = drawnInfo;
      }
      try { if(conn.open) conn.send(msg); } catch {}
    });
    renderGame();
  }

  function handleGuestData(data) {
    if(data.type==='ROOM_STATE') {
      // Update waiting room
      data.players.forEach((p,i)=>{
        if(!connectedPlayers[i]) connectedPlayers[i]={};
        Object.assign(connectedPlayers[i],p);
      });
      renderWaitingList();
    }
    if(data.type==='GAME_START') {
      // Init local state with assignment
      G.myIdx=Number(data.myIdx);
      G.isMultiplayer=true;
      G.players=data.players.map((p, idx)=>({
        ...p,
        hand: idx === G.myIdx ? data.myHand : new Array(p.handCount||7).fill({ id: -1, c: 'back', v: '' })
      }));
      G.topCard=data.topCard; G.curColor=data.curColor;
      G.curIdx=Number(data.curIdx); G.dir=data.dir; G.pending=data.pending;
      G.deck=[]; G.deckCount=data.deckCount; G.over=false; G.turns=0; G.lapNum=1;
      G.cfg=data.cfg||soloCfg; G.drawnThis=false; G.unoAble=false;
      showScreen('game');
      renderGame();
      toast('🏁 Race started! Host goes first.','t-green');
    }
    if(data.type==='GAME_STATE') {
      // Update public state
      const s=data.state;
      G.players.forEach((p,i)=>{
        const sp=s.players[i];
        if(sp){
          p.name=sp.name;
          p.team=sp.team;
          if (i !== G.myIdx) {
            p.hand = new Array(sp.handCount||0).fill({ id: -1, c: 'back', v: '' });
          }
        }
      });
      G.topCard=s.topCard; G.curColor=s.curColor; G.curIdx=Number(s.curIdx);
      G.dir=s.dir; G.pending=s.pending; G.turns=s.turns; G.lapNum=s.lapNum; G.over=s.over;
      G.deckCount=s.deckCount;
      if(data.myHand) G.players[G.myIdx].hand=data.myHand;

      if (data.drawnCardInfo && Number(data.drawnCardInfo.forPlayer) === Number(G.myIdx)) {
        G.drawnThis = true;
        const { card, isPlayable } = data.drawnCardInfo;
        const forcePlayRule = G.cfg?.rules?.forcePlay ?? true;

        if (isPlayable && forcePlayRule) {
          toast('⚡ Force Play: Auto-playing drawn card!');
          setTimeout(() => humanPlay(card.id), 300);
        } else if (isPlayable) {
          showDrawnChoiceModal(card);
        } else if (card) {
          toast(`📥 Drew ${cardLabel(card)} (${card.c.toUpperCase()}) — card kept in hand.`);
        }
      }

      renderGame();
      if(G.over) endGame(s.players.findIndex(p=>p.handCount===0));
    }
  }

  function startMPGame(cfg) {
    // Build players from connected list
    const players=connectedPlayers.map((p,i)=>({
      id:i, name:p.name, team:p.team, isHuman:true, hand:[], gameTeam:i
    }));

    const deck=shuffle(createDeck());
    let di=0;
    players.forEach(p=>{ for(let i=0;i<cfg.handLimit;i++) p.hand.push(deck[di++]); });
    let ti=di; while(ti<deck.length && isWild(deck[ti])) ti++;
    const topCard=deck[ti]; deck.splice(ti,1);

    G={
      cfg,players,
      deck:deck.slice(di),
      discardPile:[topCard],topCard,curColor:topCard.c,
      curIdx:0,dir:1,pending:0,over:false,drawnThis:false,
      unoAble:false,unoCalled:false,turns:0,lapNum:1,
      t0:Date.now(),isMultiplayer:true,myIdx:0
    };

    // Send start to all clients
    clientConns.forEach((conn)=>{
      const slot=connectedPlayers.find(p=>p.conn===conn);
      if(!slot) return;
      const pid=slot.id;
      try {
        conn.send({ type:'GAME_START', myIdx:pid, cfg,
          players:players.map(p=>({id:p.id, name:p.name, team:p.team, isHuman:p.isHuman, handCount:p.hand.length})),
          myHand:players[pid]?.hand||[],
          topCard,curColor:topCard.c,curIdx:0,dir:1,pending:0,
          deckCount:G.deck.length
        });
      } catch {}
    });

    showScreen('game');
    G.myIdx=0; G.isMultiplayer=true;
    renderGame();
    toast('🏁 Race started!','t-green');
  }

  function renderWaitingList() {
    const list=document.getElementById('waiting-players-list');
    list.innerHTML='';
    connectedPlayers.forEach(p=>{
      const teamCfg=TEAMS[p.team]||TEAMS.haas;
      const slot=document.createElement('div'); slot.className='wp-slot';
      slot.innerHTML=`
        <div class="wp-team-dot" style="background:${teamCfg.color}"></div>
        <div class="wp-name">${p.name||'Connecting...'}</div>
        <div class="wp-team-lbl">${teamCfg.label}</div>
        ${p.isHost?'<div class="wp-host-badge">HOST</div>':''}
      `;
      list.appendChild(slot);
    });

    const startBtn=document.getElementById('btn-start-mp');
    startBtn.disabled=connectedPlayers.length<2;
    const csText=document.getElementById('cs-text');
    csText.textContent=connectedPlayers.length>=2?`${connectedPlayers.length} drivers ready`:`Waiting for players (${connectedPlayers.length}/2+)`;
  }

  function destroy() {
    if(peer) { try { peer.destroy(); } catch {} peer=null; }
    hostConn=null; clientConns=[]; connectedPlayers=[]; isHost=false; roomCode='';
  }

  return { createRoom, joinRoom, sendMove, startMPGame, renderWaitingList, destroy,
    getIsHost:()=>isHost, getRoomCode:()=>roomCode, getConnectedPlayers:()=>connectedPlayers };
})();

// ══════════════════════════════════════════════════════════════
//  SETUP STATE (Solo)
// ══════════════════════════════════════════════════════════════
let soloCfg = {
  mode: '1v1', ffaCount: 4, handLimit: 7,
  playerName: 'Player 1', playerTeam: 'ferrari',
  rules: { stacking:true, noMercy:false, sevenZero:false, drawTillMatch:false, forcePlay:true }
};
let mpCfg = {
  mode: '1v1', ffaCount: 4, handLimit: 7,
  rules: { stacking:true, noMercy:false, sevenZero:false, drawTillMatch:false, forcePlay:true }
};

// ══════════════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ══════════════════════════════════════════════════════════════
const SCREENS = {
  landing: document.getElementById('screen-landing'),
  lobby:   document.getElementById('screen-lobby'),
  waiting: document.getElementById('screen-waiting'),
  setup:   document.getElementById('screen-setup'),
  game:    document.getElementById('screen-game'),
};
function showScreen(name) {
  Object.entries(SCREENS).forEach(([k,el])=>el.classList.toggle('active',k===name));
}
function showWaiting() { showScreen('waiting'); }

// ══════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════
function toast(msg, cls='') {
  const rack=document.getElementById('toast-rack');
  const t=document.createElement('div');
  t.className=`toast-item ${cls}`;
  t.textContent=msg;
  rack.appendChild(t);
  setTimeout(()=>t.remove(),3200);
}

// ══════════════════════════════════════════════════════════════
//  WIRE UP: LANDING
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-multiplayer').addEventListener('click',()=>{ Audio.play('click'); showScreen('lobby'); });
document.getElementById('btn-solo').addEventListener('click',()=>{ Audio.play('click'); showScreen('setup'); });
document.getElementById('btn-how-to').addEventListener('click',()=>{ Audio.play('click'); document.getElementById('ov-htp').style.display='flex'; });
document.getElementById('btn-close-htp').addEventListener('click',()=>{ document.getElementById('ov-htp').style.display='none'; });

document.querySelectorAll('.mode-tile').forEach(tile=>{
  tile.addEventListener('click',()=>{
    Audio.play('click'); soloCfg.mode=tile.dataset.mode;
    document.querySelectorAll('#solo-mode-row .modb').forEach(b=>b.classList.toggle('active',b.dataset.m===tile.dataset.mode));
    showScreen('setup');
  });
});

// Sound toggle
const sndToggle=document.getElementById('btn-sound-toggle');
const gameSndToggle=document.getElementById('btn-game-snd');
[sndToggle,gameSndToggle].forEach(btn=>btn.addEventListener('click',()=>{
  const on=Audio.toggle();
  document.getElementById('snd-icon').textContent=on?'🔊':'🔇';
  gameSndToggle.textContent=on?'🔊':'🔇';
}));

// ── LOBBY ──
document.getElementById('btn-lobby-back').addEventListener('click',()=>{ Audio.play('click'); MP.destroy(); showScreen('landing'); });

// Tab switcher
document.querySelectorAll('.ltab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    Audio.play('click');
    document.querySelectorAll('.ltab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.lobby-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+tab.dataset.tab).classList.add('active');
  });
});

// Team swatches
function wireTeamGrid(gridId) {
  document.querySelectorAll(`#${gridId} .team-swatch`).forEach(sw=>{
    sw.addEventListener('click',()=>{
      Audio.play('click');
      document.querySelectorAll(`#${gridId} .team-swatch`).forEach(s=>s.classList.remove('active'));
      sw.classList.add('active');
    });
  });
}
wireTeamGrid('team-grid-create');
wireTeamGrid('team-grid-join');
wireTeamGrid('team-grid-solo');

// Mode buttons
function wireModeRow(rowId, cfg) {
  document.querySelectorAll(`#${rowId} .modb`).forEach(btn=>{
    btn.addEventListener('click',()=>{
      Audio.play('click');
      document.querySelectorAll(`#${rowId} .modb`).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      if(btn.dataset.m) cfg.mode=btn.dataset.m;
      if(btn.dataset.c) cfg.ffaCount=parseInt(btn.dataset.c);
      if(btn.dataset.hl) cfg.handLimit=parseInt(btn.dataset.hl);
      if(btn.dataset.shl) cfg.handLimit=parseInt(btn.dataset.shl);
      const ffaRow=document.getElementById('ffa-count-row');
      if(ffaRow) ffaRow.style.display=cfg.mode==='ffa'?'block':'none';
    });
  });
}
wireModeRow('mp-mode-create', mpCfg);
wireModeRow('solo-mode-row', soloCfg);

document.querySelectorAll('#panel-create .mode-row').forEach((row,ri)=>{
  row.querySelectorAll('.modb').forEach(btn=>{
    btn.addEventListener('click',()=>{
      row.querySelectorAll('.modb').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      if(btn.dataset.hl) mpCfg.handLimit=parseInt(btn.dataset.hl);
      if(btn.dataset.c) mpCfg.ffaCount=parseInt(btn.dataset.c);
    });
  });
});

// Rules
['stack','mercy','70','dtm','fp'].forEach(r=>{
  const el=document.getElementById('r-'+r);
  if(el) el.addEventListener('change',e=>{
    const map={stack:'stacking',mercy:'noMercy','70':'sevenZero',dtm:'drawTillMatch',fp:'forcePlay'};
    mpCfg.rules[map[r]]=e.target.checked;
  });
});
['stack','mercy','70','dtm','fp'].forEach(r=>{
  const el=document.getElementById('sr-'+r);
  if(el) el.addEventListener('change',e=>{
    const map={stack:'stacking',mercy:'noMercy','70':'sevenZero',dtm:'drawTillMatch',fp:'forcePlay'};
    soloCfg.rules[map[r]]=e.target.checked;
  });
});

// Create room button
document.getElementById('btn-create-room').addEventListener('click',()=>{
  Audio.play('click');
  const name=document.getElementById('mp-name-create').value.trim()||'Driver';
  const team=document.querySelector('#team-grid-create .team-swatch.active')?.dataset.team||'ferrari';
  MP.createRoom(name, team, mpCfg, ()=>{});
});

// Join room button
document.getElementById('btn-join-room').addEventListener('click',()=>{
  Audio.play('click');
  const code=document.getElementById('room-code-input').value.trim();
  if(code.length<5) { toast('Enter a valid room code!','t-red'); return; }
  const name=document.getElementById('mp-name-join').value.trim()||'Driver';
  const team=document.querySelector('#team-grid-join .team-swatch.active')?.dataset.team||'mercedes';
  MP.joinRoom(code, name, team);
});

// Paste code
document.getElementById('btn-paste-code').addEventListener('click',async()=>{
  try { const t=await navigator.clipboard.readText(); document.getElementById('room-code-input').value=t.trim().toUpperCase(); } catch {}
});

// Copy code
document.getElementById('btn-copy-code').addEventListener('click',()=>{
  Audio.play('click');
  const code=document.getElementById('display-room-code').textContent;
  navigator.clipboard.writeText(code).then(()=>toast('✅ Code copied!','t-green')).catch(()=>{
    const el=document.getElementById('display-room-code');
    const range=document.createRange(); range.selectNode(el);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
  });
});

// Start multiplayer game (host only)
document.getElementById('btn-start-mp').addEventListener('click',()=>{
  if(!MP.getIsHost()) return;
  Audio.play('click');
  MP.startMPGame(mpCfg);
});

document.getElementById('btn-cancel-room').addEventListener('click',()=>{
  Audio.play('click'); MP.destroy(); showScreen('landing');
});

// ── SOLO SETUP ──
document.getElementById('btn-setup-back').addEventListener('click',()=>{ Audio.play('click'); showScreen('landing'); });

document.getElementById('btn-start-solo').addEventListener('click',()=>{
  Audio.play('click');
  soloCfg.playerName=document.getElementById('solo-name').value.trim()||'Driver';
  soloCfg.playerTeam=document.querySelector('#team-grid-solo .team-swatch.active')?.dataset.team||'ferrari';
  G.isMultiplayer=false; G.myIdx=0;
  initGame(soloCfg);
  document.getElementById('hud-mode').textContent=soloCfg.mode.toUpperCase()+' RACE';
  showScreen('game');
  renderGame();
  scheduleAI();
});

// Drawn card choice buttons
document.getElementById('btn-play-drawn')?.addEventListener('click', () => {
  Audio.play('click');
  document.getElementById('ov-drawn-choice').style.display = 'none';
  if (pendingDrawnCard) {
    const cardToPlay = pendingDrawnCard;
    pendingDrawnCard = null;
    humanPlay(cardToPlay.id);
  }
});

document.getElementById('btn-keep-drawn')?.addEventListener('click', () => {
  Audio.play('click');
  document.getElementById('ov-drawn-choice').style.display = 'none';
  toast('📥 Card kept in hand. Click PASS TURN to end turn.');
  pendingDrawnCard = null;
  renderGame();
});

// ── GAME BUTTONS ──
document.getElementById('draw-pile').addEventListener('click',()=>{ if(G.over||Number(G.curIdx)!==Number(G.myIdx)||G.drawnThis) return; humanDraw(); });
document.getElementById('btn-draw').addEventListener('click',()=>humanDraw());
document.getElementById('btn-pass').addEventListener('click',()=>humanPass());
document.getElementById('btn-uno').addEventListener('click',()=>callUno());
document.getElementById('btn-game-menu').addEventListener('click',()=>{ Audio.play('click'); document.getElementById('ov-pause').style.display='flex'; });
document.getElementById('btn-resume').addEventListener('click',()=>{ Audio.play('click'); document.getElementById('ov-pause').style.display='none'; });
document.getElementById('btn-restart').addEventListener('click',()=>{
  Audio.play('click'); document.getElementById('ov-pause').style.display='none';
  G.isMultiplayer=false; G.myIdx=0;
  initGame(G.cfg||soloCfg); renderGame(); scheduleAI();
});
document.getElementById('btn-quit').addEventListener('click',()=>{
  Audio.play('click'); document.getElementById('ov-pause').style.display='none';
  G.over=true; if(aiTimer) clearTimeout(aiTimer);
  MP.destroy(); showScreen('landing');
});

// Win screen
document.getElementById('btn-rematch').addEventListener('click',()=>{
  Audio.play('click');
  document.getElementById('screen-win').style.display='none';
  G.isMultiplayer=false; G.myIdx=0;
  initGame(G.cfg||soloCfg); renderGame(); scheduleAI();
});
document.getElementById('btn-main-menu').addEventListener('click',()=>{
  Audio.play('click');
  document.getElementById('screen-win').style.display='none';
  G.over=true; if(aiTimer) clearTimeout(aiTimer);
  MP.destroy(); showScreen('landing');
});

// ── KEYBOARD ──
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') {
    ['ov-color','ov-htp','ov-pause'].forEach(id=>{
      const el=document.getElementById(id);
      if(el.style.display!=='none') el.style.display='none';
    });
  }
  if(e.key.toLowerCase()==='u') callUno();
  if(e.key.toLowerCase()==='d') humanDraw();
});

// ══════════════════════════════════════════════════════════════
//  BACKGROUND AMBIENT PARTICLES (Landing)
// ══════════════════════════════════════════════════════════════
(function ambientFX() {
  const colors=['#E1060044','#1E88E544','#43A04744','#FDD83544'];
  function spawn() {
    if(document.getElementById('screen-landing').classList.contains('active')) {
      const x=Math.random()*innerWidth, y=Math.random()*innerHeight;
      FX.burst(x,y,colors[Math.floor(Math.random()*colors.length)],1);
      // Speed lines from left
      if(Math.random()<0.3) FX.speedLine(0,Math.random()*innerHeight,8,'#E1060022');
    }
    setTimeout(spawn,1800);
  }
  setTimeout(spawn,2000);
})();

// ══════════════════════════════════════════════════════════════
//  FLOATING CARD TEXT (populate at init)
// ══════════════════════════════════════════════════════════════
document.querySelectorAll('.fc').forEach(fc=>{
  fc.textContent=fc.dataset.val;
});

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
showScreen('landing');
console.log('%c🏎️ UNO//F1 v2.0 Ready. D=Draw, U=UNO, Esc=Pause', 'color:#E10600;font-weight:bold;font-size:14px;');
