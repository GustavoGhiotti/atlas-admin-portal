from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator


TURNOS = {"MANHÃ", "TARDE", "INTEGRAL"}
STATUS_DIA = {"PREVISTO", "PRESENTE", "FALTOU", "DESISTIU"}
TIPOS_TREINAMENTO = {"INICIAL", "REMANEJAMENTO", "CALIBRAGEM"}
CARGOS_ADMISSAO = {
    "APRENDIZ OMNICHANNEL", "APRENDIZ OPERADOR(A) COBRADOR", "BACK OFFICE 1 - 6 HRS",
    "BACK OFFICE 2", "CONCIERGE", "ESTAGIARIO", "ESTAGIÁRIO", "NEGOCIADOR",
    "NEGOCIADOR |", "OMNICHANNEL", "OPERADOR(A) COBRADOR(A)",
    "SUPERVISOR(A) DE OPERACOES", "SUPERVISOR(A) DE OPERACOES I",
}


STATUS_REAIS = {"PRESENTE", "FALTOU", "DESISTIU"}


class AdmissaoPayload(BaseModel):
    agenda_id: int | None = Field(default=None, gt=0)
    agenda_dia2_id: int | None = Field(default=None, gt=0)
    colaborador: str = Field(min_length=2, max_length=180)
    cpf: str = Field(min_length=11, max_length=14)
    admissao: date | None = None
    turno: str | None = None
    registro_cargo: str | None = Field(default=None, max_length=120)
    carteira: str | None = Field(default=None, max_length=100)
    status_primeiro_dia: str = "PREVISTO"
    status_segundo_dia: str = "PREVISTO"
    observacoes: str | None = Field(default=None, max_length=1000)

    @field_validator("turno")
    @classmethod
    def validar_turno(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        value = value.strip().upper().replace("MANHA", "MANHÃ")
        if value not in TURNOS:
            raise ValueError("Turno inválido.")
        return value

    @field_validator("status_primeiro_dia", "status_segundo_dia")
    @classmethod
    def validar_status(cls, value: str | None) -> str:
        if value is None or not str(value).strip():
            return "PREVISTO"
        value = value.strip().upper()
        if value not in STATUS_DIA:
            raise ValueError("Status inválido.")
        return value

    @field_validator("agenda_id", "agenda_dia2_id", mode="before")
    @classmethod
    def normalizar_agenda_opcional(cls, value):
        if value is None:
            return None
        texto = str(value).strip()
        return None if texto in ("", "0") else value

    @field_validator("admissao", mode="before")
    @classmethod
    def validar_admissao_opcional(cls, value):
        return None if value is None or not str(value).strip() else value

    @model_validator(mode="after")
    def validar_agenda_obrigatoria(self):
        marca_presenca = self.status_primeiro_dia in STATUS_REAIS or self.status_segundo_dia in STATUS_REAIS
        if marca_presenca and not self.agenda_id:
            raise ValueError("Vincule uma agenda para registrar presença, falta ou desistência.")
        return self

    @field_validator("registro_cargo", "carteira", "observacoes", mode="before")
    @classmethod
    def limpar_texto_opcional(cls, value):
        return None if value is None or not str(value).strip() else str(value).strip()

    @field_validator("registro_cargo")
    @classmethod
    def validar_registro_cargo(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if value not in CARGOS_ADMISSAO:
            raise ValueError("Registro/cargo inválido. Selecione uma opção da lista.")
        return value


class TreinamentoPayload(BaseModel):
    agenda_id: int = Field(gt=0)
    colaborador: str = Field(min_length=2, max_length=180)
    produto_carteira: str = Field(min_length=2, max_length=1000)
    data_treinamento: date
    tipo_treinamento: str
    responsavel: str = Field(min_length=2, max_length=1000)

    @field_validator("tipo_treinamento")
    @classmethod
    def validar_tipo(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in TIPOS_TREINAMENTO:
            raise ValueError("Tipo de treinamento inválido.")
        return value


class AgendaTreinamentoPayload(BaseModel):
    titulo: str = Field(min_length=2, max_length=180)
    data_treinamento: date
    horario_inicio: str = Field(pattern=r"^\d{2}:\d{2}$")
    horario_fim: str = Field(pattern=r"^\d{2}:\d{2}$")
    produto_carteira: str = Field(min_length=2, max_length=1000)
    tipo_treinamento: str
    responsavel: str = Field(min_length=2, max_length=1000)
    participantes: str | None = Field(default=None, max_length=2000)
    observacoes: str | None = Field(default=None, max_length=2000)
    status_agenda: str = "AGENDADO"
    dia_encontro: int = Field(default=1, ge=1, le=2)
    agenda_vinculada_id: int | None = Field(default=None, gt=0)
    criar_dia_2: bool = False
    data_dia_2: date | None = None
    horario_inicio_dia_2: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    horario_fim_dia_2: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")

    @field_validator("tipo_treinamento")
    @classmethod
    def validar_tipo_agenda(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in TIPOS_TREINAMENTO:
            raise ValueError("Tipo de treinamento inválido.")
        return value

    @field_validator("status_agenda")
    @classmethod
    def validar_status_agenda(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in {"AGENDADO", "REALIZADO", "CANCELADO"}:
            raise ValueError("Status da agenda inválido.")
        return value
