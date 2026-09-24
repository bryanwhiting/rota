import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { HudDirection, HudLayer } from "../types";

interface HudSceneProps {
  layer: HudLayer;
  layerIndex: number;
  layerCount: number;
  animate: boolean;
  onNavigate: (direction: HudDirection) => void;
  editable?: boolean;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onSelectChild?: (tileIndex: number, childIndex: number) => void;
  onAddDeep?: (index: number) => void;
}

interface DragState {
  active: boolean;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  hold?: number;
  didHold: boolean;
}

const directionFromDelta = (x: number, y: number): HudDirection =>
  Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : (y < 0 ? "up" : "down");

export function HudScene({
  layer,
  layerIndex,
  layerCount,
  animate,
  onNavigate,
  editable = false,
  selectedIndex,
  onSelect,
  onSelectChild,
  onAddDeep
}: HudSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const sceneApi = useRef<{ group: THREE.Group; target: THREE.Quaternion; velocity: THREE.Vector2 } | null>(null);
  const drag = useRef<DragState>({ active: false, x: 0, y: 0, lastX: 0, lastY: 0, didHold: false });
  const [selected, setSelected] = useState<number | null>(selectedIndex ?? null);
  const [deep, setDeep] = useState(false);
  const selectedRef = useRef<number | null>(null);
  const deepRef = useRef(false);
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const selectedTile = selected === null ? undefined : layer.tiles[selected];
  const showDeep = deep || Boolean(editable && selectedTile?.children?.length);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { deepRef.current = showDeep; }, [showDeep]);
  useEffect(() => {
    if (selectedIndex !== undefined) setSelected(selectedIndex);
  }, [selectedIndex, layer.id]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 8.7);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(2.27, 2.3, 128),
      new THREE.MeshBasicMaterial({ color: layer.accent, transparent: true, opacity: 0.58, side: THREE.DoubleSide })
    );
    root.add(rim);
    const innerAccent = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.735, 96),
      new THREE.MeshBasicMaterial({ color: layer.accent, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    innerAccent.position.z = 0.025;
    root.add(innerAccent);

    const count = Math.max(2, layer.slots);
    const sectors: THREE.Mesh[] = [];
    for (let index = 0; index < count; index += 1) {
      const slice = Math.PI * 2 / count;
      const gap = Math.min(0.075, slice * 0.16);
      const start = -slice / 2 + index * slice + gap / 2;
      const geometry = new THREE.RingGeometry(0.92, 2.24, 64, 1, start, slice - gap);
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(index % 2 ? "#0b2032" : "#0d263c"),
        emissive: new THREE.Color(layer.accent),
        emissiveIntensity: 0.018,
        roughness: 0.28,
        metalness: 0.28,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        clearcoat: 0.8,
        clearcoatRoughness: 0.22
      });
      const mesh = new THREE.Mesh(geometry, material);
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: layer.accent, transparent: true, opacity: 0.42 })
      );
      mesh.add(outline);
      mesh.userData.outline = outline;
      mesh.position.z = index % 2 ? 0.005 : 0;
      sectors.push(mesh);
      root.add(mesh);
    }

    const center = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 64),
      new THREE.MeshPhysicalMaterial({
        color: "#244c73",
        emissive: layer.accent,
        emissiveIntensity: 0.12,
        roughness: 0.26,
        metalness: 0.35
      })
    );
    center.position.z = 0.035;
    root.add(center);

    const glow = new THREE.PointLight(layer.accent, 7, 12, 2);
    glow.position.set(-1.5, 1.4, 3.5);
    scene.add(glow);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));

    const api = { group: root, target: new THREE.Quaternion(), velocity: new THREE.Vector2() };
    sceneApi.current = api;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    let frame = 0;
    const timer = new THREE.Timer();
    timer.connect(document);
    const tick = (timestamp: number) => {
      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 1 / 24);
      if (!reducedMotion && animate) {
        root.rotation.y += api.velocity.x * dt;
        root.rotation.x += api.velocity.y * dt;
        api.velocity.multiplyScalar(Math.pow(0.0008, dt));
        root.quaternion.slerp(api.target, 1 - Math.pow(0.00008, dt));
      } else {
        root.quaternion.copy(api.target);
      }
      sectors.forEach((sector, index) => {
        const material = sector.material as THREE.MeshPhysicalMaterial;
        const outline = (sector.userData.outline as THREE.LineSegments).material as THREE.LineBasicMaterial;
        const active = selectedRef.current === index;
        material.color.set(active ? "#134870" : index % 2 ? "#0b2032" : "#0d263c");
        material.emissiveIntensity = active ? 0.28 : 0.018;
        outline.opacity += ((active ? 1 : 0.42) - outline.opacity) * 0.2;
        sector.position.z += ((active ? 0.1 : index % 2 ? 0.005 : 0) - sector.position.z) * 0.2;
      });
      const scale = deepRef.current ? 0.92 : 1;
      root.scale.lerp(new THREE.Vector3(scale, scale, 1), 0.16);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      timer.dispose();
      observer.disconnect();
      renderer.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.domElement.remove();
      sceneApi.current = null;
    };
  }, [layer.id, layer.slots, layer.accent, animate, reducedMotion]);

  useEffect(() => {
    const api = sceneApi.current;
    if (!api) return;
    const angle = (layerIndex / Math.max(1, layerCount)) * Math.PI * 2;
    api.target.setFromEuler(new THREE.Euler(-0.06, Math.sin(angle) * 0.06, -angle * 0.035));
  }, [layerIndex, layerCount]);

  const selectFromPoint = (clientX: number, clientY: number): number | null => {
    const bounds = host.current?.getBoundingClientRect();
    if (!bounds) return null;
    const x = clientX - bounds.left - bounds.width / 2;
    const y = clientY - bounds.top - bounds.height / 2;
    const radius = Math.hypot(x, y);
    const diameter = Math.min(bounds.width, bounds.height);
    if (radius < diameter * 0.09 || radius > diameter * 0.42) {
      setSelected(null);
      return null;
    }
    const angle = (Math.atan2(-y, x) + Math.PI * 2) % (Math.PI * 2);
    const index = Math.floor(((angle + Math.PI / layer.slots) % (Math.PI * 2)) / (Math.PI * 2 / layer.slots));
    setSelected(index);
    return index;
  };

  const pointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const hit = selectFromPoint(event.clientX, event.clientY);
    setDeep(false);
    drag.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      didHold: false
    };
    if (hit !== null && layer.tiles[hit]?.children?.length) {
      drag.current.hold = window.setTimeout(() => {
        drag.current.didHold = true;
        setSelected(hit);
        setDeep(true);
      }, 500);
    }
  };

  const pointerMove = (event: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = event.clientX - drag.current.lastX;
    const dy = event.clientY - drag.current.lastY;
    drag.current.lastX = event.clientX;
    drag.current.lastY = event.clientY;
    if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 8) {
      window.clearTimeout(drag.current.hold);
    }
    const api = sceneApi.current;
    if (api) {
      api.group.rotation.y += dx * 0.006;
      api.group.rotation.x += dy * 0.006;
      api.velocity.set(dx * 0.8, dy * 0.8);
    }
    selectFromPoint(event.clientX, event.clientY);
  };

  const pointerUp = (event: React.PointerEvent) => {
    if (!drag.current.active) return;
    window.clearTimeout(drag.current.hold);
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current.active = false;
    if (drag.current.didHold) return;
    if (Math.hypot(dx, dy) > 44) {
      setDeep(false);
      onNavigate(directionFromDelta(dx, dy));
    } else if (selected !== null) {
      setDeep(false);
      onSelect?.(selected);
    }
  };

  const pointerCancel = () => {
    window.clearTimeout(drag.current.hold);
    drag.current.active = false;
    setDeep(false);
  };

  return (
    <div className="hud-scene" ref={host} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}>
      <div className="hud-orbit" aria-hidden="true"><span>{layerIndex + 1}</span> / {layerCount}</div>
      <div className="hud-center-copy" aria-live="polite">
        <strong>ROTA</strong><span>{showDeep ? "HOLD LAYER" : layer.name}</span>
      </div>
      <div className="hud-tile-icons">
        {layer.tiles.slice(0, layer.slots).map((tile, index) => {
          const angle = index / layer.slots * Math.PI * 2;
          return <button key={tile.id} className={selected === index ? "active" : ""}
            aria-label={tile.label}
            style={{ left: `calc(50% + ${Math.cos(angle) * 29}cqmin)`, top: `calc(50% - ${Math.sin(angle) * 29}cqmin)` }}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); setSelected(index); setDeep(false); onSelect?.(index); }}>
            <i>{tile.icon}</i>{tile.children?.length ? <b>{tile.children.length}</b> : null}
          </button>;
        })}
      </div>
      <div className={`hud-labels ${showDeep ? "is-deep" : ""}`}>
        {layer.tiles.slice(0, layer.slots).map((tile, index) => {
          const angle = index / layer.slots * Math.PI * 2;
          const radius = layer.slots > 10 ? 40 + index % 2 * 4 : 44;
          return <button key={tile.id} className={selected === index ? "active" : ""}
            style={{ left: `calc(50% + ${Math.cos(angle) * radius}cqmin)`, top: `calc(50% - ${Math.sin(angle) * radius}cqmin)` }}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); setSelected(index); setDeep(false); onSelect?.(index); }}>
            <span>{tile.label || `Tile ${index + 1}`}</span>
          </button>;
        })}
      </div>
      {editable && selected !== null ? <button className="deep-add"
        aria-label={`Add hold option to ${layer.tiles[selected]?.label}`}
        style={{ left: `calc(50% + ${Math.cos(selected / layer.slots * Math.PI * 2) * 40}cqmin)`, top: `calc(50% - ${Math.sin(selected / layer.slots * Math.PI * 2) * 40}cqmin)` }}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); onAddDeep?.(selected); }}>+</button> : null}
      {showDeep && selected !== null && layer.tiles[selected]?.children?.length ? <div className="deep-fan" aria-label={`Hold options for ${layer.tiles[selected].label}`}>
        {layer.tiles[selected].children!.map((child, index, children) => {
          const origin = selected / layer.slots * Math.PI * 2;
          const angle = origin + (index - (children.length - 1) / 2) * 0.2;
          return <button key={child.id}
            style={{ left: `calc(50% + ${Math.cos(angle) * 43}cqmin)`, top: `calc(50% - ${Math.sin(angle) * 43}cqmin)` }}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); setDeep(false); onSelectChild?.(selected, index); }}>
            <i>{child.icon}</i><span>{child.label}</span>
          </button>;
        })}
      </div> : null}
      <div className="hud-swipe-hint">{editable ? "SELECT A WEDGE - + ADDS A 500 MS HOLD LAYER" : "SWIPE - HOLD 500 MS FOR DEPTH"}</div>
    </div>
  );
}
