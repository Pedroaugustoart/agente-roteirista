import os
import uuid
import webbrowser
from threading import Timer
from datetime import datetime
from flask import Flask, request, jsonify, make_response, render_template, session
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Carregar variáveis de ambiente
load_dotenv()

from agent import ScriptAgent
import db

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "roit_secret_key_default_123_456")
agent = None

def inicializar_agente():
    global agent
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key in ["sua_chave_aqui", "seu_token_aqui", ""]:
        print("\n" + "!"*60)
        print("⚠️ AVISO: GEMINI_API_KEY não configurada no seu arquivo .env!")
        print("Por favor, adicione sua chave de API para o roteirista Roit funcionar.")
        print("!"*60 + "\n")
    agent = ScriptAgent()
    # Inicializa as tabelas do banco de dados SQLite/PostgreSQL
    db.init_db()

@app.route("/")
def index():
    # Injeta a chave do Google Client ID dinamicamente no HTML
    return render_template("index.html", google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""))

# --- ROTAS DE AUTENTICAÇÃO ---

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"error": "Usuário e senha são obrigatórios"}), 400
        
    success = db.registrar_usuario(username, password)
    if success:
        return jsonify({"message": "Usuário cadastrado com sucesso!"})
    else:
        return jsonify({"error": "Nome de usuário já está em uso"}), 409

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"error": "Usuário e senha são obrigatórios"}), 400
        
    user = db.verificar_usuario(username, password)
    if user:
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        return jsonify({
            "message": "Login realizado com sucesso!",
            "user": user
        })
    else:
        return jsonify({"error": "Usuário ou senha inválidos"}), 401

@app.route("/api/login/google", methods=["POST"])
def google_login():
    data = request.json
    token = data.get("credential")
    
    if not token:
        return jsonify({"error": "Token do Google ausente"}), 400
        
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        return jsonify({"error": "GOOGLE_CLIENT_ID não está configurado no servidor."}), 500
        
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        
        email = idinfo.get("email")
        if not email:
            return jsonify({"error": "E-mail não retornado pela conta Google"}), 400
            
        username = email.split("@")[0]
        user_id = db.obter_ou_criar_usuario_google(email, username)
        
        session["user_id"] = user_id
        session["username"] = username
        
        return jsonify({
            "message": "Login com Google realizado com sucesso!",
            "user": {
                "id": user_id,
                "username": username
            }
        })
    except ValueError as e:
        print(f"Erro na validação do token Google: {e}")
        return jsonify({"error": "Token de autenticação do Google inválido ou expirado."}), 401
    except Exception as e:
        print(f"Erro crítico no login Google: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logout realizado com sucesso!"})

@app.route("/api/session", methods=["GET"])
def get_session():
    if "user_id" in session:
        return jsonify({
            "logged_in": True,
            "user": {
                "id": session["user_id"],
                "username": session["username"]
            }
        })
    return jsonify({"logged_in": False})

# --- ROTAS DE GERAÇÃO E HISTÓRICO ---

@app.route("/api/generate", methods=["POST"])
def generate():
    if "user_id" not in session:
        return jsonify({"error": "Não autorizado. Por favor, faça login."}), 401
        
    if not agent:
        return jsonify({"error": "Agente não inicializado"}), 500
        
    try:
        briefing = request.json
        if not briefing:
            return jsonify({"error": "Dados do briefing ausentes"}), 400
            
        usuario_id = session["user_id"]
        session_id = str(uuid.uuid4())
        
        # Gera o roteiro pelo Gemini passando o usuario_id para o RAG isolado
        script = agent.criar_sessao_chat(session_id, briefing, usuario_id=usuario_id)
        
        objetivo = briefing.get("objetivo", "")
        titulo = (objetivo[:30] + "...") if len(objetivo) > 30 else (objetivo or f"Roteiro {briefing.get('tipo', '').capitalize()}")
        
        roteiro_id = db.salvar_roteiro(
            usuario_id=usuario_id,
            titulo=titulo,
            plataforma=briefing.get("plataforma"),
            categoria=briefing.get("tipo"),
            conteudo=script,
            briefing_json=briefing
        )
        
        salvar_roteiro_local(script, briefing)
        
        return jsonify({
            "session_id": session_id,
            "roteiro_id": roteiro_id,
            "script": script
        })
    except Exception as e:
        print(f"Erro na geração do roteiro: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    if "user_id" not in session:
        return jsonify({"error": "Não autorizado. Por favor, faça login."}), 401
        
    if not agent:
        return jsonify({"error": "Agente não inicializado"}), 500
        
    try:
        data = request.json
        session_id = data.get("session_id")
        message = data.get("message")
        roteiro_id = data.get("roteiro_id")
        
        if not session_id or not message:
            return jsonify({"error": "Parâmetros session_id ou message ausentes"}), 400
            
        usuario_id = session["user_id"]
        
        if session_id in agent.active_chats:
            script = agent.enviar_mensagem_chat(session_id, message)
        else:
            if not roteiro_id:
                return jsonify({"error": "ID do roteiro ausente para restauração da sessão"}), 400
                
            roteiro_db = db.obter_roteiro(roteiro_id, usuario_id)
            if not roteiro_db:
                return jsonify({"error": "Roteiro não encontrado no histórico"}), 404
                
            script = agent.enviar_mensagem_refinacao_historico(
                session_id=session_id,
                briefing=roteiro_db["briefing"],
                roteiro_anterior=roteiro_db["conteudo"],
                mensagem=message,
                usuario_id=usuario_id
            )
            
        if roteiro_id:
            roteiro_db = db.obter_roteiro(roteiro_id, usuario_id)
            if roteiro_db:
                db.salvar_roteiro(
                    usuario_id=usuario_id,
                    titulo=roteiro_db["titulo"],
                    plataforma=roteiro_db["plataforma"],
                    categoria=roteiro_db["categoria"],
                    conteudo=script,
                    briefing_json=roteiro_db["briefing"],
                    roteiro_id=roteiro_id
                )
        
        return jsonify({"script": script})
    except Exception as e:
        print(f"Erro no chat de refinação: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
def list_history():
    if "user_id" not in session:
        return jsonify({"error": "Não autorizado"}), 401
    roteiros = db.listar_roteiros(session["user_id"])
    return jsonify({"roteiros": roteiros})

@app.route("/api/history/<roteiro_id>", methods=["GET"])
def get_history_item(roteiro_id):
    if "user_id" not in session:
        return jsonify({"error": "Não autorizado"}), 401
    roteiro = db.obter_roteiro(roteiro_id, session["user_id"])
    if not roteiro:
        return jsonify({"error": "Roteiro não encontrado"}), 404
    return jsonify({"roteiro": roteiro})

# --- ROTAS DE GESTÃO DE CONHECIMENTOS (UPLOAD/LISTA/DELETAR) ---

@app.route("/api/conhecimento/upload", methods=["POST"])
def upload_conhecimento():
    if "user_id" not in session:
        return jsonify({"error": "Não autorizado"}), 401
        
    categoria = request.form.get("categoria")
    if not categoria or categoria not in ["storytelling", "viral", "analise", "educativo"]:
        return jsonify({"error": "Categoria inválida ou ausente"}), 400
        
    if 'file' not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Nome do arquivo vazio"}), 400
        
    usuario_id = session["user_id"]
    nome_arquivo = file.filename
    ext = os.path.splitext(nome_arquivo)[1].lower()
    
    conteudo_texto = ""
    
    try:
        if ext == '.pdf':
            from pypdf import PdfReader
            reader = PdfReader(file)
            paginas_texto = []
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    paginas_texto.append(txt)
            conteudo_texto = "\n".join(paginas_texto)
            if not conteudo_texto.strip():
                return jsonify({"error": "Não foi possível extrair texto legível deste PDF."}), 400
        elif ext in ['.txt', '.md']:
            conteudo_texto = file.read().decode('utf-8', errors='ignore')
        else:
            return jsonify({"error": "Formato de arquivo não suportado. Apenas PDF, TXT ou MD."}), 400
            
        conhecimento_id = db.salvar_conhecimento_usuario(
            usuario_id=usuario_id,
            nome_arquivo=nome_arquivo,
            categoria=categoria,
            conteudo_texto=conteudo_texto
        )
        
        if conhecimento_id:
            return jsonify({
                "message": "Treinamento integrado com sucesso!",
                "documento": {
                    "id": conhecimento_id,
                    "nome_arquivo": nome_arquivo,
                    "categoria": categoria
                }
            })
        else:
            return jsonify({"error": "Erro ao salvar o documento no banco de dados."}), 500
            
    except Exception as e:
        print(f"Erro no processamento do arquivo de treinamento: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/conhecimento", methods=["GET"])
def list_conhecimento():
    if "user_id" not in session:
        return jsonify({"error": "Não autorizado"}), 401
    documentos = db.listar_conhecimento_usuario(session["user_id"])
    return jsonify({"documentos": documentos})

@app.route("/api/conhecimento/<conhecimento_id>", methods=["DELETE"])
def delete_conhecimento(conhecimento_id):
    if "user_id" not in session:
        return jsonify({"error": "Não autorizado"}), 401
        
    success = db.excluir_conhecimento_usuario(conhecimento_id, session["user_id"])
    if success:
        return jsonify({"message": "Documento de treinamento excluído com sucesso."})
    else:
        return jsonify({"error": "Erro ao excluir documento de treinamento."}), 500

# --- ROTA DE DOWNLOADS ---

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
    
    if "PORT" not in os.environ:
        Timer(1.5, lambda: open_browser(port)).start()
        
        print("\n" + "="*60)
        print("🚀 Iniciando Servidor Web do Roit...")
        print("Se o seu navegador não abrir automaticamente, acesse:")
        print(f"👉 http://127.0.0.1:{port}")
        print("="*60 + "\n")
    else:
        print(f"🚀 Iniciando Roit em modo Produção (Nuvem) na porta {port}...")
    
    host = "0.0.0.0" if "PORT" in os.environ else "127.0.0.1"
    app.run(host=host, port=port, debug=False)
