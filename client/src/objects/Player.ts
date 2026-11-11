import { mat4, quat, vec3 } from 'gl-matrix';
import type { RecursiveInstances } from 'compute/RecursiveInstances';
import type { VoxelLightmap } from 'compute/VoxelLightmap';
import PlayerMaterialCode from 'objects/PlayerMaterial.wgsl';
import { Camera, CameraGPUStruct } from 'render/Camera';
import { Geometry } from 'render/Geometry';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import { Box } from 'render/Primitives';
import type { Renderer } from 'render/Renderer';
import LightingCode from 'textures/Lighting.wgsl';
import { Player as PlayerTexture } from 'textures/Player';

export class Player extends Mesh {
  static readonly VertexLayout: GPUVertexBufferLayout = {
    arrayStride: 36,
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
        format: 'uint32',
      },
    ],
  };

  private static geometry?: Geometry;
  private static getGeometry(renderer: Renderer) {
    if (!Player.geometry) {
      const vertices = new ArrayBuffer((Box.vertices.length / 8) * 9 * 4);
      for (let i = 0, l = Box.vertices.length / 8; i < l; i++) {
        new Float32Array(vertices, i * 9 * 4, 8).set(Box.vertices.subarray(i * 8, (i + 1) * 8));
        new Uint32Array(vertices, (i * 9 + 8) * 4, 1)[0] = Math.floor(i / 4) === 5 ? 1 : 0;
      }
      Player.geometry = new Geometry(renderer, {
        index: Box.index,
        vertices: new Float32Array(vertices),
      }, Player.VertexLayout);
    }
    return Player.geometry;
  }

  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Player.material) {
      Player.material = new Material({
        renderer,
        key: 'PlayerMaterial',
        code: (
          CameraGPUStruct
          + TransformGPUStruct
          + LightingCode
          + PlayerMaterialCode
        ),
        buffers: [
          Player.VertexLayout,
          {
            arrayStride: 16,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 4,
                offset: 0,
                format: 'float32x3',
              },
            ]
          },
        ],
      });
    }
    return Player.material;
  }

  private static samplers?: { lighting: GPUSampler; lightmap: GPUSampler; texture: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Player.samplers) {
      Player.samplers = {
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
        texture: renderer.getDevice().createSampler({
          magFilter: 'nearest',
          minFilter: 'nearest',
        }),
      };
    }
    return Player.samplers;
  }

  private static texture?: GPUTexture;
  private static getTexture(renderer: Renderer) {
    if (!Player.texture) {
      Player.texture = PlayerTexture(renderer.getDevice());
    }
    return Player.texture;
  }

  private readonly instances: RecursiveInstances;
  private readonly _direction = vec3.create();
  private readonly targetTransform: {
    position: vec3;
    direction: vec3;
  };

  constructor(
    renderer: Renderer,
    instances: RecursiveInstances,
    lightmap: VoxelLightmap,
    position: vec3,
    direction: vec3
  ) {
    const samplers = Player.getSamplers(renderer);
    super(
      renderer,
      Player.getGeometry(renderer),
      Player.getMaterial(renderer),
      [{
        entries: [
          {
            binding: 0,
            resource: Player.getTexture(renderer).createView({ dimension: '2d-array' }),
          },
          {
            binding: 1,
            resource: samplers.texture,
          },
          {
            binding: 2,
            resource: lightmap.getData(),
          },
          {
            binding: 3,
            resource: samplers.lightmap,
          },
          {
            binding: 4,
            resource: lightmap.getSize(),
          },
          {
            binding: 5,
            resource: renderer.getTexture('BRDF').createView(),
          },
          {
            binding: 6,
            resource: renderer.getTexture('Irradiance').createView({ dimension: 'cube' }),
          },
          {
            binding: 7,
            resource: renderer.getTexture('Prefiltered').createView({ dimension: 'cube' }),
          },
          {
            binding: 8,
            resource: samplers.lighting,
          },
        ],
      }],
    );
    this.instances = instances;
    this.targetTransform = { position, direction };
    this.frustumCulled = false;
    this.renderOrder = 1;
    this.position = position;
    this.direction = direction;
  }

  get direction(): Readonly<vec3> {
    return this._direction;
  }

  private static readonly aux1 = quat.create();
  private static readonly aux2 = mat4.create();
  private static readonly aux3 = vec3.create();
  private static readonly aux4 = vec3.create();
  private static readonly aux5 = vec3.create();
  set direction(value: vec3) {
    const { aux1: rotation, aux2: matrix, aux3: eye, aux4: translation, aux5: scale } = Player;
    vec3.copy(this._direction, value);
    mat4.targetTo(matrix, eye, value, Camera.up);
    mat4.decompose(rotation, translation, scale, matrix);
    this.rotation = rotation;
  }

  private static readonly aux6 = vec3.create();
  override animate(delta: number, time: number) {
    const { position, direction, targetTransform } = this;
    const { aux6: aux } = Player;
    const damp = Math.exp(-20 * delta);
    if (!vec3.equals(position, targetTransform.position)) {
      this.position = vec3.lerp(aux, position, targetTransform.position, damp);
    }
    if (!vec3.equals(direction, targetTransform.direction)) {
      // @dani @incomplete
      // This should prolly be a slerp
      // But I dunno why I get NaN values if I do that
      this.direction = vec3.lerp(aux, direction, targetTransform.direction, damp);
    }
    super.animate(delta, time);
  }

  override get instanceCount() {
    return this.instances.getInstances().count;
  }

  update(position: vec3, direction: vec3) {
    const { targetTransform } = this;
    vec3.copy(targetTransform.position, position);
    vec3.copy(targetTransform.direction, direction);
  }
}
