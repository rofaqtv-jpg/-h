console.log('GameEngine loading...');

class GameEngine {
  constructor(){
    this.engine = null;
    this.scene = null;
    this.canvas = document.getElementById('gameCanvas');
  }

  async init(){
    try{
      console.log('Init Babylon...');
      if(!window.BABYLON){ console.log('BABYLON not loaded!'); return false; }
      
      this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
      this.scene = new BABYLON.Scene(this.engine);
      this.scene.clearColor = new BABYLON.Color3(0.5, 0.7, 1);

      // Camera
      var camera = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0,5,-10), this.scene);
      camera.setTarget(BABYLON.Vector3.Zero());
      camera.attachControl(this.canvas, true);

      // Light
      var light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0,1,0), this.scene);
      light.intensity = 0.9;

      // Ground
      var ground = BABYLON.MeshBuilder.CreateGround('ground', {width:100, height:100}, this.scene);
      var mat = new BABYLON.StandardMaterial('mat', this.scene);
      mat.diffuseColor = new BABYLON.Color3(0.2,0.6,0.2);
      ground.material = mat;

      // Simple car box
      var car = BABYLON.MeshBuilder.CreateBox('car', {width:2, height:1, depth:4}, this.scene);
      car.position.y = 1;
      car.position.z = 5;

      this.engine.runRenderLoop(() => {
        this.scene.render();
      });

      window.addEventListener('resize', () => this.engine.resize());

      console.log('GameEngine INIT OK');
      return true;
    }catch(e){
      console.log('GameEngine ERROR: '+e.message+' '+e.stack);
      return false;
    }
  }

  start(){
    console.log('GameEngine START');
    if(this.canvas){
      this.canvas.style.pointerEvents = 'auto';
      this.canvas.style.zIndex = '5';
    }
    // Hide all menus
    document.querySelectorAll('.menu-screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('ui-overlay').style.display = 'none';
    if(this.engine) this.engine.resize();
  }
}

window.GameEngine = GameEngine;
window.gameEngineInstance = new GameEngine();
window.gameEngineInstance.init().then(ok=>{
  console.log('Engine ready: '+ok);
  window.gameEngine = window.gameEngineInstance;
  window.startFreeDrive = function(){ window.gameEngineInstance.start(); };
});

console.log('GameEngine loaded');
