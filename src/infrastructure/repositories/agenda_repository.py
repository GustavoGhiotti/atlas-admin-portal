from src.infrastructure.databases.sql_server import get_sql_server_66, get_sql_server_71


class AgendaRepository:
    TABLE_NAME = "agendamento.TB_AGENDAMENTOS_CALENDARIO"
    PENDENCIAS_TABLE_NAME = "agendamento.TB_AGENDAMENTOS_PENDENCIAS"
    PARTICIPANTES_TABLE_NAME = "agendamento.TB_AGENDAMENTOS_PARTICIPANTES"

    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_BIGGER")
        self.report_db = get_sql_server_71("DB_REPORT")

    def listar(self) -> list[dict[str, object]]:
        query = f"""
        SELECT
            ID_AGENDAMENTO AS id,
            CONVERT(VARCHAR(10), DIA, 23) AS date,
            CONVERT(VARCHAR(8), HORARIO_ENTRADA, 108) AS horario_entrada,
            CONVERT(VARCHAR(8), HORARIO_SAIDA, 108) AS horario_saida,
            ISNULL(CARTEIRA, '') AS carteira,
            LOCAL_VISITA AS local_visita,
            ISNULL(MOTIVO_VISITA, '') AS motivo_visita,
            ISNULL(STATUS_VISITA, 'AGENDADA') AS status_visita,
            RESUMO_VISITA AS resumo_visita,
            O_QUE_FOI_FEITO AS o_que_foi_feito,
            OBSERVACOES AS observacoes,
            NM_LOGIN_CRIACAO AS login_criacao,
            CRIADOR.NM_COLABORADOR AS nome_criacao,
            NM_LOGIN_ATUALIZACAO AS login_atualizacao,
            NM_LOGIN_EXCLUSAO AS login_exclusao,
            NM_LOGIN_ENVIO_ATA AS login_envio_ata,
            CONVERT(VARCHAR(19), DT_CRIACAO, 120) AS created_at,
            CONVERT(VARCHAR(19), DT_ATUALIZACAO, 120) AS updated_at,
            CONVERT(VARCHAR(19), DT_ENVIO_ATA, 120) AS data_envio_ata
        FROM {self.TABLE_NAME} AS A WITH (NOLOCK)
        OUTER APPLY (
            SELECT TOP 1 U.NM_COLABORADOR
            FROM TB_USUARIO_BCK AS U WITH (NOLOCK)
            WHERE U.NM_LOGIN = A.NM_LOGIN_CRIACAO
        ) AS CRIADOR
        WHERE FL_ATIVO = 1
        ORDER BY DIA DESC, HORARIO_ENTRADA DESC, ID_AGENDAMENTO DESC
        """
        items = self._fetch_all_dicts(query)
        self._attach_pendencias(items)
        self._attach_participantes(items)
        return items

    def listar_carteiras(self) -> list[dict[str, object]]:
        query = """
        SELECT DISTINCT
            ID_CEDENTE AS id_cedente,
            CARTEIRA AS nome_cedente
        FROM DB_REPORT.DM.TB_CARTEIRA WITH (NOLOCK)
        WHERE CARTEIRA IS NOT NULL
          AND LTRIM(RTRIM(CARTEIRA)) <> ''
        ORDER BY nome_cedente
        """
        return self._fetch_all_dicts(query, db=self.report_db)

    def buscar(self, agenda_id: int) -> dict[str, object] | None:
        query = f"""
        SELECT
            ID_AGENDAMENTO AS id,
            CONVERT(VARCHAR(10), DIA, 23) AS date,
            CONVERT(VARCHAR(8), HORARIO_ENTRADA, 108) AS horario_entrada,
            CONVERT(VARCHAR(8), HORARIO_SAIDA, 108) AS horario_saida,
            ISNULL(CARTEIRA, '') AS carteira,
            LOCAL_VISITA AS local_visita,
            ISNULL(MOTIVO_VISITA, '') AS motivo_visita,
            ISNULL(STATUS_VISITA, 'AGENDADA') AS status_visita,
            RESUMO_VISITA AS resumo_visita,
            O_QUE_FOI_FEITO AS o_que_foi_feito,
            OBSERVACOES AS observacoes,
            NM_LOGIN_CRIACAO AS login_criacao,
            CRIADOR.NM_COLABORADOR AS nome_criacao,
            NM_LOGIN_ATUALIZACAO AS login_atualizacao,
            NM_LOGIN_EXCLUSAO AS login_exclusao,
            NM_LOGIN_ENVIO_ATA AS login_envio_ata,
            CONVERT(VARCHAR(19), DT_CRIACAO, 120) AS created_at,
            CONVERT(VARCHAR(19), DT_ATUALIZACAO, 120) AS updated_at,
            CONVERT(VARCHAR(19), DT_ENVIO_ATA, 120) AS data_envio_ata
        FROM {self.TABLE_NAME} AS A WITH (NOLOCK)
        OUTER APPLY (
            SELECT TOP 1 U.NM_COLABORADOR
            FROM TB_USUARIO_BCK AS U WITH (NOLOCK)
            WHERE U.NM_LOGIN = A.NM_LOGIN_CRIACAO
        ) AS CRIADOR
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1
        """
        item = self._fetch_one_dict(query, [agenda_id])
        if item:
            self._attach_pendencias([item])
            self._attach_participantes([item])
        return item

    def criar(
        self,
        dia: str,
        horario_entrada: str,
        horario_saida: str,
        carteira: str,
        local_visita: str | None,
        motivo_visita: str,
        status_visita: str,
        resumo_visita: str | None,
        o_que_foi_feito: str | None,
        pendencias: list[dict[str, str | None]],
        participantes: list[dict[str, str | None]],
        observacoes: str | None,
        login_responsavel: str | None,
    ) -> int | None:
        query = f"""
        INSERT INTO {self.TABLE_NAME} (
            DIA,
            HORARIO_ENTRADA,
            HORARIO_SAIDA,
            CARTEIRA,
            LOCAL_VISITA,
            MOTIVO_VISITA,
            STATUS_VISITA,
            RESUMO_VISITA,
            O_QUE_FOI_FEITO,
            OBSERVACOES,
            NM_LOGIN_CRIACAO
        )
        OUTPUT INSERTED.ID_AGENDAMENTO
        VALUES (
            CONVERT(DATE, ?),
            CONVERT(TIME(0), ?),
            CONVERT(TIME(0), ?),
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
        )
        """
        row = self.db.fetch_one(
            query,
            [
                dia,
                horario_entrada,
                horario_saida,
                carteira,
                local_visita,
                motivo_visita,
                status_visita,
                resumo_visita,
                o_que_foi_feito,
                observacoes,
                login_responsavel,
            ],
        )
        agenda_id = int(row[0]) if row else None
        if agenda_id:
            self._insert_pendencias(agenda_id, pendencias)
            self._insert_participantes(agenda_id, participantes)
        return agenda_id

    def atualizar(
        self,
        agenda_id: int,
        dia: str,
        horario_entrada: str,
        horario_saida: str,
        carteira: str,
        local_visita: str | None,
        motivo_visita: str,
        status_visita: str,
        resumo_visita: str | None,
        o_que_foi_feito: str | None,
        pendencias: list[dict[str, str | None]],
        participantes: list[dict[str, str | None]],
        observacoes: str | None,
        login_responsavel: str | None,
    ) -> bool:
        query = f"""
        UPDATE {self.TABLE_NAME}
        SET
            DIA = CONVERT(DATE, ?),
            HORARIO_ENTRADA = CONVERT(TIME(0), ?),
            HORARIO_SAIDA = CONVERT(TIME(0), ?),
            CARTEIRA = ?,
            LOCAL_VISITA = ?,
            MOTIVO_VISITA = ?,
            STATUS_VISITA = ?,
            RESUMO_VISITA = ?,
            O_QUE_FOI_FEITO = ?,
            OBSERVACOES = ?,
            NM_LOGIN_ATUALIZACAO = ?,
            DT_ATUALIZACAO = SYSDATETIME()
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1
        """
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(
                cursor,
                query,
                [
                    dia,
                    horario_entrada,
                    horario_saida,
                    carteira,
                    local_visita,
                    motivo_visita,
                    status_visita,
                    resumo_visita,
                    o_que_foi_feito,
                    observacoes,
                    login_responsavel,
                    agenda_id,
                ],
            )
            updated = cursor.rowcount > 0
            if updated:
                self._replace_pendencias(cursor, agenda_id, pendencias)
                self._replace_participantes(cursor, agenda_id, participantes)
            connection.commit()
            return updated

    def excluir(self, agenda_id: int, login_responsavel: str | None) -> bool:
        query = f"""
        UPDATE {self.TABLE_NAME}
        SET
            FL_ATIVO = 0,
            STATUS_VISITA = 'APAGADA',
            NM_LOGIN_EXCLUSAO = ?,
            DT_EXCLUSAO = SYSDATETIME(),
            DT_ATUALIZACAO = SYSDATETIME()
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1
        """
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, query, [login_responsavel, agenda_id])
            deleted = cursor.rowcount > 0
            if deleted:
                self._deactivate_pendencias(cursor, agenda_id)
                self._deactivate_participantes(cursor, agenda_id)
            connection.commit()
            return deleted

    def registrar_envio_ata(self, agenda_id: int, login_responsavel: str | None) -> str | None:
        query = f"""
        UPDATE {self.TABLE_NAME}
        SET
            NM_LOGIN_ENVIO_ATA = ?,
            DT_ENVIO_ATA = SYSDATETIME()
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1
        """
        select_query = f"""
        SELECT CONVERT(VARCHAR(19), DT_ENVIO_ATA, 120)
        FROM {self.TABLE_NAME} WITH (NOLOCK)
        WHERE ID_AGENDAMENTO = ?
        """
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, query, [login_responsavel, agenda_id])
            updated = cursor.rowcount > 0
            connection.commit()
            if not updated:
                return None

            self.db._execute(cursor, select_query, [agenda_id])
            row = cursor.fetchone()
            return str(row[0]) if row and row[0] is not None else None

    def listar_pendencias_abertas_usuario(self, login_responsavel: str) -> list[dict[str, object]]:
        query = f"""
        SELECT
            P.ID_PENDENCIA AS id,
            P.ID_AGENDAMENTO AS agenda_id,
            CONVERT(VARCHAR(10), A.DIA, 23) AS date,
            CONVERT(VARCHAR(8), A.HORARIO_ENTRADA, 108) AS horario_entrada,
            CONVERT(VARCHAR(8), A.HORARIO_SAIDA, 108) AS horario_saida,
            ISNULL(A.CARTEIRA, '') AS carteira,
            ISNULL(A.MOTIVO_VISITA, '') AS motivo_visita,
            P.DESCRICAO AS descricao,
            P.RESPONSAVEL AS responsavel,
            P.OBSERVACAO AS observacao,
            ISNULL(P.STATUS_PENDENCIA, 'PENDENTE') AS status_pendencia,
            CONVERT(VARCHAR(19), P.DT_CRIACAO, 120) AS created_at
        FROM {self.PENDENCIAS_TABLE_NAME} AS P WITH (NOLOCK)
        INNER JOIN {self.TABLE_NAME} AS A WITH (NOLOCK)
            ON A.ID_AGENDAMENTO = P.ID_AGENDAMENTO
        WHERE P.FL_ATIVO = 1
          AND A.FL_ATIVO = 1
          AND ISNULL(P.STATUS_PENDENCIA, 'PENDENTE') = 'PENDENTE'
          AND UPPER(ISNULL(A.NM_LOGIN_CRIACAO, '')) = ?
        ORDER BY A.DIA ASC, A.HORARIO_ENTRADA ASC, P.ID_PENDENCIA ASC
        """
        return self._fetch_all_dicts(query, [login_responsavel])

    def resolver_pendencia(self, agenda_id: int, pendencia_id: int, login_responsavel: str | None) -> bool:
        query = f"""
        UPDATE P
        SET
            STATUS_PENDENCIA = 'RESOLVIDA',
            NM_LOGIN_RESOLUCAO = ?,
            DT_RESOLUCAO = SYSDATETIME(),
            DT_ATUALIZACAO = SYSDATETIME()
        FROM {self.PENDENCIAS_TABLE_NAME} AS P
        INNER JOIN {self.TABLE_NAME} AS A
            ON A.ID_AGENDAMENTO = P.ID_AGENDAMENTO
        WHERE P.ID_PENDENCIA = ?
          AND P.ID_AGENDAMENTO = ?
          AND P.FL_ATIVO = 1
          AND A.FL_ATIVO = 1
          AND ISNULL(P.STATUS_PENDENCIA, 'PENDENTE') = 'PENDENTE'
        """
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, query, [login_responsavel, pendencia_id, agenda_id])
            updated = cursor.rowcount > 0
            connection.commit()
            return updated

    def _attach_pendencias(self, items: list[dict[str, object]]) -> None:
        agenda_ids = [int(item.get("id") or 0) for item in items if item.get("id")]
        pendencias_por_agenda = self._listar_pendencias(agenda_ids)
        for item in items:
            agenda_id = int(item.get("id") or 0)
            item["pendencias"] = pendencias_por_agenda.get(agenda_id, [])

    def _attach_participantes(self, items: list[dict[str, object]]) -> None:
        agenda_ids = [int(item.get("id") or 0) for item in items if item.get("id")]
        participantes_por_agenda = self._listar_participantes(agenda_ids)
        for item in items:
            agenda_id = int(item.get("id") or 0)
            item["participantes"] = participantes_por_agenda.get(agenda_id, [])

    def _listar_pendencias(self, agenda_ids: list[int]) -> dict[int, list[dict[str, object]]]:
        ids = [agenda_id for agenda_id in agenda_ids if agenda_id]
        if not ids:
            return {}
        placeholders = ", ".join("?" for _ in ids)
        query = f"""
        SELECT
            ID_PENDENCIA AS id,
            ID_AGENDAMENTO AS agenda_id,
            DESCRICAO AS descricao,
            RESPONSAVEL AS responsavel,
            OBSERVACAO AS observacao,
            ISNULL(STATUS_PENDENCIA, 'PENDENTE') AS status_pendencia,
            NM_LOGIN_RESOLUCAO AS login_resolucao,
            CONVERT(VARCHAR(19), DT_RESOLUCAO, 120) AS data_resolucao
        FROM {self.PENDENCIAS_TABLE_NAME} WITH (NOLOCK)
        WHERE FL_ATIVO = 1
          AND ID_AGENDAMENTO IN ({placeholders})
        ORDER BY ID_PENDENCIA
        """
        rows = self._fetch_all_dicts(query, ids)
        result: dict[int, list[dict[str, object]]] = {}
        for row in rows:
            agenda_id = int(row.get("agenda_id") or 0)
            result.setdefault(agenda_id, []).append(
                {
                    "id": int(row.get("id") or 0),
                    "descricao": str(row.get("descricao") or ""),
                    "responsavel": str(row.get("responsavel") or "") or None,
                    "observacao": str(row.get("observacao") or "") or None,
                    "status_pendencia": str(row.get("status_pendencia") or "PENDENTE"),
                    "login_resolucao": str(row.get("login_resolucao") or "") or None,
                    "data_resolucao": str(row.get("data_resolucao") or "") or None,
                }
            )
        return result

    def _insert_pendencias(self, agenda_id: int, pendencias: list[dict[str, str | None]]) -> None:
        if not pendencias:
            return
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self._insert_pendencias_with_cursor(cursor, agenda_id, pendencias)
            connection.commit()

    def _replace_pendencias(
        self,
        cursor,
        agenda_id: int,
        pendencias: list[dict[str, str | None]],
    ) -> None:
        existing_ids = self._get_active_pendencia_ids(cursor, agenda_id)
        keep_ids: set[int] = set()

        for pendencia in pendencias:
            pendencia_id = int(pendencia.get("id") or 0)
            descricao = str(pendencia.get("descricao") or "").strip()
            if not descricao:
                continue
            if pendencia_id and pendencia_id in existing_ids:
                keep_ids.add(pendencia_id)
                self._update_pendencia_with_cursor(cursor, agenda_id, pendencia_id, pendencia)
                continue
            self._insert_pendencias_with_cursor(cursor, agenda_id, [pendencia])

        ids_to_deactivate = sorted(existing_ids - keep_ids)
        if ids_to_deactivate:
            self._deactivate_pendencias_by_ids(cursor, agenda_id, ids_to_deactivate)

    def _deactivate_pendencias(self, cursor, agenda_id: int) -> None:
        query = f"""
        UPDATE {self.PENDENCIAS_TABLE_NAME}
        SET FL_ATIVO = 0, DT_ATUALIZACAO = SYSDATETIME()
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1
        """
        self.db._execute(cursor, query, [agenda_id])

    def _deactivate_pendencias_by_ids(self, cursor, agenda_id: int, pendencia_ids: list[int]) -> None:
        if not pendencia_ids:
            return
        placeholders = ", ".join("?" for _ in pendencia_ids)
        query = f"""
        UPDATE {self.PENDENCIAS_TABLE_NAME}
        SET FL_ATIVO = 0, DT_ATUALIZACAO = SYSDATETIME()
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1 AND ID_PENDENCIA IN ({placeholders})
        """
        self.db._execute(cursor, query, [agenda_id, *pendencia_ids])

    def _get_active_pendencia_ids(self, cursor, agenda_id: int) -> set[int]:
        query = f"""
        SELECT ID_PENDENCIA
        FROM {self.PENDENCIAS_TABLE_NAME} WITH (NOLOCK)
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1
        """
        self.db._execute(cursor, query, [agenda_id])
        return {int(row[0]) for row in cursor.fetchall() if row and row[0] is not None}

    def _update_pendencia_with_cursor(
        self,
        cursor,
        agenda_id: int,
        pendencia_id: int,
        pendencia: dict[str, str | None],
    ) -> None:
        query = f"""
        UPDATE {self.PENDENCIAS_TABLE_NAME}
        SET
            DESCRICAO = ?,
            RESPONSAVEL = ?,
            OBSERVACAO = ?,
            DT_ATUALIZACAO = SYSDATETIME()
        WHERE ID_AGENDAMENTO = ? AND ID_PENDENCIA = ? AND FL_ATIVO = 1
        """
        self.db._execute(
            cursor,
            query,
            [
                pendencia.get("descricao"),
                pendencia.get("responsavel"),
                pendencia.get("observacao"),
                agenda_id,
                pendencia_id,
            ],
        )

    def _insert_pendencias_with_cursor(
        self,
        cursor,
        agenda_id: int,
        pendencias: list[dict[str, str | None]],
    ) -> None:
        query = f"""
        INSERT INTO {self.PENDENCIAS_TABLE_NAME} (
            ID_AGENDAMENTO,
            DESCRICAO,
            RESPONSAVEL,
            OBSERVACAO,
            STATUS_PENDENCIA
        )
        VALUES (?, ?, ?, ?, ?)
        """
        for pendencia in pendencias:
            descricao = str(pendencia.get("descricao") or "").strip()
            if not descricao:
                continue
            self.db._execute(
                cursor,
                query,
                [
                    agenda_id,
                    descricao,
                    pendencia.get("responsavel"),
                    pendencia.get("observacao"),
                    str(pendencia.get("status_pendencia") or "PENDENTE").upper(),
                ],
            )

    def _listar_participantes(self, agenda_ids: list[int]) -> dict[int, list[dict[str, object]]]:
        ids = [agenda_id for agenda_id in agenda_ids if agenda_id]
        if not ids:
            return {}
        placeholders = ", ".join("?" for _ in ids)
        query = f"""
        SELECT
            ID_PARTICIPANTE AS id,
            ID_AGENDAMENTO AS agenda_id,
            TIPO_PARTICIPANTE AS tipo,
            NOME AS nome,
            AREA_CARGO AS area_cargo,
            OBSERVACAO AS observacao
        FROM {self.PARTICIPANTES_TABLE_NAME} WITH (NOLOCK)
        WHERE FL_ATIVO = 1
          AND ID_AGENDAMENTO IN ({placeholders})
        ORDER BY TIPO_PARTICIPANTE, ID_PARTICIPANTE
        """
        rows = self._fetch_all_dicts(query, ids)
        result: dict[int, list[dict[str, object]]] = {}
        for row in rows:
            agenda_id = int(row.get("agenda_id") or 0)
            result.setdefault(agenda_id, []).append(
                {
                    "id": int(row.get("id") or 0),
                    "tipo": str(row.get("tipo") or ""),
                    "nome": str(row.get("nome") or ""),
                    "area_cargo": str(row.get("area_cargo") or "") or None,
                    "observacao": str(row.get("observacao") or "") or None,
                }
            )
        return result

    def _insert_participantes(self, agenda_id: int, participantes: list[dict[str, str | None]]) -> None:
        if not participantes:
            return
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self._insert_participantes_with_cursor(cursor, agenda_id, participantes)
            connection.commit()

    def _replace_participantes(
        self,
        cursor,
        agenda_id: int,
        participantes: list[dict[str, str | None]],
    ) -> None:
        self._deactivate_participantes(cursor, agenda_id)
        self._insert_participantes_with_cursor(cursor, agenda_id, participantes)

    def _deactivate_participantes(self, cursor, agenda_id: int) -> None:
        query = f"""
        UPDATE {self.PARTICIPANTES_TABLE_NAME}
        SET FL_ATIVO = 0, DT_ATUALIZACAO = SYSDATETIME()
        WHERE ID_AGENDAMENTO = ? AND FL_ATIVO = 1
        """
        self.db._execute(cursor, query, [agenda_id])

    def _insert_participantes_with_cursor(
        self,
        cursor,
        agenda_id: int,
        participantes: list[dict[str, str | None]],
    ) -> None:
        query = f"""
        INSERT INTO {self.PARTICIPANTES_TABLE_NAME} (
            ID_AGENDAMENTO,
            TIPO_PARTICIPANTE,
            NOME,
            AREA_CARGO,
            OBSERVACAO
        )
        VALUES (?, ?, ?, ?, ?)
        """
        for participante in participantes:
            nome = str(participante.get("nome") or "").strip()
            tipo = str(participante.get("tipo") or "").strip().upper()
            if not nome or tipo not in {"INTERNO", "EXTERNO"}:
                continue
            self.db._execute(
                cursor,
                query,
                [
                    agenda_id,
                    tipo,
                    nome,
                    participante.get("area_cargo"),
                    participante.get("observacao"),
                ],
            )

    def _fetch_all_dicts(
        self,
        query: str,
        params: list[object] | None = None,
        db=None,
    ) -> list[dict[str, object]]:
        database = db or self.db
        with database._connect() as connection:
            cursor = connection.cursor()
            database._execute(cursor, query, params)
            columns = [column[0] for column in cursor.description]
            return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]

    def _fetch_one_dict(self, query: str, params: list[object] | None = None) -> dict[str, object] | None:
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, query, params)
            row = cursor.fetchone()
            if not row:
                return None
            columns = [column[0] for column in cursor.description]
            return dict(zip(columns, row, strict=True))
