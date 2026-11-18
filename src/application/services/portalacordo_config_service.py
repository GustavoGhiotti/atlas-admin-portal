"""Regra de negocio da configuracao do Portal Acordo.

Escreve direto no schema [cfg] do banco do Portal Acordo. Duas consequencias
dessa escolha aparecem aqui:

1. A validacao dos CHECK do banco e replicada em src/schemas/portalacordo.py, para
   o gestor receber mensagem legivel em vez de erro de driver.
2. O portal mantem cache em memoria de 5 minutos POR PROCESSO. Gravando por SQL
   nao ha como invalida-lo - a rota HTTP do Portal Acordo faria isso, o banco nao.
   Toda resposta de escrita carrega o aviso de propagacao para a tela repassar.

Leitura de configuracao nao e cacheada: as tabelas sao pequenas (dezenas de
linhas) e um cache aqui faria a tela mostrar o valor antigo logo depois de salvar.
"""

import os
from time import perf_counter
from urllib.parse import quote

from src.infrastructure.repositories import PortalAcordoConfigRepository
from src.infrastructure.services.env_load import get_env
from src.infrastructure.services.logger_config import setup_logger
from src.infrastructure.services.request_context import get_request_id
from src.shared.exception import AtlasException


# Pasta do banco de imagens que o portal do Portal Acordo serve em /images/PortalAcordo.
# O nome tem que bater com o da rota em PortalAcordo/backend/main.py.
PASTA_IMAGENS_PORTALACORDO = "PortalAcordo"
EXTENSOES_IMAGEM = (".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif")


AVISO_PROPAGACAO = (
    "Alteracao gravada. O portal do Portal Acordo mantem cache de ate 5 minutos por "
    "processo, entao ela pode levar esse tempo para aparecer no site."
)

ENTIDADES_AUDITAVEIS = (
    "CARTEIRA",
    "CARTEIRA_ALIAS",
    "LANDING_PAGE",
    "MAILING_CARTEIRA",
    "NUMERO_CONTATO",
)


class PortalAcordoConfigService:
    def __init__(self, repository=None, logger_name: str = "atlas.portalacordo-config") -> None:
        self.repository = repository or PortalAcordoConfigRepository()
        self.logger = setup_logger(logger_name)

    # ------------------------------------------------------------------ leitura

    def listar_carteiras(self) -> list[dict[str, object]]:
        return [
            {
                "id": int(row[0]),
                "codigo": str(row[1]),
                "nome": str(row[2]),
                "id_cedente": int(row[3]) if row[3] is not None else None,
                "ativo": bool(row[4]),
                "atualizado_em": self._fmt(row[5]),
                "qtd_landing": int(row[6] or 0),
                "qtd_numero": int(row[7] or 0),
                "qtd_mailing": int(row[8] or 0),
                "qtd_alias": int(row[9] or 0),
            }
            for row in self.repository.listar_carteiras()
        ]

    def listar_landing_pages(self) -> list[dict[str, object]]:
        return [
            {
                "id": int(row[0]),
                "slug": str(row[1]),
                "nome_cliente": str(row[2]),
                "ativo": bool(row[3]),
                "ordem": int(row[4] or 0),
                "imagem_logo": str(row[5] or ""),
                "imagem_fundo": str(row[6] or ""),
                "logo_class": str(row[7] or "") or None,
                "atualizado_em": self._fmt(row[8]),
                "carteira": str(row[9] or "") or None,
                "carteira_nome": str(row[10] or "") or None,
                "carteira_ativa": bool(row[11]) if row[11] is not None else None,
                "mailing_prefixo": str(row[12] or "") or None,
                "whatsapp_efetivo": str(row[13] or "") or None,
                # LANDING | CARTEIRA | GLOBAL | NAO_CONFIGURADO - de onde o numero veio.
                "whatsapp_origem": str(row[14] or ""),
                "qtd_faq_ativa": int(row[15] or 0),
                "exibir_na_home": bool(row[16]),
                "logo_class_home": str(row[17] or "") or None,
                "titulo": str(row[18] or "") or None,
                "subtitulo": str(row[19] or "") or None,
                "numero_whatsapp": str(row[20] or "") or None,
            }
            for row in self.repository.listar_landing_pages()
        ]

    def listar_faq(self, slug: str) -> list[dict[str, object]]:
        return [
            {
                "id": int(row[0]),
                "ordem": int(row[1] or 0),
                "pergunta": str(row[2]),
                "resposta": str(row[3]),
                "ativo": bool(row[4]),
            }
            for row in self.repository.listar_faq(slug)
        ]

    def listar_mailings(self) -> list[dict[str, object]]:
        return [
            {
                "id": int(row[0]),
                "carteira": str(row[1]),
                "carteira_nome": str(row[2]),
                "prefixo": str(row[3]),
                "campanha": str(row[4] or "") or None,
                "observacao": str(row[5] or "") or None,
                "ativo": bool(row[6]),
                "atualizado_em": self._fmt(row[7]),
                "qtd_alias": int(row[8] or 0),
                # O prefixo compoe o nome do arquivo entregue ao discador Olos.
                "arquivo_exemplo": f"{row[3]}portalacordo_AAAAMMDD_HHMMSS.txt",
            }
            for row in self.repository.listar_mailings()
        ]

    def listar_numeros(self) -> list[dict[str, object]]:
        return [
            {
                "id": int(row[0]),
                "canal": str(row[1]),
                "escopo": str(row[2]),
                "carteira": str(row[3] or "") or None,
                "carteira_nome": str(row[4] or "") or None,
                "numero": str(row[5]),
                "rotulo": str(row[6] or "") or None,
                "prioridade": int(row[7] or 0),
                "ativo": bool(row[8]),
                "atualizado_em": self._fmt(row[9]),
            }
            for row in self.repository.listar_numeros()
        ]

    def listar_aliases(self) -> list[dict[str, object]]:
        return [
            {
                "id": int(row[0]),
                "alias": str(row[1]),
                "carteira": str(row[2]),
                "carteira_nome": str(row[3]),
                "tipo_match": str(row[4]),
                "prioridade": int(row[5] or 0),
                "ativo": bool(row[6]),
                "atualizado_em": self._fmt(row[7]),
            }
            for row in self.repository.listar_aliases()
        ]

    def listar_imagens(self) -> list[dict[str, object]]:
        """Opcoes de logo para a tela.

        Une duas fontes. A pasta PortalAcordo do banco de imagens e a que importa: e
        onde um logo novo aparece sem deploy do portal, porque o Portal Acordo serve
        /images/PortalAcordo/* redirecionando para o share. Os caminhos ja gravados
        entram junto para que uma landing que aponta para outro lugar (o fundo, por
        exemplo) continue aparecendo na lista em vez de sumir do seletor.
        """
        opcoes: dict[str, dict[str, object]] = {}

        for caminho, url in self._listar_arquivos_do_share():
            opcoes[caminho] = {
                "caminho": caminho,
                "usos": 0,
                "origem": "banco de imagens",
                # URL publica do share, para a tela mostrar a miniatura. O portal nao
                # usa esta URL: la o caminho interno vale, e a rota /images/PortalAcordo
                # e que redireciona. Aqui ela serve so para o gestor ver o que escolheu.
                "url_preview": url,
            }

        for row in self.repository.listar_imagens_em_uso():
            caminho = str(row[0])
            registro = opcoes.setdefault(
                caminho,
                # Arquivo do bundle do portal: o Atlas nao alcanca para pre-visualizar.
                {"caminho": caminho, "usos": 0, "origem": "bundle do portal", "url_preview": None},
            )
            registro["usos"] = int(row[1] or 0)

        return sorted(opcoes.values(), key=lambda item: (-int(item["usos"]), str(item["caminho"])))

    def _listar_arquivos_do_share(self) -> list[tuple[str, str | None]]:
        """Devolve (caminho interno, url publica) de cada arquivo da pasta."""
        pasta = os.path.join(get_env("IMAGE_SHARE_PATH", required=False) or "", "imagens", PASTA_IMAGENS_PORTALACORDO)
        base_publica = (get_env("IMAGE_PUBLIC_BASE_URL", required=False) or "").rstrip("/")
        try:
            arquivos = sorted(
                nome for nome in os.listdir(pasta)
                if os.path.isfile(os.path.join(pasta, nome)) and nome.lower().endswith(EXTENSOES_IMAGEM)
            )
        except OSError as exc:
            # Share fora do ar nao pode derrubar a tela: o gestor perde a sugestao,
            # nao a capacidade de editar. O campo aceita caminho digitado.
            self.logger.warning(
                "request_id=%s etapa=falha operacao=listar_imagens_share pasta=%s erro=%s",
                get_request_id(), pasta, exc,
            )
            return []

        return [
            (
                f"/images/{PASTA_IMAGENS_PORTALACORDO}/{nome}",
                f"{base_publica}/{PASTA_IMAGENS_PORTALACORDO}/{quote(nome)}" if base_publica else None,
            )
            for nome in arquivos
        ]

    def listar_auditoria(self, entidade: str | None = None, limite: int = 100) -> list[dict[str, object]]:
        entidade_normalizada = (entidade or "").strip().upper() or None
        if entidade_normalizada and entidade_normalizada not in ENTIDADES_AUDITAVEIS:
            raise AtlasException(f"Entidade invalida. Use uma de: {', '.join(ENTIDADES_AUDITAVEIS)}.")
        limite_efetivo = max(1, min(int(limite or 100), 500))
        return [
            {
                "id": int(row[0]),
                "entidade": str(row[1]),
                "id_entidade": int(row[2]) if row[2] is not None else None,
                "acao": str(row[3]),
                "dados_antes": str(row[4]) if row[4] is not None else None,
                "dados_depois": str(row[5]) if row[5] is not None else None,
                "ator": str(row[6]),
                "origem_ip": str(row[7] or "") or None,
                "criado_em": self._fmt(row[8]),
            }
            for row in self.repository.listar_auditoria(entidade_normalizada, limite_efetivo)
        ]

    # ------------------------------------------------------------------ escrita

    def salvar_carteira(self, payload, ator: str, ip: str | None) -> dict[str, object]:
        dados = payload.model_dump()
        self._gravar("carteira", dados["codigo"], lambda: self.repository.salvar_carteira(dados, ator, ip), ator)
        return self._resposta(f"Carteira {dados['codigo']} salva.")

    def salvar_alias(self, payload, ator: str, ip: str | None) -> dict[str, object]:
        dados = payload.model_dump()
        id_carteira = self._resolver_carteira(dados.pop("carteira"))
        self._gravar(
            "alias", dados["alias"], lambda: self.repository.salvar_alias(dados, id_carteira, ator, ip), ator
        )
        return self._resposta(f"Alias {dados['alias']} salvo.")

    def salvar_mailing(self, payload, ator: str, ip: str | None) -> dict[str, object]:
        dados = payload.model_dump()
        codigo = dados.pop("carteira")
        id_carteira = self._resolver_carteira(codigo)
        self._gravar(
            "mailing", codigo, lambda: self.repository.salvar_mailing(dados, id_carteira, ator, ip), ator
        )
        if not dados["ativo"]:
            # Sem mailing ativo a geracao nao para: ligar.py cai no MAILING_PREFIX_BY_CARTEIRA
            # embutido no codigo do Portal Acordo. Prometer o contrario seria mentira.
            return self._resposta(
                f"Mailing da carteira {codigo} salvo como inativo. Atencao: isso nao interrompe a "
                "geracao de arquivo - sem registro ativo o Portal Acordo usa o prefixo embutido no "
                "codigo dele como fallback."
            )
        return self._resposta(
            f"Mailing da carteira {codigo} salvo. Os arquivos passam a sair como "
            f"{dados['prefixo']}portalacordo_AAAAMMDD_HHMMSS.txt."
        )

    def salvar_numero(self, payload, ator: str, ip: str | None) -> dict[str, object]:
        dados = payload.model_dump()
        codigo = dados.pop("carteira")
        id_carteira = self._resolver_carteira(codigo) if codigo else None
        self._gravar(
            "numero", dados["numero"], lambda: self.repository.salvar_numero(dados, id_carteira, ator, ip), ator
        )
        detalhe = ""
        if dados["escopo"] == "GLOBAL" and dados["ativo"]:
            detalhe = " O numero global anterior desse canal foi desativado."
        return self._resposta(f"Numero {dados['numero']} salvo.{detalhe}")

    def salvar_landing(self, payload, ator: str, ip: str | None) -> dict[str, object]:
        dados = payload.model_dump()
        faq = dados.pop("faq")
        codigo = dados.pop("carteira")
        id_carteira = self._resolver_carteira(codigo) if codigo else None

        existente = self.repository.buscar_landing_por_slug(dados["slug"])
        self._gravar(
            "landing",
            dados["slug"],
            lambda: self.repository.salvar_landing(dados, id_carteira, faq, ator, ip),
            ator,
        )

        detalhe = ""
        if faq is not None:
            detalhe = (
                f" O FAQ foi substituido por {len(faq)} pergunta(s)."
                if faq
                else " O FAQ foi esvaziado."
            )
        acao = "atualizada" if existente else "criada"
        return self._resposta(f"Landing page {dados['slug']} {acao}.{detalhe}")

    def alterar_situacao_landing(self, slug: str, payload, ator: str, ip: str | None) -> dict[str, object]:
        if not self.repository.buscar_landing_por_slug(slug):
            raise AtlasException("Landing page nao encontrada.", status_code=404)
        self._gravar(
            "situacao",
            slug,
            lambda: self.repository.alterar_situacao_landing(
                slug, payload.ativo, payload.exibir_na_home, ator, ip
            ),
            ator,
        )
        partes = []
        if payload.ativo is not None:
            partes.append("publicada no ar" if payload.ativo else "despublicada")
        if payload.exibir_na_home is not None:
            partes.append("exibida na home" if payload.exibir_na_home else "escondida da home")
        return self._resposta(f"Landing page {slug} {' e '.join(partes)}.")

    def excluir_landing(self, slug: str, ator: str, ip: str | None) -> dict[str, object]:
        if not self.repository.buscar_landing_por_slug(slug):
            raise AtlasException("Landing page nao encontrada.", status_code=404)

        if not self.repository.auditoria_aceita_exclusao():
            raise AtlasException(
                "A trilha de auditoria ainda nao aceita a acao EXCLUSAO. Rode "
                "backend/docs/atlas-excluir-landing.sql no banco do Portal Acordo "
                "e tente de novo. Nada foi apagado.",
                status_code=409,
            )

        self._gravar(
            "exclusao",
            slug,
            lambda: self.repository.excluir_landing(slug, ator, ip),
            ator,
        )
        return self._resposta(
            f"Landing page {slug} excluida. A trilha de auditoria guarda a copia do "
            "registro e do FAQ, entao da para recadastrar a partir dela."
        )

    # ------------------------------------------------------------------ helpers

    def _resolver_carteira(self, codigo: str) -> int:
        carteira = self.repository.buscar_carteira_por_codigo(codigo)
        if not carteira:
            raise AtlasException(
                f"Carteira {codigo} nao existe em cfg.TB_CFG_CARTEIRA. "
                "Cadastre a carteira antes de vincular landing, mailing, numero ou alias."
            )
        return int(carteira[0])

    def _gravar(self, operacao: str, chave: str, acao, ator: str) -> None:
        started_at = perf_counter()
        self.logger.info(
            "request_id=%s etapa=inicio operacao=salvar_%s chave=%s ator=%s",
            get_request_id(),
            operacao,
            chave,
            ator,
        )
        acao()
        self.logger.info(
            "request_id=%s etapa=fim operacao=salvar_%s chave=%s ator=%s duracao_ms=%.2f",
            get_request_id(),
            operacao,
            chave,
            ator,
            (perf_counter() - started_at) * 1000,
        )

    def _resposta(self, mensagem: str) -> dict[str, object]:
        return {"status": "ok", "mensagem": mensagem, "aviso": AVISO_PROPAGACAO}

    def _fmt(self, value) -> str:
        if value is None:
            return ""
        return value.isoformat() if hasattr(value, "isoformat") else str(value)
