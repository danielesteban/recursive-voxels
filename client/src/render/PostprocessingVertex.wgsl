struct VertexInput {
  @builtin(vertex_index) index: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
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
