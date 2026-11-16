let active = $state<string[]>([]);

export const Dialogs = {
  get active() {
    return active.length ? active[active.length - 1] : null;
  },
  show(id: string) {
    Dialogs.hide(id);
    active.push(id);
  },
  hide(id: string) {
    const index = active.indexOf(id);
    if (index !== -1) {
      active.splice(index, 1);
    }
  },
};
