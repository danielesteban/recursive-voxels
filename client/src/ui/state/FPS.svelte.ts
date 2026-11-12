let clock = 0;
let count = 0;
let text = $state('···');

export const FPS = {
  get text() { return text },
  reset() {
    clock = performance.now() / 1000;
    count = 0;
    text = '···';
  },
  update(time: number) {
    count++;
    if (time >= clock + 1) {
      text = `${Math.round(count / (time - clock))}fps`;
      clock = time;
      count = 0;
    }
  }
};
