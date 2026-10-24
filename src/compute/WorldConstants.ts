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
