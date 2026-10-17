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
      this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
      this.scene = new BABYLON.Scene(this.engine);
      this.scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.98, 1); // سماء زرقاء

      // Camera - بعيدة شوية باش تبان الطوموبيل
      var camera = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0,3,-8), this.scene);
      camera.setTarget(new BABYLON.Vector3(0,1,0));
      camera.attachControl(this.canvas, true);

      // 2 Lights باش ما يبقاش كحل
      var light1 = new BABYLON.HemisphericLight('hLight', new BABYLON.Vector3(0,1,0), this.scene);
      light1.intensity = 1.2;
      var light2 = new BABYLON.DirectionalLight('dLight', new BABYLON.Vector3(-1,-2,-1), this.scene);
      light2.intensity = 0.8;

      // Ground أخضر
      var ground = BABYLON.MeshBuilder.CreateGround('ground', {width:200, height:200}, this.scene);
      var groundMat = new BABYLON.StandardMaterial('gMat', this.scene);
      groundMat.diffuseColor = new BABYLON.Color3(0.3,0.6,0.3);
      ground.material = groundMat;

      // Car - لون أصفر باش يبان
      var car = BABYLON.MeshBuilder.CreateBox('car', {width:2, height:1, depth:4}, this.scene);
      car.position.y = 0.8;
      car.position.z = 0;
      var carMat = new BABYLON.StandardMaterial('cMat', this.scene);
      carMat.diffuseColor = new BABYLON.Color3(1,0.8,0);
      carMat.emissiveColor = new BABYLON.Color3(0.2,0.1,0); // باش يضوي شوية
      car.material = carMat;

      // Box يدور باش تعرف أن المحرك خدام
      this.scene.registerBeforeRender(()=>{
        car.rotation.y += 0.01;
      });

      this.engine.runRenderLoop(() => this.scene.render());
      window.addEventListener('resize', () => this.engine.resize());

      console.log('GameEngine INIT OK');
      // خبي canvas فاللول
      this.canvas.style.display = 'none';
      return true;
    }catch(e){
      console.log('GameEngine ERROR: '+e.message);
      return false;
    }
  }

  start(){
    console.log('GameEngine START - Show 3D');
    this.canvas.style.display = 'block';
    this.canvas.style.pointerEvents = 'auto';
    this.canvas.style.zIndex = '5';
    document.querySelectorAll('.menu-screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('ui-overlay').style.display = 'none';
    if(this.engine) this.engine.resize();
  }

  stop(){
    console.log('GameEngine STOP - Hide 3D');
    this.canvas.style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';
    document.getElementById('main-menu').classList.add('active');
  }
}

window.GameEngine = GameEngine;
window.gameEngineInstance = new GameEngine();
window.gameEngineInstance.init().then(ok=>{
  window.gameEngine = window.gameEngineInstance;
  window.startFreeDrive = function(){ window.gameEngineInstance.start(); };
  console.log('Engine ready');
});
