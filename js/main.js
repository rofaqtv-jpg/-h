(function(){'use strict';
const $=id=>document.getElementById(id);
function screen(id){document.querySelectorAll('.menu-screen').forEach(s=>s.classList.remove('active'));$(id)?.classList.add('active');}
function on(id,fn){$(id)?.addEventListener('click',e=>{e.preventDefault();fn();});}
on('btn-free-drive',()=>{if(!window.GameEngine||!window.GameEngine.scene){screen('loading-screen');$('loading-text').textContent='Loading the 3D engine…';setTimeout(()=>{if(window.GameEngine?.scene)window.GameEngine.start();else $('loading-text').textContent='Engine unavailable. Check your internet connection and reload.';},300);}else window.GameEngine.start();});
on('btn-multiplayer',()=>screen('multiplayer-menu'));on('btn-back-main',()=>screen('main-menu'));on('btn-create-host',()=>screen('host-screen'));on('btn-join-room',()=>screen('join-screen'));on('btn-back-multi',()=>screen('multiplayer-menu'));on('btn-back-join',()=>screen('multiplayer-menu'));on('btn-back-mods',()=>screen('main-menu'));on('btn-back-settings',()=>screen('main-menu'));
on('btn-mod-manager',()=>screen('mod-manager-screen'));on('btn-settings',()=>screen('settings-screen'));
on('btn-import-mod',()=>$('file-input').click());$('file-input')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(file){$('mod-status').textContent='Loading '+file.name+'…';if(window.GameEngine?.scene)await window.GameEngine.importModel(file);else $('mod-status').textContent='Start the 3D engine first, then import your model.';}e.target.value='';});
on('btn-start-game',()=>{const n=$('room-name').value.trim()||'Mountain Crew';$('multi-status').textContent='Session setup: '+n+' · '+$('player-count').value+' players. Network server integration is not active in this build.';window.GameEngine?.start();});
on('btn-connect',()=>{$('join-status').textContent='Connection requires the local discovery server to be running on the host device.';});
on('btn-save-settings',()=>{const q=$('graphics-quality').value;if(window.GameEngine?.engine){window.GameEngine.engine.setHardwareScalingLevel(q==='low'?1.5:q==='high'?0.75:1);window.GameEngine.engine.resize();}if(window.GameEngine){window.GameEngine.cameraMode=$('camera-mode').value;const mode=$('camera-mode').value;if(mode==='cockpit'){window.GameEngine.camera.radius=2.2;window.GameEngine.camera.heightOffset=1.5;}else if(mode==='wide'){window.GameEngine.camera.radius=17;window.GameEngine.camera.heightOffset=7;}else{window.GameEngine.camera.radius=11;window.GameEngine.camera.heightOffset=4;}}screen('main-menu');});
on('btn-pause',()=>window.GameEngine?.togglePause());on('btn-resume',()=>window.GameEngine?.togglePause());on('btn-camera',()=>window.GameEngine?.changeCamera());on('btn-quit',()=>window.GameEngine?.stop());
// Avoid browser page gestures while steering and support older Android WebViews.
document.addEventListener('contextmenu',e=>{if(e.target.closest('.drive-btn'))e.preventDefault();});
})();
