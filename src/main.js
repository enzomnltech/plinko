import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es'; // Import Cannon.js

//-------------------------------------------------------
// Setup Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
//-------------------------------------------------------

//-------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

document.body.appendChild(renderer.domElement);
//-------------------------------------------------------

//-------------------------------------------------------
// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);
//-------------------------------------------------------


//-------------------------------------------------------
//Audio
const listener = new THREE.AudioListener();
camera.add(listener);

const audioLoader = new THREE.AudioLoader();
const sound1 = new THREE.Audio(listener);
const sound2 = new THREE.Audio(listener);

audioLoader.load('/sounds/low.mp3', (buffer) => {
  sound1.setBuffer(buffer);
  sound1.setVolume(2);
});

audioLoader.load('/sounds/high.mp3', (buffer) => {
  sound2.setBuffer(buffer);
  sound2.setVolume(2);
});
//-------------------------------------------------------


//-------------------------------------------------------
// Setup Cannon.js physics world
const world = new CANNON.World();
world.gravity.set(0, -9, 0); // Gravity pointing downwards
//-------------------------------------------------------

//-------------------------------------------------------
// Load the GLTF Plinko board
let plinkoBoard;
const gltfLoader = new GLTFLoader();
gltfLoader.load('/assets/board.gltf', (gltf) => {
  plinkoBoard = gltf.scene;
  scene.add(plinkoBoard);
  gltf.scene.rotation.y = Math.PI / 1;

  let pinIndex = 0;

  gltf.scene.traverse((child) => {
    if (child.isMesh && child.name.includes("Cylinder")) { // Assuming "pin" is in the name
      const { x, y, z } = child.position;
      const radius = child.scale.x / 2; // Assuming uniform scaling

      child.castShadow = true;
      child.receiveShadow = true;
      createPin(x, y, z, radius, pinIndex);


      pinIndex++;
    }

  });

  // console.log('**', plinkoBoard)

  //-------------------------------------------------------
  // Compute bounding box
  const bbox = new THREE.Box3().setFromObject(plinkoBoard);
  const boardWidth = bbox.max.x - bbox.min.x;
  const boardHeight = bbox.max.y - bbox.min.y;



  // console.log("Board Width:", boardWidth, "Board Height:", boardHeight);
  //-------------------------------------------------------


  // Create dynamic left and right walls based on board width
  createWall(bbox.min.x / 1.1, plinkoBoard.position.y, 0, 0.5, boardHeight * 2, 10); // Left wall
  createWall(bbox.max.x / 1.1, plinkoBoard.position.y, 0, 0.5, boardHeight * 2, 10); // Right wall

  // Create a front wall (barrier to prevent balls from escaping)
  const frontWallOffset = 1.5; // Distance in front of the board

  //Backwall
  createWall(0, plinkoBoard.position.y, bbox.min.z - frontWallOffset + 1, boardWidth, boardHeight * 2, 0.2);

  //front wall
  createWall(0, plinkoBoard.position.y, .5, boardWidth, boardHeight * 2, 0.2);

  //Floor
  createWall(0, -1, 0, boardWidth, 1, 20);


  createBuckets();
  createButton(0, .5, 14, "Add Ball", () => {
    createBall(0, 200, 0);
  });

});

// Camera position
camera.position.set(0, 2, 17);
camera.lookAt(0, 3, 0);
//-------------------------------------------------------

let wallet = 0;
const bucketBodies = [];


//-------------------------------------------------------
function createBucket() {
  gltfLoader.load('/assets/obj_winBox.glb', (gltf) => {
    const catcher = gltf.scene;
    catcher.position.set(0, 1.5, .5); // Adjust position as needed
    catcher.scale.set(8, 3, 5); // Adjust size if necessary
    catcher.rotation.y = -Math.PI / 2;
    scene.add(catcher);
  });
}
//-------------------------------------------------------

//-------------------------------------------------------
function createBuckets() {
  gltfLoader.load('/assets/obj_winBox.glb', (gltf) => {
    const bucketSpacing = 3;      // Adjust spacing between buckets
    const startX = -6;            // Starting position for first bucket

    for (let i = 0; i < 5; i++) {
      const catcher = gltf.scene.clone();  // Clone the bucket model
      catcher.position.set(startX + i * bucketSpacing, 3, 0);  // Position the bucket
      catcher.scale.set(8, 3, 5);  // Scale the bucket
      catcher.rotation.y = -Math.PI / 2;  // Rotate correctly
      scene.add(catcher);

      // Create Cannon.js body for the bucket
      const body = new CANNON.Body({
        mass: 0,  // Static object
      });


      const floorBucket = new CANNON.Material("floorBucket")
      // 🟩 Create individual wall shapes and positions
      createWall(-catcher.position.x-1.5, 1.5, 0, .2, 1, 3); // Left wall
      // createWall(-catcher.position.x+1.1, 1.3, 0, .1, 1, 3,Math.PI/1.3); // Left wall
      // const leftWall = new CANNON.Box(new CANNON.Vec3(0.4, .8, 1));  // Thin vertical left wall
      // const rightWall = new CANNON.Box(new CANNON.Vec3(0.4, .8, 1)); // Thin vertical right wall
      const bottomWall = new CANNON.Box(new CANNON.Vec3(2, 0.2, 1));    // Thin horizontal bottom wall

      // body.addShape(leftWall, new CANNON.Vec3(-1.5, -1.3, 1));    // Left of the bucket
      // body.addShape(rightWall, new CANNON.Vec3(1.5, -1.3, 1));    // Right of the bucket
      body.addShape(bottomWall, new CANNON.Vec3(0, -2, 0));  // Bottom of the bucket

      bottomWall.material = floorBucket;
      // Set body position to match the bucket model
      body.position.set(catcher.position.x, catcher.position.y, catcher.position.z);
      world.addBody(body);
      bucketBodies.push(body);  // Store for future use


      // Create visible wireframes for each wall
      // createWireframeBox(new THREE.Vector3(0.4, 1, 1), new THREE.Vector3(-1.5, -1.3, 1), catcher);   // Left wall
      // createWireframeBox(new THREE.Vector3(0.4, 1, 1), new THREE.Vector3(1.5, -1.3, 1), catcher);    // Right wall
      createWireframeBox(new THREE.Vector3(1, 0.1, 1), new THREE.Vector3(0, -1.5, 0), catcher);   // Bottom wall


      body.floorBucket = floorBucket;
      body.floorBucket.multiplier = i+1;
      body.bottomWall = bottomWall;

    }
  });
}

//-------------------------------------------------------


//-------------------------------------------------------
const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, visible: false });

function createWireframeBox(size, position, catcher) {
  const boxGeometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);  // Double size for Three.js
  const edges = new THREE.EdgesGeometry(boxGeometry);
  const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
  wireframe.position.copy(position);  // Position the wireframe correctly
  wireframe.position.add(catcher.position);  // Offset by bucket's position
  scene.add(wireframe);
}
//-------------------------------------------------------


//-------------------------------------------------------
// Create ball function with physics
const balls = [];
let ballBodies = [];

function createBall(x, y, z, radius = 0.1, color = 0xff0000) {

  //-------------------------------------------------------
  // Ball mesh
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshStandardMaterial({ color });
  const ball = new THREE.Mesh(geometry, material);
  ball.position.set(x, y, z);
  ball.castShadow = true;
  ball.receiveShadow = true;
  scene.add(ball);
  balls.push(ball);
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Cannon.js physics body
  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({
    mass: 1, // Dynamic object
    shape,
    position: new CANNON.Vec3(x, y, z),
    material: bouncyBall,
    linearDamping: 0,
  });
  //-------------------------------------------------------

  // body.velocity.set(5, 2, 0);
  // body.applyForce(new CANNON.Vec3(0, -500, 0), body.position);

  body.collisionFilterGroup = 2;
  body.collisionFilterMask = 1;
  body.velocity.z = 0;

  world.addBody(body);

  body.addEventListener("collide", (event) => {
    const otherBody = event.body; // The object it collided with
    // console.log(event, '^^^^^^^^', otherBody.mesh);

    if (otherBody.mesh) {
      const sound = otherBody.mesh.userData.sound;
      const soundBuffer = otherBody.mesh.userData.sound.buffer; // Get the buffer from the pin's sound
      wallet++;
      if (soundBuffer) {
        const newSound = new THREE.Audio(listener); // Create a new audio instance
        newSound.setBuffer(soundBuffer);
        newSound.setVolume(2);
        newSound.setLoop(false);
        newSound.play(); // Play a separate sound instance
      }
      console.log('$', wallet);
    }



    if (otherBody.floorBucket && otherBody.floorBucket.name === "floorBucket") {
      const floorMultiplier = Number(otherBody.floorBucket.mutliplier);
      // wallet = Number(wallet) + floorMultiplier ;

      const { x, y, z } = ball.position;
      // Create a coin at the ball's last position
      createCoin(x, 1, 0);

      // setTimeout(() => {
        scene.remove(ball);
        world.removeBody(body);

        // Dispose of geometry and material to free memory
        geometry.dispose();
        material.dispose();
        // Remove ball mesh and physics body
      // }, 4000);
      console.log('$', wallet);

    }


  });

  ballBodies.push(body);
}
//-------------------------------------------------------


//-------------------------------------------------------
const coins = []
const coinBodies = [];
function createCoin(x, y, z, radius = 0.1) {
  const coinGeometry = new THREE.CylinderGeometry(.5, .5, 0.2, 32); // (radiusTop, radiusBottom, height, segments)
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700, // Gold color
    metalness: 0.8,
    roughness: 0.3,
  });

  const coin = new THREE.Mesh(coinGeometry, coinMaterial);
  coin.position.set(x, y, z); // Set position
  coin.cast = true;
  coin.receiveShadow = true;
  coin.rotation.y = Math.PI / 2; // Lay it flat
  scene.add(coin);
  coins.push(coin);

  // Cannon.js physics body
  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({
    mass: 1, // Dynamic object
    shape,
    position: new CANNON.Vec3(x, y, z),
    linearDamping: 0,
  });


  //-6 to -5.8 = +1
  //-2.7 to -3.8 = +2
  //.8 to -.6 = 3
  //2.2 to 4 = 4
  //6 to 5.5 = 5

  switch (true) {
    case x > -6 && x < -4.9:
      wallet++;
      console.log('Multiplier +1');
      break;

    case x > -4.2 && x < -2.4:
      wallet += 2;
      console.log('Multiplier +2');
      break;

    case x > -0.96 && x < 0.8:
      wallet += 3;
      console.log('Multiplier +3');
      break;

    case x > 2.1 && x < 4:
      wallet += 4;
      console.log('Multiplier +4');
      break;

    case x > 5.5 && x < 6:
      wallet += 5;
      console.log('Multiplier +5');
      break;
  }

  body.collisionFilterGroup = 2;
  body.collisionFilterMask = 1;

  world.addBody(body);
  coinBodies.push(body);

}

//-------------------------------------------------------


//-------------------------------------------------------
// Function to create static walls
function createWall(x, y, z, width, height, depth, rotationY = 0) {
  const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height, depth / 2));
  const body = new CANNON.Body({
    mass: 0, // Static object (doesn't move)
    shape: shape,
    position: new CANNON.Vec3(x, y, z),
  });

  // Apply rotation to physics body
  const quaternion = new CANNON.Quaternion();
  quaternion.setFromEuler(0, rotationY, 0); // Rotate around Y-axis
  body.quaternion.copy(quaternion)

  world.addBody(body);

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
  const mesh = new THREE.Mesh(geometry, material);

  // Sync mesh position with physics body
  mesh.position.set(x, y, z);

  //Rotate the wall
  mesh.rotation.z = rotationY;

  // scene.add(mesh); // Add to Three.js scene

  // console.log('ROTATE', mesh)


  // Store wall reference for updating in animation loop
  return { body, mesh };
}
//-------------------------------------------------------

//-------------------------------------------------------
// Function to create Plinko pins as physics objects
function createPin(x, y, z, radius, pinIndex) {
  // Create Cannon.js physics body
  const shape = new CANNON.Sphere(radius * 1.3);
  const body = new CANNON.Body({
    mass: 0, // Static pin (does not move)
    shape: shape,
    position: new CANNON.Vec3(x, y, z),
    material: bouncyPin,
  });
  body.userData = { type: "pin" };
  world.addBody(body);

  // Create a visual representation
  const geometry = new THREE.SphereGeometry(radius, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh);


  // Attach sound to pin
  const sound = new THREE.PositionalAudio(listener);
  sound.setBuffer(pinIndex < 5 ? sound1.buffer : sound2.buffer); // Random sound variation
  sound.setVolume(0.5);
  sound.setLoop(false)
  mesh.add(sound);
  mesh.userData.sound = sound;
  body.mesh = mesh

  // console.log(`Plinko Pin added at (${x}, ${y}, ${z})`);
  return { body, mesh }
}
//-------------------------------------------------------

//-------------------------------------------------------
function createButton(x, y, z, text = "Click Me", onClick) {
  // Create a plane (button shape)
  const geometry = new THREE.PlaneGeometry(1, 0.5);
  const material = new THREE.MeshBasicMaterial({ color: 0x0B6623, side: THREE.DoubleSide });
  const button = new THREE.Mesh(geometry, material);
  button.position.set(x, y, z);
  scene.add(button);



  // Store button for interaction
  button.userData.isButton = true;
  button.userData.onClick = onClick;
}

//-------------------------------------------------------


//-------------------------------------------------------
const bouncyBall = new CANNON.Material("bouncyBall");
const bouncyPin = new CANNON.Material("bouncyPin");

const contactMaterial = new CANNON.ContactMaterial(bouncyBall, bouncyPin, {
  friction: 2,      // Low friction
  restitution: 2,   // High bounce
});
world.addContactMaterial(contactMaterial);

//-------------------------------------------------------



//-------------------------------------------------------
// Animation loop
function animate() {
  requestAnimationFrame(animate);

  world.step(1 / 60);
  // Sync Three.js ball positions with Cannon.js physics bodies
  // balls.forEach((ball, i) => {
  //   ball.position.copy(ballBodies[i].position);
  //   ball.quaternion.copy(ballBodies[i].quaternion);
  // });

  balls.forEach((ball, i) => {
    const ballBody = ballBodies[i];
    if (ballBody) {
      ball.position.copy(ballBody.position);
      ball.quaternion.copy(ballBody.quaternion);
    }
  });


  coins.forEach((coin, i) => {
    coin.position.copy(coinBodies[i].position);
    coin.quaternion.copy(coinBodies[i].quaternion);
  });

  // buckets.forEach((bucket, i) => {
  //   bucket.position.copy(bucketBodies[i].position);
  //   bucket.quaternion.copy(bucketBodies[i].quaternion);
  // });


  renderer.render(scene, camera);
}
animate();
//-------------------------------------------------------


//-------------------------------------------------------
// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
//-------------------------------------------------------


//-------------------------------------------------------
// button
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener("click", (event) => {
  // Convert mouse position to Three.js coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check if we clicked on a button
  const intersects = raycaster.intersectObjects(scene.children);
  for (let intersect of intersects) {
    if (intersect.object.userData.isButton) {
      const randomX = Math.random() * (1.5 - (-1.5)) + (-1.5);  // Generates a random decimal between -1.5 and 1.5
      createBall(randomX, 14, 0, 0.4, 0xffffff);
    }
  }
});



//-------------------------------------------------------
