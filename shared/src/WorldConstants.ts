export enum BlockFace {
  south,
  west,
  east,
  north,
  top,
  bottom,
}

export enum BlockModel {
  block,
  lightS,
  lightW,
  lightE,
  lightN,
  lightT,
  lightB,
}

export enum BlockTexture {
  block,
  light,
}

export enum BlockType {
  air,
  light,
  lightS,
  lightW,
  lightE,
  lightN,
  lightT,
  lightB,
  block = 128,
}

export const ChunkSize = 16;
export const LightColor = 9;
export const MaxLight = 16;

export const getModel = (value: BlockType) => {
  switch (value) {
    case BlockType.lightS:
      return BlockModel.lightS;
    case BlockType.lightW:
      return BlockModel.lightW;
    case BlockType.lightE:
      return BlockModel.lightE;
    case BlockType.lightN:
      return BlockModel.lightN;
    case BlockType.lightT:
      return BlockModel.lightT;
    case BlockType.lightB:
      return BlockModel.lightB;
    default:
      return BlockModel.block;
  }
};

export const getTexture = (value: BlockType) => {
  switch (value) {
    case BlockType.lightS:
    case BlockType.lightW:
    case BlockType.lightE:
    case BlockType.lightN:
    case BlockType.lightT:
    case BlockType.lightB:
      return BlockTexture.light;
    default:
      return BlockTexture.block;
  }
};

export const isCulled = (value: BlockType, neighbor: BlockType, face: BlockFace) => {
  switch (value) {
    case BlockType.lightS:
      return face === BlockFace.north && isOpaque(neighbor);
    case BlockType.lightW:
      return face === BlockFace.east && isOpaque(neighbor);
    case BlockType.lightE:
      return face === BlockFace.west && isOpaque(neighbor);
    case BlockType.lightN:
      return face === BlockFace.south && isOpaque(neighbor);
    case BlockType.lightT:
      return face === BlockFace.bottom && isOpaque(neighbor);
    case BlockType.lightB:
      return face === BlockFace.top && isOpaque(neighbor);
    default:
      return isOpaque(neighbor);
  }
};

export const isLight = (value: BlockType) => {
  switch (value) {
    case BlockType.light:
    case BlockType.lightS:
    case BlockType.lightW:
    case BlockType.lightE:
    case BlockType.lightN:
    case BlockType.lightT:
    case BlockType.lightB:
      return true;
    default:
      return false;
  }
};

export const isOpaque = (value: BlockType) => {
  switch (value) {
    case BlockType.air:
    case BlockType.lightS:
    case BlockType.lightW:
    case BlockType.lightE:
    case BlockType.lightN:
    case BlockType.lightT:
    case BlockType.lightB:
      return false;
    default:
      return true;
  }
};

export type Generator = (
  (blockType: typeof BlockType, size: [number, number, number]) =>
    (x: number, y: number, z: number) => number
);
