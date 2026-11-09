@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var luminanceTexture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;

struct FragmentInput {
  @location(0) uv: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let color = textureSample(colorTexture, textureSampler, fragment.uv);
  let luminance = textureSample(luminanceTexture, textureSampler, fragment.uv);
  var output: FragmentOutput;
  output.color = vec4f(color.rgb * luminance.r, 1.0);
  return output;
}
