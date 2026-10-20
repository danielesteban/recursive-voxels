@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;
@group(0) @binding(3) var<uniform> resolution: vec2f;

struct VertexInput {
  @builtin(vertex_index) index: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

struct FragmentInput {
  @location(0) uv: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

const backgroundColor: vec3f = vec3f(0.01);

const edgeColor: vec3f = vec3f(0.0);
const edgeIntensity: f32 = 0.5;
const depthScale: f32 = 0.5;
const normalScale: f32 = 1.0;

fn getEdge(uv: vec2f) -> f32 {
  let s = 0.5 / resolution;
  
  let tl = textureSample(dataTexture, textureSampler, vec2f(uv.x - s.x, uv.y - s.y));
  let l = textureSample(dataTexture, textureSampler, vec2f(uv.x - s.x, uv.y));
  let bl = textureSample(dataTexture, textureSampler, vec2f(uv.x - s.x, uv.y + s.y));

  let t = textureSample(dataTexture, textureSampler, vec2f(uv.x, uv.y - s.y));
  let c = textureSample(dataTexture, textureSampler, vec2f(uv.x, uv.y));
  let b = textureSample(dataTexture, textureSampler, vec2f(uv.x, uv.y + s.y));

  let tr = textureSample(dataTexture, textureSampler, vec2f(uv.x + s.x, uv.y - s.y));
  let r = textureSample(dataTexture, textureSampler, vec2f(uv.x + s.x, uv.y));
  let br = textureSample(dataTexture, textureSampler, vec2f(uv.x + s.x, uv.y + s.y));

  let edge = (
    abs(tl - c)
    + abs(l - c) 
    + abs(bl - c) 
    + abs(t - c)
    + abs(b - c)
    + abs(tr - c)
    + abs(r - c)
    + abs(br - c)
  );

  return clamp(max((edge.x + edge.y + edge.z) * normalScale, edge.w * depthScale), 0.0, 1.0) * edgeIntensity;
}

fn linearToSrgb(value: f32) -> f32 {
  if (value <= 0.0031308) {
    return value * 12.92;
  }
  return 1.055 * pow(value, 1.0 / 2.4) - 0.055;
}

fn linearToSrgb3(value: vec3f) -> vec3f {
  return vec3f(linearToSrgb(value.r), linearToSrgb(value.g), linearToSrgb(value.b));
}

fn tonemapACES(color: vec3f) -> vec3f {
  let x = max(color, vec3f(0.0));
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  const pos = array(
    vec2f( 1,  1),
    vec2f( 1, -1),
    vec2f(-1, -1),
    vec2f( 1,  1),
    vec2f(-1, -1),
    vec2f(-1,  1)
  );
  const uv = array(
    vec2f(1, 0),
    vec2f(1, 1),
    vec2f(0, 1),
    vec2f(1, 0),
    vec2f(0, 1),
    vec2f(0, 0)
  );
  var output: VertexOutput;
  output.position = vec4f(pos[vertex.index], 0, 1);
  output.uv = uv[vertex.index];
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  var uv = fragment.uv - 0.5;
  let d = length(uv * 0.5 * uv * 0.5);
  uv = (uv * d + uv * 0.935) + 0.5;

  let edge = getEdge(uv);
  let pixelColor = textureSample(colorTexture, textureSampler, uv);
  var color = linearToSrgb3(tonemapACES(mix(pixelColor.rgb, edgeColor, getEdge(uv) * pixelColor.a) + backgroundColor * (1.0 - pixelColor.a)));

  let s = 1.0 - smoothstep(320.0, 1440.0, resolution.y) + 1.0;
  let j = cos(uv.y*resolution.y*s) * 0.1;
  color = color - color * j;
  color *= 1.0 - (0.01 + ceil((uv.x*resolution.x) % 3.0) * (0.995-1.01));

  var m = max(0.0, 1.0 - 2.0 * max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
  m = min(m*200.0, 1.0);
  color *= m;

  var output: FragmentOutput;
  output.color = vec4f(color, 1.0);
  return output;
}
