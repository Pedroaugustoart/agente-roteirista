import os
from dotenv import load_dotenv
from google import genai
from google.genai import errors

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações globais
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

def get_gemini_client():
    """
    Inicializa e retorna o cliente oficial do Google GenAI.
    """
    if not GEMINI_API_KEY:
        # Se não houver chave no .env, tenta pegar do ambiente diretamente
        # Se ainda assim não houver, levanta um aviso ou erro apropriado
        pass
    
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
