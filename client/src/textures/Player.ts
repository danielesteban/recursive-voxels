export const Player = (
  device: GPUDevice,
) => {
  const numLayers = 3;
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const faceTextures: Uint8ClampedArray[] = [];
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 2; i++) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.fillStyle = '#fff';
    [8, 24].forEach((x) => {
      ctx.save();
      ctx.translate(x, 9);
      ctx.scale(1, i === 1 ? 0.25 : 1);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.translate(16, 19);
    ctx.scale(1, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
    faceTextures[i] = ctx.getImageData(0, 0, size, size).data;
  }
  const data = new Uint8Array(numLayers * size * size * 4);
  for (let i = 0, layer = 0; layer < numLayers; layer++) {
    for (let p = 0, y = 0; y < size; y++) {
      for (let x = 0; x < size; x++, i += 4, p += 4) {
        switch (layer) {
          case 1:
          case 2:
            data.set(faceTextures[layer - 1].subarray(p, p + 4), i);
            break;
          default: {
            let light: number;
            if (y === 0 || y === size - 1 || x === 0 || x === size - 1) {
              light = 255 - Math.floor(Math.random() * 16);
            } else {
              light = 255 - Math.floor(Math.random() * 32);
            }
            data.set([light, light, light, 255], i);
            break;
          }
        }
      }
    }
  }
  const texture = device.createTexture({
    size: [size, size, numLayers],
    format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  device.queue.writeTexture({ texture }, data, { bytesPerRow: size * 4, rowsPerImage: size }, [size, size, numLayers]);
  return texture;
};
