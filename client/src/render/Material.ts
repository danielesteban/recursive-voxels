import { Geometry } from 'render/Geometry';
import type { Renderer } from 'render/Renderer';

export class Material {
  private readonly pipeline: GPURenderPipeline;

  constructor({
    renderer,
    key,
    code,
    blend,
    buffers = [Geometry.DefaultVertexLayout],
    cullMode = 'back',
    depthTest = true,
    depthWrite = true,
    multisample = true,
    outputColor = true,
    outputData = true,
    outputDepth = true,
    outputLuminance = true,
  }: {
    renderer: Renderer;
    key: string;
    code: string;
    blend?: GPUBlendState;
    buffers?: GPUVertexBufferLayout[];
    cullMode?: GPUCullMode;
    depthTest?: boolean;
    depthWrite?: boolean;
    instanceCount?: number;
    multisample?: boolean;
    outputColor?: boolean;
    outputData?: boolean;
    outputDepth?: boolean;
    outputLuminance?: boolean;
  }) {
    this.pipeline = renderer.getRenderPipeline(key, () => {
      const device = renderer.getDevice();
      const module = device.createShaderModule({ code });
      return device.createRenderPipeline({
        label: key,
        layout: 'auto',
        vertex: {
          module,
          buffers,
        },
        fragment: {
          module,
          targets: [
            ...(outputColor ? [{
              blend,
              format: renderer.getDataFormat(),
            }] : []),
            ...(outputData ? [{
              format: renderer.getDataFormat(),
            }] : []),
            ...(outputLuminance ? [{
              format: renderer.getLuminanceFormat(),
            }] : []),
          ],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode,
        },
        ...(outputDepth ? {
          depthStencil: {
            depthWriteEnabled: depthWrite,
            depthCompare: depthTest ? 'less' : 'always',
            format: renderer.getDepthFormat(),
          },
        } : {}),
        ...(multisample ? {
          multisample: {
            count: renderer.getSampleCount(),
          },
        } : {}),
      });
    });
  }

  getPipeline() {
    return this.pipeline;
  }

  render(
    pass: GPURenderPassEncoder,
    bindings: GPUBindGroup[],
    buffers: GPUBuffer[],
    geometry: Geometry,
    instanceCount: number
  ) {
    const { pipeline } = this;
    pass.setPipeline(pipeline);
    for (let i = 0, l = bindings.length; i < l; i++) {
      pass.setBindGroup(i, bindings[i]);
    }
    pass.setIndexBuffer(geometry.getIndex(), 'uint16');
    pass.setVertexBuffer(0, geometry.getVertices());
    for (let i = 0, l = buffers.length; i < l; i++) {
      pass.setVertexBuffer(i + 1, buffers[i]);
    }
    pass.drawIndexed(geometry.getIndexCount(), instanceCount);
  }
}
