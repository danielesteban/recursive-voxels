@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;
@group(1) @binding(0) var playerTexture: texture_2d_array<f32>;
@group(1) @binding(1) var textureSampler: sampler;
@group(1) @binding(2) var lightmapTexture: texture_3d<f32>;
@group(1) @binding(3) var lightmapSampler: sampler;
@group(1) @binding(4) var<uniform> lightmapSize: vec3f;
@group(1) @binding(5) var brdfTexture: texture_2d<f32>;
@group(1) @binding(6) var irradianceTexture: texture_cube<f32>;
@group(1) @binding(7) var prefilteredTexture: texture_cube<f32>;
@group(1) @binding(8) var lightingSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) texture: u32,
  @location(4) instance: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) texture: u32,
  @location(1) uv: vec2f,
  @location(2) normal: vec3f,
  @location(3) worldPos: vec3f,
}

struct FragmentInput {
  @location(0) @interpolate(flat) texture: u32,
  @location(1) uv: vec2f,
  @location(2) normal: vec3f,
  @location(3) worldPos: vec3f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
  @location(1) data: vec4f,
  @location(2) luminance: f32,
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.worldPos = (transform.matrix * vec4f(vertex.position, 1.0)).xyz + vertex.instance;
  output.position = camera.projection * camera.view * vec4f(output.worldPos, 1.0);
  output.texture = vertex.texture * 4;
  output.uv = vec2f(vertex.uv.x, 1.0 - vertex.uv.y);
  output.normal = transform.normal * vertex.normal;
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let normal = normalize(fragment.normal);
  let voxelLight = textureSample(lightmapTexture, lightmapSampler, fragment.worldPos / lightmapSize).x;
  let light = getLight(
    textureSample(playerTexture, textureSampler, fragment.uv, fragment.texture).rgb,
    0.5,
    0.02,
    normal,
    fragment.worldPos
  ) * voxelLight;
  let depth = distance(camera.position, fragment.worldPos);
  let alpha = 1.0 - clamp(depth / 512.0, 0.0, 1.0);
  var output: FragmentOutput;
  output.color = vec4f(light * alpha, alpha);
  output.data = vec4f(normal, depth);
  output.luminance = 0.0;
  return output;
}
