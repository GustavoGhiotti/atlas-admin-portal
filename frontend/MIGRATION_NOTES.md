# Frontend Migration Notes

## Diagnostico da base atual

- O backend FastAPI expõe APIs em `/api/*` e serve a SPA em `/app`.
- O `frontend/` em React/Vite/TypeScript existe, mas estava em fase inicial:
  - cobria apenas `login`, `desbloqueio` e `banco de imagens`
  - usava estilos inline
  - o `build` estava desativado
  - o script de desenvolvimento era um proxy Node, nao um fluxo Vite real
- As regras de permissao continuam centralizadas por grupos do usuario autenticado.
- Os modulos com API dedicada e aptos para SPA nesta fase sao:
  - autenticacao/sessao
  - desbloqueio de usuario
  - banco de imagens
  - SMS Infobip dashboard e envio teste
  - Email SendGrid dashboard e envio teste
  - WhatsApp Infobip/Twilio dashboard
  - alteracoes de colaboradores
- As telas administrativas abaixo ainda eram HTML-first e dependiam de form submit no backend:
  - criacao de usuario
  - permissoes de usuarios
  - partes do fluxo de senha legado

## Riscos identificados

- Quebra de autenticacao se o token Bearer do SPA divergir do controle de sessao legado.
- Quebra de autorizacao se os grupos usados no frontend nao refletirem a mesma matriz do backend.
- Regressao em dashboards por diferencas de filtros, chaves de resposta e tratamento de estados vazios.
- Regressao em alteracoes de colaboradores, que depende de status de sincronia, lote e regra especial do centro `1011-2`.
- Risco operacional nas telas ainda sem API dedicada.

## Estrategia aplicada

- Manter o portal legado vivo como fallback seguro.
- A SPA React em `/app` substituiu o portal HTML legado.
- Preservar contratos existentes do backend e adicionar apenas endpoints pequenos e isolados para senha/sessao quando isso evita manter HTML obrigatorio.
- Centralizar layout, navegacao, tema, componentes visuais e clientes de API.
- Direcionar funcoes ainda nao migradas para links legados explicitos em vez de reimplementar comportamento sem contrato.
