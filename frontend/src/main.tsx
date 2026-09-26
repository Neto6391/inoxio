import { App as AntApp, ConfigProvider, theme } from "antd";
import ptBR from "antd/locale/pt_BR";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilo.css";

// O servidor troca o marcador por um nonce novo a cada resposta. O antd
// usa esse nonce nos estilos que injeta, e a CSP continua sem 'unsafe-inline'.
const meta = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]');
const nonce = meta && meta.content !== "__CSP_NONCE__" ? meta.content : undefined;

const tema = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#3b82f6",
    colorBgBase: "#0b1016",
    colorBgContainer: "#111821",
    colorBorderSecondary: "#1e2935",
    borderRadius: 6,
    fontFamily:
      "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: { headerBg: "#0d141c", bodyBg: "#0b1016", headerPadding: "0 24px" },
  },
};

createRoot(document.getElementById("raiz") as HTMLElement).render(
  <StrictMode>
    <ConfigProvider locale={ptBR} theme={tema} csp={nonce ? { nonce } : undefined}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
