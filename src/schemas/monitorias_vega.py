from pydantic import BaseModel, Field, field_validator


class MonitoriaVegaPayload(BaseModel):
    ano: int = Field(ge=2000, le=2100)
    mes: int = Field(ge=1, le=12)
    semana: int = Field(ge=1, le=5)
    total: int = Field(default=0, ge=0)
    conforme: int = Field(default=0, ge=0)
    inconforme: int = Field(default=0, ge=0)

    @field_validator("total", "conforme", "inconforme", mode="before")
    @classmethod
    def normalizar_inteiro(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return 0
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            raise ValueError("Informe um número inteiro válido.")

    @field_validator("ano", "mes", "semana", mode="before")
    @classmethod
    def normalizar_indice(cls, value):
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            raise ValueError("Valor inválido.")
