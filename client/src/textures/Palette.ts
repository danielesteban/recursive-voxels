import Colors from 'textures/Palette.txt?raw';

export const Palette = (
  device: GPUDevice,
) => {
  const colors = Colors.split('\n');
  const numColors = colors.length;
  const data = new Uint8Array(numColors * 4);
  for (let i = 0; i < numColors; i++) {
    const color = parseInt(`0x${colors[i]}`, 16);
    data.set([(color >> 16) & 0xFF, (color >> 8) & 0xFF, color & 0xFF, 255], i * 4);
  }
  const texture = device.createTexture({
    size: [1, 1, numColors],
    format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  device.queue.writeTexture({ texture }, data, { bytesPerRow: 4, rowsPerImage: 1 }, [1, 1, numColors]);
  return texture;
};
