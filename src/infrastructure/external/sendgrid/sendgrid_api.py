from src.infrastructure.services.env_load import get_env
from sendgrid import SendGridAPIClient
from src.shared.exception import AtlasException

class SendGrid:
    def __init__(self) -> None:
        self.sendgrid = SendGridAPIClient(get_env("SENDGRID_API_KEY"))
    
    def suppresion(self, email:list[str]):
        data = {"recipient_emails": email}

        response = self.sendgrid.client.asm.suppressions._("global").post(request_body=data)

        if response.status_code == 201: 
            return "E-mails adicionado a lista de bloqueio" 
        else: 
            raise AtlasException(message="Houve um erro ao processar a solicitação do bloqueio")   