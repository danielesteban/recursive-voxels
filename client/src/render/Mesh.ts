import { mat3, mat4, quat, vec3 } from 'gl-matrix';
import type { Intersection, Ray } from 'compute/Raycaster';
import { Sphere } from 'math/Sphere';
import type { Geometry } from 'render/Geometry';
import type { Material } from 'render/Material';
import type { Renderer } from 'render/Renderer';

export class Mesh<GeometryType extends Geometry = Geometry, MaterialType extends Material = Material> {
  protected readonly renderer: Renderer;
  private readonly bindings: GPUBindGroup[];
  private readonly buffers: GPUBuffer[];
  private readonly geometry: GeometryType;
  private readonly material: MaterialType;
  
  private readonly bounds = new Sphere();
  private boundsNeedsUpdate = true;

  private readonly transform: {
    cpu: {
      matrix: mat4;
      inverse: mat4;
      normal: mat3;
      needsUpdate: boolean;
    },
    gpu: {
      buffer: GPUBuffer;
      needsUpdate: boolean;
    },
  };

  private readonly _position = vec3.fromValues(0, 0, 0);
  private readonly _rotation = quat.fromValues(0, 0, 0, 1);
  private readonly _scale = vec3.fromValues(1, 1, 1);
  private _instanceCount = 1;

  frustumCulled = true;
  renderOrder = 0;
  visible = true;

  constructor(
    renderer: Renderer,
    geometry: GeometryType,
    material: MaterialType,
    bindings: Omit<GPUBindGroupDescriptor, 'layout'>[] = [],
    buffers: GPUBuffer[] = [],
  ) {
    const device = renderer.getDevice();
    this.renderer = renderer;
    this.material = material;
    this.geometry = geometry;
    this.transform = {
      cpu: {
        matrix: mat4.create(),
        inverse: mat4.create(),
        normal: mat3.create(),
        needsUpdate: true,
      },
      gpu: {
        buffer: device.createBuffer({
          size: 16 * 3 * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        }),
        needsUpdate: true,
      },
    };
    // @dani @incomplete
    // This prolly belongs in Material
    this.bindings = [
      device.createBindGroup({
        layout: material.getPipeline().getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: renderer.getCamera().getBuffer(),
          },
          {
            binding: 1,
            resource: this.transform.gpu,
          },
        ],
      }),
      ...bindings.map((binding, i) => (
        device.createBindGroup({
          layout: material.getPipeline().getBindGroupLayout(i + 1),
          ...binding,
        })
      )),
    ];
    this.buffers = buffers;
  }

  destroy() {
    const { transform } = this;
    transform.gpu.buffer.destroy();
  }

  get position(): Readonly<vec3> {
    return this._position;
  }

  set position(value: vec3) {
    vec3.copy(this._position, value);
    this.transform.cpu.needsUpdate = true;
  }

  get rotation(): Readonly<quat> {
    return this._rotation;
  }

  set rotation(value: quat) {
    quat.copy(this._rotation, value);
    this.transform.cpu.needsUpdate = true;
  }

  get scale(): Readonly<vec3> {
    return this._scale;
  }

  set scale(value: vec3) {
    vec3.copy(this._scale, value);
    this.transform.cpu.needsUpdate = true;
  }

  get instanceCount() {
    return this._instanceCount;
  }

  set instanceCount(value: number) {
    this._instanceCount = value;
  }

  getBounds() {
    const { geometry, bounds } = this;
    const transform = this.getTransform();
    if (this.boundsNeedsUpdate) {
      bounds.copy(geometry.getBounds()).applyMatrix(transform.cpu.matrix);
      this.boundsNeedsUpdate = false;
    }
    return bounds;
  }

  getGeometry() {
    return this.geometry;
  }

  getMaterial() {
    return this.material;
  }

  getTransform() {
    const { transform, position, rotation, scale } = this;
    if (transform.cpu.needsUpdate) {
      mat4.fromRotationTranslationScale(transform.cpu.matrix, rotation, position, scale);
      mat4.invert(transform.cpu.inverse, transform.cpu.matrix);
      mat3.normalFromMat4(transform.cpu.normal, transform.cpu.matrix);
      transform.cpu.needsUpdate = false;
      transform.gpu.needsUpdate = true;
      this.boundsNeedsUpdate = true;
    }
    return transform;
  }

  raycast(ray: Ray, intersections: Intersection[]) {
    const { geometry } = this;
    const bounds = this.getBounds();
    const transform = this.getTransform();
    const intersection = ray.intersectGeometry(bounds, geometry, transform.cpu.matrix);
    if (intersection) {
      intersections.push({
        ...intersection,
        obj: this,
      });
    }
  }

  animate(_delta: number, _time: number) {
    const { renderer } = this;
    const transform = this.getTransform();
    if (transform.gpu.needsUpdate) {
      renderer.getDevice().queue.writeBuffer(transform.gpu.buffer, 0, new Float32Array([
        ...transform.cpu.matrix,
        ...transform.cpu.inverse,
        ...(transform.cpu.normal as Float32Array).subarray(0, 3), 0,
        ...(transform.cpu.normal as Float32Array).subarray(3, 6), 0,
        ...(transform.cpu.normal as Float32Array).subarray(6, 9), 0,
      ]));
      transform.gpu.needsUpdate = false;
    }
  }

  render(pass: GPURenderPassEncoder) {
    const { bindings, buffers, geometry, instanceCount, material, visible } = this;
    if (!visible) return;
    material.render(pass, bindings, buffers, geometry, instanceCount);
  }
}

export const TransformGPUStruct = /* wgsl */`
struct Transform {
  matrix: mat4x4<f32>,
  inverse: mat4x4<f32>,
  normal: mat3x3<f32>,
}
`;
