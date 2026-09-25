import type { CSSProperties } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Layers, Plus } from "lucide-react";
import type { HudDirection, HudLayer, Profile } from "../types";
import { HudScene } from "./HudScene";

const directions = [
  { id: "up", label: "Above", hint: "Swipe up", icon: ArrowUp },
  { id: "left", label: "Left", hint: "Swipe left", icon: ArrowLeft },
  { id: "right", label: "Right", hint: "Swipe right", icon: ArrowRight },
  { id: "down", label: "Below", hint: "Swipe down", icon: ArrowDown }
] as const;

interface LayerMapProps {
  profile: Profile;
  selectedLayerId: string;
  animate: boolean;
  navigate: (direction: HudDirection) => void;
  editLayer: (id: string, tileIndex?: number, childIndex?: number) => void;
  addDeepOption: (id: string, tileIndex: number) => void;
  addLayer: (direction: HudDirection) => void;
  moveLayer: (id: string, direction: HudDirection) => void;
}

function LayerWheel({ layer, layerIndex, layerCount, animate, navigate, selected, label, editLayer, addDeepOption, moveLayer }: {
  layer: HudLayer;
  layerIndex: number;
  layerCount: number;
  animate: boolean;
  navigate: (direction: HudDirection) => void;
  selected: boolean;
  label: string;
  editLayer: (tileIndex?: number, childIndex?: number) => void;
  addDeepOption: (tileIndex: number) => void;
  moveLayer?: (direction: HudDirection) => void;
}) {
  return <article className={`mini-hud-node ${selected ? "selected" : ""}`} style={{ "--node-accent": layer.accent } as CSSProperties}>
    <div className="mini-hud-wheel">
      <HudScene layer={layer} layerIndex={layerIndex} layerCount={layerCount} animate={animate}
        onNavigate={navigate} editable onEditLayer={() => editLayer()}
        onSelect={index => editLayer(index)} onSelectChild={editLayer} onAddDeep={addDeepOption}/>
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

export function LayerMap({ profile, selectedLayerId, animate, navigate, editLayer, addDeepOption, addLayer, moveLayer }: LayerMapProps) {
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
        return <div key={id} className={`mini-canvas-slot direction-${id}`}><LayerWheel layer={item} layerIndex={profile.layers.indexOf(item)} layerCount={profile.layers.length} animate={animate} navigate={navigate} selected={selectedLayerId === item.id} label={label} editLayer={(tileIndex, childIndex) => editLayer(item.id, tileIndex, childIndex)} addDeepOption={tileIndex => addDeepOption(item.id, tileIndex)} moveLayer={direction => moveLayer(item.id, direction)}/></div>;
      })}
      <div className="mini-canvas-slot main-layer"><LayerWheel layer={main} layerIndex={profile.layers.indexOf(main)} layerCount={profile.layers.length} animate={animate} navigate={navigate} selected={selectedLayerId === main.id} label="Main" editLayer={(tileIndex, childIndex) => editLayer(main.id, tileIndex, childIndex)} addDeepOption={tileIndex => addDeepOption(main.id, tileIndex)}/></div>
    </div>
  </section>;
}
