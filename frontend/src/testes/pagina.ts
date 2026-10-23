// O envelope de página que a API devolve, para as respostas falsas dos testes.
export function pagina<T>(itens: T[], por_pagina = 20) {
  return { total: itens.length, pagina: 1, por_pagina, itens };
}
