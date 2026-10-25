import PostprocessingBlurCode from 'render/PostprocessingBlur.wgsl';
import PostprocessingCompositeCode from 'render/PostprocessingComposite.wgsl';
import PostprocessingEdgeCode from 'render/PostprocessingEdge.wgsl';
import PostprocessingLuminanceCode from 'render/PostprocessingLuminance.wgsl';
import PostprocessingVertexCode from 'render/PostprocessingVertex.wgsl';
import type { Renderer } from 'render/Renderer';

export class Postprocessing {
  private readonly renderer: Renderer;
  private passes: {
    bindings: GPUBindGroup;
    pipeline: GPURenderPipeline;
    texture?: GPUTextureView;
  }[] = null!;
  private readonly pipelines: {
    blur: GPURenderPipeline;
    composite: GPURenderPipeline;
    edge: GPURenderPipeline;
    luminance: GPURenderPipeline;
  };
  private readonly samplers: {
    texture: GPUSampler;
  };
  private readonly textures: {
    blurA: GPUTexture;
    blurB: GPUTexture;
    edgeOutput: GPUTexture;
    inputColor: GPUTexture;
    inputData: GPUTexture;
    inputLuminance: GPUTexture;
  } = {
    blurA: null!,
    blurB: null!,
    edgeOutput: null!,
    inputColor: null!,
    inputData: null!,
    inputLuminance: null!,
  };
  private readonly uniforms: {
    blurDirectionH: GPUBuffer;
    blurDirectionV: GPUBuffer;
    resolution: GPUBuffer;
  };

  constructor(renderer: Renderer) {
    const device = renderer.getDevice();
    this.renderer = renderer;
    const vertex = device.createShaderModule({
      code: PostprocessingVertexCode,
    });
    this.pipelines = {
      blur: renderer.getRenderPipeline('PostprocessingBlur', () => {
        const module = device.createShaderModule({
          code: PostprocessingBlurCode,
        });
        return device.createRenderPipeline({
          label: 'PostprocessingBlur',
          layout: 'auto',
          vertex: {
            module: vertex,
          },
          fragment: {
            module,
            targets: [{ format: renderer.getDataFormat() }],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });
      }),
      composite: renderer.getRenderPipeline('PostprocessingComposite', () => {
        const module = device.createShaderModule({
          code: PostprocessingCompositeCode,
        });
        return device.createRenderPipeline({
          label: 'PostprocessingComposite',
          layout: 'auto',
          vertex: {
            module: vertex,
          },
          fragment: {
            module,
            targets: [{ format: renderer.getColorFormat() }],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });
      }),
      edge: renderer.getRenderPipeline('PostprocessingEdge', () => {
        const module = device.createShaderModule({
          code: PostprocessingEdgeCode,
        });
        return device.createRenderPipeline({
          label: 'PostprocessingEdge',
          layout: 'auto',
          vertex: {
            module: vertex,
          },
          fragment: {
            module,
            targets: [{ format: renderer.getDataFormat() }],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });
      }),
      luminance: renderer.getRenderPipeline('PostprocessingLuminance', () => {
        const module = device.createShaderModule({
          code: PostprocessingLuminanceCode,
        });
        return device.createRenderPipeline({
          label: 'PostprocessingLuminance',
          layout: 'auto',
          vertex: {
            module: vertex,
          },
          fragment: {
            module,
            targets: [{ format: renderer.getDataFormat() }],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });
      }),
    };
    this.samplers = {
      texture: renderer.getDevice().createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      }),
    };
    this.uniforms = {
      blurDirectionH: device.createBuffer({
        size: 2 * 4,
        usage: GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
      }),
      blurDirectionV: device.createBuffer({
        size: 2 * 4,
        usage: GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
      }),
      resolution: device.createBuffer({
        size: 2 * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      }),
    };
    new Float32Array(this.uniforms.blurDirectionH.getMappedRange()).set([1, 0]);
    this.uniforms.blurDirectionH.unmap();
    new Float32Array(this.uniforms.blurDirectionV.getMappedRange()).set([0, 1]);
    this.uniforms.blurDirectionV.unmap();
  }

  getInput() {
    const { textures } = this;
    return {
      color: textures.inputColor,
      data: textures.inputData,
      luminance: textures.inputLuminance,
    };
  }

  setSize(width: number, height: number, scale: number, pixelRatio: number) {
    const { renderer, pipelines, samplers, textures, uniforms } = this;
    const device = renderer.getDevice();
    for (const texture in textures) {
      if (textures[texture as (keyof typeof textures)]) {
        textures[texture as (keyof typeof textures)].destroy();
      }
      textures[texture as (keyof typeof textures)] = device.createTexture({
        size: [width * scale, height * scale],
        format: texture === 'inputLuminance' ? renderer.getLuminanceFormat() : renderer.getDataFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
    }
    this.passes = [
      {
        bindings: device.createBindGroup({
          layout: pipelines.luminance.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: textures.inputColor.createView(),
            },
            {
              binding: 1,
              resource: textures.inputLuminance.createView(),
            },
            {
              binding: 2,
              resource: samplers.texture,
            },
          ],
        }),
        pipeline: pipelines.luminance,
        texture: textures.blurA,
      },
      {
        bindings: device.createBindGroup({
          layout: pipelines.blur.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: textures.blurA.createView(),
            },
            {
              binding: 1,
              resource: samplers.texture,
            },
            {
              binding: 2,
              resource: uniforms.blurDirectionH,
            },
            {
              binding: 3,
              resource: uniforms.resolution,
            },
          ],
        }),
        pipeline: pipelines.blur,
        texture: textures.blurB,
      },
      {
        bindings: device.createBindGroup({
          layout: pipelines.blur.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: textures.blurB.createView(),
            },
            {
              binding: 1,
              resource: samplers.texture,
            },
            {
              binding: 2,
              resource: uniforms.blurDirectionV,
            },
            {
              binding: 3,
              resource: uniforms.resolution,
            },
          ],
        }),
        pipeline: pipelines.blur,
        texture: textures.blurA,
      },
      {
        bindings: device.createBindGroup({
          layout: pipelines.edge.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: textures.inputColor.createView(),
            },
            {
              binding: 1,
              resource: textures.blurA.createView(),
            },
            {
              binding: 2,
              resource: textures.inputData.createView(),
            },
            {
              binding: 3,
              resource: samplers.texture,
            },
            {
              binding: 4,
              resource: uniforms.resolution,
            },
          ],
        }),
        pipeline: pipelines.edge,
        texture: textures.edgeOutput.createView(),
      },
      {
        bindings: device.createBindGroup({
          layout: pipelines.composite.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: textures.edgeOutput.createView(),
            },
            {
              binding: 1,
              resource: samplers.texture,
            },
            {
              binding: 2,
              resource: uniforms.resolution,
            },
          ],
        }),
        pipeline: pipelines.composite,
      },
    ];
    device.queue.writeBuffer(uniforms.resolution, 0, new Float32Array([width / pixelRatio, height / pixelRatio]));
    return this;
  }

  render(command: GPUCommandEncoder, output: GPUTextureView) {
    const { passes } = this;
    for (const { bindings, pipeline, texture } of passes) {
      const pass = command.beginRenderPass({
        colorAttachments: [
          {
            view: texture || output,
            clearValue: [0, 0, 0, 0],
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings);
      pass.draw(6);
      pass.end();
    }
  }
}
