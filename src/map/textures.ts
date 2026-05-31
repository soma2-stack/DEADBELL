import * as THREE from 'three';

export const generateWornWallTexture = () => {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Dual-tone paint grimy classroom look
  ctx.fillStyle = '#dfdcd4';
  ctx.fillRect(0, 0, size, size * 0.58);
  ctx.fillStyle = '#4c5d50';
  ctx.fillRect(0, size * 0.58, size, size * 0.42);
  ctx.fillStyle = '#3a2012';
  ctx.fillRect(0, size * 0.57, size, size * 0.015);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const factor = (Math.random() - 0.5) * 10;
    data[i] = Math.max(0, Math.min(255, data[i] + factor));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + factor));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + factor));
  }
  ctx.putImageData(imgData, 0, 0);

  const topGrad = ctx.createLinearGradient(0, 0, 0, size * 0.28);
  topGrad.addColorStop(0, 'rgba(12, 11, 10, 0.65)');
  topGrad.addColorStop(1, 'rgba(12, 11, 10, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, size, size * 0.28);

  const bottomGrad = ctx.createLinearGradient(0, size, 0, size * 0.72);
  bottomGrad.addColorStop(0, 'rgba(15, 14, 12, 0.78)');
  bottomGrad.addColorStop(1, 'rgba(15, 14, 12, 0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, size * 0.72, size, size * 0.28);

  ctx.strokeStyle = 'rgba(24, 20, 15, 0.55)';
  ctx.lineWidth = 1.5;
  for (let c = 0; c < 5; c++) {
    ctx.beginPath();
    let sx = Math.random() * size;
    let sy = Math.random() * size;
    ctx.moveTo(sx, sy);
    for (let j = 0; j < 5; j++) {
      sx += (Math.random() - 0.5) * 65;
      sy += (Math.random() - 0.5) * 65;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(40, 32, 22, 0.22)';
  for (let s = 0; s < 12; s++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const sr = Math.random() * 30 + 10;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    if (Math.random() < 0.7) {
      ctx.fillRect(sx - 1.5, sy, 3, Math.random() * 90 + 20);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const generateConcreteFloorTexture = () => {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#484c4a'; 
  ctx.fillRect(0, 0, size, size);

  const tSize = size / 8;
  ctx.strokeStyle = 'rgba(12, 14, 13, 0.72)';
  ctx.lineWidth = 4;
  for (let col = 0; col <= 8; col++) {
    ctx.beginPath(); ctx.moveTo(col * tSize, 0); ctx.lineTo(col * tSize, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, col * tSize); ctx.lineTo(size, col * tSize); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(10, 10, 10, 0.16)';
  for (let tx = 0; tx < 8; tx++) {
    for (let ty = 0; ty < 8; ty++) {
      if (Math.random() < 0.38) ctx.fillRect(tx * tSize + 2, ty * tSize + 2, tSize - 4, tSize - 4);
    }
  }

  ctx.strokeStyle = 'rgba(16, 16, 16, 0.65)';
  ctx.lineWidth = 3.0;
  for (let sm = 0; sm < 14; sm++) {
    ctx.beginPath();
    const cx = Math.random() * size; const cy = Math.random() * size; const r = Math.random() * 75 + 25;
    ctx.arc(cx, cy, r, Math.random() * Math.PI, Math.random() * Math.PI * 1.8);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(8, 9, 8, 0.85)';
  ctx.lineWidth = 1.6;
  for (let fc = 0; fc < 4; fc++) {
    ctx.beginPath();
    let px = Math.random() * size; let py = Math.random() * size;
    ctx.moveTo(px, py);
    for (let j = 0; j < 6; j++) {
      px += (Math.random() - 0.5) * 55; py += (Math.random() - 0.5) * 55;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  const centerDampGrad = ctx.createRadialGradient(size/2, size/2, size/3, size/2, size/2, size * 0.72);
  centerDampGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  centerDampGrad.addColorStop(1, 'rgba(10, 8, 6, 0.72)');
  ctx.fillStyle = centerDampGrad;
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const generateCeilingTexture = () => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#222426';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#121314';
  ctx.lineWidth = 5;
  const tSize = size / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * tSize, 0); ctx.lineTo(i * tSize, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * tSize); ctx.lineTo(size, i * tSize); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(8, 8, 8, 0.5)';
  for (let px = 6; px < size; px += 10) {
    for (let py = 6; py < size; py += 10) {
      if (Math.random() < 0.75) ctx.fillRect(px + (Math.random() - 0.5) * 3, py + (Math.random() - 0.5) * 3, 1.6, 1.6);
    }
  }

  ctx.fillStyle = 'rgba(64, 48, 30, 0.25)';
  for (let leak = 0; leak < 5; leak++) {
    const lx = Math.random() * size; const ly = Math.random() * size; const r = Math.random() * 50 + 15;
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(52, 36, 20, 0.18)';
    ctx.beginPath(); ctx.arc(lx, ly, r * 1.6, 0, Math.PI * 2); ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const generateWoodTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#6d4520';
  ctx.fillRect(0, 0, 256, 256);
  
  ctx.strokeStyle = '#3e240f';
  ctx.lineWidth = 2;
  for (let i = 0; i < 256; i += 6) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.bezierCurveTo(80, i + Math.sin(i)*15, 170, i - Math.cos(i)*15, 256, i);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
};