
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const unitSize = 20;

function gcd(n0, n1) {
  const a = Math.max(n0, n1);
  const b = Math.min(n0, n1);
  return (b === 0) ? a : gcd(b, a % b);
}

const state = {
  w: 1,
  h: 1,
};

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

function drawNonCoprimes(fillStyle) {
  for (let x=1; x<=canvas.width/unitSize; x++) {
    for (let y=1; y<=canvas.height/unitSize; y++) {
      const scale = gcd(x,y);
      if (scale !== 1) {
        const r = scale;
        ctx.beginPath();
        ctx.strokeStyle = (x === state.w && y === state.h) ? "#555" : fillStyle;
        ctx.ellipse(x*unitSize,y*unitSize,r,r,0,0,Math.PI*2);
        ctx.stroke();
      }
    }
  }
}

function drawBox() {
  ctx.strokeStyle = "#555";
  ctx.fillStyle = "rgba(40,70,100,0.3)";
  const w = state.w * unitSize;
  const h = state.h * unitSize;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeRect(0, 0, w, h);

  const scale = gcd(state.w, state.h);
  if (scale !== 1) {
    drawGrid(canvas.width, canvas.height, scale*unitSize, "rgba(40,70,100,0.3)");
  }

  const pad = unitSize/2;
  ctx.fillStyle = "#555";
  ctx.font = '20px Helvetica';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(state.h, w + pad, h/2);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText(state.w, w/2, h + pad);
}

function draw() {
  ctx.clearRect(0,0,canvas.width, canvas.height);
  drawGrid(canvas.width, canvas.height, unitSize, "rgba(0,0,0,0.05)");
  drawNonCoprimes("rgba(0,0,0,0.1");
  drawBox();
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

resizeCanvas();
document.body.onresize = resizeCanvas;

function resizeBoxToMouse(e) {
  state.w = Math.round(e.offsetX / unitSize);
  state.h = Math.round(e.offsetY / unitSize);
  draw();
}

function createMouseEvents() {
  let down = false;
  canvas.onmousemove = (e) => { if (down) resizeBoxToMouse(e); };
  canvas.onmousedown = (e) => { down = true; resizeBoxToMouse(e); };
  canvas.onmouseup = (e) => { down = false; };
}

createMouseEvents();
