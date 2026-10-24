import PaletteMaterialCode from 'objects/PaletteMaterial.wgsl';
import { CameraGPUStruct } from 'render/Camera';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';
import LightingCode from 'textures/Lighting.wgsl';

export class Palette extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Palette.material) {
      Palette.material = new Material({
        renderer,
        key: 'PaletteMaterial',
        code: (
          CameraGPUStruct
          + TransformGPUStruct
          + LightingCode
          + PaletteMaterialCode
        ),
      });
    }
    return Palette.material;
  }

  private static samplers?: { lighting: GPUSampler; texture: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Palette.samplers) {
      Palette.samplers = {
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
    return Palette.samplers;
  }

  constructor(renderer: Renderer) {
    const samplers = Palette.getSamplers(renderer);
    super(
      renderer,
      renderer.getDefaultGeometry('Plane'),
      Palette.getMaterial(renderer),
      [{
        entries: [
          {
            binding: 0,
            resource: renderer.getTexture('Palette').createView({ dimension: '2d-array' }),
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
    );
    this.renderOrder = 2;
    this.visible = false;
  }
}
