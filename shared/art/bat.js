// Skitterbat: a purple bat with glowing eyes. Flaps, screeches, swoops.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rig'), require('./kit'));
  else { root.DC = root.DC || {}; root.DC.art = root.DC.art || {}; root.DC.art.bat = factory(root.DC.rig, root.DC.artKit); }
})(this, function (rig, kit) {
  const { mirror } = kit;
  const BODY = [
    'B........B',
    'BB......BB',
    'BbbbbbbbbB',
    '.bBbbbbbbd',
    '.brrbbrrbd',
    '.bbbbbbbbd',
    '.bbfbbfbd.',
    '..bddddd..',
    '...ddd....'
  ];
  const WING = [
    'vv........',
    'vWvvv.....',
    'vWWwwvvv..',
    '.vWwwwwwvv',
    '.vWwwwwwwv',
    '..vwwvwwvv',
    '...v..v..v'
  ];
  const MOUTH = ['mmmm', 'fmmf'];

  const batRig = {
    size: 32,
    parts: [
      { name: 'root', pivot: [16, 29], at: [16, 29] },
      { name: 'body', parent: 'root', rows: BODY, pivot: [5, 4], at: [16, 15], z: 2 },
      { name: 'wingL', parent: 'body', rows: mirror(WING), pivot: [9, 1], at: [1, 3], z: 1 },
      { name: 'wingR', parent: 'body', rows: WING, pivot: [0, 1], at: [9, 3], z: 1 },
      { name: 'mouth', parent: 'body', rows: MOUTH, pivot: [2, 0], at: [5, 5], z: 3, hidden: true, outline: false }
    ]
  };

  const flap = (up, y) => ({ wingR: { rot: up }, wingL: { rot: -up }, body: { y } });
  const anims = {
    idle: { fps: 10, frames: [flap(-35, -1), flap(0, 0), flap(30, 1), flap(0, 0)] },
    walk: { fps: 12, frames: [flap(-35, -1), flap(0, 0), flap(30, 1), flap(0, 0)] },
    hover: { fps: 10, frames: [flap(-35, -1), flap(0, 0), flap(30, 1), flap(0, 0)] },
    retreat: { fps: 14, frames: [flap(-40, -2), flap(0, -1), flap(35, 0), flap(0, -1)] },
    // screech: wings thrown wide, mouth open, shaking
    screech: { fps: 14, frames: [
      { wingR: { rot: -55 }, wingL: { rot: 55 }, mouth: { show: true }, body: { x: -1, y: -1 } },
      { wingR: { rot: -60 }, wingL: { rot: 60 }, mouth: { show: true }, body: { x: 1, y: -1 } }
    ] },
    // swoop: wings swept back, diving
    swoop: { fps: 10, frames: [
      { wingR: { rot: 75 }, wingL: { rot: -75 }, body: { y: 2 }, mouth: { show: true } },
      { wingR: { rot: 82 }, wingL: { rot: -82 }, body: { y: 3 }, mouth: { show: true } }
    ] },
    attack: { fps: 12, frames: [
      { wingR: { rot: 75 }, wingL: { rot: -75 }, body: { y: 2 }, mouth: { show: true } }
    ] },
    hurt: { fps: 8, frames: [{ wingR: { rot: 45 }, wingL: { rot: -20 }, body: { rot: -15, x: -2 } }] },
    death: { fps: 8, frames: [
      { wingR: { rot: 50 }, wingL: { rot: -50 }, body: { rot: 30, y: 3 } },
      { wingR: { rot: 70 }, wingL: { rot: -70 }, body: { rot: 90, y: 8 } },
      { wingR: { rot: 80 }, wingL: { rot: -80 }, body: { rot: 160, y: 12 } }
    ] }
  };

  const PAL = { o: '#1A1024', b: '#5B4A7A', B: '#7A6699', d: '#3E3157', w: '#8E7BB0', W: '#A898C8', v: '#4A3A66', r: '#F2A541', f: '#FFFFFF', m: '#3A0F1A' };
  return { size: 32, rig: batRig, anims, palette: () => PAL, once: ['attack', 'hurt', 'death'] };
});
