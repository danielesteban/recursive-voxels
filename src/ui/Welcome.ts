// @dani
// this is kinda dumb
// but I'm not gonna include a UI framework
// just for this single dialog

export const showWelcome = (canvas: HTMLCanvasElement) => {
  const overlay = document.createElement('div');
  overlay.id = 'welcome';
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target !== overlay) {
      return;
    }
    document.body.removeChild(overlay);
    canvas.requestPointerLock();
  });
  const dialog = document.createElement('div');
  dialog.classList.add('dialog');
  overlay.appendChild(dialog);
  const heading = document.createElement('div');
  heading.classList.add('heading');
  heading.innerText = 'recursive-voxels';
  dialog.appendChild(heading);
  const content = document.createElement('div');
  content.classList.add('content');
  dialog.appendChild(content);

  const info = document.createElement('div');
  info.classList.add('info');
  content.appendChild(info);

  {
    const content = document.createElement('div');
    info.appendChild(content);
    const heading = document.createElement('div');
    heading.classList.add('heading');
    heading.innerText = 'Welcome!';
    content.appendChild(heading);
    const text1 = document.createElement('p');
    text1.innerText = 'This idea came to me while dreaming about the 1953 piece by M.C. Escher: "Cubic Space Division".';
    content.appendChild(text1);
    const text2 = document.createElement('p');
    text2.innerText = 'The physics are simulated with the stellar JoltPhysics library. Everything else has been carefully coded by hand, including the custom WebGPU engine/renderer.';
    content.appendChild(text2);
  }
  {
    const settings = document.createElement('div');
    settings.classList.add('settings');
    info.appendChild(settings);
    const play = document.createElement('button');
    play.innerText = 'Play';
    play.addEventListener('click', () => {
      document.body.removeChild(overlay);
      canvas.requestPointerLock();
    });
    settings.appendChild(play);
  }

  const controlsA = document.createElement('div');
  controlsA.classList.add('controls');
  content.appendChild(controlsA);
  controlsA.appendChild(getControlsEntryKeys('Move', [['W'], ['A', 'S', 'D']]));
  controlsA.appendChild(getControlsEntryKeys('Down', [['Shift']]));
  controlsA.appendChild(getControlsEntryKeys('Up', [['Space']]));
  controlsA.appendChild(getControlsEntryIcon('Speed', MouseIcons.middleClick));
  controlsA.appendChild(getControlsEntryKeys('Palette', [['E']]));

  const controlsB = document.createElement('div');
  controlsB.classList.add('controls');
  content.appendChild(controlsB);
  controlsB.appendChild(getControlsEntryIcon('Build', MouseIcons.leftClick));
  controlsB.appendChild(getControlsEntryIcon('Destroy', MouseIcons.rightClick));
  controlsB.appendChild(getControlsEntryIcon('Shoot', MouseIcons.middleClick));
  controlsB.appendChild(getControlsEntryCombo('Pick', [[['Ctrl']], MouseIcons.leftClick]));
  controlsB.appendChild(getControlsEntryCombo('Undo', [[['Ctrl']], [['Z']]]));
  controlsB.appendChild(getControlsEntryCombo('Redo', [[['Ctrl'], ['Shift']], [['Z']]]));

  document.body.appendChild(overlay);
};

const getControlsKeys = (keysRows: string[][]) => {
  const keys = document.createElement('div');
  keys.classList.add('keys');
  for (const keysRow of keysRows) {
    const row = document.createElement('div');
    row.classList.add('row');
    keys.appendChild(row);
    for (const keyText of keysRow) {
      const key = document.createElement('div');
      key.classList.add('key');
      if (keyText === 'Ctrl' || keyText === 'Shift') {
        key.classList.add('shift');
      }
      if (keyText === 'Space') {
        key.classList.add('spacebar');
      }
      key.innerText = keyText;
      row.appendChild(key);
    }
  }
  return keys;
};

const getControlsIcon = (iconPath: string) => {
  const icon = document.createElement('div');
  icon.classList.add('icon');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 356.572 356.572');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', iconPath);
  svg.appendChild(path);
  icon.appendChild(svg);
  return icon;
};

const getControlsEntryKeys = (descriptionText: string, keysRows: string[][]) => {
  const entry = document.createElement('div');
  entry.classList.add('entry');
  entry.appendChild(getControlsKeys(keysRows));
  const description = document.createElement('div');
  description.classList.add('description');
  description.innerText = descriptionText;
  entry.appendChild(description);
  return entry;
};

const getControlsEntryIcon = (descriptionText: string, iconPath: string) => {
  const entry = document.createElement('div');
  entry.classList.add('entry');
  entry.appendChild(getControlsIcon(iconPath));
  const description = document.createElement('div');
  description.classList.add('description');
  description.innerText = descriptionText;
  entry.appendChild(description);
  return entry;
};

const getControlsEntryCombo = (descriptionText: string, combination: (string[][] | string)[]) => {
  const entry = document.createElement('div');
  entry.classList.add('entry');
  const combo = document.createElement('div');
  combo.classList.add('combo');
  entry.appendChild(combo);
  for (let i = 0, l = combination.length; i < l; i++) {
    if (i > 0) {
      const combinator = document.createElement('div');
      combinator.classList.add('combinator');
      combinator.innerText = '+';
      combo.appendChild(combinator);
    }
    const step = combination[i];
    if (Array.isArray(step)) {
      combo.appendChild(getControlsKeys(step));
    } else {
      combo.appendChild(getControlsIcon(step));
    }
  }
  const description = document.createElement('div');
  description.classList.add('description');
  description.innerText = descriptionText;
  entry.appendChild(description);
  return entry;
};

const MouseIcons = {
  leftClick: 'M181.563,0C120.762,0,59.215,30.525,59.215,88.873V237.5c0,65.658,53.412,119.071,119.071,119.071 c65.658,0,119.07-53.413,119.07-119.071V88.873C297.356,27.809,237.336,0,181.563,0z M274.945,237.5 c0,53.303-43.362,96.657-96.659,96.657c-53.299,0-96.657-43.354-96.657-96.657v-69.513c20.014,6.055,57.685,15.215,102.221,15.215 c28.515,0,59.831-3.809,91.095-14.567V237.5z M274.945,144.794c-81.683,31.233-168.353,7.716-193.316-0.364V88.873 c0-43.168,51.489-66.46,99.934-66.46c46.481,0,93.382,20.547,93.382,66.46V144.794z M190.893,48.389v81.248 c0,6.187-5.023,11.208-11.206,11.208c-6.185,0-11.207-5.021-11.207-11.208V48.389c0-6.186,5.021-11.207,11.207-11.207 C185.869,37.182,190.893,42.203,190.893,48.389z M154.938,40.068V143.73c-15.879,2.802-62.566-10.271-62.566-10.271 C80.233,41.004,154.938,40.068,154.938,40.068z',
  middleClick: 'M181.563,0C120.762,0,59.215,30.525,59.215,88.873V237.5c0,65.658,53.412,119.071,119.071,119.071 c65.658,0,119.07-53.413,119.07-119.071V88.873C297.356,27.809,237.336,0,181.563,0z M274.945,237.5 c0,53.303-43.362,96.657-96.659,96.657c-53.299,0-96.657-43.354-96.657-96.657v-69.513c20.014,6.055,57.685,15.215,102.221,15.215 c28.515,0,59.831-3.809,91.095-14.567V237.5z M274.945,144.794c-81.683,31.233-168.353,7.716-193.316-0.364V88.873 c0-43.168,51.489-66.46,99.934-66.46c46.481,0,93.382,20.547,93.382,66.46V144.794z M190.893,48.389v81.248 c0,6.187-5.023,11.208-11.206,11.208c-6.185,0-11.207-5.021-11.207-11.208V48.389c0-6.186,5.021-11.207,11.207-11.207 C185.869,37.182,190.893,42.203,190.893,48.389z',
  rightClick: 'M181.563,0C120.762,0,59.215,30.525,59.215,88.873V237.5c0,65.658,53.412,119.071,119.071,119.071 c65.658,0,119.07-53.413,119.07-119.071V88.873C297.356,27.809,237.336,0,181.563,0z M274.945,237.5 c0,53.303-43.362,96.657-96.659,96.657c-53.299,0-96.657-43.354-96.657-96.657v-69.513c20.014,6.055,57.685,15.215,102.221,15.215 c28.515,0,59.831-3.809,91.095-14.567V237.5z M274.945,144.794c-81.683,31.233-168.353,7.716-193.316-0.364V88.873 c0-43.168,51.489-66.46,99.934-66.46c46.481,0,93.382,20.547,93.382,66.46V144.794z M190.893,48.389v81.248 c0,6.187-5.023,11.208-11.206,11.208c-6.185,0-11.207-5.021-11.207-11.208V48.389c0-6.186,5.021-11.207,11.207-11.207 C185.869,37.182,190.893,42.203,190.893,48.389z M264.272,130.378c0,0-46.687,13.072-62.566,10.271V36.988 C201.706,36.988,276.412,37.923,264.272,130.378z',
};
