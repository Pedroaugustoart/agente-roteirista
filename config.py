import os
from dotenv import load_dotenv
from google import genai
from google.genai import errors

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações globais
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

def get_gemini_client():
    """
    Inicializa e retorna o cliente oficial do Google GenAI.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY in ["sua_chave_aqui", "seu_token_aqui", ""]:
        # Se estiver em produção e não houver chave, falha imediatamente (Fail Fast)
        if "PORT" in os.environ:
            raise RuntimeError("⚠️ ERRO CRÍTICO (FAIL-FAST): GEMINI_API_KEY não configurada no ambiente de produção!")
        # Localmente apenas lança o erro na hora de usar
    
    try:
        # O cliente automaticamente busca a variável de ambiente GEMINI_API_KEY se não passarmos api_key.
        # Mas passamos explicitamente para garantir robustez.
        if GEMINI_API_KEY:
            client = genai.Client(api_key=GEMINI_API_KEY)
        else:
            client = genai.Client()
        return client
    except Exception as e:
        raise RuntimeError(
            f"Erro ao inicializar o cliente Gemini: {e}\n"
            "Certifique-se de configurar a variável GEMINI_API_KEY no arquivo .env ou no seu ambiente."
        )

def get_model_name():
    return GEMINI_MODEL
