import { vec3 } from 'gl-matrix';
import { ChunkSize } from '@shared/WorldConstants';
import type { Renderer } from 'render/Renderer';

export class VoxelLightmap {
  private readonly data: GPUTexture;
  private readonly size: GPUBuffer;
  private readonly renderer: Renderer;

  constructor(renderer: Renderer, size: vec3) {
    const device = renderer.getDevice();
    this.data = device.createTexture({
      dimension: '3d',
      size: [size[0], size[1], size[2]],
      format: 'r8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.size = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    new Float32Array(this.size.getMappedRange()).set([size[0], size[1], size[2]]);
    this.size.unmap();
    this.renderer = renderer;
  }

  destroy() {
    const { data, size } = this;
    data.destroy();
    size.destroy();
  }

  getData() {
    return this.data;
  }

  getSize() {
    return this.size;
  }

  private static readonly aux1 = vec3.create();
  update(chunk: vec3, lightmap: Uint8Array) {
    const { data, renderer } = this;
    const { aux1: origin } = VoxelLightmap;
    vec3.scale(origin, chunk, ChunkSize);
    const device = renderer.getDevice();
    device.queue.writeTexture(
      { texture: data, origin: [origin[0], origin[1], origin[2]] },
      lightmap,
      { bytesPerRow: ChunkSize, rowsPerImage: ChunkSize },
      [ChunkSize, ChunkSize, ChunkSize]
    );
  }
}
