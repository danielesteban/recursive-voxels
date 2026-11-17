import type { RecursiveInstances } from 'compute/RecursiveInstances';
import type { VoxelLightmap } from 'compute/VoxelLightmap';
import BallMaterialCode from 'objects/BallMaterial.wgsl';
import { CameraGPUStruct } from 'render/Camera';
import { Geometry } from 'render/Geometry';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';
import LightingCode from 'textures/Lighting.wgsl';

export class Ball extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Ball.material) {
      Ball.material = new Material({
        renderer,
        key: 'BallMaterial',
        code: (
          CameraGPUStruct
          + TransformGPUStruct
          + LightingCode
          + BallMaterialCode
        ),
        buffers: [
          Geometry.DefaultVertexLayout,
          {
            arrayStride: 16,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 3,
                offset: 0,
                format: 'float32x3',
              },
            ]
          },
        ],
      });
    }
    return Ball.material;
  }

  private static samplers?: { lighting: GPUSampler; lightmap: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Ball.samplers) {
      Ball.samplers = {
        lighting: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        }),
        lightmap: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeU: 'repeat',
          addressModeV: 'repeat',
          addressModeW: 'repeat',
        }),
      };
    }
    return Ball.samplers;
  }

  private readonly color: GPUBuffer;
  private readonly instances: RecursiveInstances;

  constructor(renderer: Renderer, instances: RecursiveInstances, lightmap: VoxelLightmap) {
    const device = renderer.getDevice();
    const samplers = Ball.getSamplers(renderer);
    const color = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    new Float32Array(color.getMappedRange()).set([Math.random(), Math.random(), Math.random()]);
    color.unmap();
    super(
      renderer,
      renderer.getDefaultGeometry('Sphere'),
      Ball.getMaterial(renderer),
      [{
        entries: [
          {
            binding: 0,
            resource: color,
          },
          {
            binding: 1,
            resource: lightmap.getData(),
          },
          {
            binding: 2,
            resource: samplers.lightmap,
          },
          {
            binding: 3,
            resource: lightmap.getSize(),
          },
          {
            binding: 4,
            resource: renderer.getTexture('BRDF').createView(),
          },
          {
            binding: 5,
            resource: renderer.getTexture('Irradiance').createView({ dimension: 'cube' }),
          },
          {
            binding: 6,
            resource: renderer.getTexture('Prefiltered').createView({ dimension: 'cube' }),
          },
          {
            binding: 7,
            resource: samplers.lighting,
          },
        ],
      }]
    );
    this.color = color;
    this.instances = instances;
    this.frustumCulled = false;
    this.renderOrder = 1;
  }

  override destroy() {
    const { color } = this;
    color.destroy();
    super.destroy();
  }
  
  override get buffers() {
    return [this.instances.getInstances().gpu];
  }

  override get instanceCount() {
    return this.instances.getInstances().count;
  }
}
