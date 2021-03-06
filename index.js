'use strict';

const state = {
  w: null, // box width
  h: null, // box height
  scale: null, // box tile size
  tiles: [], // tiles {x,y,s} added during animation
  mouseX: 0,
  mouseY: window.innerHeight*0.75,
  animate: {
    scrubbing: false,
    enabled: true,
    t: null,
    total: null,
    phases: [],
  },
};

const animPhases = [
  {name:'fill', duration: 1400},
  {name:'found', duration: null}, // set by initAnim
  {name:'backfill', duration: 1000},
];
const animPhaseNames = {};
for (let phase of Object.values(animPhases)) {
  animPhaseNames[phase.name] = phase;
}

function updateSize(w,h) {
  state.w = w;
  state.h = h;
  state.scale = gcd(w,h);
  state.tiles = createTiles(w,h);
  initAnim();
  draw();
  localStorage.w = w;
  localStorage.h = h;
}

const unitSize = 20; // pixel size of single unit

//----------------------------------------------------------------------
// Canvas
//----------------------------------------------------------------------

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

let canvasW, canvasH;

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW * ratio;
  canvas.height = canvasH * ratio;
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  ctx.scale(ratio, ratio);
  draw();
}
document.body.onresize = resizeCanvas;

//----------------------------------------------------------------------
// Math
//----------------------------------------------------------------------

// greatest common divisor (via euclidean algorithm)
function gcd(x,y) {
  const a = Math.max(x,y);
  const b = Math.min(x,y);
  return (b === 0) ? a : gcd(b, a % b);
}

//----------------------------------------------------------------------
// Tile Creation
//----------------------------------------------------------------------

function cutSpace({x,y,w,h,lastFillDir}) {
  // Given a `spaceLeft` to fill, we cut out biggest possible square from it and
  // return both parts.
  const spaceLeft = {x,y,w,h};
  const tile = {x,y};
  tile.s = Math.min(w,h)
  if (tile.s === 1) {
    tile.isLast = true; // stop early
  }
  tile.rowsFilled = 0;
  if (w > h)      { spaceLeft.x += tile.s; spaceLeft.w -= tile.s; tile.fillDir = 'x'; }
  else if (w < h) { spaceLeft.y += tile.s; spaceLeft.h -= tile.s; tile.fillDir = 'y'; }
  else {
    spaceLeft.x += tile.s;
    spaceLeft.y += tile.s;
    spaceLeft.w = spaceLeft.h = 0;
    tile.fillDir = lastFillDir || 'x';
    tile.isLast = true;
  }
  spaceLeft.lastFillDir = tile.fillDir;
  return {tile, spaceLeft};
}

function* allTiles(w,h) {
  let spaceLeft = {x:0, y:0, w, h};
  let tile = {};
  while (!tile.isLast) {
    ({tile, spaceLeft} = cutSpace(spaceLeft));
    yield tile;
  }
}

function addAnimToTiles(tiles) {
  const pause = 2;
  const total = tiles.reduce((sum, {s}) => sum+s+pause, 0);
  let i = 0;
  for (let tile of tiles) {
    tile.fillStart = i/total;
    i += tile.s+pause;
    tile.fillEnd = i/total;
    tile.fillLength = tile.fillEnd - tile.fillStart;
  }
  const scale = tiles[tiles.length-1].s;
  i = 0;
  for (let tile of tiles.slice(0).reverse()) {
    tile.scale = scale;
    if (tile.s === scale) {
      continue;
    }
    tile.backfillStart = i/total;
    i += tile.s;
    tile.backfillEnd = i/total;
    tile.backfillLength = tile.backfillEnd - tile.backfillStart;
  }
}

function createTiles(w,h) {
  const tiles = Array.from(allTiles(w,h));
  addAnimToTiles(tiles);
  return tiles;
}

//----------------------------------------------------------------------
// Draw
//----------------------------------------------------------------------

const unitStroke = 'rgba(40,70,100,0.08)';
const tileStrokeOut = 'rgba(40,70,100,0.1)';
const tileStrokeIn = 'rgba(40,70,100,0.4)';

const boxFill = 'rgba(40,70,100,0.15)';
const tileFill = 'rgba(40,70,100,0.15)';
const boxStroke = '#555';

const noncoprimeFill = 'rgba(10,40,70,0.2)';
const coprimeFill = 'rgba(10,40,70,0.3)';

const fontSize = 20;
const smallFontSize = 16;

const activeTextFill = '#555';
const inactiveTextFill = 'rgb(130, 140, 160)';

// draw a simple grid in the given area
function drawGrid(w, h, unit, strokeStyle) {
  ctx.beginPath();
  for (let x=0; x<=w; x+=unit) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y=0; y<=h; y+=unit) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

// draw a tile size indicator at the given point
function drawTileSizeIndicator(x,y,size) {
  const r = size;
  ctx.save();
  ctx.translate(x,y);
  // ctx.rotate(Math.PI/2);
  ctx.beginPath();
  ctx.moveTo(0,-r);
  ctx.lineTo(-r,0);
  ctx.lineTo(0,r);
  ctx.lineTo(r,0);
  ctx.closePath();
  ctx.restore();
}

// draw all tile size indicators at non-coprime points
function drawNonCoprimes(fillStyle) {
  for (let x=1; x<=canvasW/unitSize; x++) {
    for (let y=1; y<=canvasH/unitSize; y++) {
      const {w,h} = state;
      const scale = gcd(x,y);
      if (scale !== 1) {
        drawTileSizeIndicator(x*unitSize,y*unitSize,scale);
        ctx.strokeStyle = (x === w && y === h) ? '#555' : 'rgba(0,0,0,0.06)';
        ctx.stroke();
      }
    }
  }
}

// draw `NxN` inside the given tile
function drawTileLabel(x,y,s) {
  if (s === 1) {
    return;
  }
  ctx.font = `${smallFontSize}px Helvetica`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  // ctx.strokeStyle = boxStroke;
  const tx = (x+s - 0.3) * unitSize;
  const ty = (y+s - 0.3) * unitSize;
  const text = `${s}x${s}`;
  // ctx.strokeText(text, tx, ty);
  ctx.fillText(text, tx, ty);
}

// draw box dimension size labels (and in terms of tiles if applicable)
function drawBoxSizeLabels() {
  const {w,h,scale} = state;
  const pixelW = w * unitSize;
  const pixelH = h * unitSize;

  const pad = unitSize/2;
  ctx.font = `${fontSize}px Helvetica`;

  // show height
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = activeTextFill;
  ctx.fillText(state.h, pixelW + pad, pixelH/2);

  // show width
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = activeTextFill;
  ctx.fillText(w, pixelW/2, pixelH + pad + fontSize/2);
}

function drawBoxSizeTileLabels() {
  const {w,h,scale} = state;
  const pixelW = w * unitSize;
  const pixelH = h * unitSize;
  const pad = unitSize/2;

  let x,y,text,tiles;
  ctx.font = `${fontSize}px Helvetica`;
  const widthLabelPad = ctx.measureText(w).width;
  const heightLabelPad = ctx.measureText(h).width;
  ctx.font = `${smallFontSize}px Helvetica`;

  // show height in terms of tiles
  if (state.h <= 10) {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    x = pixelW + 2*pad + heightLabelPad;
    y = pixelH/2;
  } else {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    x = pixelW + pad;
    y = pixelH/2 + pad*1.5;
  }
  tiles = state.h/scale;
  text = `(${tiles} tile${tiles>1?'s':''} high)`;
  ctx.fillStyle = inactiveTextFill;
  ctx.fillText(text, x, y);

  // show width in terms of tiles
  if (w <= 10) {
    ctx.textBaseline = 'top';
    ctx.textAlign = w <= 4 ? 'left' : 'center';
    x = pixelW/2;
    y = pixelH + pad + fontSize;
  } else {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    x = pixelW/2 + pad + widthLabelPad/2;
    y = pixelH + pad + fontSize/2;
  }
  ctx.fillStyle = inactiveTextFill;
  tiles = w/scale;
  text = `(${tiles} tile${tiles>1?'s':''} wide)`;
  ctx.fillText(text, x, y);

  drawTileLabel(w - scale, h - scale, scale);
}

// draw the current box shape
function drawBox() {
  const {w,h,scale} = state;
  const pixelW = w * unitSize;
  const pixelH = h * unitSize;

  ctx.strokeStyle = boxStroke;
  ctx.fillStyle = boxFill;
  ctx.fillRect(0, 0, pixelW, pixelH);
  ctx.strokeRect(0, 0, pixelW, pixelH);
}

function drawTileGrid() {
  const {w,h,scale} = state;
  const pixelW = w * unitSize;
  const pixelH = h * unitSize;
  drawGrid(canvasW, canvasH, scale*unitSize, tileStrokeOut);
  drawGrid(pixelW, pixelH, scale*unitSize, tileStrokeIn);
  ctx.fillStyle = tileFill;
  ctx.strokeStyle = tileStrokeIn;
  ctx.fillRect(0, 0, pixelW, pixelH);
  ctx.strokeRect(0, 0, pixelW, pixelH);
}

function drawScrubLayer() {
  // show instructions
  const size = 14;
  ctx.font = `${size}px monospace`;
  ctx.fillStyle = boxStroke;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.save();
  ctx.fillText('             Click = resize ', window.innerWidth-size, size);
  ctx.translate(0, size*1.5);
  ctx.fillText('             Enter = animate', window.innerWidth-size, size);
  ctx.translate(0, size*1.5);
  ctx.fillText('Shift + Mouse move = study  ', window.innerWidth-size, size);
  ctx.restore();

  if (state.animate.scrubbing) {
    const {mouseX, mouseY} = state;
    const s = 28;
    ctx.save();
    const {phase,time} = getPhase(state.animate.t);

    // background and border
    const y = -s/2;
    const h = s;
    const bottomPad = 60;
    ctx.translate(0, window.innerHeight - s*2 - bottomPad);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(0,y,window.innerWidth,h*2.2);

    // how far marker pokes out of timeline
    const m = 4;

    for (let {name,duration,start} of state.animate.phases) {
      const x = start / state.animate.total * window.innerWidth;
      const w = duration / state.animate.total * window.innerWidth;
      const dark = '#555';
      const light = '#fff';

      // draw timeline markers for each tile
      if (name === 'fill') {
        for (let {fillStart} of state.tiles) {
          const lx = x + fillStart * duration / state.animate.total * window.innerWidth;
          ctx.beginPath();
          ctx.moveTo(lx, y+h);
          ctx.lineTo(lx, y+h+m);
          ctx.strokeStyle = dark;
          ctx.stroke();
        }
      }
      else if (name === 'backfill') {
        for (let {backfillStart} of state.tiles) {
          if (backfillStart == null) {
            continue;
          }
          const lx = x + backfillStart * duration / state.animate.total * window.innerWidth;
          ctx.beginPath();
          ctx.moveTo(lx, y+h);
          ctx.lineTo(lx, y+h+m);
          ctx.strokeStyle = dark;
          ctx.stroke();
        }
      }

      ctx.strokeStyle = dark;
      ctx.strokeRect(x,y,w,h);

      // label
      ctx.font = `${s*0.5}px Helvetica`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      let title;
      let caption;
      const {scale} = state;
      if (name === 'fill') {
        title = 'Fill with large squares';
        caption = 'Insert largest fitting square tiles (i.e. smallest side of remaining space).';
      }
      else if (name === 'found') {
        if (state.scale === 1) {
          title = `Identify simplest unit: (${scale}x${scale})`;
          caption = 'A 1x1 tile means the space dimensions are already simplified (i.e. coprime).';
        } else {
          title = `Identify simplest unit: (${scale}x${scale})`;
          caption = 'Last tile inserted is the largest to evenly divide the whole space.';
        }
      }
      else if (name === 'backfill') {
        title = 'Subdivide previous squares';
        caption = 'Extend the new unit tiles into the previous squares until covered.';
      }
      ctx.fillStyle = activeTextFill;
      ctx.fillText(title, x + s/4, 0);
      if (phase == name) {
        ctx.save();
        ctx.globalAlpha *= 0.7;
        ctx.fillStyle = inactiveTextFill;
        ctx.fillText(caption, x + s/4, s*1.1);
        ctx.restore();
      }


      // progress bar
      if (phase === name) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x,y,w*time,h);
        ctx.fillStyle = dark;
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = light;
        ctx.fillText(title, x + s/4, 0);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.rect(mouseX-m, -s/2-m, 2*m, s+2*m);
      ctx.strokeStyle = dark;
      ctx.fillStyle = light;
      ctx.fill();
      ctx.stroke();
    }
    // ctx.stroke();
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0,0,canvasW,canvasH);
  drawGrid(canvasW, canvasH, unitSize, unitStroke);
  drawNonCoprimes();
  drawBox();
  drawBoxSizeLabels();
  drawAnimLayer(state.animate.t);
  drawScrubLayer();
}

//----------------------------------------------------------------------
// Draw Animation
//----------------------------------------------------------------------

function drawTileFill(tile, time) {
  const {fillStart, fillLength} = tile;
  const {x,y,s,fillDir} = tile;
  if (time < fillStart) {
    // draw nothing
  } else if (time < fillStart+fillLength) {
    // draw sweeping arc to clarify how the size is chosen
    ctx.beginPath();
    ctx.moveTo(x*unitSize, y*unitSize);
    const t = Math.min(1, (time - fillStart) / fillLength);
    const a = t*Math.PI/2;
    let startA, endA, cc;
    if (fillDir === 'x') {
      startA = Math.PI/2;
      endA = startA-a;
      cc = true;
    } else if (fillDir === 'y') {
      startA = 0;
      endA = a;
      cc = false;
    }
    ctx.save();
    ctx.globalAlpha *= t;
    ctx.fillStyle = tileFill;
    ctx.fillRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.restore();

    ctx.ellipse(x*unitSize, y*unitSize, s*unitSize, s*unitSize, 0, startA, endA, cc);
    ctx.strokeStyle = tileFill;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x*unitSize, y*unitSize);
    ctx.lineTo((x + s*Math.cos(endA)) * unitSize, (y + s*Math.sin(endA)) * unitSize);
    ctx.strokeStyle = boxStroke;
    ctx.stroke();

    // show the radius length of the sweeping arc
    if (s > 3) {
      ctx.font = `${smallFontSize}px Helvetica`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const textInside = a > Math.PI/4;
      ctx.fillStyle = textInside ? '#fff' : inactiveTextFill;
      const textDist = 0.7;
      let textA;
      if (fillDir === 'x') {
        textA = endA + Math.PI/2 * (textInside ? 1 : -1);
      } else if (fillDir === 'y') {
        textA = endA + Math.PI/2 * (textInside ? -1 : 1);
      }
      ctx.fillText(
        s,
        (x + s/2*Math.cos(endA) + textDist*Math.cos(textA)) * unitSize,
        (y + s/2*Math.sin(endA) + textDist*Math.sin(textA)) * unitSize
      );
    }
  } else {
    // draw growing tile
    const t = Math.min(1, (time - fillStart) / fillLength);
    const w = s * (fillDir === 'x' ? t : 1);
    const h = s * (fillDir === 'y' ? t : 1);
    ctx.fillStyle = tileFill;
    ctx.strokeStyle = tileStrokeIn;
    ctx.fillRect(x*unitSize, y*unitSize, w*unitSize, h*unitSize);
    ctx.strokeRect(x*unitSize, y*unitSize, w*unitSize, h*unitSize);
    if (t === 1) {
      drawTileLabel(x,y,s);
    }
  }
}

function drawTileFound(tile, time) {
  const {x,y,s,scale,isLast} = tile;
  if (isLast) {
    ctx.fillStyle = tileFill;
    ctx.fillRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.fillStyle = (s === 1) ? coprimeFill : noncoprimeFill;
    ctx.fillRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.strokeStyle = tileStrokeIn;
    ctx.strokeRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    drawTileLabel(x,y,s);
  } else {
    ctx.fillStyle = tileFill;
    ctx.strokeStyle = tileStrokeIn;
    ctx.fillRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.strokeRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.save();
    const fade = animPhaseNames.backfill.skip ? 0 : 0.5;
    ctx.globalAlpha *= (time < (1-fade) ? 1 : (1 - time) / fade);
    drawTileLabel(x,y,s);
    ctx.restore();
  }
}

function drawTileBackfill(tile, time) {
  const {x,y,s,scale} = tile;
  const {backfillStart, backfillLength} = tile;

  if (backfillStart == null) {
    ctx.fillStyle = tileFill;
    ctx.fillRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.strokeStyle = tileStrokeIn;
    ctx.strokeRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
  }
  else if (time < backfillStart) {
    ctx.fillStyle = tileFill;
    ctx.fillRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.strokeStyle = tileStrokeIn;
    ctx.strokeRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
  }
  else {
    ctx.fillStyle = tileFill;
    ctx.fillRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);
    ctx.strokeStyle = tileStrokeIn;
    ctx.strokeRect(x*unitSize, y*unitSize, s*unitSize, s*unitSize);

    const t = Math.min(1, (time - backfillStart) / backfillLength);
    const numTiles = s / scale;
    const rowProgress = t * numTiles;
    const rows = Math.ceil(rowProgress);
    const cols = numTiles;
    let lastRowScale = rowProgress % 1;
    if (lastRowScale === 0) {
      lastRowScale = 1;
    }

    // instead of using tile.fillDir, we use both to show why the square tiles
    // do in fact fit correctly when backfilling.
    for (let fillDir of ['x', 'y']) {
      ctx.save();
      if (fillDir === 'x')      { ctx.translate((x+s)*unitSize, y*unitSize); ctx.rotate(Math.PI/2); }
      else if (fillDir === 'y') { ctx.translate((x+s)*unitSize, (y+s)*unitSize); ctx.rotate(Math.PI); }
      ctx.strokeStyle = tileStrokeIn;
      for (let row=0; row<rows; row++) {
        const h = scale*unitSize*(row === rows-1 ? lastRowScale : 1);
        for (let col=0; col<cols; col++) {
          const x = col*scale*unitSize;
          const y = row*scale*unitSize;
          const w = scale*unitSize;
          ctx.beginPath();
          ctx.moveTo(x,y);
          ctx.lineTo(x,y+h);
          ctx.moveTo(x+w,y);
          ctx.lineTo(x+w,y+h);
          ctx.stroke();
          // ctx.strokeRect(x, y, w, h);
        }
      }
      ctx.restore();
    }
  }
}

function drawAnimTile(tile, phase, time) {
  switch (phase) {
    case 'fill': drawTileFill(tile, time); break;
    case 'found': drawTileFound(tile, time); break;
    case 'backfill': drawTileBackfill(tile, time); break;
  }
}

//----------------------------------------------------------------------
// Animation Timing
//----------------------------------------------------------------------

function* allPhases() {
  for (let phase of animPhases) {
    if (!phase.skip) {
      yield phase;
    }
  }
}

function getPhase(t) {
  const phases = state.animate.phases;
  let p;
  for (p of phases) {
    if (t < p.duration) { return { phase: p.name, time: t / p.duration }; }
    t -= p.duration;
  }
  return { phase: p.name, time: 1 };
}

function setPhaseTimes(phases) {
  let t = 0;
  for (let phase of phases) {
    phase.start = t;
    t += phase.duration;
  }
  return t;
}

function getPhaseTime(name) {
  return animPhaseNames[name].start;
}

function initAnim() {
  // adjust some animation phases depending on tile result
  animPhaseNames.found.duration = (state.scale === 1 ? 800 : 800);
  animPhaseNames.backfill.skip = (state.scale === 1);

  const phases = Array.from(allPhases());
  const total = setPhaseTimes(phases);
  state.animate.phases = phases;
  state.animate.total = total;
  state.animate.t = state.animate.enabled ? getPhaseTime('found') : total;
}

function drawAnimLayer(t) {
  let {phase, time} = getPhase(t);
  for (let tile of state.tiles) {
    drawAnimTile(tile, phase, time);
  }
  if (state.scale !== 1 && t >= getPhaseTime('found')) {
    drawBoxSizeTileLabels();
  }
}

function advanceAnim(dt) {
  state.animate.t += dt;
  draw();
}

let lastTime;
function tick(t) {
  let dt;
  if (lastTime) {
    dt = t - lastTime;
  } else {
    dt = 0;
  }
  lastTime = t;
  if (state.animate.t < state.animate.total && !state.animate.scrubbing) {
    advanceAnim(dt);
  }
  window.requestAnimationFrame(tick);
}

//----------------------------------------------------------------------
// Mouse
//----------------------------------------------------------------------

function resizeBoxToMouse(e, resizeW, resizeH) {
  let {w,h} = state;
  if (resizeW) { w = Math.max(1, Math.round(e.offsetX / unitSize)); }
  if (resizeH) { h = Math.max(1, Math.round(e.offsetY / unitSize)); }
  if (state.w !== w || state.h !== h) {
    updateSize(w,h);
  }
}

function canResizeWidth(e) {
  const x = e.offsetX/unitSize;
  const y = e.offsetY/unitSize;
  return Math.abs(x-state.w) < 0.5 && y < state.h + 0.5;
}

function canResizeHeight(e) {
  const x = e.offsetX/unitSize;
  const y = e.offsetY/unitSize;
  return Math.abs(y-state.h) < 0.5 && x < state.w + 0.5;
}

function getCursor(e) {
  const resizeW = canResizeWidth(e);
  const resizeH = canResizeHeight(e);
  let cursor;
  if (state.animate.scrubbing) { cursor = '-webkit-grabbing'; }
  else if (resizeW && resizeH) { cursor = 'nwse-resize'; }
  else if (resizeW)            { cursor = 'ew-resize'; }
  else if (resizeH)            { cursor = 'ns-resize'; }
  else                         { cursor = 'crosshair'; }
  return cursor;
}

function updateCursor(e) {
  const cursor = getCursor(e);
  canvas.style.cursor = cursor;
}

function createMouseEvents() {
  let resizeW = false;
  let resizeH = false;
  document.body.onkeydown = (e) => {
    if (e.key === 'Shift') {
      state.animate.scrubbing = true;
      state.animate.t = state.animate.total * state.mouseX / window.innerWidth;
      draw();
      updateCursor(e);
    }
  };
  document.body.onkeyup = (e) => {
    if (e.key === 'Shift') {
      state.animate.scrubbing = false;
      updateCursor(e);
    }
    if (e.key === 'Enter') {
      state.animate.t = 0;
    }
  };
  canvas.onmousedown = (e) => {
    if (state.animate.scrubbing || e.button !== 0) {
      return;
    }
    updateCursor(e);
    resizeW = canResizeWidth(e);
    resizeH = canResizeHeight(e);
    if (!resizeW && !resizeH) {
      resizeW = true;
      resizeH = true;
    }
    resizeBoxToMouse(e, resizeW, resizeH);
  };
  canvas.onmousemove = (e) => {
    state.mouseX = e.offsetX;
    state.mouseY = e.offsetY;
    if (state.animate.scrubbing) {
      state.animate.t = state.animate.total * state.mouseX / window.innerWidth;
      draw();
    } else if (resizeH || resizeW) {
      resizeBoxToMouse(e, resizeW, resizeH);
    } else {
      updateCursor(e);
    }
  };
  canvas.onmouseup = (e) => {
    if (e.button !== 0) {
      return;
    }
    resizeW = false;
    resizeH = false;
    updateCursor(e);
  };
}

//----------------------------------------------------------------------
// Load
//----------------------------------------------------------------------

updateSize(
  parseInt(localStorage.w, 10) || 36,
  parseInt(localStorage.h, 10) || 22
);
resizeCanvas();
createMouseEvents();
window.requestAnimationFrame(tick);
