import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  hold?: number;
  didHold: boolean;
  hit: number | null;
}

const TAU = Math.PI * 2;
const VIEW_RADIUS = 240;
const SECTOR_INNER = 80;
const SECTOR_OUTER = 140;
const LABEL_RADIUS = 194;

const point = (radius: number, angle: number) => ({
  x: Math.cos(angle) * radius,
  y: Math.sin(angle) * radius
});

function annularPath(inner: number, outer: number, start: number, end: number) {
  const outerStart = point(outer, start);
  const outerEnd = point(outer, end);
  const innerEnd = point(inner, end);
  const innerStart = point(inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    "Z"
  ].join(" ");
}

function sectorGeometry(index: number, count: number, inner = SECTOR_INNER, outer = SECTOR_OUTER) {
  const slice = TAU / count;
  const gap = Math.min(0.08, slice * 0.16);
  const mid = index * slice;
  return {
    mid,
    start: mid - slice / 2 + gap / 2,
    end: mid + slice / 2 - gap / 2,
    path: annularPath(inner, outer, mid - slice / 2 + gap / 2, mid + slice / 2 - gap / 2)
  };
}

const directionFromDelta = (x: number, y: number): HudDirection =>
  Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : (y < 0 ? "up" : "down");

const labelAnchor = (angle: number) => {
  const horizontal = Math.cos(angle);
  return horizontal > 0.28 ? "start" : horizontal < -0.28 ? "end" : "middle";
};

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
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState>({ active: false, x: 0, y: 0, didHold: false, hit: null });
  const [selected, setSelected] = useState<number | null>(selectedIndex ?? null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [holding, setHolding] = useState<number | null>(null);
  const [deep, setDeep] = useState(false);

  useEffect(() => {
    if (selectedIndex !== undefined) setSelected(selectedIndex);
  }, [selectedIndex, layer.id]);

  useEffect(() => () => window.clearTimeout(drag.current.hold), []);

  const count = Math.max(2, layer.slots);
  const tiles = layer.tiles.slice(0, count);
  const activeIndex = hovered ?? selected;
  const deepTile = selected === null ? undefined : tiles[selected];
  const showDeep = deep || Boolean(editable && deepTile?.children?.length);

  const indexFromPoint = (clientX: number, clientY: number) => {
    const element = svg.current;
    const matrix = element?.getScreenCTM();
    if (!element || !matrix) return null;
    const local = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    const radius = Math.hypot(local.x, local.y);
    if (radius < 66 || radius > 148) return null;
    const angle = (Math.atan2(local.y, local.x) + TAU) % TAU;
    const slice = TAU / count;
    return Math.floor(((angle + slice / 2) % TAU) / slice);
  };

  const selectTile = (index: number) => {
    setSelected(index);
    setHovered(index);
    setDeep(false);
    onSelect?.(index);
  };

  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const hit = indexFromPoint(event.clientX, event.clientY);
    setDeep(false);
    drag.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      didHold: false,
      hit
    };
    if (hit !== null && tiles[hit]?.children?.length) {
      setHolding(hit);
      drag.current.hold = window.setTimeout(() => {
        drag.current.didHold = true;
        setSelected(hit);
        setHovered(hit);
        setHolding(null);
        setDeep(true);
      }, 500);
    }
  };

  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const hit = indexFromPoint(event.clientX, event.clientY);
    setHovered(hit);
    if (!drag.current.active) return;
    drag.current.hit = hit;
    if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 8) {
      window.clearTimeout(drag.current.hold);
      setHolding(null);
    }
  };

  const pointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current.active) return;
    window.clearTimeout(drag.current.hold);
    setHolding(null);
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    const hit = drag.current.hit;
    drag.current.active = false;
    if (drag.current.didHold) return;
    if (Math.hypot(dx, dy) > 44) {
      setDeep(false);
      onNavigate(directionFromDelta(dx, dy));
    } else if (hit !== null) {
      selectTile(hit);
    }
  };

  const pointerCancel = () => {
    window.clearTimeout(drag.current.hold);
    drag.current.active = false;
    setHolding(null);
    setDeep(false);
  };

  const keyboardSelect = (event: React.KeyboardEvent<SVGGElement>, index: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectTile(index);
    }
  };

  const selectedGeometry = activeIndex === null ? null : sectorGeometry(activeIndex, count, 146, 176);
  const children = deepTile?.children ?? [];
  const fanWidth = Math.min(0.3, (TAU / count) * 0.42);
  const fanStep = fanWidth + 0.035;
  const selectedMid = selected === null ? 0 : selected * TAU / count;

  return (
    <div className={`hud-scene hud-2d ${showDeep ? "is-deep" : ""} ${animate ? "motion-on" : "motion-off"}`}
      style={{ "--hud-accent": layer.accent } as CSSProperties}>
      <div className="hud-orbit" aria-hidden="true"><span>{layerIndex + 1}</span> / {layerCount}</div>
      <svg ref={svg} className="hud-2d-svg" viewBox={`${-VIEW_RADIUS} ${-VIEW_RADIUS} ${VIEW_RADIUS * 2} ${VIEW_RADIUS * 2}`}
        role="application" aria-label={`${layer.name} radial HUD`}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
        onPointerCancel={pointerCancel} onPointerLeave={() => { if (!drag.current.active) setHovered(null); }}>
        <g key={layer.id} className="hud-2d-wheel">
          <g className="hud-2d-primary">
            <circle className="hud-outer-ring" r="142"/>
            {tiles.map((tile, index) => {
              const geometry = sectorGeometry(index, count);
              const icon = point(110, geometry.mid);
              const labelRadius = count > 10 ? LABEL_RADIUS + index % 2 * 18 : LABEL_RADIUS;
              const label = point(labelRadius, geometry.mid);
              const active = activeIndex === index;
              return <g key={tile.id} className={`hud-sector ${active ? "active" : ""} ${holding === index ? "holding" : ""}`}
                role="button" tabIndex={0} aria-label={`${tile.label}: ${tile.action}`}
                onFocus={() => setHovered(index)} onBlur={() => setHovered(null)}
                onKeyDown={event => keyboardSelect(event, index)}>
                <title>{`${tile.label} - ${tile.action}`}</title>
                <path className="hud-sector-shape" d={geometry.path}/>
                <text className="hud-sector-icon" x={icon.x} y={icon.y} textAnchor="middle" dominantBaseline="central">{tile.icon || "+"}</text>
                {tile.children?.length ? <circle className="hud-depth-dot" cx={point(132, geometry.mid).x} cy={point(132, geometry.mid).y} r="3"/> : null}
                <text className="hud-sector-label" x={label.x} y={label.y} textAnchor={labelAnchor(geometry.mid)} dominantBaseline="central">{tile.label || `TILE ${index + 1}`}</text>
              </g>;
            })}
            <circle className="hud-inner-dash" r="60"/>
            <circle className="hud-hub" r="30"/>
            <text className="hud-hub-title" y="-3" textAnchor="middle">ROTA</text>
            <text className="hud-hub-subtitle" y="10" textAnchor="middle">{showDeep ? "HOLD" : String(layerIndex + 1).padStart(2, "0")}</text>
          </g>

          {showDeep && selected !== null && children.map((child, index) => {
            const mid = selectedMid + (index - (children.length - 1) / 2) * fanStep;
            const path = annularPath(148, 184, mid - fanWidth / 2, mid + fanWidth / 2);
            const icon = point(166, mid);
            return <g key={child.id} className="hud-deep-sector" role="button" tabIndex={0}
              aria-label={`${child.label}: ${child.action}`}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); setDeep(false); onSelectChild?.(selected, index); }}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setDeep(false);
                  onSelectChild?.(selected, index);
                }
              }}>
              <title>{`${child.label} - ${child.action}`}</title>
              <path d={path}/>
              <text x={icon.x} y={icon.y} textAnchor="middle" dominantBaseline="central">{child.icon || ">"}</text>
            </g>;
          })}

          {editable && activeIndex !== null && selectedGeometry ? (() => {
            const hasFan = activeIndex === selected && children.length > 0;
            const addMid = selectedGeometry.mid + (hasFan ? (children.length + 1) / 2 * fanStep : 0);
            const addPath = hasFan
              ? annularPath(148, 184, addMid - fanWidth / 2, addMid + fanWidth / 2)
              : selectedGeometry.path;
            const icon = point(hasFan ? 166 : 161, addMid);
            return <g className="hud-add-sector" role="button" tabIndex={0} aria-label={`Add hold option to ${tiles[activeIndex]?.label}`}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); setSelected(activeIndex); onAddDeep?.(activeIndex); }}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(activeIndex);
                  onAddDeep?.(activeIndex);
                }
              }}>
              <path d={addPath}/>
              <text x={icon.x} y={icon.y} textAnchor="middle" dominantBaseline="central">+</text>
            </g>;
          })() : null}
        </g>
      </svg>
      <div className="hud-swipe-hint">{editable ? "CLICK A WEDGE TO EDIT - + ADDS A 500 MS HOLD ACTION" : "SWIPE TO CHANGE HUD - HOLD 500 MS FOR DEPTH"}</div>
    </div>
  );
}
