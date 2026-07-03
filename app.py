import os
import uuid
import webbrowser
from threading import Timer
from datetime import datetime
from flask import Flask, request, jsonify, make_response, render_template
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

from agent import ScriptAgent

app = Flask(__name__, template_folder="templates", static_folder="static")
agent = None

def inicializar_agente():
    global agent
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key in ["sua_chave_aqui", "seu_token_aqui", ""]:
        print("\n" + "!"*60)
        print("⚠️ AVISO: GEMINI_API_KEY não configurada no seu arquivo .env!")
        print("Por favor, adicione sua chave de API para o roteirista funcionar.")
        print("!"*60 + "\n")
    agent = ScriptAgent()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/generate", methods=["POST"])
def generate():
    if not agent:
        return jsonify({"error": "Agente não inicializado"}), 500
        
    try:
        briefing = request.json
        if not briefing:
            return jsonify({"error": "Dados do briefing ausentes"}), 400
            
        session_id = str(uuid.uuid4())
        script = agent.criar_sessao_chat(session_id, briefing)
        
        # Salva localmente na pasta 'roteiros_gerados' por segurança
        salvar_roteiro_local(script, briefing)
        
        return jsonify({
            "session_id": session_id,
            "script": script
        })
    except Exception as e:
        print(f"Erro na geração do roteiro: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    if not agent:
        return jsonify({"error": "Agente não inicializado"}), 500
        
    try:
        data = request.json
        session_id = data.get("session_id")
        message = data.get("message")
        
        if not session_id or not message:
            return jsonify({"error": "Parâmetros session_id ou message ausentes"}), 400
            
        script = agent.enviar_mensagem_chat(session_id, message)
        return jsonify({"script": script})
    except Exception as e:
        print(f"Erro no chat de refinação: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/download", methods=["POST"])
def download():
    try:
        data = request.json
        script = data.get("script", "")
        tipo = data.get("tipo", "roteiro")
        
        response = make_response(script)
        response.headers["Content-Disposition"] = f"attachment; filename=roteiro_{tipo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        response.headers["Content-type"] = "text/markdown; charset=utf-8"
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def salvar_roteiro_local(roteiro, briefing):
    """Salva uma cópia de backup do roteiro na pasta do projeto."""
    try:
        diretorio_saida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roteiros_gerados")
        os.makedirs(diretorio_saida, exist_ok=True)
        
        tipo_sanitizado = briefing.get("tipo", "roteiro").replace(" ", "_").lower()
        data_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        nome_arquivo = f"roteiro_{tipo_sanitizado}_{data_str}.md"
        caminho_arquivo = os.path.join(diretorio_saida, nome_arquivo)
        
        conteudo_completo = f"""# Roteiro Gerado: {briefing.get('tipo', 'roteiro').capitalize()}
Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
Plataforma: {briefing.get('plataforma')}
Tom de Voz: {briefing.get('tom')}

---

{roteiro}
"""
        with open(caminho_arquivo, "w", encoding="utf-8") as f:
            f.write(conteudo_completo)
        print(f"💾 Cópia de backup salva em: {caminho_arquivo}")
    except Exception as e:
        print(f"Aviso: Não foi possível salvar cópia local do roteiro: {e}")

def open_browser(port):
    webbrowser.open_new(f"http://127.0.0.1:{port}")

if __name__ == "__main__":
    inicializar_agente()
    
    port = int(os.environ.get("PORT", 5001))
    
    # Abrir navegador automaticamente após 1.5s apenas se rodando localmente (sem a variável PORT)
    if "PORT" not in os.environ:
        Timer(1.5, lambda: open_browser(port)).start()
        
        print("\n" + "="*60)
        print("🚀 Iniciando Servidor Web do Gravy Scriptwriter...")
        print("Se o seu navegador não abrir automaticamente, acesse:")
        print(f"👉 http://127.0.0.1:{port}")
        print("="*60 + "\n")
    else:
        print(f"🚀 Iniciando em modo Produção (Nuvem) na porta {port}...")
    
    # Na nuvem (Render), precisamos escutar em '0.0.0.0' para aceitar conexões externas
    host = "0.0.0.0" if "PORT" in os.environ else "127.0.0.1"
    app.run(host=host, port=port, debug=False)
