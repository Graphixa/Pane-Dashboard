import React from "react";
import { createRoot } from "react-dom/client";
import "./appStyles";
import "./reference.css";
import ComponentReference from "./ComponentReference";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ComponentReference /></React.StrictMode>,
);
