import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

let scene, camera, renderer, controls, dragControls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let objects = [];
let directionalLight;
const moveSpeed = 0.05;
const keysPressed = {};
let isDraggingFace = false;
let faceNormal = new THREE.Vector3();
let dragStartY = 0;
let isShiftDown = false;
let isExpanding = false; // ya deberías tener esto
let activeBox = null;
const statusText = document.getElementById('molding-status');
window.selectedObject = null;
const infoLabel = document.getElementById('infoLabel');
const tempVec = new THREE.Vector3();

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

  // Luz direccional principal
  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(directionalLight);

  // Esfera que representa la luz
  const lightSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  lightSphere.position.copy(new THREE.Vector3(5, 10, 7.5));
  directionalLight.position.copy(lightSphere.position);
  lightSphere.name = 'lightSphere';

  scene.add(lightSphere);
  objects.push(lightSphere); // que pueda arrastrarse

  // Luz ambiente suave
  scene.add(new THREE.AmbientLight(0x404040));

  const grid = new THREE.GridHelper(20, 20);
  scene.add(grid);

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('click', onMouseClick);
  window.addEventListener('dblclick', onDoubleClick);
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
  dragControls.addEventListener('drag', (event) => {
    if (event.object.name === 'lightSphere') {
      directionalLight.position.copy(event.object.position);
    }
  });
}

function onMouseClick(event) {
  if (event.target.closest('#ui') || event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects);

  if (intersects.length > 0) {
      const intersect = intersects[0];
      selectedObject = intersect.object;

      // Mostrar UI si es parte del UI
      if (intersect.object.name === 'ui') {
          selectedObject = null;
          return;
      }

      // Si Shift está presionado, activamos el modo moldeo
      if (isShiftDown) {
          faceNormal.copy(intersect.face.normal)
              .transformDirection(selectedObject.matrixWorld)
              .normalize();
          dragStartY = event.clientY;
          isDraggingFace = true;
      } else {
          // Selección simple
          selectedObject.material.emissive.set(0x444444);
      }
  } else {
      if (selectedObject) {
          selectedObject.material.emissive.set(0x000000);
      }
      selectedObject = null;
  }
}

function highlightSelected(obj) {
  removeHighlights();
  if (obj) {
    obj.material.emissive = new THREE.Color(0x333333);
  }
}

function removeHighlights() {
  objects.forEach(o => o.material.emissive = new THREE.Color(0x000000));
}

function changeColor(event) {
  const newColor = new THREE.Color(event.target.value);
  if (selectedObject) {
    selectedObject.material.color = newColor;
  }
}

function deleteSelected() {
  if (!selectedObject) return;
  scene.remove(selectedObject);
  objects = objects.filter(o => o !== selectedObject);
  selectedObject = null;
  window.selectedObject = null;
  updateDragControls();
}

function applyTexture(event) {
  const file = event.target.files[0];
  if (!file || !selectedObject) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const texture = new THREE.TextureLoader().load(e.target.result);
    selectedObject.material.map = texture;
    selectedObject.material.needsUpdate = true;
  };
  reader.readAsDataURL(file);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  handleFreeCameraMovement();
  controls.update();
  renderer.render(scene, camera);
  if (selectedObject) {
    // Obtener dimensiones
    const bbox = new THREE.Box3().setFromObject(selectedObject);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const ancho = size.x.toFixed(2);
    const alto = size.y.toFixed(2);
    const profundo = size.z.toFixed(2);
    const area = (size.x * size.y).toFixed(2); // asumiendo m² como X * Y

    // Proyectar al espacio 2D
    bbox.getCenter(tempVec);
    tempVec.project(camera);

    const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

    // Posicionar y mostrar
    infoLabel.style.left = `${x}px`;
    infoLabel.style.top = `${y}px`;
    infoLabel.innerHTML = `
        <strong>Medidas:</strong><br>
        Ancho: ${ancho} m<br>
        Alto: ${alto} m<br>
        Profundo: ${profundo} m<br>
        Área: ${area} m²
    `;
    infoLabel.style.display = 'block';
  } else {
      infoLabel.style.display = 'none';
  }
}

function handleFreeCameraMovement() {
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0); // Y-axis

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  right.crossVectors(forward, up).normalize();

  if (keysPressed['w']) camera.position.add(forward.clone().multiplyScalar(moveSpeed));
  if (keysPressed['s']) camera.position.add(forward.clone().multiplyScalar(-moveSpeed));
  if (keysPressed['a']) camera.position.add(right.clone().multiplyScalar(-moveSpeed));
  if (keysPressed['d']) camera.position.add(right.clone().multiplyScalar(moveSpeed));
  if (keysPressed['q']) camera.position.y += moveSpeed;
  if (keysPressed['e']) camera.position.y -= moveSpeed;

  controls.update(); // Para mantener OrbitControls sincronizado
}

function onDoubleClick(event) {
  // No activar si se clickea en el UI
  if (event.target.closest('#ui') || event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') {
    return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects, true);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    const point = intersect.point;
    const object = intersect.object;

    // Calcular dirección desde la cámara hacia el punto clickeado
    const direction = new THREE.Vector3().subVectors(camera.position, point).normalize();

    // Nueva posición de la cámara (un poco alejada del punto)
    const newCamPos = new THREE.Vector3().addVectors(point, direction.multiplyScalar(3));

    // Transición suave
    moveCameraTo(newCamPos, object.position);
  }
}

function moveCameraTo(newPosition, lookAtTarget) {
  const duration = 600; // milisegundos
  const start = {
    position: camera.position.clone(),
    target: controls.target.clone()
  };
  const end = {
    position: newPosition.clone(),
    target: lookAtTarget.clone()
  };

  const startTime = performance.now();

  function animateCamera(time) {
    const elapsed = time - startTime;
    const t = Math.min(elapsed / duration, 1);

    camera.position.lerpVectors(start.position, end.position, t);
    controls.target.lerpVectors(start.target, end.target, t);
    controls.update();

    if (t < 1) {
      requestAnimationFrame(animateCamera);
    }
  }

  requestAnimationFrame(animateCamera);
}

window.addEventListener('mousemove', (event) => {
  if (!isDraggingFace || !selectedObject || !isShiftDown || !faceNormal) return;

  const deltaY = event.clientY - dragStartY;
  dragStartY = event.clientY;

  const scaleAmount = deltaY * -0.01;

  // Crear un vector de escala
  const scale = new THREE.Vector3(1, 1, 1);
  if (Math.abs(faceNormal.x) > 0.9) scale.x += scaleAmount * Math.sign(faceNormal.x);
  if (Math.abs(faceNormal.y) > 0.9) scale.y += scaleAmount * Math.sign(faceNormal.y);
  if (Math.abs(faceNormal.z) > 0.9) scale.z += scaleAmount * Math.sign(faceNormal.z);

  // Aplicar la escala
  selectedObject.scale.multiply(scale);

  // Prevenir reducción a cero
  selectedObject.scale.x = Math.max(0.1, selectedObject.scale.x);
  selectedObject.scale.y = Math.max(0.1, selectedObject.scale.y);
  selectedObject.scale.z = Math.max(0.1, selectedObject.scale.z);

  // Mover el objeto en dirección contraria a la normal para simular crecimiento desde la cara
  const movement = faceNormal.clone().multiplyScalar(scaleAmount * 0.5); // el 0.5 lo podés ajustar
  selectedObject.position.add(movement);
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') {
    isShiftDown = false;
    isDraggingFace = false; // Esto detiene la expansión inmediatamente
    faceNormal = null;
    document.body.classList.remove('molding-mode');
    statusText.textContent = 'Modo Moldeo: OFF';
    statusText.style.background = 'rgba(128, 0, 0, 0.8)';
  }
});

// Escalar y rotar
window.rotateObject = function (axis, degrees) {
  if (!selectedObject) return;
  const radians = degrees * (Math.PI / 180);
  selectedObject.rotation[axis] = radians;
};

window.scaleObject = function (axis, value) {
  if (!selectedObject) return;
  selectedObject.scale[axis] = parseFloat(value);
};

// Luz: funciones expuestas al HTML
window.updateLightPosition = function (axis, value) {
  directionalLight.position[axis] = parseFloat(value);
};

window.updateLightIntensity = function (value) {
  directionalLight.intensity = parseFloat(value);
};

window.updateLightColor = function (value) {
  directionalLight.color = new THREE.Color(value);
};

document.addEventListener('keydown', (e) => {
  keysPressed[e.key.toLowerCase()] = true;
  if (event.key === 'Shift') {
    isShiftDown = true;
    document.body.classList.add('molding-mode');
    statusText.textContent = 'Modo Moldeo: ON';
    statusText.style.background = 'rgba(0, 128, 0, 0.8)';
  }
});

document.addEventListener('keyup', (e) => {
  keysPressed[e.key.toLowerCase()] = false;
  if (event.key === 'Shift') {
    isShiftDown = false;
    document.body.classList.remove('molding-mode');
    statusText.textContent = 'Modo Moldeo: OFF';
    statusText.style.background = 'rgba(128, 0, 0, 0.8)';
    if (isExpanding) {
      isExpanding = false;
      activeBox = null;
    }
  }
});


globalThis.addCube = addCube;
globalThis.addSphere = addSphere;
globalThis.addCylinder = addCylinder;
globalThis.changeColor = changeColor;
globalThis.deleteSelected = deleteSelected;
globalThis.applyTexture = applyTexture;
