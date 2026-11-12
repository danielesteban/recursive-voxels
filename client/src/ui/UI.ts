import { mount } from 'svelte';
import UI from 'ui/UI.svelte';

export const mountUI = (target: HTMLElement) => {
  mount(UI, { target });
};
