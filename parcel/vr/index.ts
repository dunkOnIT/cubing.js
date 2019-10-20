import "babel-polyfill"; // Prevent `regeneratorRuntime is not defined` error. https://github.com/babel/babel/issues/5085
import * as THREE from "three";

import { BareBlockMove, BlockMove, Sequence } from "../../src/alg";
import { connect, MoveEvent } from "../../src/bluetooth";
import { Puzzles } from "../../src/kpuzzle";
import { Twisty } from "../../src/twisty";
import { Cube3D } from "../../src/twisty/3d/cube3D";
import {TAU} from "../../src/twisty/3d/twisty3D";

import { Group, Intersection, Material, Mesh, PlaneGeometry, Raycaster, WebGLRenderer, WebVRManager } from "three";
import { BoxLineGeometry } from "three/examples/jsm/geometries/BoxLineGeometry.js";
import { WEBVR } from "../../src/vendor/three/examples/jsm/vr/WebVR";

let initialHeight = parseFloat(new URL(location.href).searchParams.get("height") || "1");
if (isNaN(initialHeight)) {
  initialHeight = 1;
}

let initialScale = parseFloat(new URL(location.href).searchParams.get("scale") || "1");
if (isNaN(initialScale)) {
  initialScale = 1;
}

const cubeCenter = new THREE.Vector3(0, initialHeight, 0);
const twisty = new Twisty(document.createElement("twisty"), {alg: new Sequence([])});
const controlPlanes = [];
let cube3D: Cube3D;

let camera;
let scene;
let renderer: WebGLRenderer;
let controller0;
let controller1;

let room;
const numBouncies = 0;

let count = 0;
const radius = 0.08;
let normal = new THREE.Vector3();
const relativeVelocity = new THREE.Vector3();

const clock = new THREE.Clock();

enum Status {
  Untargeted,
  Targeted,
  Pressed,
}

// From `cube3D.ts`
class AxisInfo {
  public stickerMaterial: THREE.MeshBasicMaterial;
  constructor(public side: string, public vector: THREE.Vector3, public fromZ: THREE.Euler, public color: number) {
    // TODO: Make sticker material single-sided when cubie base is rendered?
    color = 0xffffff; // override
    this.stickerMaterial = new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide});
    this.stickerMaterial.transparent = true;
    this.stickerMaterial.opacity = 0;
  }
}
const axesInfo: AxisInfo[] = [
  new AxisInfo("U", new THREE.Vector3( 0,  1,  0), new THREE.Euler(-TAU / 4,  0,  0), 0xffffff),
  new AxisInfo("L", new THREE.Vector3(-1,  0,  0), new THREE.Euler( 0, -TAU / 4,  0), 0xff8800),
  new AxisInfo("F", new THREE.Vector3( 0,  0,  1), new THREE.Euler( 0,  0,      0), 0x00ff00),
  new AxisInfo("R", new THREE.Vector3( 1,  0,  0), new THREE.Euler( 0,  TAU / 4,  0), 0xff0000),
  new AxisInfo("B", new THREE.Vector3( 0,  0, -1), new THREE.Euler( 0,  TAU / 2,  0), 0x0000ff),
  new AxisInfo("D", new THREE.Vector3( 0, -1,  0), new THREE.Euler( TAU / 4,  0,  0), 0xffff00),
];

init();
animate();

function init(): void {

  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0x505050 );

  camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 1000);

  cube3D = twisty.experimentalGetPlayer().cube3DView.experimentalGetCube3D();
  cube3D.experimentalGetCube().position.copy(cubeCenter);
  cube3D.experimentalUpdateOptions({showFoundation: false, showHintStickers: false});
  setCubeScale(cube3D, initialScale);
  scene.add(cube3D.experimentalGetCube());


  for (const axis of axesInfo) {
    const plane = new THREE.Mesh( new THREE.PlaneGeometry(1, 1), axis.stickerMaterial );
    plane.userData.axis = axis;
    setControlPlaneScale(plane, initialScale);

    plane.userData.side = axis.side;
    plane.userData.status = [Status.Untargeted, Status.Untargeted];

    controlPlanes.push(plane);

    scene.add(plane);
  }

  room = new THREE.LineSegments(
    new BoxLineGeometry( 6, 6, 6, 10, 10, 10 ),
    new THREE.LineBasicMaterial( { color: 0x808080 } ),
  );
  room.geometry.translate( 0, 3, 0 );
  scene.add( room );

  const light = new THREE.HemisphereLight( 0xffffff, 0x444444 );
  light.position.set( 1, 1, 1 );
  scene.add( light );

  //

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.vr.enabled = true;
  document.body.appendChild( renderer.domElement );

  //

  document.body.appendChild( WEBVR.createButton( renderer ) );

  // controllers

  function onSelectStart(): void {

    this.userData.isSelecting = true;

  }

  function onSelectEnd(): void {

    this.userData.isSelecting = false;

  }

  controller0 = renderer.vr.getController( 0 );
  controller0.addEventListener( "selectstart", onSelectStart );
  controller0.addEventListener( "selectend", onSelectEnd );
  controller0.userData.controllerNumber = 0;
  controller0.userData.direction = 1;
  controller0.userData.lastIsSelecting = false;
  controller0.userData.lastSide = "";
  scene.add( controller0 );

  controller1 = renderer.vr.getController( 1 );
  controller1.addEventListener( "selectstart", onSelectStart );
  controller1.addEventListener( "selectend", onSelectEnd );
  controller1.userData.controllerNumber = 1;
  controller1.userData.direction = -1;
  controller1.userData.lastIsSelecting = false;
  controller1.userData.lastSide = "";
  scene.add( controller1 );

  // helpers

  const geometry2 = new THREE.BufferGeometry();
  geometry2.addAttribute( "position", new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
  geometry2.addAttribute( "color", new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

  const material = new THREE.LineBasicMaterial( { /*vertexColors: true,*/ blending: THREE.AdditiveBlending, linewidth: 10, transparent: true, opacity: 0.5 } );

  controller0.add( new THREE.Line( geometry2, material ) );
  controller1.add( new THREE.Line( geometry2, material ) );

  //

  window.addEventListener( "resize", onWindowResize, false );

}

function onWindowResize(): void {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function handleController( controller: Group ): void {
  const euler = new THREE.Euler().setFromQuaternion(controller.quaternion);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion);
  const raycaster = new Raycaster(controller.position, direction);
  const closestIntersection: Intersection | null = ((l) => l.length > 0 ? l[0] : null)(raycaster.intersectObjects(controlPlanes));
  for (const controlPlane of controlPlanes) {
    controlPlane.userData.status[controller.userData.controllerNumber] = Status.Untargeted;
  }

  if (closestIntersection) {
    (closestIntersection.object as Mesh).userData.status[controller.userData.controllerNumber] = controller.userData.isSelecting ? Status.Pressed : Status.Targeted;
  }

  if ( controller.userData.isSelecting ) {
    if (closestIntersection && !areBothControllersSelecting()) {
      const side = closestIntersection.object.userData.side;
      if (controller.userData.isSelecting !== controller.userData.lastIsSelecting || side !== controller.userData.lastSide) {
        twisty.experimentalAddMove(BareBlockMove(side, controller.userData.direction));
        navigator.getGamepads()[controller.userData.controllerNumber].hapticActuators[0].pulse(0.2, 100);
      }
      controller.userData.lastSide = side;
    }
    // if () {
    //   console.log(max, x, y, z);
    //   twisty.experimentalAddMove(BareBlockMove(side, controller.userData.direction));
    // }
    // controller.userData.lastSide = side;

  }
  controller.userData.lastIsSelecting = controller.userData.isSelecting;

}

//

function animate(): void {
  renderer.setAnimationLoop( render );
}

function setControlPlaneScale(controlPlane: Mesh, scale: number): void {
  controlPlane.position.copy(controlPlane.userData.axis.vector);
  controlPlane.position.multiplyScalar(1.502 * scale);
  controlPlane.position.add(cubeCenter);
  controlPlane.setRotationFromEuler(controlPlane.userData.axis.fromZ);
  controlPlane.scale.setScalar(3 * scale);
}

function setCubeScale(cube: Cube3D, scale: number): void {
  cube.experimentalGetCube().scale.setScalar(scale);
}

function setScale(scale: number): void {
  for (const controlPlane of controlPlanes) {
    setControlPlaneScale(controlPlane, scale);
  }
  if (cube3D) {
    setCubeScale(cube3D, scale);
  }
}

function areBothControllersSelecting(): boolean {
  return controller0.userData.isSelecting && controller1.userData.isSelecting;
}

(window as any).setScale = setScale;

let lastSelectingBoth = false;
let selectingBothInitialDistance = 1;
let selectingBothInitialScale = 1;
let currentScale = 1;

function render(): void {

  handleController( controller0 );
  handleController( controller1 );

  if (areBothControllersSelecting()) {
    if (lastSelectingBoth === false) {
      selectingBothInitialDistance = controller0.position.distanceTo(controller1.position);
      selectingBothInitialScale = currentScale;
    } else {
      const newDistance = controller0.position.distanceTo(controller1.position);
      currentScale = selectingBothInitialScale * newDistance / selectingBothInitialDistance;
      setScale(currentScale);
    }
    lastSelectingBoth = true;
  } else {
    lastSelectingBoth = false;
  }

  for (const controlPlane of controlPlanes) {
    if (controlPlane.userData.status[0] === Status.Pressed || controlPlane.userData.status[1] === Status.Pressed) {
      controlPlane.material.opacity = 0.4;
    } else if (controlPlane.userData.status[0] === Status.Targeted || controlPlane.userData.status[1] === Status.Targeted) {
      controlPlane.material.opacity = 0.2;
    } else {
      controlPlane.material.opacity = 0;
    }
  }

  renderer.render( scene, camera );

}