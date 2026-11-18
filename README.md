# Atlas

> **Versão de portfólio.** Código real de produção, anonimizado: nomes de empresa, clientes, pessoas, hosts, e-mails e credenciais foram trocados por valores fictícios (`Acme`, `Banco Alfa`, `10.0.0.x`, `empresa.example`). Toda configuração sensível vem do `.env` (modelo em `.env.example`). O código não aponta para nenhum sistema real.

Reestruturacao do projeto interno `Atlas`, mantendo inicialmente apenas os modulos de:

- desbloqueio de usuarios
- banco de imagens

## Base adotada

O projeto foi reorganizado com base na estrutura observada em:

- `C:\Users\usuario\Documents\APISistemaAcme`
- `C:\Users\usuario\Documents\PortalAcordo`

Padrao atual aplicado:

- `routers/` para exposicao das rotas
- `src/application/services/` para regras de negocio
- `src/infrastructure/` para banco, AD, fileshare, middleware e configuracao
- `src/schemas/` para contratos da API
- `src/shared/` para excecoes e handlers globais
- `frontend/` para a aplicacao React/TypeScript no padrao de estrutura do `PortalAcordo`

## Rotas iniciais

- `GET /api/status`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/desbloqueio-usuario/pesquisar`
- `POST /api/desbloqueio-usuario/executar`
- `GET /api/banco-imagens`
- `POST /api/banco-imagens/upload` com campo opcional `pasta_destino`
- `DELETE /api/banco-imagens/{caminho_arquivo}`

## Configuracao local

### Backend

1. Criar `.env` a partir de `.env.example`
2. Criar a `venv`
3. Ativar a `venv`
4. Instalar dependencias do backend
5. Subir a API

Comandos no Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Se a `venv` ja estava criada antes, rode novamente o `pip install -r requirements.txt` para instalar as dependencias novas do modo HTML legado, incluindo `Jinja2`.

### Frontend

Com o backend rodando, abrir outro terminal e executar:

```powershell
cd frontend
npm install
npm run dev
```

Frontend local:

- `http://localhost:8080`

Backend local:

- `http://localhost:8000`
- `http://localhost:8000/docs`

Fluxo esperado no frontend:

1. Abrir `http://localhost:8080/login`
2. Fazer login com o usuario do portal antigo
3. Navegar pelo menu lateral
4. No desbloqueio, informar apenas o CPF do colaborador
5. No banco de imagens, listar e operar os arquivos conforme permissao do grupo

### Build integrado

Se quiser que o FastAPI sirva o frontend como no ambiente final:

```powershell
cd frontend
npm install
npm run build
```

Depois, acessando `http://localhost:8000/`, o backend servira o build de `frontend/dist`.

## Observacoes

- A regra de permissao da pesquisa de desbloqueio foi portada do `Atlas` antigo.
- O login foi portado com base no `DB_BIGGER`, reutilizando `TB_USUARIO`, `TB_CONEXOES` e `TB_GRUPOS_USUARIOS`.
- O desbloqueio continua usando SQL Server para buscar credenciais e auditar o log.
- O banco de imagens continua operando no compartilhamento de rede configurado por variavel de ambiente.
- O banco de imagens agora lista arquivos em subpastas e permite upload em pastas novas ou existentes.
- Caminho atual do banco de imagens: `\\10.0.0.91\c$\inetpub\wwwroot\APISistemaAcme\arquivos\imagens`
- URL publica das imagens: `https://api.empresa.example/imagens`
- Em desenvolvimento, o Vite usa proxy para `/api` apontando para `http://localhost:8000`
- O menu lateral do frontend deixa prontos os dois modulos migrados nesta fase.
- O restante do legado nao foi migrado nesta etapa.
