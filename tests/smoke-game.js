const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(fs.readFileSync('/tmp/t/stub.js', 'utf8'));
  await ctx.route('https://cdn.babylonjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' @ ' + (e.stack||'').split('\n')[1])); 
  await p.goto('http://localhost:45001/', { waitUntil: 'load' });
  await p.waitForSelector('#main-menu.active', { timeout: 60000 });
  console.log('engine ready:', await p.evaluate(() => !!window.GameEngine.scene), 'dialog hidden:', await p.evaluate(() => document.getElementById('error-dialog').classList.contains('hidden')));
  // frames
  const frames = async n => { for (let i = 0; i < n; i++) await p.evaluate(() => window.__frame && window.__frame()); };
  await frames(5);
  // garage
  await p.click('#btn-garage'); await p.waitForTimeout(150);
  console.log('garage active:', await p.evaluate(() => document.getElementById('garage-screen').classList.contains('active')), 'items:', await p.evaluate(() => document.getElementById('garage-list').children.length));
  await p.screenshot({ path: '/tmp/t/garage.png' });
  await p.click('#garage-list .car-item:nth-child(4)'); await p.waitForTimeout(100);
  console.log('selected car:', await p.evaluate(() => window.GameEngine.settings.car));
  await p.click('#btn-select-car'); await p.waitForTimeout(100);
  console.log('driving:', await p.evaluate(() => window.GameEngine.state), 'hud visible:', await p.evaluate(() => !document.getElementById('game-hud').classList.contains('hidden')));
  // drive with keyboard
  await p.keyboard.down('KeyW');
  for (let i = 0; i < 40; i++) { await frames(6); await p.waitForTimeout(20); }
  const mid = await p.evaluate(() => ({ speed: document.getElementById('speed').textContent, gear: document.getElementById('gear').textContent, sim: window.GameEngine.sim.speed, rpm: document.getElementById('rpm').textContent }));
  console.log('after throttle:', JSON.stringify(mid));
  await p.keyboard.down('KeyD'); for (let i = 0; i < 15; i++) { await frames(4); await p.waitForTimeout(15); }
  console.log('heading changed:', await p.evaluate(() => window.GameEngine.sim.heading.toFixed(3)), 'steer:', await p.evaluate(() => window.InputManager.steering.toFixed(2)));
  await p.keyboard.up('KeyD'); await p.keyboard.up('KeyW');
  await p.screenshot({ path: '/tmp/t/hud.png' });
  // actions
  await p.keyboard.press('KeyL'); await p.keyboard.press('KeyQ'); await p.keyboard.press('KeyC');
  console.log('lights/sigL/view:', await p.evaluate(() => [GameEngine.sim.lights, GameEngine.sim.sigL, GameEngine.camSys.currentView].join('/')));
  // brake & reverse
  await p.keyboard.down('KeyS'); for (let i = 0; i < 60; i++) { await frames(6); await p.waitForTimeout(15); }
  console.log('after brake/reverse speed:', await p.evaluate(() => GameEngine.sim.speed.toFixed(2)), 'gear:', await p.evaluate(() => document.getElementById('gear').textContent));
  await p.keyboard.up('KeyS');
  // touch pedals + wheel
  await p.evaluate(() => { GameEngine.settings.steer = 'wheel'; GameEngine.applySettings(); });
  const wb = await p.locator('#steer-wheel').boundingBox();
  await p.touchscreen.tap(wb.x + wb.width/2, wb.y + wb.height/2);
  // pause
  await p.keyboard.press('KeyP'); console.log('paused:', await p.evaluate(() => GameEngine.paused));
  await p.screenshot({ path: '/tmp/t/pause.png' });
  await p.click('#btn-resume'); await p.click('#btn-pause'); await p.click('#btn-resume');
  await p.click('#btn-camera-toggle');
  await p.click('#btn-pause'); await p.click('#btn-quit'); 
  console.log('back to menu:', await p.evaluate(() => document.getElementById('main-menu').classList.contains('active')), 'stats distance:', await p.evaluate(() => GameEngine.stats.distance.toFixed(3)));
  await p.click('#btn-settings');
  await p.selectOption('#speed-unit', 'mph'); await p.click('#btn-save-settings');
  console.log('unit label:', await p.evaluate(() => document.getElementById('speed-unit-label').textContent));
  console.log('errors:', JSON.stringify(errs));
  await b.close();
})();
