import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./tailwind.css";
import App from "./App";
import { ensureGlobalStyles } from "./globalStyles";

const routerBasename =
  import.meta.env.BASE_URL === "/"
    ? ""
    : import.meta.env.BASE_URL.replace(/\/$/, "");

ensureGlobalStyles();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={routerBasename}>
    <App />
  </BrowserRouter>,
);
