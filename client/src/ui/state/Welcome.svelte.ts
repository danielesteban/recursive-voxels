let isShowingWorlds = $state(false);
let onPlay = $state<((server?: string) => Promise<void>) | null>(null);

export const Welcome = {
  get isShowingWorlds() { return isShowingWorlds },
  set isShowingWorlds(value) { isShowingWorlds = value },
  get onPlay() { return onPlay },
  set onPlay(value) { onPlay = value },
};
