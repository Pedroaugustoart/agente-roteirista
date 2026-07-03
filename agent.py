import os
from google.genai import types
from config import get_gemini_client, get_model_name

class ScriptAgent:
    def __init__(self):
        self.client = get_gemini_client()
        self.model = get_model_name()
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.prompts_dir = os.path.join(self.base_dir, "prompts")
        # Dicionário em memória para guardar sessões de chat ativas
        self.active_chats = {}

    def _ler_arquivo(self, caminho):
        """Auxiliar para ler arquivos de texto."""
        try:
            with open(caminho, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"Erro: O arquivo '{caminho}' não foi encontrado.")
        except Exception as e:
            raise RuntimeError(f"Erro ao ler o arquivo '{caminho}': {e}")

    def carregar_system_prompt(self):
        caminho_sys = os.path.join(self.prompts_dir, "system_prompt.txt")
        return self._ler_arquivo(caminho_sys)

    def carregar_template(self, tipo):
        caminho_template = os.path.join(self.prompts_dir, "templates", f"{tipo}.txt")
        return self._ler_arquivo(caminho_template)

    def formatar_briefing(self, briefing):
        """Converte o dicionário de respostas em um texto estruturado."""
        return f"""
DADOS DO BRIEFING COLETADOS:
- Plataforma/Canal: {briefing.get('plataforma')}
- Tipo de Vídeo: {briefing.get('tipo', '').upper()}
- Objetivo: {briefing.get('objetivo')}
- Público-Alvo: {briefing.get('publico')}
- Mensagem Principal / Dor: {briefing.get('mensagem_dor')}
- Tom de Voz: {briefing.get('tom')}
- Referências Culturais/Pop: {briefing.get('referencias')}
- Duração Estimada: {briefing.get('duracao')}
- Chamada para Ação (CTA): {briefing.get('cta')}
"""

    def criar_sessao_chat(self, session_id, briefing):
        """
        Cria um chat persistente na API do Gemini para a sessão do usuário.
        Envia o primeiro prompt de briefing e retorna o roteiro inicial.
        """
        system_instruction = self.carregar_system_prompt()
        template = self.carregar_template(briefing["tipo"])
        briefing_formatado = self.formatar_briefing(briefing)

        prompt_usuario = f"""
Por favor, gere um roteiro com base no briefing do usuário e no template fornecido abaixo.

{briefing_formatado}

---
TEMPLATE DE ESTRUTURA PARA ESTE TIPO DE VÍDEO:
{template}
---

Gere agora o roteiro em português na tabela Markdown com as duas colunas solicitadas (Visual & Edição | Áudio & Locução). 
Lembre-se de adicionar a seção de "SEO e Metadados do Vídeo" no final.
"""

        print(f"🧠 Inicializando chat persistente para a sessão {session_id} com modelo {self.model}...")
        
        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.75,
                max_output_tokens=8192
            )
            
            # Criando chat persistente no SDK google-genai
            chat = self.client.chats.create(
                model=self.model,
                config=config
            )
            
            # Salva o objeto do chat na memória da aplicação
            self.active_chats[session_id] = chat
            
            # Envia a primeira mensagem com o briefing
            response = chat.send_message(prompt_usuario)
            return response.text
            
        except Exception as e:
            raise RuntimeError(f"Erro ao inicializar sessão do Gemini: {e}")

    def enviar_mensagem_chat(self, session_id, mensagem):
        """
        Envia uma mensagem de texto de refinação em uma sessão de chat existente.
        """
        if session_id not in self.active_chats:
            raise ValueError(f"Sessão de chat {session_id} não encontrada ou expirada. Por favor, reinicie.")
            
        chat = self.active_chats[session_id]
        
        print(f"💬 Enviando mensagem de refinação na sessão {session_id}...")
        try:
            # Envia a mensagem no chat contínuo
            response = chat.send_message(mensagem)
            return response.text
        except Exception as e:
            raise RuntimeError(f"Erro ao enviar mensagem ao Gemini: {e}")
