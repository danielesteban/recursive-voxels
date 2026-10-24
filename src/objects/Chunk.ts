import { mat4, vec3 } from 'gl-matrix';
import type { Intersection, Ray } from 'compute/Raycaster';
import type { RecursiveInstances } from 'compute/RecursiveInstances';
import { BlockTexture, ChunkSize } from 'compute/WorldConstants';
import { Sphere } from 'math/Sphere';
import ChunkMaterialCode from 'objects/ChunkMaterial.wgsl';
import { CameraGPUStruct } from 'render/Camera';
import { Geometry } from 'render/Geometry';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';
import LightingCode from 'textures/Lighting.wgsl';

export class Chunk extends Mesh {
  private static readonly VertexLayout: GPUVertexBufferLayout = {
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
        format: 'float32',
      },
    ],
  };

  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Chunk.material) {
      Chunk.material = new Material({
        renderer,
        key: 'ChunkMaterial',
        code: (
          CameraGPUStruct
          + TransformGPUStruct
          + LightingCode
          + ChunkMaterialCode
        ),
        buffers: [
          Chunk.VertexLayout,
          {
            arrayStride: 16,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 5,
                offset: 0,
                format: 'float32x3',
              },
            ]
          },
        ],
      });
    }
    return Chunk.material;
  }

  private static texture?: GPUTexture;
  private static getTexture(renderer: Renderer) {
    if (!Chunk.texture) {
      const numLayers = 3;
      const size = 16;
      const data = new Uint8Array(numLayers * size * size * 4);
      for (let i = 0, layer = 0; layer < numLayers; layer++) {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++, i += 4) {
            let light: number;
            if (y === 0 || y === size - 1 || x === 0 || x === size - 1) {
              light = 255 - Math.floor(Math.random() * 16);
            } else {
              light = 255 - Math.floor(Math.random() * 32);
            }
            switch (layer) {
              case BlockTexture.blockLight:
                data.set([light, light, light, 255], i);
              break;
              case BlockTexture.light:
                data.set([255, 255, 255, 255], i);
              break;
              default:
                data.set([light * 0.25, light * 0.5, light, 255], i);
              break;
            }
          }
        }
      }
      const device = renderer.getDevice();
      const texture = device.createTexture({
        size: [size, size, numLayers],
        format: 'rgba8unorm-srgb',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      });
      device.queue.writeTexture({ texture }, data, { bytesPerRow: size * 4, rowsPerImage: size }, [size, size, numLayers]);
      Chunk.texture = texture;
    }
    return Chunk.texture;
  }

  private static samplers?: { lighting: GPUSampler, texture: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Chunk.samplers) {
      Chunk.samplers = {
        lighting: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        }),
        texture: renderer.getDevice().createSampler({
          magFilter: 'nearest',
          minFilter: 'nearest',
        }),
      };
    }
    return Chunk.samplers;
  }

  private readonly instances: RecursiveInstances;

  constructor(
    renderer: Renderer,
    buffers: { index: Uint16Array; vertices: Float32Array },
    instances: RecursiveInstances,
    position: vec3,
  ) {
    const samplers = Chunk.getSamplers(renderer);
    const geometry = new Geometry(
      renderer,
      buffers,
      Chunk.VertexLayout
    );
    super(
      renderer,
      geometry,
      Chunk.getMaterial(renderer),
      [{
        entries: [
          {
            binding: 0,
            resource: Chunk.getTexture(renderer).createView({ dimension: '2d-array' }),
          },
          {
            binding: 1,
            resource: samplers.texture,
          },
          {
            binding: 2,
            resource: renderer.getTexture('BRDF').createView(),
          },
          {
            binding: 3,
            resource: renderer.getTexture('Irradiance').createView({ dimension: 'cube' }),
          },
          {
            binding: 4,
            resource: renderer.getTexture('Prefiltered').createView({ dimension: 'cube' }),
          },
          {
            binding: 5,
            resource: samplers.lighting,
          },
        ],
      }],
      [
        instances.getInstances().gpu,
      ],
    );
    this.instances = instances;
    this.position = vec3.scale(vec3.create(), position, ChunkSize);
    this.frustumCulled = false;
  }

  override destroy() {
    this.getGeometry().destroy();
    super.destroy();
  }

  override get instanceCount() {
    return this.instances.getInstances().count;
  }

  private static aux1 = new Sphere();
  private static aux2 = mat4.create();
  override async raycast(ray: Ray, intersections: Intersection[]) {
    const { instances } = this;
    const { aux1: instanceBounds, aux2: instanceTransform } = Chunk;
    const bounds = this.getBounds();
    const transform = this.getTransform();
    for (let i = 0; i < instances.getInstances().count; i++) {
      mat4.fromTranslation(instanceTransform, instances.getInstances().cpu.subarray(i * 4, i * 4 + 3));
      instanceBounds.copy(bounds).applyMatrix(instanceTransform);
      mat4.multiply(instanceTransform, instanceTransform, transform.cpu.matrix);
      const intersection = ray.intersectGeometry(instanceBounds, this.getGeometry(), instanceTransform);
      if (intersection) {
        intersections.push({
          ...intersection,
          obj: this,
        });
      }
    }
  }
}
