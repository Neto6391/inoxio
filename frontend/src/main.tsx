import { App as AntApp, ConfigProvider } from "antd";
import ptBR from "antd/locale/pt_BR";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilo.css";

// O servidor troca o marcador por um nonce novo a cada resposta. O antd
// usa esse nonce nos estilos que injeta, e a CSP continua sem 'unsafe-inline'.
const meta = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]');
const nonce = meta && meta.content !== "__CSP_NONCE__" ? meta.content : undefined;

createRoot(document.getElementById("raiz") as HTMLElement).render(
  <StrictMode>
    <ConfigProvider locale={ptBR} csp={nonce ? { nonce } : undefined}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
