let isShowing = $state(false);
let isShowingWorlds = $state(false);
let onPlay = $state<((server?: string) => Promise<void>) | null>(null);

export const Welcome = {
  get isShowing() { return isShowing },
  set isShowing(value) {
    isShowing = value;
    if (!value) isShowingWorlds = false;
  },
  get isShowingWorlds() { return isShowingWorlds },
  set isShowingWorlds(value) { isShowingWorlds = value },
  get onPlay() { return onPlay },
  set onPlay(value) { onPlay = value },
};
