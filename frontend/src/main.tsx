import { App as AntApp, ConfigProvider, theme, type ThemeConfig } from "antd";
import ptBR from "antd/locale/pt_BR";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { type Tema, useTema } from "./tema";
import "./estilo.css";

// O servidor troca o marcador por um nonce novo a cada resposta. O antd
// usa esse nonce nos estilos que injeta, e a CSP continua sem 'unsafe-inline'.
const meta = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]');
const nonce = meta && meta.content !== "__CSP_NONCE__" ? meta.content : undefined;

const FONTE = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// As mesmas cores das variáveis de estilo.css, para o antd e o resto da tela combinarem.
const TEMAS: Record<Tema, ThemeConfig> = {
  escuro: {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: "#3b82f6",
      colorBgBase: "#0b1016",
      colorBgContainer: "#111821",
      colorBorderSecondary: "#1e2935",
      borderRadius: 8,
      fontFamily: FONTE,
    },
  },
  claro: {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: "#2563eb",
      colorBgBase: "#ffffff",
      colorBgLayout: "#f5f7fa",
      colorBorderSecondary: "#e2e8f0",
      colorText: "#0f172a",
      colorTextSecondary: "#475569",
      borderRadius: 8,
      fontFamily: FONTE,
    },
  },
};

function Raiz() {
  const tema = useTema();
  return (
    <ConfigProvider locale={ptBR} theme={TEMAS[tema]} csp={nonce ? { nonce } : undefined}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("raiz") as HTMLElement).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
);
