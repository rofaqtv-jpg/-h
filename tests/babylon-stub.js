(() => {
  const make = () => {
    const store = {};
    const t = function () {};
    const p = new Proxy(t, {
      get(_, k) {
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === 'then') return undefined;           // not thenable
        if (!(k in store)) store[k] = make();
        return store[k];
      },
      set(_, k, v) { store[k] = v; return true; },
      apply() { return make(); },
      construct() { return make(); },
      has() { return true; }
    });
    return p;
  };
  window.BABYLON = make();
  // a few values the engine reads as real numbers/functions
  BABYLON.Engine = function () { const e = make(); e.runRenderLoop = f => { window.__frame = f; }; e.getFps = () => 60; e.getDeltaTime = () => 16; e.getHardwareScalingLevel = () => 1; return e; };
  BABYLON.Scene = function () { const s = make(); s.pickWithRay = () => ({ hit: false }); s.getPhysicsEngine = () => null; s.getMaterialByName = () => make(); return s; };
  BABYLON.Scene.FOGMODE_EXP2 = 3;
})();
