import os
from google.genai import types
from config import get_gemini_client, get_model_name
import db

class ScriptAgent:
    def __init__(self):
        self.client = get_gemini_client()
        self.model = get_model_name()
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.prompts_dir = os.path.join(self.base_dir, "prompts")
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
        nome_arquivo = tipo
        if tipo == "analise":
            nome_arquivo = "review"
            
        caminho_template = os.path.join(self.prompts_dir, "templates", f"{nome_arquivo}.txt")
        if os.path.exists(caminho_template):
            return self._ler_arquivo(caminho_template)
        return "Nenhum template estrutural definido para esta categoria."

    def carregar_conhecimento_categoria(self, categoria):
        """
        Lê todos os arquivos de texto (.txt, .md) e PDF (.pdf) localizados
        na pasta prompts/conhecimento/{categoria}/ e concatena o texto.
        """
        cat_folder = categoria.strip().lower()
        pasta = os.path.join(self.prompts_dir, "conhecimento", cat_folder)
        
        if not os.path.exists(pasta):
            return "Nenhuma base de conhecimento adicional disponível para esta categoria."
            
        textos = []
        try:
            for nome_arquivo in os.listdir(pasta):
                caminho_completo = os.path.join(pasta, nome_arquivo)
                if not os.path.isfile(caminho_completo):
                    continue
                    
                if nome_arquivo.endswith(('.txt', '.md')):
                    with open(caminho_completo, "r", encoding="utf-8") as f:
                        textos.append(f"--- Diretriz Global ({nome_arquivo}) ---\n" + f.read())
                        
                elif nome_arquivo.endswith('.pdf'):
                    from pypdf import PdfReader
                    try:
                        reader = PdfReader(caminho_completo)
                        conteudo_pdf = []
                        for page in reader.pages:
                            texto_pag = page.extract_text()
                            if texto_pag:
                                conteudo_pdf.append(texto_pag)
                        textos.append(f"--- Diretriz Global ({nome_arquivo}) ---\n" + "\n".join(conteudo_pdf))
                    except Exception as e:
                        print(f"Aviso: Erro ao ler PDF {nome_arquivo}: {e}")
                        
            if not textos:
                return "Nenhum documento de diretriz global nesta categoria."
                
            return "\n\n".join(textos)
        except Exception as e:
            return f"Erro ao carregar base de conhecimento global: {e}"

    def formatar_briefing(self, briefing):
        """Converte o dicionário de respostas em um texto estruturado."""
        return f"""
DADOS DO BRIEFING COLETADOS:
- Plataforma/Canal: {briefing.get('plataforma')}
- Categoria / Foco Principal: {briefing.get('tipo', '').upper()}
- Objetivo Principal: {briefing.get('objetivo')}
- Problema que o Vídeo Resolve: {briefing.get('mensagem_dor')}
- Público-Alvo e Tom de Voz: {briefing.get('publico')}
- Referências Culturais/Pop / Inspirações: {briefing.get('referencias')}
- Duração Estimada: {briefing.get('duracao')}
- Chamada para Ação (CTA): {briefing.get('cta')}
"""

    def criar_sessao_chat(self, session_id, briefing, usuario_id=None):
        """
        Cria um chat persistente na API do Gemini para a sessão do usuário.
        Envia o briefing com a base de conhecimento exclusiva global + exclusiva da conta do usuário.
        """
        system_instruction = self.carregar_system_prompt()
        template = self.carregar_template(briefing["tipo"])
        
        # Conhecimento Global do Sistema
        conhecimento_global = self.carregar_conhecimento_categoria(briefing["tipo"])
        
        # Conhecimento Exclusivo do Usuário (RAG do Banco de Dados)
        conhecimento_usuario = ""
        if usuario_id:
            conhecimento_usuario = db.obter_conteudo_conhecimento_usuario(usuario_id, briefing["tipo"])
            
        conhecimento_completo = conhecimento_global
        if conhecimento_usuario:
            conhecimento_completo += "\n\n=== CONHECIMENTO ADICIONAL EXCLUSIVO DO USUÁRIO ===\n" + conhecimento_usuario

        briefing_formatado = self.formatar_briefing(briefing)

        prompt_usuario = f"""
Por favor, gere um roteiro com base no briefing do usuário, no template estrutural e nas diretrizes de conhecimento exclusivas fornecidas abaixo.

{briefing_formatado}

---
TEMPLATE DE ESTRUTURA PARA ESTE TIPO DE VÍDEO:
{template}
---

---
BASE DE CONHECIMENTO EXCLUSIVA DE TREINAMENTO (Siga estritamente estas regras e diretrizes ao escrever as falas e edição):
{conhecimento_completo}
---

Gere agora o roteiro em português na tabela Markdown com as duas colunas solicitadas (Visual & Edição | Áudio & Locução). Dê destaque máximo para as falas do apresentador na coluna de Áudio & Locução.
Lembre-se de adicionar a seção de "SEO e Metadados do Vídeo" no final.
"""

        print(f"🧠 Inicializando chat persistente para a sessão {session_id} com modelo {self.model}...")
        
        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=8192
            )
            
            chat = self.client.chats.create(
                model=self.model,
                config=config
            )
            
            self.active_chats[session_id] = chat
            response = chat.send_message(prompt_usuario)
            return response.text
            
        except Exception as e:
            raise RuntimeError(f"Erro ao inicializar sessão do Gemini: {e}")

    def enviar_mensagem_chat(self, session_id, message):
        """Envia uma mensagem de texto de refinação em uma sessão de chat existente."""
        if session_id not in self.active_chats:
            raise ValueError(f"Sessão de chat {session_id} não encontrada ou expirada.")
            
        chat = self.active_chats[session_id]
        
        print(f"💬 Enviando mensagem de refinação na sessão {session_id}...")
        try:
            response = chat.send_message(message)
            return response.text
        except Exception as e:
            raise RuntimeError(f"Erro ao enviar mensagem ao Gemini: {e}")

    def enviar_mensagem_refinacao_historico(self, session_id, briefing, roteiro_anterior, mensagem, usuario_id=None):
        """Inicializa o chat a partir de um roteiro histórico antigo e aplica o ajuste, injetando RAG isolado."""
        system_instruction = self.carregar_system_prompt()
        template = self.carregar_template(briefing["tipo"])
        
        # Conhecimento Global
        conhecimento_global = self.carregar_conhecimento_categoria(briefing["tipo"])
        
        # Conhecimento Isolado do Usuário
        conhecimento_usuario = ""
        if usuario_id:
            conhecimento_usuario = db.obter_conteudo_conhecimento_usuario(usuario_id, briefing["tipo"])
            
        conhecimento_completo = conhecimento_global
        if conhecimento_usuario:
            conhecimento_completo += "\n\n=== CONHECIMENTO ADICIONAL EXCLUSIVO DO USUÁRIO ===\n" + conhecimento_usuario
            
        briefing_formatado = self.formatar_briefing(briefing)
        
        print(f"🧠 Restaurando chat para o roteiro do histórico na sessão {session_id}...")
        
        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=8192
            )
            
            chat = self.client.chats.create(
                model=self.model,
                config=config
            )
            self.active_chats[session_id] = chat
            
            prompt_contexto = f"""
Você está editando um roteiro gerado anteriormente.
{briefing_formatado}

---
BASE DE CONHECIMENTO EXCLUSIVA:
{conhecimento_completo}
---

Aqui está o roteiro atual:
{roteiro_anterior}

Por favor, faça o seguinte ajuste solicitado pelo usuário no roteiro acima e retorne o roteiro completo atualizado na tabela Markdown:
"{mensagem}"
"""
            response = chat.send_message(prompt_contexto)
            return response.text
        except Exception as e:
            raise RuntimeError(f"Erro ao refinar roteiro antigo: {e}")
