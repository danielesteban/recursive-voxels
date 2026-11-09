@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var bloomTexture: texture_2d<f32>;
@group(0) @binding(2) var dataTexture: texture_2d<f32>;
@group(0) @binding(3) var textureSampler: sampler;
@group(0) @binding(4) var<uniform> resolution: vec2f;

struct FragmentInput {
  @location(0) uv: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

const bloomIntensity: f32 = 0.5;
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

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let color = textureSample(colorTexture, textureSampler, fragment.uv);
  let bloom = textureSample(bloomTexture, textureSampler, fragment.uv);
  var output: FragmentOutput;
  output.color = vec4f(mix(color.rgb + bloom.rgb * bloomIntensity, edgeColor, getEdge(fragment.uv) * color.a), 1.0);
  return output;
}
