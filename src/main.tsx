import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./styles/tokens.css"
import App from "./App.tsx"
import "./styles/app.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
