import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./powered-glass.css";
import "./hud-studio.css";
import "./hud-modal.css";
import "./range-controls.css";
import "./flat-surfaces.css";
import "./hud-2d.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
