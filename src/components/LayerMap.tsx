import type { CSSProperties, KeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Layers, Plus } from "lucide-react";
import type { HudDirection, HudLayer, Profile } from "../types";

const directions = [
  { id: "up", label: "Above", hint: "Swipe up", icon: ArrowUp },
  { id: "left", label: "Left", hint: "Swipe left", icon: ArrowLeft },
  { id: "right", label: "Right", hint: "Swipe right", icon: ArrowRight },
  { id: "down", label: "Below", hint: "Swipe down", icon: ArrowDown }
] as const;

interface LayerMapProps {
  profile: Profile;
  selectedLayerId: string;
  editLayer: (id: string, tileIndex?: number) => void;
  addLayer: (direction: HudDirection) => void;
  moveLayer: (id: string, direction: HudDirection) => void;
}

const point = (radius: number, angle: number) => ({
  x: 60 + Math.cos(angle) * radius,
  y: 60 + Math.sin(angle) * radius
});

function sectorPath(index: number, count: number) {
  const gap = Math.min(0.075, Math.PI / count * 0.24);
  const start = -Math.PI / 2 + index * Math.PI * 2 / count + gap;
  const end = -Math.PI / 2 + (index + 1) * Math.PI * 2 / count - gap;
  const outerStart = point(48, start);
  const outerEnd = point(48, end);
  const innerEnd = point(23, end);
  const innerStart = point(23, start);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A 48 48 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A 23 23 0 0 0 ${innerStart.x} ${innerStart.y}`,
    "Z"
  ].join(" ");
}

function keyboardEdit(event: KeyboardEvent<SVGGElement>, edit: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    edit();
  }
}

function LayerWheel({ layer, selected, label, editLayer, moveLayer }: {
  layer: HudLayer;
  selected: boolean;
  label: string;
  editLayer: (tileIndex?: number) => void;
  moveLayer?: (direction: HudDirection) => void;
}) {
  const tiles = layer.tiles.slice(0, layer.slots);
  return <article className={`mini-hud-node ${selected ? "selected" : ""}`} style={{ "--node-accent": layer.accent } as CSSProperties}>
    <div className="mini-hud-wheel">
      <svg className="layer-wheel" viewBox="0 0 120 120" role="group" aria-label={`${layer.name}, ${layer.slots} editable tiles`}>
        <circle className="layer-wheel-orbit" cx="60" cy="60" r="54"/>
        {tiles.map((tile, index) => {
          const angle = -Math.PI / 2 + (index + .5) * Math.PI * 2 / layer.slots;
          const icon = point(35.5, angle);
          const depth = point(45, angle);
          return <g className="mini-hud-tile" key={tile.id} role="button" tabIndex={0}
            aria-label={`Edit ${tile.label || `tile ${index + 1}`}`}
            onClick={() => editLayer(index)}
            onKeyDown={event => keyboardEdit(event, () => editLayer(index))}>
            <title>{`${tile.label || `Tile ${index + 1}`} - ${tile.action}`}</title>
            <path className="layer-wheel-sector" d={sectorPath(index, layer.slots)} style={{ "--wheel-accent": layer.accent } as CSSProperties}/>
            <text className="layer-wheel-icon" x={icon.x} y={icon.y + 2.5}>{tile.icon || "+"}</text>
            {tile.children?.length ? <circle className="layer-wheel-depth" cx={depth.x} cy={depth.y} r="2.2"/> : null}
          </g>;
        })}
        <circle className="layer-wheel-dash" cx="60" cy="60" r="18"/>
        <circle className="layer-wheel-hub" cx="60" cy="60" r="13" style={{ "--wheel-accent": layer.accent } as CSSProperties}/>
        <circle className="mini-hud-center-hit" cx="60" cy="60" r="17" role="button" tabIndex={0}
          aria-label={`Edit ${layer.name}`}
          onClick={() => editLayer()}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              editLayer();
            }
          }}/>
        {selected ? <circle className="layer-wheel-selected" cx="60" cy="60" r="57"/> : null}
      </svg>
      <button className="mini-hud-name" onClick={() => editLayer()}>
        <strong>{layer.name}</strong>
        <span>{layer.slots} tiles - click a wedge to edit</span>
      </button>
    </div>
    <div className="mini-hud-direction">
      <span>{layer.id === "main" ? <><Layers size={12}/> Main - fixed</> : `${label} HUD`}</span>
      {moveLayer ? <label><span className="sr-only">Direction</span><select value={layer.position} onChange={event => moveLayer(event.target.value as HudDirection)}>{directions.map(direction => <option key={direction.id} value={direction.id}>{direction.label}</option>)}</select></label> : null}
    </div>
  </article>;
}

export function LayerMap({ profile, selectedLayerId, editLayer, addLayer, moveLayer }: LayerMapProps) {
  const main = profile.layers.find(item => item.id === "main") ?? profile.layers[0];
  const directional = profile.layers.filter(item => item.id !== main.id);
  const openDirection = directions.find(direction => !directional.some(item => item.position === direction.id));

  return <section className="layer-map-panel mini-canvas-panel">
    <header>
      <div><span>HUD MINI CANVAS</span><h2>Edit the actual tiles</h2><p>Click any wedge to open that tile. Click a HUD name or center for its full editor.</p></div>
      <button className="primary" disabled={!openDirection} onClick={() => openDirection && addLayer(openDirection.id)}><Plus size={15}/> Add HUD layer</button>
    </header>
    <div className="layer-map-canvas mini-canvas">
      {directions.map(({ id, label, hint, icon: Icon }) => {
        const item = directional.find(candidate => candidate.position === id);
        if (!item) return <button key={id} className={`mini-canvas-empty direction-${id}`} onClick={() => addLayer(id)}><Icon size={18}/><strong>Add {label} HUD</strong><span>{hint}</span></button>;
        return <div key={id} className={`mini-canvas-slot direction-${id}`}><LayerWheel layer={item} selected={selectedLayerId === item.id} label={label} editLayer={tileIndex => editLayer(item.id, tileIndex)} moveLayer={direction => moveLayer(item.id, direction)}/></div>;
      })}
      <div className="mini-canvas-slot main-layer"><LayerWheel layer={main} selected={selectedLayerId === main.id} label="Main" editLayer={tileIndex => editLayer(main.id, tileIndex)}/></div>
    </div>
  </section>;
}
