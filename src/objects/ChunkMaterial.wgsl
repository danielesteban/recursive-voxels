@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;
@group(1) @binding(0) var blockTexture: texture_2d_array<f32>;
@group(1) @binding(1) var blockPalette: texture_2d_array<f32>;
@group(1) @binding(2) var textureSampler: sampler;
@group(1) @binding(3) var brdfTexture: texture_2d<f32>;
@group(1) @binding(4) var irradianceTexture: texture_cube<f32>;
@group(1) @binding(5) var prefilteredTexture: texture_cube<f32>;
@group(1) @binding(6) var lightingSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) light: f32,
  @location(4) texture: u32,
  @location(5) instance: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) color: u32,
  @location(1) @interpolate(flat) texture: u32,
  @location(2) uv: vec2f,
  @location(3) normal: vec3f,
  @location(4) light: f32,
  @location(5) worldPos: vec3f,
}

struct FragmentInput {
  @location(0) @interpolate(flat) color: u32,
  @location(1) @interpolate(flat) texture: u32,
  @location(2) uv: vec2f,
  @location(3) normal: vec3f,
  @location(4) light: f32,
  @location(5) worldPos: vec3f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
  @location(1) data: vec4f,
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.worldPos = (transform.matrix * vec4f(vertex.position, 1.0)).xyz + vertex.instance;
  output.position = camera.projection * camera.view * vec4f(output.worldPos, 1.0);
  output.light = vertex.light;
  output.color = (vertex.texture >> 16) & 0xFFFF;
  output.texture = vertex.texture & 0xFFFF;
  output.normal = transform.normal * vertex.normal;
  output.uv = vertex.uv;
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let normal = normalize(fragment.normal);
  let light = getLight(
    textureSample(blockPalette, textureSampler, fragment.uv, fragment.color).rgb
    * textureSample(blockTexture, textureSampler, fragment.uv, fragment.texture).rgb,
    0.5,
    0.02,
    normal,
    fragment.worldPos
  ) * fragment.light;
  let depth = distance(camera.position, fragment.worldPos);
  let alpha = 1.0 - clamp(depth / 512.0, 0.0, 1.0);
  var output: FragmentOutput;
  output.color = vec4f(light * alpha, alpha);
  output.data = vec4f(normal, depth);
  return output;
}
