import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
//import { CSG } from 'https://cdn.jsdelivr.net/npm/three-csg-ts@2.0.5/+esm';


let scene, camera, renderer, controls, dragControls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let objects = [];
window.selectedObject = null;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 7.5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  const grid = new THREE.GridHelper(20, 20);
  scene.add(grid);

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('click', onMouseClick);
}

function addCube() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  addObject(geometry);
}

function addSphere() {
  const geometry = new THREE.SphereGeometry(0.5, 32, 32);
  addObject(geometry);
}

function addCylinder() {
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
  addObject(geometry);
}

function addObject(geometry) {
  const material = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0.5, 0);
  scene.add(mesh);
  objects.push(mesh);

  updateDragControls();
}

function updateDragControls() {
  if (dragControls) dragControls.dispose();

  dragControls = new DragControls(objects, camera, renderer.domElement);
  dragControls.addEventListener('dragstart', () => controls.enabled = false);
  dragControls.addEventListener('dragend', () => controls.enabled = true);
}

function onMouseClick(event) {
  // Si se clickeó sobre un input, button o cualquier control del UI, no hacer nada
  if (event.target.closest('#ui') || event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') {
    return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects);

  if (intersects.length > 0) {
    selectedObject = intersects[0].object;
    window.selectedObject = selectedObject;
    highlightSelected(selectedObject);
  } else {
    selectedObject = null;
    window.selectedObject = null;
    removeHighlights();
  }
}

function highlightSelected(obj) {
  removeHighlights();
  if (obj) {
    obj.material.emissive = new THREE.Color(0x333333); // resalta con leve brillo
  }
}

function removeHighlights() {
  objects.forEach(o => {
    o.material.emissive = new THREE.Color(0x000000);
  });
}

function changeColor(event) {
  const newColor = new THREE.Color(event.target.value);
  if (selectedObject) {
    selectedObject.material.color = newColor;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

globalThis.addCube = addCube;
globalThis.addSphere = addSphere;
globalThis.addCylinder = addCylinder;
globalThis.changeColor = changeColor;

window.rotateObject = function(axis, degrees) {
  if (!selectedObject) return;
  const radians = degrees * (Math.PI / 180);
  selectedObject.rotation[axis] = radians;
  console.log(`Rotando ${axis} a ${degrees}°`);
};

window.scaleObject = function(axis, value) {
  if (!selectedObject) return;
  selectedObject.scale[axis] = parseFloat(value);
  console.log(`Escalando ${axis} a ${value}`);
};

function subtractSphereFromSelected() {
  if (!selectedObject) {
    alert("Seleccioná un objeto primero");
    return;
  }

  const subtractGeo = new THREE.SphereGeometry(0.4, 32, 32);
  const subtractMesh = new THREE.Mesh(subtractGeo, new THREE.MeshStandardMaterial());

  // Posicionar la esfera donde querés hacer el hueco
  subtractMesh.position.copy(selectedObject.position);

  const result = CSG.subtract(selectedObject, subtractMesh);

  // Remplazar el objeto original con el nuevo con hueco
  scene.remove(selectedObject);
  objects = objects.filter(o => o !== selectedObject);
  scene.add(result);
  objects.push(result);
  selectedObject = result;
  window.selectedObject = result;
}
