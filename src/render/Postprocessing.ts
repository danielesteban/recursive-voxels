import PostprocessingCode from 'render/Postprocessing.wgsl';
import type { Renderer } from 'render/Renderer';

export class Postprocessing {
  private bindings: GPUBindGroup = null!;
  private readonly renderer: Renderer;
  private readonly pipeline: GPURenderPipeline;
  private readonly resolution: GPUBuffer;
  private readonly samplers: { texture: GPUSampler };
  private readonly textures: {
    inputColor: GPUTexture;
    inputData: GPUTexture;
  } = {
    inputColor: null!,
    inputData: null!,
  };

  constructor(renderer: Renderer) {
    const device = renderer.getDevice();
    this.renderer = renderer;
    this.pipeline = renderer.getRenderPipeline('Postprocessing', () => {
      const module = device.createShaderModule({
        code: PostprocessingCode,
      });
      return device.createRenderPipeline({
        label: 'Postprocessing',
        layout: 'auto',
        vertex: {
          module,
        },
        fragment: {
          module,
          targets: [{ format: renderer.getColorFormat() }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
    });
    this.resolution = device.createBuffer({
      size: 2 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.samplers = {
      texture: renderer.getDevice().createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      }),
    };
  }

  getInput() {
    const { textures } = this;
    return {
      color: textures.inputColor,
      data: textures.inputData,
    };
  }

  setSize(width: number, height: number, scale: number, pixelRatio: number) {
    const { renderer, pipeline, resolution, samplers, textures } = this;
    const device = renderer.getDevice();
    for (const texture of ['inputColor', 'inputData'] as (keyof typeof textures)[]) {
      if (textures[texture]) {
        textures[texture].destroy();
      }
      textures[texture] = device.createTexture({
        size: [width * scale, height * scale],
        format: renderer.getDataFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
    }
    this.bindings = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: textures.inputColor.createView(),
        },
        {
          binding: 1,
          resource: textures.inputData.createView(),
        },
        {
          binding: 2,
          resource: samplers.texture,
        },
        {
          binding: 3,
          resource: resolution,
        },
      ],
    });
    device.queue.writeBuffer(resolution, 0, new Float32Array([width / pixelRatio, height / pixelRatio]));
    return this;
  }

  render(command: GPUCommandEncoder, output: GPUTextureView) {
    const { bindings, pipeline } = this;
    const pass = command.beginRenderPass({
      colorAttachments: [
        {
          view: output,
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
