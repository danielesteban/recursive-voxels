import { vec3 } from 'gl-matrix';
import { Box } from 'math/Box';
import { Sphere } from 'math/Sphere';
import type { Renderer } from 'render/Renderer';

type GeometryBuffers = { index: Uint16Array; vertices: Float32Array };

export class Geometry {
  static readonly DefaultVertexLayout: GPUVertexBufferLayout = {
    arrayStride: 32,
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
    ],
  };

  private readonly buffers: GeometryBuffers;
  private readonly vertexLayout: GPUVertexBufferLayout;

  private readonly bounds = new Sphere();
  private readonly index: GPUBuffer;
  private readonly indexCount: number;
  private readonly triangles: Readonly<{ [Symbol.iterator](): Generator<[vec3, vec3, vec3]> }>;
  private readonly vertices: GPUBuffer;

  private static readonly aux1 = new Box();
  private static readonly aux2 = vec3.create();
  constructor(renderer: Renderer, buffers: GeometryBuffers, vertexLayout = Geometry.DefaultVertexLayout) {
    const device = renderer.getDevice();
  
    this.buffers = buffers;
    this.vertexLayout = vertexLayout;

    this.index = device.createBuffer({
      size: buffers.index.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint16Array(this.index.getMappedRange()).set(buffers.index);
    this.index.unmap();
    this.indexCount = buffers.index.length;
  
    this.vertices = device.createBuffer({
      size: buffers.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertices.getMappedRange()).set(buffers.vertices);
    this.vertices.unmap();

    const vertexStride = vertexLayout.arrayStride / 4;

    this.triangles = {
      [Symbol.iterator]() {
        return Geometry.trianglesIterator(buffers, vertexStride);
      },
    };

    const { aux1: box, aux2: aux } = Geometry;
    box.makeEmpty();
    for (let i = 0, l = buffers.vertices.length; i < l; i += vertexStride) {
      box.expandByPoint(vec3.set(aux, buffers.vertices[i], buffers.vertices[i + 1], buffers.vertices[i + 2]));
    }
    box.getCenter(this.bounds.center);
    let maxRadiusSq = 0;
    for (let i = 0, l = buffers.vertices.length; i < l; i += vertexStride) {
      maxRadiusSq = Math.max(maxRadiusSq, vec3.sqrDist(this.bounds.center, vec3.set(aux, buffers.vertices[i], buffers.vertices[i + 1], buffers.vertices[i + 2])));
    }
    this.bounds.radius = Math.sqrt(maxRadiusSq);
  }

  destroy() {
    const { index, vertices } = this;
    index.destroy();
    vertices.destroy();
  }

  getBounds() {
    return this.bounds;
  }

  getIndex() {
    return this.index;
  }

  getIndexCount() {
    return this.indexCount;
  }

  private static readonly aux3: { position: [vec3, vec3, vec3], normal: [vec3, vec3, vec3] } = {
    position: [vec3.create(), vec3.create(), vec3.create()],
    normal: [vec3.create(), vec3.create(), vec3.create()],
  };
  getTriangle(index: number) {
    const { buffers, vertexLayout } = this;
    const { aux3: triangle } = Geometry;
    const vertexStride = vertexLayout.arrayStride / 4;
    for (let t = 0; t < 3; t++) {
      const offset = buffers.index[index * 3 + t] * vertexStride;
      vec3.set(
        triangle.position[t],
        buffers.vertices[offset],
        buffers.vertices[offset + 1],
        buffers.vertices[offset + 2]
      );
      vec3.set(
        triangle.normal[t],
        buffers.vertices[offset + 3],
        buffers.vertices[offset + 4],
        buffers.vertices[offset + 5]
      );
    }
    return triangle;
  }

  getTriangles() {
    return this.triangles;
  }

  getVertices() {
    return this.vertices;
  }

  private static readonly aux4: [vec3, vec3, vec3] = [vec3.create(), vec3.create(), vec3.create()];
  private static *trianglesIterator(buffers: GeometryBuffers, vertexStride: number) {
    const { aux4: triangle } = Geometry;
    for (let i = 0, l = buffers.index.length; i < l; i += 3) {
      for (let t = 0; t < 3; t++) {
        const offset = buffers.index[i + t] * vertexStride;
        vec3.set(
          triangle[t],
          buffers.vertices[offset],
          buffers.vertices[offset + 1],
          buffers.vertices[offset + 2]
        );
      }
      yield triangle;
    }
  };
}
