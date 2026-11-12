export enum Tool {
  block,
  blockLight,
  light,
}

let activeColor = $state(46);
let activeTool = $state(Tool.block);

export const Toolbar = {
  get activeColor() { return activeColor },
  set activeColor(value) { activeColor = value },
  get activeTool() { return activeTool },
  set activeTool(value) { activeTool = value },
};
