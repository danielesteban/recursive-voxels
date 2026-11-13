let isShowing = $state(false);

export const Disconnected = {
  get isShowing() { return isShowing },
  set isShowing(value) { isShowing = value },
};
