import type { CSSProperties } from "react";
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
  selectLayer: (id: string) => void;
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

function LayerWheel({ layer, selected, onSelect }: { layer: HudLayer; selected: boolean; onSelect: () => void }) {
  const tiles = layer.tiles.slice(0, layer.slots);
  return <button className="layer-wheel-button" onClick={onSelect} aria-label={`Edit ${layer.name}`}>
    <svg className="layer-wheel" viewBox="0 0 120 120" role="img" aria-label={`${layer.name}, ${layer.slots} slots`}>
      <circle className="layer-wheel-orbit" cx="60" cy="60" r="52"/>
      {tiles.map((tile, index) => {
        const angle = -Math.PI / 2 + (index + .5) * Math.PI * 2 / layer.slots;
        const icon = point(35.5, angle);
        const depth = point(45, angle);
        return <g key={tile.id}>
          <path className="layer-wheel-sector" d={sectorPath(index, layer.slots)} style={{ "--wheel-accent": layer.accent } as CSSProperties}/>
          <text className="layer-wheel-icon" x={icon.x} y={icon.y + 2.5}>{tile.icon || "+"}</text>
          {tile.children?.length ? <circle className="layer-wheel-depth" cx={depth.x} cy={depth.y} r="2.2"/> : null}
        </g>;
      })}
      <circle className="layer-wheel-dash" cx="60" cy="60" r="18"/>
      <circle className="layer-wheel-hub" cx="60" cy="60" r="12" style={{ "--wheel-accent": layer.accent } as CSSProperties}/>
      {selected ? <circle className="layer-wheel-selected" cx="60" cy="60" r="56"/> : null}
    </svg>
    <span className="layer-wheel-title"><strong>{layer.name}</strong><small>{layer.slots} slots - {layer.shortcut || "No hotkey"}</small></span>
  </button>;
}

export function LayerMap({ profile, selectedLayerId, selectLayer, addLayer, moveLayer }: LayerMapProps) {
  const main = profile.layers.find(item => item.id === "main") ?? profile.layers[0];
  const directional = profile.layers.filter(item => item.id !== main.id);
  const openDirection = directions.find(direction => !directional.some(item => item.position === direction.id));

  return <section className="layer-map-panel">
    <header>
      <div><span>HUD ORBIT</span><h2>Your HUDs, arranged spatially</h2><p>Each wheel is the actual HUD in that direction. Select one to edit its wedges and hold layers.</p></div>
      <button className="primary" disabled={!openDirection} onClick={() => openDirection && addLayer(openDirection.id)}><Plus size={15}/> Add HUD layer</button>
    </header>
    <div className="layer-map-canvas">
      {directions.map(({ id, label, hint, icon: Icon }) => {
        const item = directional.find(candidate => candidate.position === id);
        if (!item) return <button key={id} className={`layer-drop-zone direction-${id}`} onClick={() => addLayer(id)}><Icon size={20}/><strong>Add HUD</strong><span>{label} - {hint}</span></button>;
        return <article key={id} className={`layer-map-card direction-${id} ${selectedLayerId === item.id ? "selected" : ""}`}>
          <LayerWheel layer={item} selected={selectedLayerId === item.id} onSelect={() => selectLayer(item.id)}/>
          <footer><span>{label} HUD</span><label><span className="sr-only">Direction</span><select value={item.position} onChange={event => moveLayer(item.id, event.target.value as HudDirection)}>{directions.map(direction => <option key={direction.id} value={direction.id}>{direction.label}</option>)}</select></label></footer>
        </article>;
      })}
      <article className={`layer-map-card main-layer ${selectedLayerId === main.id ? "selected" : ""}`}>
        <LayerWheel layer={main} selected={selectedLayerId === main.id} onSelect={() => selectLayer(main.id)}/>
        <footer><span><Layers size={13}/> Main HUD - fixed</span><button onClick={() => selectLayer(main.id)}>Edit</button></footer>
      </article>
    </div>
  </section>;
}
