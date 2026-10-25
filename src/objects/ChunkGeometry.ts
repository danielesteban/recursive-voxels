import { type GeometryBuffers, Geometry } from 'render/Geometry';
import type { Renderer } from 'render/Renderer';

export class ChunkGeometry extends Geometry {
  static readonly VertexLayout: GPUVertexBufferLayout = {
    arrayStride: 40,
    attributes: [
      {
        shaderLocation: 0,
        offset: 0,
        format: 'float32x3',
      },
      {
        shaderLocation: 1,
        offset: 12,
        format: 'float32x3',
      },
      {
        shaderLocation: 2,
        offset: 24,
        format: 'float32x2',
      },
      {
        shaderLocation: 3,
        offset: 32,
        format: 'float32',
      },
      {
        shaderLocation: 4,
        offset: 36,
        format: 'uint32',
      },
    ],
  };

  constructor(renderer: Renderer, buffers: GeometryBuffers) {
    super(renderer, buffers, ChunkGeometry.VertexLayout);
  }

  getInfo(triangle: number) {
    const { buffers, vertexLayout } = this;
    const vertexStride = vertexLayout.arrayStride / 4;
    const offset = ((buffers.index[triangle * 3] * vertexStride) + 9) * 4;
    const info = new Uint32Array(buffers.vertices.buffer, offset, 1)[0];
    return {
      blockType: (info >> 16) & 0xFF,
      color: (info >> 8) & 0xFF,
      texture: info & 0xFF,
    };
  }
}
