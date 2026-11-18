const GLOBAL_STYLES_ID = "atlas-global-styles";

const globalStyles = String.raw`:root {
  font-family: "Segoe UI", "Helvetica Neue", sans-serif;
  color: #f3f4f6;
  background: #0b1220;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  --bg-app: #0b1220;
  --bg-panel: #111827;
  --bg-panel-2: #172132;
  --bg-panel-3: #1d2940;
  --bg-sidebar: #0f172a;
  --bg-header: rgba(11, 18, 32, 0.9);
  --bg-accent: #ff6a00;
  --bg-accent-hover: #ff8a33;
  --bg-accent-soft: rgba(255, 106, 0, 0.14);
  --bg-success-soft: rgba(45, 160, 94, 0.14);
  --bg-warning-soft: rgba(255, 184, 0, 0.14);
  --bg-danger-soft: rgba(217, 72, 72, 0.14);
  --text-primary: #f3f4f6;
  --text-secondary: #94a3b8;
  --text-muted: #6b7a90;
  --text-inverse: #ffffff;
  --border: rgba(255, 255, 255, 0.05);
  --border-strong: rgba(255, 255, 255, 0.1);
  --success: #48b66f;
  --warning: #f3b63f;
  --danger: #db6363;
  --radius-sm: 10px;
  --radius-md: 12px;
  --radius-lg: 12px;
  /* Curvas emprestadas do Copilot: desaceleracao forte no fim, que faz o
     movimento parecer que "assenta" em vez de parar seco. */
  --ease-saida: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-suave: cubic-bezier(0.2, 0.72, 0.2, 1);
  --content-max: 1560px;
  --space-sm: 12px;
  --space-md: 16px;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  min-width: 320px;
  color: var(--text-primary);
  background:
    radial-gradient(circle at top left, rgba(255, 106, 0, 0.12), transparent 26%),
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 18%),
    linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
}

body,
button,
input,
select,
textarea {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  cursor: pointer;
}

input,
select,
textarea {
  outline: none;
}

.rich-text-content {
  white-space: normal;
}

.rich-text-content p,
.rich-text-content div {
  margin: 0 0 0.45rem;
}

.rich-text-content p:last-child,
.rich-text-content div:last-child {
  margin-bottom: 0;
}

.rich-text-content ul,
.rich-text-content ol {
  margin: 0.35rem 0 0.45rem 1.25rem;
  padding: 0;
}

.rich-text-content li {
  margin: 0.15rem 0;
}

.rich-text-content strong,
.rich-text-content b {
  font-weight: 800;
}

.app-shell {
  min-height: 100vh;
  background: transparent;
}

.shell-header {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 40;
  height: 62px;
  display: grid;
  grid-template-columns: 248px minmax(280px, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--bg-header);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid var(--border);
}

.shell-header__brand,
.shell-header__actions,
.shell-header__center,
.brand,
.shell-sidebar__header,
.shell-sidebar__nav,
.shell-sidebar__footer,
.profile-card,
.nav-section,
.nav-section__list,
.stack-lg,
.page-content,
.form-grid,
.filter-grid,
.filters-grid,
.analytics-grid,
.kpi-grid,
.info-grid,
.card-grid,
.link-grid,
.data-table,
.data-table__toolbar-actions,
.data-table__pagination,
.command-search,
.command-list {
  display: grid;
  gap: 12px;
}

.table-actions {
  display: flex;
  /* Era nowrap: numa tabela com table-layout fixed e muitas colunas, a celula de
     acoes fica estreita e os botoes vazavam por cima da coluna vizinha, do mesmo
     jeito que o texto longo. Quebrando, eles empilham dentro da propria celula. */
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
}

.folder-grid {
  display: grid;
  gap: 16px;
}

.folder-grid__button {
  width: 100%;
}

.shell-header__brand,
.shell-header__actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.shell-header__center {
  display: block;
}

.shell-header__actions {
  justify-content: flex-end;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 100%;
  padding-right: 60px;
}

.brand > div {
  display: grid;
  justify-items: center;
}

.brand__logo {
  display: block;
  width: 148px;
  height: 42px;
  object-fit: contain;
  object-position: center center;
  flex: 0 0 auto;
}

.brand__eyebrow,
.eyebrow,
.nav-section__title,
.workspace-intro__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #d68c4c;
}

.brand__title {
  display: block;
  font-size: 18px;
  line-height: 1.1;
}

.icon-button {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-primary);
}

.shell-header__menu {
  display: none;
}

.command-trigger {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(255, 106, 0, 0.38);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary);
  text-align: left;
}

.command-trigger__icon,
kbd {
  color: #f7c08a;
  font-size: 12px;
  font-weight: 700;
}

kbd {
  padding: 4px 6px;
  border: 1px solid rgba(255, 106, 0, 0.28);
  border-radius: 6px;
  background: rgba(255, 106, 0, 0.08);
}

.menu-bars {
  display: grid;
  gap: 4px;
}

.menu-bars span {
  display: block;
  width: 16px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.header-user span,
.page-header__meta-item span,
.kpi-card__label,
.chart-card__header span,
.field span,
.info-card span,
.data-table__toolbar span,
.workspace-chip span,
.link-panel span,
.hero-command__item strong {
  color: var(--text-secondary);
  font-size: 12px;
}

.shell-sidebar {
  position: fixed;
  inset: 64px auto 0 0;
  z-index: 30;
  width: 248px;
  padding: 12px 10px;
  overflow-y: auto;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.92) 100%);
  border-right: 1px solid var(--border);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 106, 0, 0.28) rgba(11, 18, 32, 0.92);
}

.shell-sidebar::-webkit-scrollbar {
  width: 8px;
}

.shell-sidebar::-webkit-scrollbar-track {
  background: rgba(11, 18, 32, 0.92);
}

.shell-sidebar::-webkit-scrollbar-thumb {
  border-radius: 999px;
  border: 1px solid rgba(255, 106, 0, 0.14);
  background: linear-gradient(180deg, rgba(255, 106, 0, 0.44) 0%, rgba(214, 140, 76, 0.34) 100%);
}

.shell-sidebar::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(255, 138, 51, 0.58) 0%, rgba(214, 140, 76, 0.44) 100%);
}

.shell-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 14px;
  color: var(--text-primary);
}

.shell-sidebar__subtitle,
.panel__description,
.page-header__description,
.muted,
.workspace-intro p,
.link-panel p,
.command-item p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.shell-sidebar h2,
.workspace-intro h1,
.page-header h1,
.panel h2,
.chart-card h3,
.auth-panel h1,
.auth-panel h2 {
  margin: 0;
}

.profile-card {
  grid-template-columns: 48px minmax(0, 1fr);
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.03);
}

.profile-card__avatar {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, #ff7a1a 0%, #e25c00 100%);
  color: #fff9f3;
  font-weight: 700;
}

.profile-card p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.nav-section__title {
  color: #8a9cb2;
}

.nav-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: border-color 120ms ease, background 120ms ease;
}

.nav-item strong {
  font-size: 14px;
  line-height: 1.25;
}

.nav-item:hover,
.nav-item--active {
  background: rgba(255, 106, 0, 0.08);
  border-color: rgba(255, 106, 0, 0.24);
}

.nav-group {
  display: grid;
  gap: 8px;
  padding: 8px 0 0;
}

.nav-group__title {
  display: grid;
  width: 100%;
  grid-template-columns: 18px minmax(0, 1fr) 12px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 6px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
}

.nav-group__title strong {
  font-size: 14px;
  line-height: 1.25;
}

.nav-group__title--open {
  color: #fff2e4;
}

.nav-group__chevron {
  width: 10px;
  height: 10px;
  position: relative;
}

.nav-group__chevron span {
  position: absolute;
  top: 4px;
  width: 6px;
  height: 1.5px;
  background: currentColor;
  transition: transform 120ms ease;
}

.nav-group__chevron span:first-child {
  left: 0;
  transform: rotate(45deg);
}

.nav-group__chevron span:last-child {
  right: 0;
  transform: rotate(-45deg);
}

.nav-group__title--open .nav-group__chevron span:first-child {
  transform: rotate(-45deg);
}

.nav-group__title--open .nav-group__chevron span:last-child {
  transform: rotate(45deg);
}

.nav-group__items {
  display: grid;
  gap: 4px;
  margin-left: 14px;
  padding-left: 14px;
  border-left: 1px solid rgba(148, 167, 192, 0.18);
}

.nav-subitem {
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.35;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}

.nav-subitem:hover,
.nav-subitem--active {
  background: rgba(255, 106, 0, 0.08);
  border-color: rgba(255, 106, 0, 0.22);
  color: var(--text-primary);
}

.nav-icon {
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  color: #f2bf91;
}

.nav-icon svg {
  width: 18px;
  height: 18px;
}

.user-menu {
  position: relative;
}

.user-menu__trigger {
  min-width: 190px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-primary);
}

.user-menu__trigger--open {
  border-color: rgba(255, 106, 0, 0.24);
  background: rgba(255, 106, 0, 0.08);
}

.user-menu__identity strong,
.user-menu__identity small {
  display: block;
}

.user-menu__identity small {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}

.user-menu__chevron {
  width: 10px;
  height: 10px;
  position: relative;
}

.user-menu__chevron span {
  position: absolute;
  top: 4px;
  width: 6px;
  height: 1.5px;
  background: currentColor;
}

.user-menu__chevron span:first-child {
  left: 0;
  transform: rotate(45deg);
}

.user-menu__chevron span:last-child {
  right: 0;
  transform: rotate(-45deg);
}

.user-menu__dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 220px;
  padding: 8px;
  display: grid;
  gap: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: rgba(10, 20, 31, 0.98);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
}

.user-menu__item {
  width: 100%;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
}

.user-menu__item:hover {
  background: rgba(255, 106, 0, 0.08);
}

.user-menu__item--danger {
  border-top: 1px solid var(--border);
  margin-top: 4px;
  padding-top: 12px;
}

.secondary-link {
  color: #f7c08a;
  font-size: 13px;
}

.shell-main {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 82px 20px 24px 272px;
}

.shell-main__body {
  flex: 1 0 auto;
}

.page-content {
  width: min(100%, var(--content-max));
  margin: 0 auto;
}

.page-content {
  min-width: 0;
  padding-top: 0;
  gap: 16px;
}

/* Coluna implicita de grid e "auto": e dimensionada pelo max-content dos
   filhos: bastava uma tabela larga la dentro para esticar a pagina inteira e
   por barra de rolagem no documento. Travando em minmax(0, 1fr), a largura
   passa a ser a do container e quem rola e so quem tem overflow proprio - a
   tabela e a faixa de abas. */
.page-content,
.stack-lg,
.stack-md {
  grid-template-columns: minmax(0, 1fr);
}

.panel,
.surface-card {
  min-width: 0;
}

/* Ultima trava, so no painel: se algum conteudo novo escapar, ele para aqui em
   vez de virar barra de rolagem no documento. Nao vale para .surface-card, que
   vive dentro do modal, onde recortar esconderia foco e menu suspenso. */
.panel {
  overflow-x: clip;
}

.page-header,
.panel,
.surface-card,
.auth-panel,
.not-found-card,
.chart-card,
.kpi-card,
.info-card,
.module-card,
.modal {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
  transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}

.page-header,
.panel,
.surface-card,
.auth-panel {
  padding: 16px;
}

.not-found-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(255, 106, 0, 0.12), transparent 28%),
    linear-gradient(180deg, #0f172a 0%, #111827 100%);
}

.not-found-card {
  width: min(100%, 680px);
  padding: 28px;
  display: grid;
  gap: 16px;
  text-align: left;
}

.not-found-code {
  display: inline-flex;
  width: fit-content;
  padding: 6px 12px;
  border: 1px solid rgba(255, 106, 0, 0.24);
  border-radius: 999px;
  background: rgba(255, 106, 0, 0.08);
  color: #ffb879;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.not-found-card h1 {
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1;
}

.not-found-description {
  max-width: 52ch;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.6;
}

.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.page-header {
  display: grid;
  gap: 12px;
}

.page-header__top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

/* O texto quebra por medida propria, nao pelo que sobra ao lado do botao.
   Sem isto o rotulo do botao mudando de "Atualizar" para "Atualizando..."
   estreita a coluna e reescreve a quebra da frase no meio do carregamento.
   A medida em ch acompanha o tamanho da fonte e continua encolhendo em tela
   estreita - fixa no ritmo de leitura, nao em pixels. */
.page-header__description {
  max-width: 76ch;
  /* Evita a ultima linha com uma palavra so, que e o que mais chama atencao
     quando a quebra muda. */
  text-wrap: pretty;
}

/* A acao do cabecalho reserva a largura do rotulo mais longo, entao trocar de
   estado nao mexe no espaco de quem esta ao lado. */
.page-header__actions .button,
.page-header__actions .button--secondary {
  min-width: 15ch;
}

.page-header__content {
  display: grid;
  gap: 8px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
}

/* Faixa de indicadores em UMA linha, nao em caixas.

   Cada indicador e um par curto - "Carteiras ativas 32". Em caixa com borda,
   fundo e padding, quatro deles viravam um bloco alto que empurrava a pagina
   para baixo sem dizer mais nada. Em linha, separados por um tracinho, a mesma
   informacao ocupa uma linha so. */
.page-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 0;
  align-items: baseline;
}

.page-header__meta-item {
  display: inline-flex;
  align-items: baseline;
  /* O rotulo e um <span> e o valor um <strong>, os dois inline: sem este gap
     eles encostam e viram "Carteiras ativas32". */
  gap: 8px;
  min-width: 0;
  padding: 0 18px;
}

.page-header__meta-item:first-child {
  padding-left: 0;
}

.page-header__meta-item + .page-header__meta-item {
  border-left: 1px solid var(--border);
}

.page-header__meta-item strong {
  font-size: 16px;
  line-height: 1.2;
  /* Digito de largura fixa: os numeros nao dancam quando o valor muda. */
  font-variant-numeric: tabular-nums;
}

.page-header__actions,
.panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.panel__header,
.section-header,
.chart-card__header,
.data-table__toolbar,
.data-table__footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  /* Era center: com titulo, descricao longa e botao na mesma linha, o botao
     descia para o meio do bloco de texto em telas estreitas. No topo ele fica
     alinhado com o titulo, que e a referencia visual. */
  align-items: flex-start;
}

/* Sem isto o bloco de texto nao encolhe abaixo do proprio min-content e empurra
   o botao para fora do painel entre 1100px e 1400px. */
.panel__header > *:first-child,
.section-header > *:first-child,
.data-table__toolbar > *:first-child {
  min-width: 0;
}

.panel-status {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 106, 0, 0.22);
  border-radius: 999px;
  background: rgba(255, 106, 0, 0.08);
  color: #ffcb9d;
  font-size: 11px;
  font-weight: 700;
}

.chart-card__header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  margin-bottom: 12px;
}

.chart-card__filter {
  min-width: 180px;
}

.chart-card__filter span {
  font-size: 11px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
}

.toolbar > .button,
.toolbar > .button--secondary,
.toolbar > .button--ghost,
.toolbar > .button--danger,
.toolbar > .button--link {
  flex-shrink: 0;
  min-height: 44px;
  align-self: flex-end;
}

.inline-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  margin-bottom: 16px;
}

.inline-form > .field {
  min-width: 0;
}

.inline-form > .button,
.inline-form > .button--secondary,
.inline-form > .button--ghost,
.inline-form > .button--danger,
.inline-form > .button--link {
  min-height: 44px;
  align-self: end;
}

.inline-form--file input[type="file"] {
  min-height: 48px;
  padding: 10px 12px;
}

.inline-form--file input[type="file"]::file-selector-button,
.inline-form--file input[type="file"]::-webkit-file-upload-button {
  margin-right: 12px;
  height: 26px;
  padding: 5px 14px;
  border: 1px solid rgba(255, 106, 0, 0.24);
  border-radius: var(--radius-sm);
  background: var(--bg-accent-soft);
  color: #ffb879;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
  cursor: pointer;
}

.arquivos-path-actions {
  display: flex;
  align-items: end;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.arquivos-path-actions .button,
.arquivos-path-actions .button--ghost-neutral {
  min-height: 44px;
}

.inline-form + .alert,
.inline-form + .empty-state,
.inline-form + .result-box,
.inline-form + .info-grid {
  margin-top: 8px;
}

.alert + .info-grid,
.alert + .empty-state,
.alert + .result-box {
  margin-top: 14px;
}

.filter-grid,
.analytics-grid,
.kpi-grid,
.info-grid,
.card-grid,
.link-grid,
.form-grid {
  grid-template-columns: repeat(12, minmax(0, 1fr));
}

.filters-grid {
  grid-template-columns: 180px minmax(0, 1fr) 220px auto;
  align-items: end;
  gap: 12px;
}

.filters-grid__submit {
  grid-column: 1 / -1;
  width: 100%;
}

.filters-grid--recebimento {
  grid-template-columns: 180px minmax(280px, 1fr) 220px;
}

.filters-grid--recebimento .filters-grid__submit--inline {
  grid-column: auto;
  width: auto;
  min-width: 220px;
  min-height: 44px;
  padding: 11px 16px;
}

.filter-grid > *,
.kpi-grid > *,
.info-grid > *,
.card-grid > *,
.link-grid > * {
  grid-column: span 4;
}

.kpi-grid > * {
  grid-column: span 3;
}

.filter-panel .filter-grid > .button {
  grid-column: 1 / -1;
  width: 100%;
}

.analytics-grid > * {
  grid-column: span 4;
}

.analytics-grid--two > * {
  grid-column: span 6;
}

.analytics-grid--three > * {
  grid-column: span 4;
}

.form-grid > * {
  grid-column: span 12;
}

.card-grid--two > *,
.form-grid--two > * {
  grid-column: span 6;
}

.form-grid--three > * {
  grid-column: span 4;
}

.field {
  display: grid;
  gap: 6px;
  color: var(--text-primary);
  font-weight: 600;
  /* Num grid de duas colunas o campo herda a altura do vizinho mais alto. Com o
     align-content padrao (stretch) a sobra e distribuida entre as trilhas: o
     rotulo sobe, o select estica e o campo fica de outro tamanho que o do lado.
     Ancorando no topo, controle e rotulo mantem a altura natural e a sobra vai
     toda para baixo - as duas colunas alinham pelo topo, que e como se le. */
  align-content: start;
}

.field--full {
  grid-column: 1 / -1;
}

.field--grow {
  flex: 1;
}

.field input,
.field select,
.field textarea,
.data-table__search {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.025);
  color: var(--text-primary);
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.field input:focus,
.field select:focus,
.field textarea:focus,
.data-table__search:focus {
  border-color: rgba(255, 106, 0, 0.32);
  box-shadow: 0 0 0 3px rgba(255, 106, 0, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.regua-mis-dias-field input {
  width: 56px;
  min-height: 36px;
  padding: 6px 10px;
  text-align: center;
}

.stepper-control {
  display: inline-grid;
  grid-template-columns: 38px 72px 38px;
  align-items: center;
  gap: 8px;
  width: max-content;
}

.stepper-control .button,
.stepper-control .button--secondary {
  min-width: 38px;
  min-height: 38px;
  padding: 0;
  justify-content: center;
}

.stepper-control input {
  min-height: 38px;
  padding: 8px 10px;
  text-align: center;
}

.field select option,
.field select optgroup {
  color: #e5eefc;
  background: #132235;
}

.field input::placeholder,
.field textarea::placeholder,
.data-table__search::placeholder {
  color: var(--text-muted);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 106, 0, 0.16);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, #ff7a1a 0%, #f36600 100%);
  color: #fff7ef;
  font-weight: 700;
  transition: transform 120ms ease, border-color 120ms ease, filter 120ms ease, background 120ms ease;
}

.button:hover:not(:disabled) {
  border-color: rgba(255, 138, 51, 0.42);
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.button:disabled {
  opacity: 0.65;
  cursor: default;
}

.button--secondary {
  background: var(--bg-accent-soft);
  color: #ffb879;
  border-color: rgba(255, 106, 0, 0.24);
}

.button--success {
  background: var(--bg-success-soft);
  color: #b8efcc;
  border-color: rgba(72, 182, 111, 0.26);
}

.button--ghost {
  background: transparent;
  color: var(--text-primary);
  border-color: var(--border);
}

.button--ghost-neutral,
.button--link {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  border-color: var(--border);
}

.button--danger {
  background: var(--bg-danger-soft);
  color: #ffb3b3;
  border-color: rgba(217, 72, 72, 0.28);
}

.text-link {
  color: #ffb879;
  font-weight: 600;
}

.kpi-card {
  padding: 16px;
  min-height: 96px;
  display: grid;
  align-content: space-between;
  gap: 8px;
}

.kpi-card__body {
  display: grid;
  gap: 2px;
}

.kpi-card__value {
  font-size: clamp(1.6rem, 2vw, 2rem);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.kpi-card__helper {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.35;
  display: none;
}

.kpi-card--success {
  border-top: 2px solid var(--success);
}

.kpi-card--warning {
  border-top: 2px solid var(--warning);
}

.kpi-card--accent {
  border-top: 2px solid var(--bg-accent);
}

.kpi-card--danger {
  border-top: 2px solid var(--danger);
}

.dashboard-refreshing {
  opacity: 0.78;
  transition: opacity 140ms ease;
}

.chart-card,
.data-table {
  padding: 16px;
}

.chart-card__body {
  display: grid;
  gap: 12px;
}

.chart-surface {
  display: grid;
  gap: 12px;
  position: relative;
}

.line-chart {
  width: 100%;
  height: 250px;
}

.line-chart__area {
  fill: rgba(255, 106, 0, 0.12);
}

.line-chart__line {
  fill: none;
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.line-chart__point-hitbox {
  fill: transparent;
}

.line-chart__point {
  fill: var(--bg-panel);
  stroke-width: 3;
  transition: filter 120ms ease, stroke-width 120ms ease;
}

.line-chart__point:hover {
  stroke-width: 4;
  filter: drop-shadow(0 0 8px rgba(31, 94, 255, 0.35));
}

.chart-tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 18px));
  pointer-events: none;
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  background: rgba(7, 16, 28, 0.94);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
  color: #f8fafc;
  font-size: 12px;
  white-space: nowrap;
  z-index: 2;
}

.chart-tooltip strong {
  font-size: 12px;
  font-weight: 700;
}

.chart-tooltip span {
  color: rgba(226, 232, 240, 0.86);
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}

.chart-summary {
  margin-top: 12px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.chart-export-card {
  display: grid;
  gap: 16px;
  align-content: start;
  min-height: 120px;
}

.chart-export-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.bar-chart {
  display: grid;
  gap: 12px;
}

.bar-chart__row {
  display: grid;
  gap: 8px;
}

.bar-chart__label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.bar-chart__track {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.bar-chart__fill {
  height: 100%;
  border-radius: 999px;
}

.donut-chart {
  display: grid;
  gap: 16px;
  justify-items: center;
}

.donut-chart__ring {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

/* As fatias moram numa camada atras do centro. Mascarar o anel inteiro levaria
   o numero do meio junto, e ele apareceria em pedacos durante a varredura. */
.donut-chart__ring::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--fatias);
}

.donut-chart__center {
  position: relative;
  width: 108px;
  height: 108px;
  border-radius: 50%;
  background: var(--bg-panel);
  display: grid;
  place-items: center;
  text-align: center;
}

.donut-chart__legend {
  width: 100%;
  display: grid;
  gap: 8px;
}

.donut-chart__legend-item {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.donut-chart__swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.alert,
.empty-state,
.page-loader,
.result-box {
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.025);
}

.result-box {
  margin: 0;
  white-space: pre-wrap;
  overflow: auto;
  max-height: 420px;
}

.alert--success {
  border-color: rgba(72, 182, 111, 0.3);
  background: var(--bg-success-soft);
  color: #b7efc8;
}

.alert--danger {
  border-color: rgba(217, 72, 72, 0.32);
  background: var(--bg-danger-soft);
  color: #f7c0c0;
}

.alert--warning {
  border-color: rgba(243, 182, 63, 0.28);
  background: var(--bg-warning-soft);
  color: #ffe1a1;
}

.guide-card {
  display: grid;
  gap: 14px;
  margin-bottom: 20px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.guide-card p {
  margin: 0;
  color: var(--text-secondary);
}

.guide-card code {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px 18px;
}

.guide-grid > div {
  display: grid;
  gap: 6px;
}

.guide-grid strong {
  color: var(--text-primary);
  font-size: 14px;
}

.guide-grid span {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.guide-card--standalone {
  margin-bottom: 0;
}

.sql-preview {
  margin-top: 18px;
  display: grid;
  gap: 12px;
}

.sql-preview__header {
  display: grid;
  gap: 6px;
}

.sql-preview__header h3 {
  margin: 0;
  font-size: 18px;
}

.sql-preview__header p:not(.eyebrow) {
  margin: 0;
  color: var(--text-secondary);
}

.sql-preview__code {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.55;
  border-color: rgba(255, 122, 26, 0.18);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.015) 100%),
    radial-gradient(circle at top right, rgba(255, 122, 26, 0.08), transparent 38%);
}

.alteracoes-colaboradores__top-block {
  min-height: 212px;
}

.alteracoes-colaboradores__top-block .info-grid {
  margin: 0;
}

.alteracoes-colaboradores__top-block textarea {
  min-height: 190px;
}

.alteracoes-page {
  gap: 24px;
}

.alteracoes-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
}

.alteracoes-hero__title {
  display: flex;
  align-items: center;
  gap: 18px;
}

.alteracoes-hero__icon {
  width: 68px;
  height: 68px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #ff9b1c 0%, #ff6a00 55%, #ff4f87 100%);
  box-shadow: 0 0 28px rgba(250, 100, 0, 0.35);
}

.alteracoes-hero__icon span {
  color: white;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.alteracoes-hero h1 {
  margin: 0;
  font-size: 28px;
}

.alteracoes-hero p {
  margin: 8px 0 0;
  color: var(--text-secondary);
}

.alteracoes-hero__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.alteracoes-hero__batch-button {
  min-width: auto;
  min-height: 34px;
  padding: 7px 16px;
  background: var(--bg-accent-soft);
  color: #ffb879;
  border: 1px solid rgba(255, 106, 0, 0.24);
  box-shadow: none;
  white-space: nowrap;
  border-radius: 10px;
}

.alteracoes-hero__batch-button:hover {
  background: rgba(255, 122, 26, 0.16);
}

.alteracoes-sync-toggle {
  min-width: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 7px 12px 7px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(20, 33, 53, 0.9);
  color: var(--text-primary);
}

.alteracoes-sync-toggle:has(.alteracoes-sync-toggle__track.is-active) {
  border-color: rgba(255, 106, 0, 0.3);
  background: rgba(255, 106, 0, 0.08);
  box-shadow: 0 0 18px rgba(255, 106, 0, 0.14);
}

.alteracoes-sync-toggle strong {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  letter-spacing: 0.12em;
}

.alteracoes-sync-toggle > div {
  display: grid;
  gap: 1px;
}

.alteracoes-sync-toggle span {
  color: var(--text-secondary);
  font-size: 10px;
}

.alteracoes-sync-toggle__help {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  border: 1px solid rgba(255, 106, 0, 0.24);
  color: #ffb879;
  font-size: 10px;
  line-height: 1;
}

.alteracoes-sync-toggle__track {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  padding: 3px;
  background: rgba(140, 156, 181, 0.22);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.alteracoes-sync-toggle__track.is-active {
  background: #ff6a00;
  justify-content: flex-end;
}

.alteracoes-sync-toggle__thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f5f7fb;
}

.alteracoes-search-card {
  padding: 22px 24px;
}

.alteracoes-search-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 188px;
  gap: 12px;
  align-items: end;
  margin-bottom: 14px;
}

.alteracoes-search-form__button {
  min-height: 46px;
  box-shadow: 0 0 22px rgba(250, 100, 0, 0.22);
}

.alteracoes-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 0.92fr) minmax(340px, 1fr);
  gap: 24px;
}

.alteracoes-card {
  min-height: 560px;
}

.alteracoes-current-list {
  margin-top: 18px;
  display: grid;
}

.alteracoes-current-item {
  padding: 18px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.alteracoes-current-item:first-child {
  padding-top: 6px;
  border-top: 0;
}

.alteracoes-current-item span {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.alteracoes-current-item strong {
  display: block;
  margin-top: 8px;
  font-size: 14px;
}

.alteracoes-form {
  margin-top: 18px;
  display: grid;
  gap: 18px;
}

.alteracoes-submit {
  width: 100%;
  min-height: 48px;
  margin-top: 8px;
  box-shadow: 0 0 24px rgba(250, 100, 0, 0.24);
}

.alteracoes-helper {
  margin: -6px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.alteracoes-lote-modal {
  width: min(760px, 100%);
}

.alteracoes-modal__close {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.alteracoes-modal__close span {
  font-size: 22px;
  line-height: 1;
}

.alteracoes-modal__close:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 980px) {
  .alteracoes-hero,
  .alteracoes-hero__actions,
  .alteracoes-workspace,
  .alteracoes-search-form {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .alteracoes-sync-toggle,
  .alteracoes-hero__batch-button {
    width: 100%;
  }

  .alteracoes-card {
    min-height: auto;
  }
}

.empty-state--inline {
  padding: 12px;
}

.table-shell {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.table {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
  table-layout: fixed;
}

.table th,
.table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 167, 192, 0.12);
  text-align: left;
  vertical-align: top;
  /* table-layout: fixed reparte a largura igualmente e nao reserva espaco para o
     conteudo. Sem quebra, um token longo sem espaco (caminho de imagem, nome de
     arquivo de mailing, data ISO) vaza da celula e se sobrepoe a coluna vizinha.
     anywhere so quebra quando nao ha alternativa - texto normal segue quebrando
     por palavra. */
  overflow-wrap: anywhere;
}

/* Tabela que rola na horizontal em vez de quebrar o texto.

   O padrao do Atlas (table-layout: fixed + overflow-wrap: anywhere) reparte a
   largura igualmente e quebra o que nao couber. Serve para tabela de poucas
   colunas; nas de configuracao, com oito ou mais, cada celula fica estreita
   demais e caminho de imagem, prefixo de mailing e data viram tres linhas.

   Aqui a largura sai do conteudo e quem rola e o .table-shell, que ja tem
   overflow: auto. min-width: 100% mantem a tabela ocupando o painel inteiro
   quando o conteudo e curto - sem isso ela encolheria para o tamanho do texto. */
/* .data-table e grid; sem trilha explicita, a coluna implicita e dimensionada
   pelo max-content da tabela e o painel inteiro vazaria para a direita em vez
   de a tabela rolar dentro dele. */
.table-scroll-x {
  grid-template-columns: minmax(0, 1fr);
}

.table-scroll-x .table-shell {
  min-width: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 106, 0, 0.28) rgba(11, 18, 32, 0.92);
}

.table-scroll-x .table {
  table-layout: auto;
  width: auto;
  min-width: 100%;
}

.table-scroll-x .table td {
  white-space: nowrap;
  overflow-wrap: normal;
}

/* O cabecalho continua quebrando. Com table-layout: auto a coluna e dimensionada
   pelo maior conteudo, e o rotulo em caixa alta com letter-spacing costuma ser
   maior que o dado: "PUBLICADA" reserva ~90px para um "Sim". Deixando o titulo
   quebrar em duas linhas, a coluna passa a ter a largura do valor. */
.table-scroll-x .table th {
  white-space: normal;
  overflow-wrap: normal;
  /* Alinha o titulo de uma linha com a base do de duas. */
  vertical-align: bottom;
}

/* A celula de acoes nao entra no calculo de largura: o botao tem tamanho fixo. */
.table-scroll-x .table .table-actions {
  flex-wrap: nowrap;
  width: auto;
}

/* Cabecalho de painel com acao ao lado do titulo.

   A descricao saiu do bloco de texto e virou irma do cabecalho: assim a linha
   tem so titulo e botao, que cabem lado a lado em praticamente qualquer largura.
   Antes os tres ficavam juntos e, quando o flex virava coluna, o botao caia
   sozinho embaixo de um paragrafo inteiro, encostado e alinhado a esquerda -
   sem relacao visual com nada.

   Especificidade dobrada para vencer o flex-direction: column da media query,
   que vem depois neste arquivo. */
.panel__header.panel__header--action {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.panel__header--action > *:first-child {
  flex: 1 1 240px;
}

.panel__header--action .panel__actions {
  flex: 0 0 auto;
}

/* A descricao ganha respiro do que vem depois - tabela, faixa de abas. Sem isso
   ela encosta no elemento seguinte, porque .panel e bloco simples e o paragrafo
   so tem margem no topo. */
.panel > .panel__description {
  margin-bottom: 14px;
  max-width: 96ch;
}

/* Quando ela abre o painel, o padding de 16px ja e o respiro do topo. */
.panel > .panel__description:first-child {
  margin-top: 0;
}

/* Barra da tabela: continua em linha mesmo estreita, quebrando so quando nao
   couber. Empilhada, os tres blocos comiam ~150px de altura entre o texto do
   painel e a primeira linha de dado. */
.table-scroll-x .data-table__toolbar {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.table-scroll-x .data-table__toolbar-meta {
  flex: 0 0 auto;
}

.table-scroll-x .data-table__toolbar-actions {
  grid-auto-flow: column;
  align-items: center;
  /* Empurra busca e exportacao para a direita sem depender de space-between,
     que abriria um vao enorme quando a esquerda e so um contador. */
  margin-left: auto;
}

.table-scroll-x .data-table__search {
  width: min(280px, 42vw);
}

/* Barra de acao do formulario.

   Antes eram dois botoes soltos depois do cartao, alinhados a direita sem nada
   que os prendesse - liam como elemento flutuante. Aqui eles ganham regua e
   fundo proprios e sangram ate a borda do modal, entao a barra e claramente o
   rodape do formulario.

   Sticky porque a altura util e o que aperta em notebook: com 85vh de 768px
   sobram ~650px, e o formulario da landing e mais alto que isso - sem grudar,
   o Salvar so aparece no fim da rolagem. */
.form-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  /* Sangra os 18px de padding do .modal__body dos tres lados. */
  margin: 4px -18px -18px;
  padding: 14px 18px;
  border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: rgba(9, 15, 26, 0.94);
  backdrop-filter: blur(8px);
}

.form-footer .button,
.form-footer .button--ghost-neutral,
.form-footer .button--danger {
  min-width: 132px;
}

/* .stack-md e grid, e um item de grid so consegue grudar dentro da propria
   linha - a barra de acao nao teria para onde deslizar e o sticky viraria
   enfeite. Em coluna flex o bloco de contencao passa a ser o formulario
   inteiro. Seletor com o elemento para vencer .stack-md, que vem depois. */
form.pq-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 3) Campo curto nao precisa de meia largura de modal: numero e Sim/Nao ficam
   do tamanho do que mostram, e a dica ocupa o resto da coluna. */
.pq-form .field input[type="number"] {
  max-width: 180px;
}

.pq-form .field select[name="ativo"],
.pq-form .field select[name="exibir_na_home"],
.pq-form .field select[name="canal"],
.pq-form .field select[name="escopo"],
.pq-form .field select[name="tipo_match"] {
  max-width: 260px;
}

/* Faixa de abas. Nao usa .toolbar porque la o space-between espalha os botoes
   pela largura inteira; e porque com flex-shrink: 0 e sem rolagem eles saem do
   painel na tela estreita em vez de ficarem alcancaveis. */
.tab-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  /* A barra de rolagem se sobrepoe ao botao sem esta folga. */
  padding-bottom: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 106, 0, 0.28) rgba(11, 18, 32, 0.92);
}

.tab-strip > .button,
.tab-strip > .button--secondary {
  flex: 0 0 auto;
  white-space: nowrap;
}

.table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #182131;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.table tbody tr {
  transition: background 120ms ease;
}

.table tbody tr:hover {
  background: rgba(255, 255, 255, 0.035);
}

.table__sort {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  text-align: left;
}

.table__sort--enabled {
  cursor: pointer;
}

.table__sort--right {
  text-align: right;
}

.table__cell--right {
  text-align: right;
}

.table__cell--center {
  text-align: center;
}

.banco-imagens__acoes-header .table__sort {
  text-align: right;
}

.banco-imagens-table .table td {
  vertical-align: middle;
}

.banco-imagens-table .table {
  table-layout: auto;
}

.banco-imagens-table .table th,
.banco-imagens-table .table td {
  padding: 10px 10px;
}

.banco-imagens-table .table th:first-child,
.banco-imagens-table .table td:first-child {
  padding-left: 12px;
}

.banco-imagens-table .table th:last-child,
.banco-imagens-table .table td:last-child {
  padding-right: 12px;
}

.banco-imagens-table .table th:nth-child(2),
.banco-imagens-table .table td:nth-child(2) {
  width: 90px;
  white-space: nowrap;
}

.banco-imagens-table .table th:nth-last-child(2),
.banco-imagens-table .table td:nth-last-child(2) {
  width: 165px;
  white-space: nowrap;
}

.banco-imagens-table .table th:last-child,
.banco-imagens-table .table td:last-child {
  width: 1%;
  white-space: nowrap;
}

.banco-imagens-table .table-actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 6px;
  width: auto;
  margin-left: auto;
}

.banco-imagens-table .table-actions .button,
.banco-imagens-table .table-actions .button--link,
.banco-imagens-table .table-actions .button--ghost-neutral,
.banco-imagens-table .table-actions .button--danger {
  white-space: nowrap;
  min-height: 34px;
  padding: 6px 12px;
}

.arquivos-importacao-table .table th:nth-child(2),
.arquivos-importacao-table .table td:nth-child(2) {
  width: 112px;
  white-space: nowrap;
}

.arquivos-importacao-table .table th:nth-child(3),
.arquivos-importacao-table .table td:nth-child(3) {
  width: 168px;
  white-space: nowrap;
}

.arquivos-importacao-table .table th:last-child,
.arquivos-importacao-table .table td:last-child {
  width: 272px;
  min-width: 272px;
  white-space: nowrap;
}

.arquivos-importacao-table .table td:first-child {
  min-width: 0;
}

.arquivos-importacao-table__name {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arquivos-importacao-table .table-actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 6px;
  width: 100%;
  margin-left: 0;
}

.arquivos-importacao-table .table-actions .button,
.arquivos-importacao-table .table-actions .button--link,
.arquivos-importacao-table .table-actions .button--ghost-neutral,
.arquivos-importacao-table .table-actions .button--danger {
  white-space: nowrap;
  min-height: 34px;
  padding: 6px 12px;
}

.arquivos-exportacao-table .table th:nth-child(2),
.arquivos-exportacao-table .table td:nth-child(2) {
  width: 112px;
  white-space: nowrap;
}

.arquivos-exportacao-table .table th:nth-child(3),
.arquivos-exportacao-table .table td:nth-child(3) {
  width: 168px;
  white-space: nowrap;
}

.arquivos-exportacao-table .table th:last-child,
.arquivos-exportacao-table .table td:last-child {
  width: 272px;
  min-width: 272px;
  white-space: nowrap;
}

.arquivos-exportacao-table .table td:first-child {
  min-width: 0;
}

.arquivos-exportacao-table__name {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arquivos-exportacao-table .table-actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 6px;
  width: 100%;
  margin-left: 0;
}

.arquivos-exportacao-table .table-actions .button,
.arquivos-exportacao-table .table-actions .button--link,
.arquivos-exportacao-table .table-actions .button--ghost-neutral,
.arquivos-exportacao-table .table-actions .button--danger {
  white-space: nowrap;
  min-height: 34px;
  padding: 6px 12px;
}

.controle-tarefas__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(92px, 1fr));
  gap: 6px;
  justify-content: end;
  width: min(100%, 196px);
  margin-left: auto;
}

.controle-tarefas__action {
  width: 100%;
  min-height: 32px;
  padding: 5px 8px;
  font-size: 11px;
  white-space: nowrap;
}

.controle-tarefas__actions-header .table__sort {
  text-align: right;
}

.controle-tarefas__task-name {
  font-weight: 600;
  line-height: 1.35;
  font-size: 13px;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.controle-tarefas__date {
  line-height: 1.35;
  font-size: 12px;
  white-space: nowrap;
}

.controle-tarefas__result {
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  font-size: 12px;
  word-break: break-word;
}

.controle-tarefas-table .table {
  table-layout: auto;
}

.controle-tarefas-table .table th:nth-child(1),
.controle-tarefas-table .table td:nth-child(1) {
  width: 31%;
}

.controle-tarefas-table .table th:nth-child(2),
.controle-tarefas-table .table td:nth-child(2) {
  width: 11%;
}

.controle-tarefas-table .table th:nth-child(3),
.controle-tarefas-table .table td:nth-child(3),
.controle-tarefas-table .table th:nth-child(4),
.controle-tarefas-table .table td:nth-child(4) {
  width: 16%;
  white-space: nowrap;
}

.controle-tarefas-table .table th:nth-child(5),
.controle-tarefas-table .table td:nth-child(5) {
  width: 24%;
}

.controle-tarefas-table .table th:nth-child(6),
.controle-tarefas-table .table td:nth-child(6) {
  width: 18%;
}

.controle-tarefas-table .data-table__toolbar h3 {
  font-size: 14px;
  line-height: 1.25;
}

.data-table__toolbar {
  align-items: end;
}

.data-table__toolbar-meta {
  display: grid;
  gap: 6px;
}

.data-table__toolbar h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.data-table__record-count {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 26px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.data-table__toolbar-actions {
  grid-auto-flow: column;
  align-items: center;
  gap: 10px;
}

.data-table__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.data-table__pagination {
  width: auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.data-table__pagination > .button {
  min-width: 112px;
}


.criacao-usuarios__form {
  align-items: start;
}

.criacao-usuarios__form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.criacao-usuarios__form-actions .button {
  width: auto;
  min-width: 220px;
}

.criacao-usuarios-table .table {
  table-layout: auto;
}

.criacao-usuarios-table .table th,
.criacao-usuarios-table .table td {
  vertical-align: top;
}

.criacao-usuarios-table .table th:nth-child(1),
.criacao-usuarios-table .table td:nth-child(1) {
  width: 20%;
}

.criacao-usuarios-table .table th:nth-child(2),
.criacao-usuarios-table .table td:nth-child(2) {
  width: 14%;
}

.criacao-usuarios-table .table th:nth-child(3),
.criacao-usuarios-table .table td:nth-child(3) {
  width: 14%;
  white-space: nowrap;
}

.criacao-usuarios-table .table th:nth-child(4),
.criacao-usuarios-table .table td:nth-child(4) {
  width: 24%;
}

.criacao-usuarios-table .table th:nth-child(5),
.criacao-usuarios-table .table td:nth-child(5) {
  width: 18%;
}

.criacao-usuarios-table .table th:nth-child(6),
.criacao-usuarios-table .table td:nth-child(6) {
  width: 10%;
}

.criacao-usuarios-table__text,
.criacao-usuarios-table__groups {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.55;
}

.criacao-usuarios-table__text--mono {
  font-variant-numeric: tabular-nums;
}

.criacao-usuarios-table__actions {
  display: flex;
  justify-content: flex-end;
}

.criacao-usuarios-table__actions .button {
  min-width: 132px;
  white-space: nowrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--bg-success-soft);
  color: #b8efcc;
  font-size: 12px;
  font-weight: 700;
}

.badge--warning {
  background: var(--bg-warning-soft);
  color: #ffd47d;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.status-pill--default {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.status-pill--success {
  background: var(--bg-success-soft);
  color: #b8efcc;
  border-color: rgba(72, 182, 111, 0.24);
}

.status-pill--warning {
  background: var(--bg-warning-soft);
  color: #ffd47d;
  border-color: rgba(243, 182, 63, 0.24);
}

.status-pill--accent {
  background: var(--bg-accent-soft);
  color: #ffb879;
  border-color: rgba(255, 106, 0, 0.24);
}

.status-pill--danger {
  background: var(--bg-danger-soft);
  color: #f6b1b1;
  border-color: rgba(217, 72, 72, 0.24);
}

.info-card,
.link-panel {
  padding: 14px;
}

.info-card strong,
.link-panel strong,
.command-item strong {
  display: block;
  margin-top: 6px;
}

.link-grid > * {
  grid-column: span 6;
}

.link-panel {
  display: grid;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.hero-command {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, rgba(255, 106, 0, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
}

.hero-command__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.hero-command__item {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid rgba(255, 106, 0, 0.18);
  border-radius: var(--radius-md);
  background: rgba(10, 18, 29, 0.8);
}

.hero-command__item span {
  font-weight: 700;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 7, 13, 0.72);
  backdrop-filter: blur(10px);
}

.toast-viewport {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 90;
  width: min(360px, calc(100vw - 32px));
  display: grid;
  gap: 12px;
}

.toast {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(9, 17, 29, 0.96);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(12px);
}

.toast--success {
  border-color: rgba(72, 182, 111, 0.34);
  background: linear-gradient(180deg, rgba(10, 36, 28, 0.98) 0%, rgba(10, 28, 24, 0.98) 100%);
}

.toast--danger {
  border-color: rgba(217, 72, 72, 0.34);
  background: linear-gradient(180deg, rgba(48, 18, 22, 0.98) 0%, rgba(33, 15, 19, 0.98) 100%);
}

.toast--warning {
  border-color: rgba(243, 182, 63, 0.34);
  background: linear-gradient(180deg, rgba(48, 34, 14, 0.98) 0%, rgba(34, 24, 11, 0.98) 100%);
}

.toast__content {
  display: grid;
  gap: 6px;
}

.toast__content strong {
  font-size: 14px;
  line-height: 1.2;
}

.toast__content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.toast__close {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  font-size: 20px;
  line-height: 1;
}

.shell-alert {
  position: fixed;
  right: 20px;
  top: 82px;
  z-index: 85;
  width: min(380px, calc(100vw - 32px));
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(255, 106, 0, 0.14), transparent 36%),
    linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.38);
}

.shell-alert__content {
  display: grid;
  gap: 6px;
}

.shell-alert__content strong {
  font-size: 15px;
  line-height: 1.25;
}

.shell-alert__content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.shell-alert__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shell-alert__actions .button {
  flex: 1 1 auto;
}

.shell-alert__close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  font-size: 22px;
  line-height: 1;
}

.modal {
  width: min(920px, 100%);
  max-height: min(85vh, 820px);
  display: grid;
  grid-template-rows: auto 1fr;
}

.modal--wide {
  width: min(1020px, 100%);
  max-height: min(88vh, 860px);
}

/* Notebook de 768px de altura: 85vh sao 653px, e o teto absoluto de 820px nunca
   entra em jogo. Aqui a janela usa a altura toda menos o respiro do backdrop -
   ganha ~100px de formulario visivel, que e uma secao inteira da landing. */
@media (max-height: 860px) {
  .modal,
  .modal--wide {
    max-height: calc(100vh - 48px);
  }
}

.modal__header,
.modal__body {
  padding: 18px;
}

.modal__header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid var(--border);
}

.modal__body {
  overflow: auto;
}

.command-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.command-item__meta {
  min-width: 110px;
  text-align: right;
}

.command-item__meta span {
  display: block;
  color: #ffb879;
  font-size: 12px;
  font-weight: 700;
}

.command-item__meta small {
  color: var(--text-secondary);
}

.auth-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 20px;
  padding: 24px;
}

.auth-panel--hero {
  background: linear-gradient(135deg, rgba(8, 19, 33, 0.98) 0%, rgba(255, 106, 0, 0.26) 100%);
  color: #ffffff;
}

.auth-panel--hero-login {
  background-position: center 22%;
  background-repeat: no-repeat;
  background-size: cover;
}

.auth-hero {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.auth-hero__top {
  display: flex;
  justify-content: flex-start;
}

.auth-hero__content {
  margin-top: auto;
}

.auth-panel--hero .eyebrow,
.auth-panel--hero .muted {
  color: rgba(255, 255, 255, 0.82);
}

.auth-panel--centered {
  display: flex;
  align-items: center;
}

.auth-panel__content {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.auth-login-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-top: 100px;
  margin-bottom: 0;
  padding-right: 0;
  text-align: left;
}

.auth-login-brand > div {
  display: grid;
  justify-items: center;
}

.auth-login-form {
  display: grid;
  flex: 1 1 auto;
  grid-template-rows: 1fr auto;
  margin-top: -90px;
}

.auth-login-form__main {
  align-self: center;
}

.auth-login-description {
  padding-top: 32px;
  text-align: center;
}

.auth-panel--centered .section-header {
  justify-content: center;
}

.auth-panel--centered .section-header > div {
  width: 100%;
}

.auth-login-brand__logo {
  display: block;
  width: 220px;
  height: 92px;
  object-fit: contain;
  object-position: center top;
  flex: 0 0 auto;
}

.auth-login-brand__eyebrow {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #d68c4c;
}

.auth-login-brand__title {
  display: block;
  font-size: 40px;
  line-height: 1;
  color: #fff7ef;
}

.auth-footer {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: 20px 0 0;
}

.shell-main > .auth-footer {
  width: min(100%, var(--content-max));
  margin: 0 auto;
  margin-top: auto;
}

.recovery-box {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.recovery-feedback {
  margin-top: 18px;
  margin-bottom: 8px;
}

.auth-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.auth-actions--split > * {
  flex: 1 1 0;
}

.auth-actions .button {
  width: 100%;
  justify-content: center;
}

.field-label-with-help {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.field-help-wrap {
  flex-wrap: wrap;
}

.field .field-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 14px;
  height: 18px;
  padding: 0 2px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #ff7a1a;
  box-shadow: none;
  text-shadow: 0 0 12px rgba(255, 122, 26, 0.18);
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  transition:
    transform 140ms ease,
    color 140ms ease;
  animation: field-help-pulse 1.8s ease-in-out infinite;
}

.field .field-help:hover,
.field .field-help:focus-visible,
.field .field-help--active {
  color: #ff7a1a;
  outline: none;
  transform: translateY(-1px);
  animation-play-state: paused;
}

.field-help-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 8;
  display: none;
  width: min(280px, calc(100vw - 56px));
  padding: 10px 12px;
  border: 1px solid rgba(255, 122, 26, 0.32);
  border-radius: 12px;
  background: rgba(18, 26, 46, 0.98);
  color: rgba(244, 239, 232, 0.92);
  box-shadow: 0 18px 34px rgba(5, 10, 22, 0.34);
  font-size: 12px;
  line-height: 1.45;
}

.field-help-popover::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 14px;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  border-top: 1px solid rgba(255, 122, 26, 0.32);
  border-left: 1px solid rgba(255, 122, 26, 0.32);
  background: rgba(18, 26, 46, 0.98);
}

.field-help-wrap:hover .field-help-popover,
.field-help-wrap:focus-within .field-help-popover,
.field-help-popover--visible {
  display: block;
}

@keyframes field-help-pulse {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }
}

.usuarios-carteira__cell {
  display: flex;
  align-items: center;
  min-height: 100%;
}

.usuarios-carteira__cell--cc {
  min-width: 88px;
}

.usuarios-carteira__action {
  min-height: 34px;
  padding: 6px 12px;
  font-size: 13px;
  white-space: nowrap;
}

.usuarios-carteira__table .table th {
  text-align: center;
}

.usuarios-carteira__table .table__sort {
  width: 100%;
  display: inline-flex;
  justify-content: center;
}

.sms-limites-table .table {
  table-layout: fixed;
  width: 100%;
  min-width: 0;
}

.sms-limites-table .table th,
.sms-limites-table .table td {
  vertical-align: middle;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
}

.sms-limites-table .table th {
  text-align: center;
}

.sms-limites-table .table th .table__sort {
  width: 100%;
  display: inline-flex;
  justify-content: center;
  text-align: center;
  white-space: normal;
}

.sms-limites-table--readonly .table th:nth-child(1),
.sms-limites-table--readonly .table td:nth-child(1),
.sms-limites-table--readonly .table th:nth-child(2),
.sms-limites-table--readonly .table td:nth-child(2),
.sms-limites-table--readonly .table th:nth-child(3),
.sms-limites-table--readonly .table td:nth-child(3),
.sms-limites-table--readonly .table th:nth-child(4),
.sms-limites-table--readonly .table td:nth-child(4),
.sms-limites-table--readonly .table th:nth-child(5),
.sms-limites-table--readonly .table td:nth-child(5) {
  width: 20%;
}

.sms-limites-table--with-action .table th:nth-child(1),
.sms-limites-table--with-action .table td:nth-child(1),
.sms-limites-table--with-action .table th:nth-child(3),
.sms-limites-table--with-action .table td:nth-child(3),
.sms-limites-table--with-action .table th:nth-child(4),
.sms-limites-table--with-action .table td:nth-child(4),
.sms-limites-table--with-action .table th:nth-child(5),
.sms-limites-table--with-action .table td:nth-child(5) {
  width: 14%;
}

.sms-limites-table--with-action .table th:nth-child(2),
.sms-limites-table--with-action .table td:nth-child(2),
.sms-limites-table--with-action .table th:nth-child(6),
.sms-limites-table--with-action .table td:nth-child(6) {
  width: 22%;
}

.sms-limites-table .table th:nth-child(2),
.sms-limites-table .table td:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sms-limites-table--readonly .table td:nth-child(4) .button,
.sms-limites-table--with-action .table td:nth-child(6) .button {
  width: 100%;
  white-space: normal;
}

.sms-limites-table .table td:nth-child(1),
.sms-limites-table .table td:nth-child(3) {
  font-variant-numeric: tabular-nums;
}

.stack-md {
  display: grid;
  gap: 16px;
}

.perfil-card {
  display: grid;
  gap: 20px;
  padding: 20px;
}

.perfil-card__header,
.perfil-card__section {
  display: grid;
  gap: 14px;
}

.perfil-card__section + .perfil-card__section {
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.perfil-card__identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, rgba(255, 106, 0, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
}

.perfil-card__identity:hover,
.perfil-action-section:hover,
.perfil-overview-item:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.perfil-card__avatar {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  background: linear-gradient(180deg, #ff7a1a 0%, #e25c00 100%);
  color: #fff7ef;
  box-shadow: 0 10px 28px rgba(255, 106, 0, 0.2);
}

.perfil-card__avatar span {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.perfil-card__identity-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.perfil-card__identity-copy h2 {
  margin: 0;
  font-size: clamp(2rem, 3vw, 2.5rem);
  line-height: 1.02;
  letter-spacing: -0.03em;
}

.perfil-card__role,
.perfil-card__cost-center {
  margin: 0;
}

.perfil-card__role {
  color: #f7efe5;
  font-size: 15px;
  font-weight: 600;
}

.perfil-card__cost-center {
  color: var(--text-secondary);
  font-size: 13px;
}

.perfil-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  margin-top: 4px;
}

.perfil-card__meta span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  font-size: 12px;
}

.perfil-card__section-heading {
  display: grid;
  gap: 4px;
}

.perfil-card__section-heading h3,
.perfil-action-section__header h4 {
  margin: 0;
}

.perfil-card__section-heading h3 {
  font-size: 16px;
  font-weight: 600;
}

.perfil-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.perfil-overview-item,
.perfil-action-section {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.02);
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
}

.perfil-overview-item {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
}

.perfil-overview-item span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.perfil-overview-item strong {
  font-size: 15px;
  line-height: 1.35;
  word-break: break-word;
}

.perfil-overview-item:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.perfil-action-list {
  display: grid;
  gap: 12px;
}

.perfil-action-section {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
}

.perfil-action-section__header {
  display: grid;
  gap: 4px;
}

.perfil-action-section__header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.perfil-action-section__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.perfil-action-section__body--single {
  grid-template-columns: minmax(0, 1fr) auto;
}

.perfil-action-section__body .button {
  min-width: 170px;
  min-height: 40px;
}

.operacoes-page {
  gap: 12px;
}

.operacoes-toolbar {
  padding: 14px 16px;
}

.operacoes-toolbar__form {
  align-items: end;
}

.filters-grid--status {
  grid-template-columns: 180px minmax(260px, 1fr) 220px auto;
}

.filters-grid--status .filters-grid__submit--inline,
.filters-grid--recebimento .filters-grid__submit--inline {
  grid-column: auto;
  width: auto;
  min-width: 180px;
  min-height: 40px;
  padding: 10px 14px;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.surface-card--compact {
  padding: 16px;
}

.whatsapp-templates-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.whatsapp-templates-summary__card {
  display: grid;
  gap: 10px;
  min-height: 156px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(19, 29, 45, 0.98) 0%, rgba(14, 22, 36, 0.98) 100%);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.whatsapp-templates-summary__card span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.whatsapp-templates-summary__card strong {
  font-size: 34px;
  line-height: 1;
  letter-spacing: -0.03em;
}

.whatsapp-templates-summary__card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.whatsapp-templates-summary__card--success {
  border-color: rgba(72, 182, 111, 0.2);
  background: linear-gradient(180deg, rgba(13, 38, 31, 0.94) 0%, rgba(11, 27, 25, 0.98) 100%);
}

.whatsapp-template-guide,
.whatsapp-template-example {
  display: grid;
  gap: 12px;
}

.whatsapp-template-guide__grid,
.whatsapp-template-example__variables {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.whatsapp-template-guide .result-box,
.whatsapp-template-example .result-box {
  padding: 12px 14px;
}

.whatsapp-template-guide h2,
.whatsapp-template-example h2 {
  font-size: 17px;
  line-height: 1.25;
}

.whatsapp-template-guide .section-header,
.whatsapp-template-example .section-header {
  margin-bottom: 0;
}

.whatsapp-template-guide .result-box strong,
.whatsapp-template-example .result-box strong {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
}

.whatsapp-template-guide .result-box p,
.whatsapp-template-example .result-box p,
.whatsapp-template-guide__list {
  font-size: 13.5px;
  line-height: 1.5;
}

.whatsapp-template-guide__list {
  margin: 0;
  padding-left: 20px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.whatsapp-template-guide__list li + li {
  margin-top: 6px;
}

.field-hint {
  display: block;
  min-height: 36px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.field-hint--placeholder {
  color: var(--text-secondary);
}

.whatsapp-template-creation {
  display: grid;
  gap: 16px;
}

.whatsapp-template-composer {
  gap: 12px;
}

.whatsapp-template-composer__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
  gap: 16px;
  align-items: start;
}

.whatsapp-template-composer__editor textarea {
  min-height: 208px;
}

.whatsapp-template-inline-variables,
.whatsapp-template-preview {
  gap: 10px;
}

.whatsapp-template-preview__card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(72, 182, 111, 0.08), transparent 26%),
    linear-gradient(180deg, rgba(10, 26, 21, 0.96) 0%, rgba(9, 21, 19, 0.98) 100%);
}

.whatsapp-template-preview__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.whatsapp-template-preview__header span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.whatsapp-template-preview__header strong {
  font-size: 13px;
}

.whatsapp-template-preview__bubble {
  width: min(100%, 520px);
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border: 1px solid rgba(72, 182, 111, 0.14);
  border-radius: 18px 18px 18px 8px;
  background: linear-gradient(180deg, rgba(31, 50, 44, 0.98) 0%, rgba(22, 39, 34, 0.98) 100%);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.whatsapp-template-preview__eyebrow,
.whatsapp-template-preview__body,
.whatsapp-template-preview__footer {
  margin: 0;
}

.whatsapp-template-preview__eyebrow {
  color: #d7efe3;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.whatsapp-template-preview__body {
  color: var(--text-primary);
  line-height: 1.65;
  white-space: pre-wrap;
}

.whatsapp-template-preview__footer {
  color: #8db9a3;
  font-size: 12px;
}

.whatsapp-template-example__form input:disabled,
.whatsapp-template-example__form textarea:disabled {
  opacity: 1;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.035);
}

.whatsapp-template-variable-help {
  gap: 8px;
}

.whatsapp-template-variable-help--compact {
  padding: 14px 16px;
}

.whatsapp-template-variable-help p {
  margin: 0;
}

.template-table__identity {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.template-table__identity strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.3;
}

.template-table__identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 12px;
}

.template-table__actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.template-table__actions--stacked {
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.whatsapp-templates-table .table {
  table-layout: fixed;
}

.whatsapp-templates-table__col-template {
  width: 34%;
}

.whatsapp-templates-table__col-status {
  width: 14%;
}

.whatsapp-templates-table__col-categoria {
  width: 10%;
}

.whatsapp-templates-table__col-idioma {
  width: 8%;
}

.whatsapp-templates-table__col-disponivel {
  width: 18%;
}

.whatsapp-templates-table__col-data {
  width: 14%;
}

.whatsapp-templates-table__col-acoes {
  width: 16%;
}

.whatsapp-templates-table td {
  vertical-align: middle;
}

.whatsapp-templates-table .table__cell--right {
  white-space: normal;
}

.whatsapp-templates-table .status-pill {
  justify-content: center;
  white-space: nowrap;
}

.whatsapp-templates-table .button,
.whatsapp-templates-table .button--ghost-neutral,
.whatsapp-templates-table .button--success {
  min-width: 104px;
}

.template-active-toggle {
  min-width: 108px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-primary);
}

.template-active-toggle:disabled {
  cursor: wait;
  opacity: 0.8;
}

.template-active-toggle:has(.template-active-toggle__track.is-active) {
  border-color: rgba(72, 182, 111, 0.28);
  background: rgba(72, 182, 111, 0.08);
  box-shadow: 0 0 18px rgba(72, 182, 111, 0.12);
}

.template-active-toggle__meta {
  display: grid;
  gap: 0;
  text-align: center;
}

.template-active-toggle__meta small {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.1;
  white-space: nowrap;
}

.template-active-toggle__track {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  padding: 3px;
  background: rgba(140, 156, 181, 0.22);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  transition: all 180ms ease;
}

.template-active-toggle__track.is-active {
  background: #48b66f;
  justify-content: flex-end;
}

.template-active-toggle__thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f5f7fb;
}

.template-active-toggle__placeholder {
  color: var(--text-secondary);
  font-size: 12px;
}

.template-active-toggle--detail {
  min-width: 120px;
}

.whatsapp-template-detail-table .data-table__toolbar-actions {
  grid-auto-flow: column;
}

.whatsapp-template-events-table .table {
  table-layout: fixed;
}

.whatsapp-template-events-table__col-data {
  width: 20%;
}

.whatsapp-template-events-table__col-evento {
  width: 24%;
}

.whatsapp-template-events-table__col-origem {
  width: 16%;
}

.whatsapp-template-events-table__col-status {
  width: 22%;
}

.whatsapp-template-events-table__col-responsavel {
  width: 18%;
}

.whatsapp-template-events-table td {
  vertical-align: middle;
}

.whatsapp-template-events-table__event-label {
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
}

.whatsapp-template-events-table .status-pill {
  justify-content: center;
  white-space: nowrap;
}

.whatsapp-template-variable-row {
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
}

.module-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(14, 26, 42, 0.98) 0%, rgba(17, 30, 46, 0.98) 100%);
}

.module-card--compact {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.module-card__eyebrow {
  color: #d68c4c;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.module-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.quick-link-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.quick-link-list__item {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.quick-link-list__item strong,
.quick-link-list__item span {
  display: block;
}

.quick-link-list__item span {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.checkbox-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.checkbox-card input {
  width: 16px;
  height: 16px;
}

.importacao-banco__status {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
}

.importacao-banco__status--success {
  border-color: rgba(72, 182, 111, 0.28);
  background: var(--bg-success-soft);
  color: #c8f3d7;
}

.importacao-banco__status--danger {
  border-color: rgba(217, 72, 72, 0.3);
  background: var(--bg-danger-soft);
  color: #ffc3c3;
}

.importacao-banco__server-grid {
  margin-top: 6px;
}

.importacao-banco__actions-section {
  margin-top: 10px;
}

.importacao-banco__actions {
  margin-top: 6px;
}

.importacao-banco__actions--inline {
  margin-top: 0;
  min-height: 40px;
  align-items: end;
}

.importacao-banco__actions--inline .button {
  flex: 1 1 0;
  min-width: 0;
}

.importacao-banco__destino-card {
  gap: 1px;
  padding: 10px 10px;
}

.importacao-banco__destino-section {
  margin-top: 12px;
}

.importacao-banco__destino-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.importacao-banco__destino-value {
  flex: 1 1 320px;
  min-width: 0;
  line-height: 1.35;
  word-break: break-word;
}

.importacao-banco__destino-row .button {
  flex: 0 0 auto;
  min-width: 170px;
}

.importacao-banco__file-field input[type="file"] {
  min-height: 48px;
  padding: 10px 12px;
}

.importacao-banco__file-field input[type="file"]::file-selector-button,
.importacao-banco__file-field input[type="file"]::-webkit-file-upload-button {
  margin-right: 12px;
  height: 26px;
  padding: 5px 14px;
  border: 1px solid rgba(255, 106, 0, 0.24);
  border-radius: var(--radius-sm);
  background: var(--bg-accent-soft);
  color: #ffb879;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
  cursor: pointer;
}

.importacao-banco__summary > * {
  grid-column: span 3;
}

.importacao-banco__lists > * {
  grid-column: span 6;
}

.importacao-banco__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.importacao-banco__tag {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border: 1px solid rgba(255, 106, 0, 0.2);
  border-radius: 999px;
  background: rgba(255, 106, 0, 0.08);
  color: #ffcfab;
  font-size: 12px;
  line-height: 1.4;
}

.importacao-banco__tag--danger {
  border-color: rgba(217, 72, 72, 0.28);
  background: rgba(217, 72, 72, 0.12);
  color: #ffc3c3;
}

.importacao-banco__tag--empty {
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
}

.importacao-banco__cell {
  display: block;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chamadev-page {
  gap: 16px;
  overflow-x: auto;
  overflow-y: visible;
  padding-bottom: 4px;
}

.chamadev-page > * {
  min-width: 980px;
}

.chamadev-hero {
  position: relative;
  overflow: hidden;
  gap: 18px;
  background:
    radial-gradient(circle at top right, rgba(255, 106, 0, 0.14), transparent 26%),
    linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
}

.chamadev-hero::after {
  content: "";
  position: absolute;
  inset: auto -80px -120px auto;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 106, 0, 0.12) 0%, rgba(255, 106, 0, 0) 70%);
  pointer-events: none;
}

.chamadev-hero__grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 20px;
  align-items: start;
}

.chamadev-hero__intro,
.chamadev-hero__toolbar,
.chamadev-stats,
.chamados-list-panel,
.chamados-detail-panel,
.chamados-create-card {
  display: grid;
  gap: 14px;
}

.chamadev-hero__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.chamadev-hero__title-row h1 {
  margin: 0;
  font-size: clamp(32px, 4vw, 42px);
  line-height: 1;
  letter-spacing: -0.04em;
}

.chamadev-hero__description {
  max-width: 64ch;
  margin: 0;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.65;
}

.chamadev-view-switch {
  display: grid;
  justify-items: center;
  align-content: start;
  justify-content: flex-end;
  gap: 6px;
  margin-left: auto;
  margin-top: -2px;
}

.chamadev-view-switch > span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.chamadev-view-switch .chamadev-quick-filters {
  flex-wrap: nowrap;
  margin-inline: 0;
}

.chamadev-hero__highlights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.chamadev-highlight-card,
.chamados-list-summary,
.chamados-timeline-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
}

.chamadev-highlight-card {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
}

.chamadev-highlight-card span,
.chamadev-hero__aside-meta span,
.chamados-list-summary span,
.chamadev-create-form__hint span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.chamadev-highlight-card strong,
.chamados-list-summary strong,
.chamadev-create-form__hint strong {
  font-size: 16px;
}

.chamadev-highlight-card p,
.chamados-timeline__item p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.chamadev-hero__toolbar {
  justify-items: end;
  align-content: start;
  align-self: start;
}

.chamadev-segmented {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: min(100%, 420px);
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.chamadev-segmented__item {
  min-height: 42px;
  padding: 10px 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
}

.chamadev-segmented__item--active {
  background: var(--bg-accent-soft);
  color: #ffcfab;
  box-shadow: inset 0 0 0 1px rgba(255, 106, 0, 0.18);
}

.chamadev-hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.chamadev-hero__actions--inline {
  justify-content: flex-start;
  padding-top: 6px;
}

.chamadev-hero__actions--centered {
  justify-content: center;
  width: 100%;
  padding-top: 40px;
}

.chamadev-hero__actions--centered .chamadev-quick-filters {
  margin-inline: auto;
}

.chamadev-quick-filters {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.chamadev-quick-filters__item {
  min-height: 36px;
  padding: 8px 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
  transition: background 120ms ease, color 120ms ease;
}

.chamadev-quick-filters__item--active {
  background: var(--bg-accent-soft);
  color: #ffb879;
  box-shadow: inset 0 0 0 1px rgba(255, 106, 0, 0.24);
}

.chamadev-summary-card {
  display: grid;
  gap: 14px;
  width: min(100%, 360px);
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
}

.chamadev-summary-card__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}

.chamadev-summary-card__header .eyebrow {
  margin-bottom: 8px;
}

.chamadev-summary-card h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}

.chamadev-summary-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.chamadev-summary-card__meta div {
  display: grid;
  gap: 6px;
}

.chamadev-summary-card__meta span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.chamadev-summary-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chamadev-summary-card__actions .button,
.chamadev-summary-card__actions .button--secondary {
  flex: 1 1 0;
}

.chamadev-summary-card__nav {
  width: 38px;
  height: 38px;
  font-size: 18px;
  font-weight: 700;
}

.chamadev-summary-card__nav:disabled {
  opacity: 0.45;
  cursor: default;
}

.chamadev-stats {
  position: relative;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.chamadev-stat-card {
  display: grid;
  gap: 8px;
  min-height: 104px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.015) 100%);
}

.chamadev-stat-card span {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chamadev-stat-card strong {
  font-size: clamp(28px, 3vw, 34px);
  line-height: 1;
  letter-spacing: -0.04em;
}

.chamadev-create-card {
  background:
    linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%),
    linear-gradient(90deg, rgba(255, 106, 0, 0.06), transparent);
}

.chamadev-create-form,
.chamadev-guide-list {
  display: grid;
  gap: 14px;
}

.chamadev-guide-item {
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
}

.chamadev-guide-item strong,
.chamados-timeline__item strong {
  display: block;
  margin-bottom: 6px;
}

.chamadev-guide-item p,
.chamadev-create-form__hint p {
  margin: 0;
}

.chamadev-create-form {
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 22px;
  background: rgba(11, 18, 32, 0.52);
}

.chamadev-create-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 2px;
}

.chamadev-create-steps__item {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.chamadev-create-steps__item--active {
  border-color: rgba(255, 106, 0, 0.32);
  background: rgba(255, 106, 0, 0.1);
  color: #ffb879;
}

.chamadev-create-steps__item--done {
  border-color: rgba(34, 197, 94, 0.22);
  background: rgba(34, 197, 94, 0.1);
  color: #9be7b0;
}

.chamadev-create-form__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
  padding-top: 0;
}

.chamadev-create-form__file-field {
  margin-bottom: 0;
}

.chamadev-create-form__file-field input[type="file"] {
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.025);
  color: var(--text-secondary);
}

.chamadev-create-form__file-field input[type="file"]::file-selector-button,
.chamadev-create-form__file-field input[type="file"]::-webkit-file-upload-button {
  margin-right: 12px;
  min-height: 28px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 106, 0, 0.24);
  border-radius: 10px;
  background: var(--bg-accent-soft);
  color: #ffb879;
  font-weight: 700;
  cursor: pointer;
}

.chamadev-create-form__file-field input[type="file"]:focus {
  border-color: rgba(255, 106, 0, 0.32);
  box-shadow: 0 0 0 3px rgba(255, 106, 0, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.chamadev-guided-fields,
.chamadev-guided-fields__grid {
  display: grid;
  gap: 12px;
}

.chamadev-guided-fields {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
}

.chamadev-guided-fields__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chamadev-guided-fields__checkbox {
  align-content: start;
}

.chamadev-guided-fields__checkbox--static {
  gap: 8px;
  padding-top: 2px;
}

.chamadev-guided-fields__label {
  position: relative;
  width: fit-content;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.chamadev-guided-fields__label .field-help {
  min-width: 12px;
  height: 16px;
  font-size: 16px;
}

.chamadev-guided-fields__label .field-help-popover {
  top: calc(100% + 6px);
  left: 0;
}

.chamadev-guided-fields__static-copy {
  margin: 0;
  max-width: 34ch;
}

.chamadev-guided-fields__multi,
.chamadev-guided-fields__stack {
  display: grid;
  gap: 10px;
}

.chamadev-guided-fields__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.chamadev-guided-fields__multi .button,
.chamadev-guided-fields__multi .button--ghost-neutral {
  justify-self: start;
}

.chamadev-boolean-group {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.chamadev-boolean-option {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease, box-shadow 120ms ease;
  cursor: pointer;
}

.chamadev-boolean-option input {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}

.chamadev-boolean-option span {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.chamadev-boolean-option span::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.45);
  transition: background 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

.chamadev-boolean-option--active {
  border-color: rgba(255, 106, 0, 0.18);
  background: rgba(11, 18, 32, 0.88);
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.chamadev-boolean-option--active span::before {
  background: var(--bg-accent);
  box-shadow: 0 0 0 3px rgba(255, 106, 0, 0.16);
  transform: scale(1.05);
}

.chamadev-boolean-option input:focus-visible + span {
  outline: 2px solid rgba(255, 106, 0, 0.18);
  outline-offset: 4px;
}

.chamadev-create-card__actions {
  justify-content: flex-end;
}

.chamadev-filters {
  gap: 14px;
}

.chamadev-filters__header,
.chamadev-section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.chamadev-filters__header h2,
.chamadev-section-header h2 {
  margin: 6px 0 0;
  font-size: 20px;
}

.chamados-filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.chamados-filter-group {
  display: grid;
  gap: 14px;
}

.chamados-filter-actions,
.chamados-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chamados-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1.08fr);
  gap: 18px;
  align-items: start;
}

.chamados-layout.chamados-layout--single {
  grid-template-columns: minmax(0, 1fr);
}

.chamados-list-panel {
  min-height: 640px;
  gap: 10px;
  align-content: start;
}

.chamados-list-panel__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 10px 16px;
  margin: 0;
}

.chamados-list-panel__header-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.chamados-list-panel__header-main .eyebrow {
  margin: 0;
  line-height: 1;
}

.chamados-list-panel__description {
  margin: 0;
  max-width: 64ch;
}

.chamados-list-panel__actions {
  margin-left: auto;
  align-self: start;
}

.chamados-detail-panel {
  position: sticky;
  top: 82px;
}

.chamados-list {
  display: grid;
  gap: 12px;
  align-content: start;
}

.chamados-list-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 14px 11px;
}

.chamados-list-summary > div {
  display: grid;
  gap: 6px;
}

.chamado-card {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.024) 0%, rgba(255, 255, 255, 0.015) 100%);
  color: var(--text-primary);
  text-align: left;
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}

.chamado-card:hover,
.chamado-card--active {
  border-color: rgba(255, 106, 0, 0.28);
  background:
    linear-gradient(180deg, rgba(255, 106, 0, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.16);
  transform: translateY(-1px);
}

.chamado-card__top,
.chamado-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.chamado-card__badges,
.chamadev-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.chamado-card__id {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.chamado-card__title {
  font-size: 16px;
  line-height: 1.25;
  margin: 0;
  flex: 1 1 220px;
}

.chamado-card__summary {
  display: grid;
  gap: 4px;
}

.chamado-card__summary-label {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chamado-card__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chamado-card__meta span {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.chamado-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-size: 12px;
}

.chamados-detail-grid > * {
  grid-column: span 4;
}

.chamados-controls .field {
  flex: 1 1 220px;
}

.chamadev-detail {
  gap: 16px;
}

.chamados-description-card,
.chamados-evidence {
  display: grid;
  gap: 18px;
}

.chamados-description-card__header {
  align-items: flex-start;
}

.chamados-description-card__eyebrow-type {
  color: #ffb879;
}

.chamados-description-card__content,
.chamados-description-card__edit-form {
  display: grid;
  gap: 16px;
}

.chamados-description-card__box {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.34);
}

.chamados-description-card__box-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.chamados-description-card__complementares {
  display: grid;
  gap: 14px;
}

.chamados-description-card__complementar-group {
  display: grid;
  gap: 8px;
}

.chamados-description-card__complementar-title {
  font-size: 14px;
  color: var(--text-primary);
}

.chamados-description-card__complementar-items {
  display: grid;
  gap: 6px;
}

.chamados-description-card__complementar-item {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.chamados-description {
  white-space: pre-wrap;
  font-size: 15px;
  line-height: 1.75;
  margin: 0;
}

.chamados-timeline-card {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.chamados-timeline {
  display: grid;
  gap: 14px;
}

.chamados-timeline__item {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.chamados-timeline__content {
  display: grid;
  gap: 4px;
}

.chamados-timeline__content p {
  margin: 0;
  white-space: pre-wrap;
}

.chamados-timeline__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
}

.chamados-timeline__edit {
  min-height: 30px;
  padding: 4px 10px;
  font-size: 12px;
  flex-shrink: 0;
  border-color: rgba(255, 106, 0, 0.24);
  background: var(--bg-accent-soft);
  color: #ffb879;
}

.chamados-timeline__item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 8px;
  top: 20px;
  bottom: -12px;
  width: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.chamados-timeline__dot {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
}

.chamados-timeline__item--done .chamados-timeline__dot {
  border-color: rgba(255, 106, 0, 0.4);
  background: var(--bg-accent-soft);
  box-shadow: inset 0 0 0 4px rgba(255, 106, 0, 0.12);
}

.chamados-evidence-card {
  display: grid;
  gap: 16px;
  margin-top: 8px;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.34);
}

.chamados-evidence-image {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}

.chamados-evidence__actions {
  justify-content: flex-end;
  width: 100%;
  margin-left: auto;
}

.chamados-evidence-file {
  display: grid;
  gap: 8px;
  padding: 6px 2px 2px;
}

.chamados-evidence .section-header {
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 0;
}

.chamados-evidence .section-header > div {
  display: grid;
  gap: 6px;
}

.chamados-evidence .section-header h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
}

.chamados-evidence .section-header .eyebrow {
  margin: 0;
}

.chamados-evidence .section-header .button {
  margin-top: 0;
  align-self: flex-start;
}

.chamados-modal {
  width: min(980px, 100%);
}

.chamados-create-modal {
  width: min(1040px, 100%);
}

.chamados-modal__header-main {
  display: grid;
  gap: 2px;
}

.chamados-modal__header-copy {
  margin: 0;
  max-width: 64ch;
}

.chamados-modal__header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--text-secondary);
  font-size: 12px;
}

.chamados-modal__header-main h2 {
  margin: 0;
}

.chamados-modal__header-actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.chamados-modal__header-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.chamados-modal__header-badges .status-pill {
  min-height: auto;
  padding: 10px 14px;
  border-radius: 999px;
}

.chamados-modal__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 18px;
  align-items: start;
}

.chamados-modal__layout--single {
  grid-template-columns: minmax(0, 1fr);
}

.chamados-modal__main,
.chamados-modal__sidebar,
.chamados-modal__property-list {
  display: grid;
  gap: 16px;
}

.chamados-modal__field,
.chamados-modal__actions {
  width: 100%;
}

.chamados-modal__actions {
  margin-top: 8px;
}

.chamados-modal__properties {
  padding: 20px;
}

.chamados-modal__properties .chamados-modal__property-list {
  gap: 20px;
  padding: 4px 2px 2px;
}

.chamados-dev-status {
  display: grid;
  gap: 12px;
}

.chamados-modal__panel {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.018) 100%);
}

.chamados-modal__properties {
  display: grid;
  gap: 16px;
}

.chamados-modal__properties .section-header {
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 0;
  padding: 10px 12px 0;
}

.chamados-modal__properties .section-header h2 {
  margin: 2px 0 0;
  font-size: 20px;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.chamados-modal__property {
  min-height: auto;
}

.chamados-modal__properties .field {
  gap: 8px;
}

.chamados-modal__properties .field span,
.chamados-modal__properties .field .field-label-with-help {
  padding-left: 2px;
}

.chamados-modal__properties .field textarea {
  padding-top: 12px;
}

.chamadev-platform-combobox {
  position: relative;
}

.chamadev-platform-combobox__menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  display: grid;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: rgba(11, 18, 32, 0.98);
  box-shadow: var(--shadow-lg);
}

.chamadev-platform-combobox__option,
.chamadev-platform-combobox__create {
  width: 100%;
  min-height: 34px;
  justify-content: flex-start;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.chamadev-platform-combobox__option:hover {
  background: rgba(255, 255, 255, 0.06);
}

.chamadev-platform-combobox__create {
  margin-top: 4px;
  border: 1px solid rgba(255, 106, 0, 0.22);
  background: rgba(255, 106, 0, 0.1);
  color: #ffb879;
}

.chamadev-platform-combobox__create:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.chamadev-platform-combobox__empty {
  padding: 8px 10px;
  color: var(--text-secondary);
  font-size: 13px;
}

.shell-backdrop {
  position: fixed;
  inset: 64px 0 0 0;
  z-index: 20;
  border: 0;
  background: rgba(3, 7, 13, 0.48);
}

@media (max-width: 1360px) {
  .analytics-grid > *,
  .analytics-grid--three > * {
    grid-column: span 6;
  }

  .filter-grid > *,
  .kpi-grid > *,
  .info-grid > *,
  .card-grid > * {
    grid-column: span 6;
  }

  .home-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .importacao-banco__summary > *,
  .importacao-banco__lists > * {
    grid-column: span 6;
  }

  .chamadev-hero__grid {
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.9fr);
  }

  .chamados-detail-panel {
    position: sticky;
    top: 82px;
  }

  .chamados-layout {
    grid-template-columns: minmax(300px, 0.92fr) minmax(0, 1.08fr);
    gap: 14px;
  }

  .chamados-layout.chamados-layout--single {
    grid-template-columns: minmax(0, 1fr);
  }

  .chamadev-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

}

@media (max-width: 1100px) {
  .shell-header {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "brand actions"
      "center center";
    padding: 0 16px;
  }

  .shell-header__brand {
    grid-area: brand;
    min-width: 0;
  }

  .shell-header__actions {
    grid-area: actions;
    min-width: 0;
  }

  .shell-header__center {
    grid-area: center;
    display: block;
    margin-bottom: 12px;
  }

  .shell-header {
    height: auto;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .shell-header__menu {
    display: inline-grid;
  }

  .shell-sidebar {
    inset: 0 auto 0 0;
    transform: translateX(-100%);
    transition: transform 160ms ease;
    width: min(248px, 86vw);
    z-index: 50;
  }

  .shell-sidebar--open {
    transform: translateX(0);
  }

  .app-shell--sidebar-open .shell-header {
    left: min(248px, 86vw);
    width: calc(100% - min(248px, 86vw));
  }

  .shell-main {
    padding: 156px 16px 20px;
  }

  .shell-backdrop {
    inset: 0;
  }

  .shell-main > .auth-footer {
    width: min(100%, var(--content-max));
  }

  .page-header__top,
  .panel__header,
  .section-header,
  .toolbar,
  .inline-form,
  .data-table__toolbar,
  .data-table__footer,
  .modal__header {
    flex-direction: column;
  }

  .inline-form {
    grid-template-columns: 1fr;
  }

  .arquivos-path-actions {
    width: 100%;
    justify-content: stretch;
  }

  .arquivos-path-actions .button,
  .arquivos-path-actions .button--ghost-neutral {
    flex: 1 1 0;
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .hero-command {
    grid-template-columns: 1fr;
  }

  .chamadev-hero__highlights,
  .chamados-list-summary,
  .chamadev-create-card__grid {
    grid-template-columns: 1fr;
  }

  .chamadev-guided-fields__grid {
    grid-template-columns: 1fr;
  }

  .chamadev-create-steps {
    grid-template-columns: 1fr;
  }

  .chamadev-guided-fields__row {
    grid-template-columns: 1fr;
  }

  .chamadev-summary-card__meta {
    grid-template-columns: 1fr;
  }

  .chamados-list-panel__header {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .chamados-list-panel__actions {
    margin-left: 0;
  }

  .chamados-modal__layout {
    grid-template-columns: 1fr;
  }

  .chamados-modal__header-actions {
    width: 100%;
    justify-content: space-between;
    align-items: center;
  }

  .chamados-modal__header-badges {
    justify-content: flex-start;
  }

  .auth-shell {
    grid-template-columns: minmax(260px, 0.88fr) minmax(340px, 1.12fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 16px;
    padding: 16px;
  }

  .auth-panel--hero-login {
    min-height: 100%;
    background-position: center 26%;
  }

  .auth-panel--centered {
    align-items: stretch;
  }

  .auth-panel__content {
    max-width: 100%;
    min-height: auto;
  }

  .auth-login-brand {
    margin-top: 32px;
    padding-right: 0;
    gap: 8px;
  }

  .auth-login-form {
    margin-top: -24px;
    grid-template-rows: auto auto;
    gap: 14px;
  }

  .auth-login-form__main {
    align-self: stretch;
  }

  .auth-login-description {
    padding-top: 0;
    font-size: 14px;
  }

  .auth-login-brand__logo {
    width: 56px;
    height: 56px;
  }

  .auth-login-brand__eyebrow {
    font-size: 12px;
    letter-spacing: 0.14em;
  }

  .auth-login-brand__title {
    font-size: 32px;
  }

  .auth-panel h1,
  .auth-panel h2 {
    font-size: clamp(24px, 3vw, 34px);
  }

  .auth-panel,
  .page-header,
  .panel,
  .surface-card {
    padding: 14px;
  }

  .quick-link-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chamados-filters {
    grid-template-columns: 1fr;
  }

  .filters-grid--status,
  .filters-grid--recebimento {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .auth-shell {
    min-height: 100vh;
    grid-template-columns: minmax(200px, 0.82fr) minmax(320px, 1.18fr);
    grid-template-rows: minmax(0, 1fr) auto;
    padding: 12px;
    gap: 12px;
  }

  .auth-panel--hero-login {
    min-height: 100%;
    background-position: center 22%;
  }

  .auth-login-brand {
    margin-top: 12px;
    justify-content: center;
  }

  .auth-login-brand > div {
    justify-items: center;
  }

  .auth-login-brand__logo {
    width: 48px;
    height: 48px;
  }

  .auth-login-brand__title {
    font-size: 28px;
  }

  .auth-login-form {
    margin-top: 0;
    gap: 12px;
  }

  .auth-actions {
    gap: 10px;
  }

  .auth-actions .button,
  .auth-actions .button--secondary {
    min-height: 40px;
  }
}

@media (max-width: 760px) {
  .auth-shell {
    grid-template-columns: minmax(148px, 0.72fr) minmax(0, 1.28fr);
    grid-template-rows: minmax(0, 1fr) auto;
    padding: 10px;
    gap: 10px;
  }

  .auth-panel,
  .page-header,
  .panel,
  .surface-card {
    padding: 12px;
  }

  .auth-panel--hero-login {
    min-height: 100%;
    background-position: center 18%;
  }

  .auth-login-brand {
    gap: 6px;
    margin-top: 0;
    justify-content: center;
  }

  .auth-login-brand > div {
    justify-items: center;
  }

  .auth-login-brand__logo {
    width: 40px;
    height: 40px;
  }

  .auth-login-brand__eyebrow {
    font-size: 10px;
    letter-spacing: 0.12em;
  }

  .auth-login-brand__title {
    font-size: 24px;
  }

  .auth-login-form {
    gap: 10px;
  }

  .auth-panel h1,
  .auth-panel h2 {
    font-size: clamp(20px, 3vw, 28px);
  }

  .field span,
  .auth-login-description,
  .muted {
    font-size: 13px;
  }

  .chamadev-hero__grid {
    gap: 18px;
  }

  .field input,
  .field textarea,
  .field select {
    min-height: 42px;
    padding: 10px 12px;
  }

  .button,
  .button--secondary {
    min-height: 40px;
    padding: 10px 14px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .auth-shell {
    grid-template-columns: minmax(120px, 0.68fr) minmax(0, 1.32fr);
    gap: 8px;
    padding: 8px;
  }

  .auth-login-brand__title {
    font-size: 22px;
  }

  .auth-login-description {
    font-size: 12px;
  }

  .auth-panel h1,
  .auth-panel h2 {
    font-size: clamp(18px, 4vw, 24px);
  }

  .field span {
    font-size: 12px;
  }

  .field-label-with-help {
    gap: 6px;
  }

  .field-help {
    width: 14px;
    height: 14px;
    font-size: 10px;
  }
}

@media (max-width: 760px) {
  .whatsapp-template-guide__grid,
  .whatsapp-template-example__variables,
  .whatsapp-template-composer__grid {
    grid-template-columns: 1fr;
  }

  .shell-header {
    grid-template-columns: 1fr;
    grid-template-areas:
      "brand"
      "center"
      "actions";
    gap: 10px;
    padding: 12px;
  }

  .shell-header__brand,
  .shell-header__actions {
    width: 100%;
  }

  .shell-header__brand {
    justify-content: space-between;
    gap: 10px;
  }

  .shell-header__actions {
    justify-content: stretch;
  }

  .brand {
    min-width: 0;
  }

  .brand > div {
    justify-items: start;
  }

  .brand__eyebrow {
    font-size: 10px;
    letter-spacing: 0.12em;
  }

  .brand__title {
    font-size: 16px;
  }

  .user-menu,
  .user-menu__trigger {
    min-width: 0;
    width: 100%;
  }

  .user-menu__trigger {
    justify-content: space-between;
  }

  .user-menu__identity {
    min-width: 0;
    text-align: left;
  }

  .user-menu__identity strong,
  .user-menu__identity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shell-main {
    padding: 192px 12px 20px;
  }

  .app-shell--sidebar-open .shell-header {
    left: min(248px, 86vw);
    width: calc(100% - min(248px, 86vw));
    padding-left: 10px;
    padding-right: 10px;
  }

  .home-grid,
  .quick-link-list,
  .checkbox-grid,
  .hero-command__list {
    grid-template-columns: 1fr;
  }

  .filter-grid > *,
  .kpi-grid > *,
  .info-grid > *,
  .card-grid > *,
  .analytics-grid > *,
  .analytics-grid--two > *,
  .analytics-grid--three > *,
  .link-grid > *,
  .form-grid--two > *,
  .form-grid--three > * {
    grid-column: 1 / -1;
  }

  .data-table__toolbar-actions {
    grid-auto-flow: row;
  }

  .command-item {
    flex-direction: column;
  }

  .command-item__meta {
    text-align: left;
  }

  .controle-tarefas__actions {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .controle-tarefas__task-name,
  .controle-tarefas__date,
  .controle-tarefas__result {
    min-width: 0;
    max-width: none;
  }

  .perfil-card {
    padding: 16px;
    gap: 16px;
  }

  .perfil-card__identity,
  .perfil-overview-grid,
  .perfil-action-section__body,
  .perfil-action-section__body--single {
    grid-template-columns: 1fr;
  }

  .perfil-card__identity {
    padding: 16px;
  }

  .perfil-card__avatar {
    width: 60px;
    height: 60px;
    border-radius: 20px;
  }

  .perfil-card__identity-copy h2 {
    font-size: 1.75rem;
  }

  .perfil-action-section__body .button {
    width: 100%;
    min-width: 0;
  }

  .importacao-banco__summary > *,
  .importacao-banco__lists > * {
    grid-column: 1 / -1;
  }

  .chamadev-page > * {
    min-width: 940px;
  }

  .chamadev-hero {
    overflow: hidden;
  }

  .chamadev-hero__grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    gap: 14px;
  }

  .chamadev-hero__title-row h1 {
    font-size: 42px;
  }

  .chamadev-hero__description {
    font-size: 14px;
  }

  .chamadev-hero__highlights {
    grid-template-columns: 1fr;
  }

  .chamadev-segmented {
    width: min(100%, 360px);
  }

  .chamadev-segmented__item {
    min-height: 38px;
    padding: 8px 12px;
    font-size: 14px;
  }

  .chamadev-hero__actions {
    gap: 8px;
  }

  .chamadev-hero__actions .button,
  .chamadev-hero__actions .button--ghost-neutral,
  .chamados-filter-actions .button,
  .chamados-filter-actions .button--secondary,
  .chamados-filter-actions .button--ghost-neutral {
    min-height: 36px;
    padding: 8px 12px;
    font-size: 14px;
  }

  .chamadev-stat-card {
    min-height: 92px;
    padding: 14px 16px;
  }

  .chamadev-stat-card strong {
    font-size: 30px;
  }

  .chamados-layout {
    grid-template-columns: minmax(300px, 0.92fr) minmax(0, 1.08fr);
    gap: 14px;
  }

  .chamados-layout.chamados-layout--single {
    grid-template-columns: minmax(0, 1fr);
  }

  .chamado-card {
    padding: 15px;
  }

  .chamado-card__title {
    font-size: 16px;
  }

  .chamado-card__description,
  .chamado-card__meta span,
  .chamados-description,
  .muted {
    font-size: 13px;
  }

  .chamados-detail-grid > * {
    grid-column: span 4;
  }
}

/* ===========================================================================
   MOVIMENTO

   Tudo aqui e entrada: o elemento aparece uma vez e para. Nada fica em loop,
   nada se mexe enquanto a pessoa le. O "both" guarda o estado inicial durante o
   delay, senao o item pisca na posicao final antes de comecar.

   O bloco inteiro morre em prefers-reduced-motion, no fim da secao.
   =========================================================================== */

@keyframes atlas-sobe {
  from { opacity: 0; transform: translateY(14px) scale(0.994); }
  to   { opacity: 1; transform: none; }
}

@keyframes atlas-surge {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

@keyframes atlas-cresce-x {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

@keyframes atlas-desenha {
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
}

/* Passa uma vez sobre a barra enquanto ela cresce, como o shine dos botoes do
   Copilot. Vai alem da largura para sair de cena em vez de sumir no meio. */
@keyframes atlas-brilho {
  from { transform: translateX(-120%); }
  to   { transform: translateX(320%); }
}

/* Chega passando um tico do lugar e volta - da peso ao numero que aterrissa. */
@keyframes atlas-assenta {
  0%   { opacity: 0; transform: translateY(10px); }
  62%  { opacity: 1; transform: translateY(-2px); }
  100% { opacity: 1; transform: none; }
}

@keyframes atlas-ponto {
  0%   { opacity: 0; transform: scale(0.2); }
  70%  { opacity: 1; transform: scale(1.25); }
  100% { opacity: 1; transform: scale(1); }
}

/* Barra de espera: some e volta sem sair do lugar, para nao competir com o
   conteudo que vai ocupar a linha. */
@keyframes atlas-espera {
  0%, 100% { opacity: 0.28; }
  50%      { opacity: 0.62; }
}

@keyframes atlas-respira {
  0%, 100% { opacity: 0.62; }
  50%      { opacity: 1; }
}

/* --- entrada por rolagem -------------------------------------------------
   A classe "revelar" e posta pelo hook em lib/revelarNaRolagem.ts, nunca no
   JSX. Sem ela nada fica escondido - se o JS nao rodar, a pagina aparece
   inteira sem animacao em vez de ficar em branco. */
/* O modal e filho direto desta pilha, mas nao pertence a ela: e sobreposicao,
   nao bloco de conteudo. Sem a excecao ele nascia transparente e ficava assim,
   porque o observador so reavalia quando o conteudo da pagina muda. */
.pq-page.revelar > *:not(.visivel):not(.modal-backdrop) {
  opacity: 0;
}

.pq-page > *.visivel:not(.modal-backdrop) {
  animation: atlas-sobe 760ms var(--ease-saida) both;
}

/* A ancoragem de rolagem do navegador tenta compensar quando algo muda de
   tamanho acima do ponto lido. Com blocos entrando e saindo de opacidade ela
   briga com a revelacao e joga a pagina para lugares aleatorios. */
.pq-page {
  overflow-anchor: none;
}

/* O escalonamento agora e de quem entra junto na mesma dobra, nao da pagina
   toda: dois blocos que aparecem no mesmo momento nao sobem colados. */
.pq-page > *.visivel:nth-child(even) { animation-delay: 120ms; }

/* Os KPIs entram um a um dentro da propria faixa, quando ela e revelada. */
.pq-page > .visivel .kpi-grid > * {
  animation: atlas-surge 620ms var(--ease-saida) both;
}

/* O numero chega depois do cartao e passa um tico do lugar: e o dado que a
   pessoa veio ver, entao ele merece o ultimo movimento da sequencia. */
.pq-page > .visivel .kpi-card__value {
  animation: atlas-assenta 840ms var(--ease-saida) both;
  animation-delay: 360ms;
}

.pq-page > .visivel .kpi-grid > *:nth-child(1) { animation-delay: 100ms; }
.pq-page > .visivel .kpi-grid > *:nth-child(2) { animation-delay: 175ms; }
.pq-page > .visivel .kpi-grid > *:nth-child(3) { animation-delay: 250ms; }
.pq-page > .visivel .kpi-grid > *:nth-child(4) { animation-delay: 325ms; }
.pq-page > .visivel .kpi-grid > *:nth-child(5) { animation-delay: 400ms; }
.pq-page > .visivel .kpi-grid > *:nth-child(6) { animation-delay: 475ms; }

/* Trocar de aba remonta o painel: a entrada sozinha ja marca a troca. */
.pq-page > .visivel .data-table {
  animation: atlas-surge 540ms var(--ease-suave) both;
}

/* --- graficos ------------------------------------------------------------ */
/* A barra ja nasce com a largura final; o scaleX cresce a partir dela, entao
   o valor nunca e desenhado errado - so revelado. */
.bar-chart__fill {
  position: relative;
  overflow: hidden;
  transform-origin: left center;
  animation: atlas-cresce-x 1000ms var(--ease-saida) both;
}

/* O brilho e um irmao dentro do preenchimento: cresce junto e some sozinho. */
.bar-chart__fill::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgba(255, 255, 255, 0.55) 45%,
    transparent 100%
  );
  animation: atlas-brilho 1450ms var(--ease-suave) both;
  animation-delay: 300ms;
  pointer-events: none;
}

.bar-chart__row:nth-child(1) .bar-chart__fill { animation-delay: 60ms; }
.bar-chart__row:nth-child(2) .bar-chart__fill { animation-delay: 140ms; }
.bar-chart__row:nth-child(3) .bar-chart__fill { animation-delay: 220ms; }
.bar-chart__row:nth-child(4) .bar-chart__fill { animation-delay: 300ms; }
.bar-chart__row:nth-child(5) .bar-chart__fill { animation-delay: 380ms; }
.bar-chart__row:nth-child(n + 6) .bar-chart__fill { animation-delay: 440ms; }

/* Dentro das telas do Portal Acordo a barra deixa de seguir a faixa e passa a
   seguir a si mesma: cada linha e observada, cresce quando entra na dobra e o
   escalonamento por posicao some - ele so faria sentido se todas entrassem
   juntas. O rotulo entra junto com o preenchimento. */
.pq-page.revelar .bar-chart__row:not(.visivel) .bar-chart__fill,
.pq-page.revelar .bar-chart__row:not(.visivel) .bar-chart__fill::after,
.pq-page.revelar .bar-chart__row:not(.visivel) .bar-chart__label {
  animation-play-state: paused;
}

.pq-page.revelar .bar-chart__row .bar-chart__fill { animation-delay: 0ms; }

.pq-page.revelar .bar-chart__row:not(.visivel) .bar-chart__label {
  opacity: 0;
}

.pq-page.revelar .bar-chart__row .bar-chart__label {
  animation: atlas-surge 620ms var(--ease-saida) both;
  animation-delay: 220ms;
}

/* pathLength normaliza o traco em 1, entao um dasharray de 1 vale para
   qualquer serie - nao precisa medir o caminho em JS. */
.line-chart__line {
  stroke-dasharray: 1;
  animation: atlas-desenha 1500ms var(--ease-suave) both;
}

.line-chart__area {
  animation: atlas-surge 1150ms var(--ease-suave) both;
  animation-delay: 300ms;
}

.line-chart__point {
  transform-box: fill-box;
  transform-origin: center;
  animation: atlas-ponto 700ms var(--ease-saida) both;
  animation-delay: 1050ms;
}

/* Angulo registrado: sem isso o navegador trata a variavel como texto e o
   keyframe pula de 0 para 360 em vez de percorrer. Onde nao houver suporte, a
   rosca simplesmente aparece inteira - que e o comportamento de antes. */
@property --varredura {
  syntax: "<angle>";
  initial-value: 360deg;
  inherits: false;
}

@keyframes atlas-rosca {
  from { --varredura: 0deg; }
  to   { --varredura: 360deg; }
}

/* A rosca se desenha no sentido do relogio, como quem preenche. */
.donut-chart__ring::before {
  mask: conic-gradient(#000 var(--varredura), transparent 0deg);
  -webkit-mask: conic-gradient(#000 var(--varredura), transparent 0deg);
  animation: atlas-rosca 2600ms var(--ease-suave) both;
}

/* O anel ainda ganha a entrada, mais discreta agora que a varredura carrega o
   movimento: so escala, sem a rotacao que competia com o desenho. */
.donut-chart__ring {
  animation: atlas-surge 900ms var(--ease-saida) both;
}

/* O total do meio entra depois da volta completa. */
.donut-chart__center {
  animation: atlas-assenta 900ms var(--ease-saida) both;
  animation-delay: 2400ms;
}

.donut-chart__swatch {
  animation: atlas-ponto 700ms var(--ease-saida) both;
  animation-delay: 900ms;
}

.donut-chart__legend-item {
  animation: atlas-surge 760ms var(--ease-suave) both;
  animation-delay: 760ms;
}

/* Nos outros painies do Atlas o grafico anima ao montar, como antes. Aqui ele
   espera a dobra: pausado no primeiro quadro enquanto o bloco esta escondido,
   volta a correr no instante em que o bloco e revelado. */
.pq-page.revelar > *:not(.visivel) .bar-chart__fill,
.pq-page.revelar > *:not(.visivel) .line-chart__line,
.pq-page.revelar > *:not(.visivel) .line-chart__area,
.pq-page.revelar > *:not(.visivel) .line-chart__point,
.pq-page.revelar > *:not(.visivel) .donut-chart__ring,
.pq-page.revelar > *:not(.visivel) .donut-chart__ring::before,
.pq-page.revelar > *:not(.visivel) .donut-chart__center,
.pq-page.revelar > *:not(.visivel) .donut-chart__swatch,
.pq-page.revelar > *:not(.visivel) .donut-chart__legend-item {
  animation-play-state: paused;
}

/* --- modal --------------------------------------------------------------- */
.modal-backdrop {
  animation: atlas-surge 280ms ease both;
}

.modal {
  animation: atlas-sobe 460ms var(--ease-saida) both;
}

/* --- consulta em andamento ----------------------------------------------- */
/* Substitui a opacidade fixa: pulsar diz "esta vindo", opaco diz "quebrou". */
.dashboard-refreshing {
  animation: atlas-respira 1.8s ease-in-out infinite;
  opacity: 1;
}

/* --- tabela esperando dado ----------------------------------------------- */
/* Ocupa a altura de uma linha real, entao a tabela nao muda de tamanho quando
   o dado chega - e o que evita o salto. A largura varia por coluna so para nao
   parecer um formulario em branco. */
.table__espera {
  display: block;
  height: 12px;
  border-radius: 999px;
  background: var(--text-muted);
  animation: atlas-espera 1.5s ease-in-out infinite;
}

.table tbody tr:nth-child(odd) .table__espera { width: 72%; }
.table tbody tr:nth-child(even) .table__espera { width: 54%; }
.table td:last-child .table__espera { width: 40%; }

/* --- quem pediu para nao ver movimento ------------------------------------ */
@media (prefers-reduced-motion: reduce) {
  .pq-page > *,
  .pq-page > *.visivel,
  .pq-page > .visivel .kpi-grid > *,
  .pq-page > .visivel .data-table,
  .bar-chart__fill,
  .line-chart__line,
  .line-chart__area,
  .line-chart__point,
  .bar-chart__fill::after,
  .bar-chart__label,
  .pq-page.revelar .bar-chart__row .bar-chart__label,
  .pq-page > .visivel .kpi-card__value,
  .donut-chart__ring,
  .donut-chart__ring::before,
  .donut-chart__center,
  .donut-chart__swatch,
  .donut-chart__legend-item,
  .modal-backdrop,
  .modal,
  .dashboard-refreshing {
    animation: none;
  }

  .dashboard-refreshing { opacity: 0.78; }
  .table__espera { animation: none; opacity: 0.4; }
  .pq-page.revelar > *:not(.visivel),
  .pq-page.revelar .bar-chart__row:not(.visivel) .bar-chart__label { opacity: 1; }
  .bar-chart__fill::after { display: none; }
  .donut-chart__ring::before { mask: none; -webkit-mask: none; }
  .line-chart__line { stroke-dasharray: none; }
}
`;

export function ensureGlobalStyles() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById(GLOBAL_STYLES_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = GLOBAL_STYLES_ID;
  style.textContent = globalStyles;
  document.head.appendChild(style);
}
