"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TRANSPARENT } from "@/lib/pixelUtils";
import type { VoxelSprite } from "@/lib/voxelUtils";

type VoxelCanvasProps = {
  voxel: VoxelSprite;
};

function createCamera(width: number, height: number) {
  const aspect = width / Math.max(1, height);
  const viewSize = 14;
  const camera = new THREE.OrthographicCamera(
    (-viewSize * aspect) / 2,
    (viewSize * aspect) / 2,
    viewSize / 2,
    -viewSize / 2,
    0.1,
    100,
  );
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);
  return camera;
}

export default function VoxelCanvas({ voxel }: VoxelCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const dragRef = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const [size, setSize] = useState({ width: 520, height: 360 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      setSize({
        width: Math.max(240, entry.contentRect.width),
        height: Math.max(240, entry.contentRect.height),
      });
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");
    const initialWidth = Math.max(240, host.clientWidth || 520);
    const initialHeight = Math.max(240, host.clientHeight || 360);
    const camera = createCamera(initialWidth, initialHeight);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initialWidth, initialHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#f8fafc", 1);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.x = -0.45;
    group.rotation.y = 0.72;
    scene.add(group);

    scene.add(new THREE.AmbientLight("#ffffff", 1.4));
    const keyLight = new THREE.DirectionalLight("#ffffff", 2.2);
    keyLight.position.set(4, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight("#dbeafe", 0.8);
    fillLight.position.set(-6, 3, -4);
    scene.add(fillLight);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    groupRef.current = group;

    renderer.render(scene, camera);

    return () => {
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) {
      return;
    }

    const aspect = size.width / Math.max(1, size.height);
    const viewSize = 14;
    camera.left = (-viewSize * aspect) / 2;
    camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
    renderScene();
  }, [size.height, size.width]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const group = groupRef.current;
    if (!renderer || !scene || !camera || !group) {
      return;
    }

    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose?.();
      }
    });
    group.clear();

    const solidVoxels: Array<{ x: number; y: number; z: number; color: string }> = [];
    for (let z = 0; z < voxel.depth; z += 1) {
      for (let y = 0; y < voxel.height; y += 1) {
        for (let x = 0; x < voxel.width; x += 1) {
          const color = voxel.voxels[z][y][x];
          if (color !== TRANSPARENT) {
            solidVoxels.push({ x, y, z, color });
          }
        }
      }
    }

    const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.72,
      metalness: 0.02,
      vertexColors: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, solidVoxels.length));
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const offsetX = (voxel.width - 1) / 2;
    const offsetY = (voxel.height - 1) / 2;
    const offsetZ = (voxel.depth - 1) / 2;

    solidVoxels.forEach((item, index) => {
      matrix.makeTranslation(item.x - offsetX, offsetY - item.y, item.z - offsetZ);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(item.color));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    if (solidVoxels.length > 0) {
      group.add(mesh);
    }

    if (solidVoxels.length === 0) {
      const placeholderGeometry = new THREE.BoxGeometry(2, 2, 2);
      const placeholderMaterial = new THREE.MeshBasicMaterial({
        color: "#38bdf8",
        opacity: 0.75,
        transparent: true,
      });
      const placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
      group.add(placeholder);

      const edgeGeometry = new THREE.EdgesGeometry(placeholderGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: "#64748b" });
      group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
    }

    const grid = new THREE.GridHelper(
      Math.max(voxel.width, voxel.depth) + 2,
      Math.max(voxel.width, voxel.depth) + 2,
      "#64748b",
      "#cbd5e1",
    );
    grid.position.y = -offsetY - 0.6;
    group.add(grid);

    const axes = new THREE.AxesHelper(Math.max(voxel.width, voxel.height, voxel.depth) / 2 + 1);
    axes.position.set(-offsetX - 0.8, -offsetY - 0.6, -offsetZ - 0.8);
    group.add(axes);

    const fit = Math.max(voxel.width, voxel.height, voxel.depth, 4);
    camera.zoom = Math.max(0.35, 7 / fit);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [voxel]);

  function renderScene() {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  return (
    <div
      className="relative min-h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerDown={(event) => {
        const group = groupRef.current;
        if (!group) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          x: event.clientX,
          y: event.clientY,
          rx: group.rotation.x,
          ry: group.rotation.y,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        const group = groupRef.current;
        if (!drag || !group) {
          return;
        }
        group.rotation.y = drag.ry + (event.clientX - drag.x) * 0.01;
        group.rotation.x = drag.rx + (event.clientY - drag.y) * 0.01;
        renderScene();
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
      }}
      ref={hostRef}
    >
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-[11px] font-bold text-slate-500 shadow-sm">
        {voxel.width}x{voxel.height}x{voxel.depth} voxels
      </div>
    </div>
  );
}
