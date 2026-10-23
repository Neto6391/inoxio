import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App as AntApp } from "antd";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { PAGINAS, trilha } from "./navegacao";
import { navegar } from "./rotas";
import { pagina } from "./testes/pagina";

afterEach(() => {
  vi.unstubAllGlobals();
  navegar("/");
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

type Pedido = { caminho: string; metodo: string; corpo: unknown };

const ADMIN = { nome: "chefe", papel: "admin", onboarding_visto: true, termos_pendentes: false };
const ANA = { nome: "ana", papel: "analista", onboarding_visto: true, termos_pendentes: false };
const PERFIL = {
  nome: "ana",
  nome_exibicao: null,
  email: "ana@exemplo.com",
  email_pendente: null,
  papel: "analista",
  criado_em: "2026-10-20T12:00:00",
  email_confirmado_em: "2026-10-20T12:00:00",
  cota_diaria: 10,
  termos_versao: "2026-10-23",
  termos_aceitos_em: "2026-10-23T12:00:00",
};
const GERAL = {
  contas: 1,
  situacoes: { ativa: 1, desativada: 0, aguardando: 0, recusada: 0 },
  usaram_30_dias: 1,
  sem_uso_30_dias: [],
  investigacoes: 0,
  sites_distintos: 0,
  indicadores_distintos: 0,
  ameacas_distintas: 0,
  top_usuarios: [],
};

function servidor(usuario: Record<string, unknown> | null, pedidos: Pedido[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (caminho: string, pedido: RequestInit = {}) => {
      const metodo = pedido.method ?? "GET";
      if (metodo !== "GET") pedidos.push({ caminho, metodo, corpo: pedido.body ? JSON.parse(pedido.body as string) : null });
      if (caminho === "/api/sessao") return json({ usuario, csrf: usuario ? "t" : null });
      if (caminho === "/api/estatisticas/geral") return json(GERAL);
      if (caminho.startsWith("/api/usuarios?") || caminho.startsWith("/api/auditoria/usuarios?")) return json(pagina([]));
      if (caminho === "/api/publico") return json({ contato_privacidade: "dpo@exemplo.com", versao_termos: "2026-10-23" });
      if (caminho === "/api/conta" && metodo === "PATCH") {
        const corpo = JSON.parse(pedido.body as string);
        return json({ ...PERFIL, nome_exibicao: corpo.nome_exibicao.trim() || null });
      }
      if (caminho === "/api/conta") return json(PERFIL);
      if (caminho === "/api/conta/senha") return new Response(null, { status: 204 });
      if (caminho === "/api/conta/email") return json({ mensagem: "Enviamos um link para o e-mail novo." }, 202);
      if (caminho === "/api/conta/email/confirmar") return json({ mensagem: "E-mail trocado." });
      return json([]);
    }),
  );
}

function abrir(caminho: string, usuario: Record<string, unknown> | null = ADMIN, pedidos: Pedido[] = []) {
  servidor(usuario, pedidos);
  navegar(caminho);
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
}

function trilhaNaTela(): string[] {
  const nav = document.querySelector(".trilha .ant-breadcrumb") as HTMLElement;
  return [...nav.querySelectorAll("li")].map((li) => li.textContent ?? "").filter((texto) => texto && texto !== "/");
}

test("todo pai do mapa das telas é uma tela do mapa", () => {
  const caminhos = new Set(PAGINAS.map((pagina) => pagina.caminho));
  for (const pagina of PAGINAS) if (pagina.pai) expect(caminhos).toContain(pagina.pai);
  expect(trilha("/investigacoes/abc-1").map((p) => p.titulo)).toEqual(["Início", "Investigações", "Investigação"]);
  expect(trilha("/usuarios").map((p) => p.titulo)).toEqual(["Visão geral", "Usuários"]);
});

test("na administração o breadcrumb começa na Visão geral, sem o Início", async () => {
  abrir("/usuarios");
  await screen.findByRole("button", { name: "Novo usuário" });
  expect(trilhaNaTela()).toEqual(["Visão geral", "Usuários"]);
  fireEvent.click(within(document.querySelector(".trilha") as HTMLElement).getByRole("link", { name: "Visão geral" }));
  expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/visao-geral");
});

test("Voltar volta para a tela anterior desta aba", async () => {
  abrir("/visao-geral");
  await screen.findByRole("heading", { name: "Visão geral" });
  const conteudo = document.querySelector(".conteudo") as HTMLElement;
  fireEvent.click(within(conteudo).getByRole("link", { name: /Auditoria/ }));
  await waitFor(() => expect(window.location.pathname).toBe("/auditoria"));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  await waitFor(() => expect(window.location.pathname).toBe("/visao-geral"));
});

test("Voltar volta para a tela de onde se veio, mesmo fora da hierarquia", async () => {
  abrir("/painel");
  await screen.findByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), / });
  navegar("/usuarios");
  await screen.findByRole("button", { name: "Novo usuário" });
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  await waitFor(() => expect(window.location.pathname).toBe("/painel"));
});

test("sem tela anterior, Voltar sobe um nível", async () => {
  servidor(ADMIN);
  window.history.replaceState(null, "", "/usuarios");
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  await screen.findByRole("button", { name: "Novo usuário" });
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  await waitFor(() => expect(window.location.pathname).toBe("/visao-geral"));
});

test("a Administração abre na Visão geral e só então mostra as telas dela", async () => {
  abrir("/painel");
  const menu = await screen.findByRole("navigation", { name: "Menu principal" });
  expect(within(menu).queryByRole("link", { name: "Usuários" })).toBeNull();
  fireEvent.click(within(menu).getByRole("link", { name: /Administração/ }));
  expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
  expect(within(menu).getByRole("link", { name: "Usuários" })).toHaveAttribute("href", "/usuarios");
  expect(within(menu).getByRole("link", { name: "Auditoria" })).toHaveAttribute("href", "/auditoria");
  // A Visão geral liga as duas telas.
  const conteudo = document.querySelector(".conteudo") as HTMLElement;
  expect(within(conteudo).getByRole("link", { name: /Usuários/ })).toHaveAttribute("href", "/usuarios");
});

test("analista não vê a Administração", async () => {
  abrir("/painel", ANA);
  const menu = await screen.findByRole("navigation", { name: "Menu principal" });
  expect(within(menu).queryByText("Administração")).toBeNull();
});

test("logado, o logo e os documentos ficam dentro do app", async () => {
  abrir("/termos", ANA);
  expect(await screen.findByText("Termos de Uso", { selector: "h1" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Menu principal" })).toBeInTheDocument();
  expect(trilhaNaTela()).toEqual(["Início", "Termos de Uso"]);
  // Só o cartão do documento: sem a casca da página pública (logo e Voltar próprios).
  expect(document.querySelector(".conteudo .landing")).toBeNull();
  expect(document.querySelectorAll(".marca")).toHaveLength(1);
  const logo = document.querySelector(".lateral > a") as HTMLAnchorElement;
  expect(logo.getAttribute("href")).toBe("/painel");
});

test("sem sessão, os documentos têm o botão Voltar", async () => {
  abrir("/privacidade", null);
  expect(await screen.findByText("Política de Privacidade", { selector: "h1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Menu principal" })).toBeNull();
});

test("Minha conta corrige o nome de exibição, e o topo acompanha", async () => {
  const pedidos: Pedido[] = [];
  abrir("/conta", ANA, pedidos);
  const campo = await screen.findByLabelText("Nome de exibição");
  expect(screen.getByText("o papel só o admin muda")).toBeInTheDocument();
  fireEvent.change(campo, { target: { value: "Ana Maria" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
  await waitFor(() => expect(pedidos).toEqual([{ caminho: "/api/conta", metodo: "PATCH", corpo: { nome_exibicao: "Ana Maria" } }]));
  expect(await screen.findByText("Ana Maria · analista")).toBeInTheDocument();
});

test("Minha conta troca a senha com a atual e pede o e-mail novo com a senha", async () => {
  const pedidos: Pedido[] = [];
  abrir("/conta", ANA, pedidos);
  await screen.findByLabelText("Nome de exibição");
  // A troca da senha abre numa janela.
  fireEvent.click(screen.getByRole("button", { name: "Trocar a senha" }));
  const senha = await screen.findByRole("dialog", { name: "Trocar a senha" });
  fireEvent.change(within(senha).getByLabelText("Senha atual"), { target: { value: "senha-antiga-longa" } });
  fireEvent.change(within(senha).getByLabelText("Senha nova"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.change(within(senha).getByLabelText("Repita a senha nova"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.click(within(senha).getByRole("button", { name: "Trocar a senha" }));
  await waitFor(() =>
    expect(pedidos[0]).toEqual({
      caminho: "/api/conta/senha",
      metodo: "POST",
      corpo: { atual: "senha-antiga-longa", nova: "senha-nova-bem-longa" },
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Trocar o e-mail" }));
  const email = await screen.findByRole("dialog", { name: "Trocar o e-mail" });
  fireEvent.change(within(email).getByLabelText("E-mail novo"), { target: { value: "ana.nova@exemplo.com" } });
  fireEvent.change(within(email).getByLabelText("Sua senha, para confirmar"), { target: { value: "senha-nova-bem-longa" } });
  fireEvent.click(within(email).getByRole("button", { name: "Enviar o link" }));
  await waitFor(() =>
    expect(pedidos[1]).toEqual({
      caminho: "/api/conta/email",
      metodo: "POST",
      corpo: { email: "ana.nova@exemplo.com", senha: "senha-nova-bem-longa" },
    }),
  );
  expect(await screen.findByText("Enviamos um link para o e-mail novo.")).toBeInTheDocument();
});

test("o link do e-mail novo confirma a troca", async () => {
  const pedidos: Pedido[] = [];
  servidor(null, pedidos);
  navegar("/confirmar-email#token-do-link");
  render(<App />);
  expect(await screen.findByText("E-mail trocado", { selector: ".ant-result-title" })).toBeInTheDocument();
  expect(pedidos).toEqual([{ caminho: "/api/conta/email/confirmar", metodo: "POST", corpo: { token: "token-do-link" } }]);
});
