const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });   // separate contexts: BroadcastChannel NOT shared
    await ctx.addInitScript(fs.readFileSync('/tmp/t/stub.js', 'utf8'));
    await ctx.route('https://cdn.babylonjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', e => p.errs.push(name + ' ' + e.message));
    await p.goto('http://localhost:45001/', { waitUntil: 'load' }); await p.waitForSelector('#main-menu.active');
    return p;
  };
  const host = await mk('HOST'), cli = await mk('CLIENT');
  const frames = (p, n) => p.evaluate(n => { for (let i = 0; i < n; i++) window.__frame && window.__frame(); }, n);

  // host
  await host.click('#btn-multiplayer'); await host.fill('#server-address', 'localhost:45001');
  await host.click('#btn-create-host'); await host.waitForSelector('#host-screen.active');
  const code = await host.textContent('#room-id-display'); console.log('room code:', code);
  console.log('server lists room:', await host.evaluate(async () => (await (await fetch('http://localhost:45001/rooms')).json()).map(r => r.id + ':' + r.name)));

  // client finds it through the discovery server (separate context => HTTP path only)
  await cli.click('#btn-multiplayer'); await cli.fill('#server-address', 'localhost:45001'); await cli.click('#btn-join-room');
  await cli.waitForSelector('#rooms-list .list-item', { timeout: 15000 });
  console.log('client sees room:', await cli.textContent('#rooms-list .list-item .name'));
  await cli.locator('#rooms-list .list-item', { hasText: code }).locator('button').click();
  await cli.waitForFunction(() => window.NetworkManager.connected, null, { timeout: 20000 });
  console.log('client connected, players:', await cli.evaluate(() => window.NetworkManager.players.size));
  await host.waitForFunction(() => window.NetworkManager.players.size === 2, null, { timeout: 10000 });
  console.log('host slots:', await host.evaluate(() => Array.from(document.querySelectorAll('#host-players .list-item')).map(e => e.querySelector('.meta').textContent).join(',')));

  // start match
  await host.click('#btn-start-game');
  await cli.waitForFunction(() => GameEngine.state === 'driving', null, { timeout: 10000 });
  console.log('both driving:', await host.evaluate(() => GameEngine.state), await cli.evaluate(() => GameEngine.state));

  // host drives, client should receive state
  await host.keyboard.down('KeyW');
  for (let i = 0; i < 50; i++) { await frames(host, 6); await frames(cli, 3); await host.waitForTimeout(25); }
  await host.keyboard.up('KeyW');
  const rv = await cli.evaluate(() => { const v = window.SyncManager.getAllRemoteVehicles(); return { n: v.length, z: v[0] && v[0].target && v[0].target.position[2].toFixed(2), speed: v[0] && v[0].target && v[0].target.speed.toFixed(1) }; });
  console.log('client sees remote car:', JSON.stringify(rv), '| host z =', await host.evaluate(() => GameEngine.vehicle.rootNode.position.z));
  console.log('latency host/client:', await host.evaluate(() => window.NetworkManager.latency), await cli.evaluate(() => window.NetworkManager.latency));

  // client leaves -> host drops player
  await cli.evaluate(() => window.NetworkManager.disconnect());
  await host.waitForFunction(() => window.NetworkManager.players.size === 1, null, { timeout: 12000 });
  console.log('host after client leaves players:', await host.evaluate(() => window.NetworkManager.players.size));
  console.log('errors:', JSON.stringify([...host.errs, ...cli.errs]));
  await b.close();
})().catch(e => { console.error('TEST FAIL', e.message); process.exit(1); });
