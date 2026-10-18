const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(fs.readFileSync('/tmp/t/stub.js', 'utf8'));
  await ctx.route('https://cdn.babylonjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:45001/'); await p.waitForSelector('#main-menu.active');
  // inject a fake imported vehicle + map the way ModManager would store them
  await p.evaluate(() => {
    const mk = n => ({ name: n, position: { x: 0, y: 0, z: 0 } });
    const meshes = ['body', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'Cube.004'].map(mk);
    const veh = { id: 'mod_a', type: 'car', rootNode: { setEnabled() {}, scaling: { setAll() {} }, position: { set() {}, clone() { return {}; } }, rotation: { set() {} } }, settings: { dimensions: { x: 1.8, y: 1.4, z: 4.2 }, wheelNodes: { FL: 'wheel_fl' }, wheelRadius: .35, needsWheelSetup: true, externalCamera: {}, cockpitCamera: {} },
      detection: { wheels: { FL: { nodeName: 'wheel_fl' }, FR: null, RL: null, RR: null }, confidence: .5, driverPosition: null }, state: { speed: 0 }, visualWheels: [{}, {}, {}, {}] };
    window.ModManager.mods.set('mod_a', { modId: 'mod_a', name: 'my-car.glb', type: 'vehicle', vehicleType: 'car', dimensions: { x: 1.8, y: 1.4, z: 4.2 }, meshes, scale: 1, adaptedData: veh });
    window.ModManager.mods.set('map_a', { modId: 'map_a', name: 'city-map.glb', type: 'map', dimensions: { x: 300, y: 20, z: 300 }, meshes: [], adaptedData: {} });
    window.UIManager.refreshModsList();
  });
  await p.click('#btn-mod-manager');
  console.log('mods rows:', await p.locator('#mods-list .list-item').count(), '| counter:', await p.textContent('#mods-count'));
  await p.locator('#mods-list .list-item', { hasText: 'my-car' }).locator('button', { hasText: 'SETUP' }).click();
  console.log('setup title:', await p.textContent('#setup-title'));
  await p.selectOption('#setup-FR', 'wheel_fr'); await p.selectOption('#setup-RL', 'wheel_rl'); await p.selectOption('#setup-RR', 'Cube.004');
  await p.fill('#setup-scale', '1.5'); 
  await p.click('#btn-save-setup');
  console.log('saved settings:', await p.evaluate(() => JSON.stringify(window.ModSettings.getModSettings('mod_a').wheelNodes)), '| needsSetup:', await p.evaluate(() => window.ModSettings.getModSettings('mod_a').needsWheelSetup));
  console.log('status:', await p.textContent('#mod-status'));
  await p.screenshot({ path: '/tmp/t/mods2.png' });
  await p.locator('#mods-list .list-item', { hasText: 'my-car' }).locator('button', { hasText: 'DELETE' }).click();
  console.log('rows after delete:', await p.locator('#mods-list .list-item').count());
  console.log('errors:', JSON.stringify(errs));
  await b.close();
})();
