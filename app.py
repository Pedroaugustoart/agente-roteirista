import os
import uuid
import webbrowser
from functools import wraps
from threading import Timer
from datetime import datetime
from flask import Flask, request, jsonify, make_response, render_template, session
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import logging

# Configuração de Logging (Achado 005)
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("RoitApp")

# Carregar variáveis de ambiente
load_dotenv()

from agent import ScriptAgent
import db

app = Flask(__name__, template_folder="templates", static_folder="static")

# --- 1. CONFIGURAÇÕES DE SEGURANÇA DO SERVIDOR ---
secret_key = os.getenv("FLASK_SECRET_KEY")
is_production = "PORT" in os.environ

if is_production and not secret_key:
    raise RuntimeError("⚠️ ERRO CRÍTICO: FLASK_SECRET_KEY não configurada em ambiente de produção!")

app.secret_key = secret_key or "roit_secret_key_dev_local_12345"

# Proteção contra ataques CSRF e roubo de cookies
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = is_production  # Apenas HTTPS em produção
app.config["SESSION_COOKIE_HTTPONLY"] = True

# Proteção contra ataque de negação de serviço (DoS): Limite de 16MB para uploads
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

agent = None
_agente_inicializado = False

def inicializar_agente():
    global agent, _agente_inicializado
    if _agente_inicializado:
        return
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key in ["sua_chave_aqui", "seu_token_aqui", ""]:
        logger.warning("GEMINI_API_KEY não configurada no seu arquivo .env!")
    agent = ScriptAgent()
    db.init_db()
    _agente_inicializado = True
    logger.info("✅ Agente e banco de dados inicializados com sucesso!")

# --- 2. DECORADOR DE AUTENTICAÇÃO REUTILIZÁVEL ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Sessão expirada ou não autorizada. Faça login novamente."}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- 3. CONTROLE DE RATE LIMIT SIMPLES EM MEMÓRIA (Evita abuso financeiro) ---
# Em escala corporativa alta, substitua por Flask-Limiter integrado com Redis
rate_limits = {}
def rate_limit(segundos_entre_chamadas=5):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            user_id = session.get("user_id", request.remote_addr)
            agora = datetime.now().timestamp()
            ultimo_acesso = rate_limits.get(user_id, 0)
            
            if agora - ultimo_acesso < segundos_entre_chamadas:
                return jsonify({"error": "Muitas requisições seguidas. Aguarde alguns segundos."}), 429
                
            rate_limits[user_id] = agora
            return f(*args, **kwargs)
        return wrapped
    return decorator

# Garante que o agente seja inicializado na primeira requisição.
# Isso é essencial para rodar via Gunicorn (que não passa pelo __main__)
@app.before_request
def before_first_request():
    # Rota de health check não precisa de inicialização
    if request.path == "/healthz":
        return
    try:
        inicializar_agente()
    except Exception as e:
        logger.error(f"Falha na inicialização do agente: {e}")

@app.route("/healthz")
def healthz():
    """Health check para a Render confirmar que o servidor está vivo."""
    return jsonify({"status": "ok"}), 200

@app.route("/")
def index():
    return render_template("index.html", google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""))

# --- ROTAS DE AUTENTICAÇÃO ---

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    
    if len(username) < 3 or len(password) < 6:
        return jsonify({"error": "Usuário (mín. 3 caracteres) e senha (mín. 6 caracteres) são obrigatórios"}), 400
        
    if db.registrar_usuario(username, password):
        return jsonify({"message": "Usuário cadastrado com sucesso!"})
    return jsonify({"error": "Nome de usuário já está em uso"}), 409

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")
    
    user = db.verificar_usuario(username, password)
    if user:
        session.clear() # Evita fixação de sessão
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        return jsonify({"message": "Login realizado com sucesso!", "user": user})
    return jsonify({"error": "Usuário ou senha inválidos"}), 401

@app.route("/api/login/google", methods=["POST"])
def google_login():
    data = request.json or {}
    token = data.get("credential")
    
    if not token:
        return jsonify({"error": "Token do Google ausente"}), 400
        
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        return jsonify({"error": "Configuração OAuth ausente no servidor."}), 500
        
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        email = idinfo.get("email")
        sub = idinfo.get("sub")
        
        if not email or not sub:
            return jsonify({"error": "Dados incompletos retornados pelo Google"}), 400
            
        username = email.split("@")[0]
        user_id, final_username = db.obter_ou_criar_usuario_google(email, username, sub)
        
        session.clear()
        session["user_id"] = user_id
        session["username"] = final_username
        
        return jsonify({"message": "Login com Google realizado com sucesso!", "user": {"id": user_id, "username": final_username}})
    except Exception as e:
        logger.error(f"Erro no login Google: {e}")
        return jsonify({"error": "Token do Google inválido ou expirado."}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logout realizado com sucesso!"})

@app.route("/api/session", methods=["GET"])
def get_session():
    if "user_id" in session:
        return jsonify({"logged_in": True, "user": {"id": session["user_id"], "username": session["username"]}})
    return jsonify({"logged_in": False})

# --- ROTAS DE GERAÇÃO E HISTÓRICO ---

@app.route("/api/generate", methods=["POST"])
@login_required
@rate_limit(segundos_entre_chamadas=10)  # Trava contra flood de gastos na IA
def generate():
    if not agent:
        return jsonify({"error": "Motor de IA indisponível no momento."}), 503
        
    try:
        briefing = request.json
        if not briefing:
            return jsonify({"error": "Dados de briefing inválidos"}), 400
            
        usuario_id = session["user_id"]
        session_id = str(uuid.uuid4())
        
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
        
        # Só grava no disco de backup se rodar localmente no PC
        if not is_production:
            salvar_roteiro_local(script, briefing)
        
        return jsonify({"session_id": session_id, "roteiro_id": roteiro_id, "script": script})
    except Exception as e:
        logger.error(f"Erro na geração do roteiro: {e}")
        return jsonify({"error": "Não foi possível gerar o roteiro no momento."}), 500

@app.route("/api/chat", methods=["POST"])
@login_required
@rate_limit(segundos_entre_chamadas=4)
def chat():
    if not agent:
        return jsonify({"error": "Motor de IA indisponível no momento."}), 503
        
    try:
        data = request.json or {}
        session_id = data.get("session_id")
        message = str(data.get("message", "")).strip()
        roteiro_id = data.get("roteiro_id")
        
        if not session_id or not message:
            return jsonify({"error": "Parâmetros inválidos ou mensagem vazia"}), 400
            
        if len(message) > 4000:
            return jsonify({"error": "A mensagem de refinação é muito longa (máx. 4000 caracteres)."}), 400
            
        usuario_id = session["user_id"]
        
        if session_id in agent.active_chats:
            script = agent.enviar_mensagem_chat(session_id, message)
        else:
            if not roteiro_id:
                return jsonify({"error": "ID de roteiro ausente para restaurar sessão antiga."}), 400
            roteiro_db = db.obter_roteiro(roteiro_id, usuario_id)
            if not roteiro_db:
                return jsonify({"error": "Roteiro não encontrado ou sem permissão"}), 404
                
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
        logger.error(f"Erro no chat de refinação: {e}")
        return jsonify({"error": "Erro ao refinar o roteiro com a inteligência artificial."}), 500

@app.route("/api/history", methods=["GET"])
@login_required
def list_history():
    roteiros = db.listar_roteiros(session["user_id"])
    return jsonify({"roteiros": roteiros})

@app.route("/api/history/<roteiro_id>", methods=["GET"])
@login_required
def get_history_item(roteiro_id):
    roteiro = db.obter_roteiro(roteiro_id, session["user_id"])
    if not roteiro:
        return jsonify({"error": "Roteiro não encontrado"}), 404
    return jsonify({"roteiro": roteiro})

# --- ROTAS DE GESTÃO DE CONHECIMENTO (RAG) ---

@app.route("/api/conhecimento/upload", methods=["POST"])
@login_required
@rate_limit(segundos_entre_chamadas=15) # Evita sobrecarga de API de embeddings
def upload_conhecimento():
    categoria = request.form.get("categoria")
    if not categoria or categoria not in ["storytelling", "viral", "analise", "educativo"]:
        return jsonify({"error": "Categoria inválida"}), 400
        
    if 'file' not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
        
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"error": "Arquivo vazio"}), 400
        
    usuario_id = session["user_id"]
    nome_arquivo = file.filename
    ext = os.path.splitext(nome_arquivo)[1].lower()
    
    try:
        if ext == '.pdf':
            from pypdf import PdfReader
            reader = PdfReader(file)
            paginas_texto = [page.extract_text() for page in reader.pages if page.extract_text()]
            conteudo_texto = "\n".join(paginas_texto)
        elif ext in ['.txt', '.md']:
            conteudo_texto = file.read().decode('utf-8', errors='ignore')
        else:
            return jsonify({"error": "Formato não suportado. Envie PDF, TXT ou MD."}), 400
            
        if not conteudo_texto or len(conteudo_texto.strip()) < 20:
            return jsonify({"error": "O arquivo enviado não possui texto legível suficiente."}), 400
            
        conhecimento_id = db.salvar_conhecimento_usuario(usuario_id, nome_arquivo, categoria, conteudo_texto)
        
        if conhecimento_id:
            # Chunking com limite de segurança para evitar timeout na nuvem
            chunk_size = 600
            overlap = 100
            texto_limpo = conteudo_texto.replace("\n", " ").strip()
            
            chunks = []
            start = 0
            while start < len(texto_limpo) and len(chunks) < 50:  # Trava máxima de 50 chunks por arquivo
                chunks.append(texto_limpo[start : start + chunk_size])
                start += chunk_size - overlap
                
            chunks_dados = []
            from config import get_gemini_client
            client = get_gemini_client()
            
            for c_text in chunks:
                if not c_text.strip():
                    continue
                try:
                    response = client.models.embed_content(model="text-embedding-004", contents=c_text)
                    chunks_dados.append({"texto": c_text, "embedding": response.embeddings[0].values})
                except Exception as e:
                    logger.error(f"Erro ao gerar embedding: {e}")
                    
            if chunks_dados:
                db.salvar_chunks_usuario(usuario_id, conhecimento_id, categoria, chunks_dados)
                
            return jsonify({
                "message": "Treinamento integrado com sucesso!",
                "documento": {"id": conhecimento_id, "nome_arquivo": nome_arquivo, "categoria": categoria}
            })
        return jsonify({"error": "Erro ao registrar o documento na base."}), 500
    except Exception as e:
        logger.error(f"Erro no processamento do upload: {e}")
        return jsonify({"error": "Não foi possível processar o arquivo enviado."}), 500

@app.route("/api/conhecimento", methods=["GET"])
@login_required
def list_conhecimento():
    documentos = db.listar_conhecimento_usuario(session["user_id"])
    return jsonify({"documentos": documentos})

@app.route("/api/conhecimento/<conhecimento_id>", methods=["DELETE"])
@login_required
def delete_conhecimento(conhecimento_id):
    if db.excluir_conhecimento_usuario(conhecimento_id, session["user_id"]):
        return jsonify({"message": "Documento excluído com sucesso."})
    return jsonify({"error": "Erro ao excluir documento."}), 500

@app.route("/api/download", methods=["POST"])
@login_required
def download():
    data = request.json or {}
    script = data.get("script", "")
    tipo = data.get("tipo", "roteiro")
    
    response = make_response(script)
    response.headers["Content-Disposition"] = f"attachment; filename=roteiro_{tipo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    response.headers["Content-type"] = "text/markdown; charset=utf-8"
    return response

def salvar_roteiro_local(roteiro, briefing):
    """Executa apenas localmente na máquina de desenvolvimento."""
    try:
        diretorio_saida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roteiros_gerados")
        os.makedirs(diretorio_saida, exist_ok=True)
        tipo_sanitizado = briefing.get("tipo", "roteiro").replace(" ", "_").lower()
        nome_arquivo = f"roteiro_{tipo_sanitizado}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        
        with open(os.path.join(diretorio_saida, nome_arquivo), "w", encoding="utf-8") as f:
            f.write(f"# Roteiro: {briefing.get('tipo', '')}\n\n{roteiro}")
    except Exception as e:
        logger.warning(f"Aviso ao salvar backup local: {e}")

def open_browser(port):
    webbrowser.open_new(f"http://127.0.0.1:{port}")

if __name__ == "__main__":
    inicializar_agente()
    port = int(os.environ.get("PORT", 5001))
    
    if not is_production:
        Timer(1.5, lambda: open_browser(port)).start()
        logger.info(f"🚀 Servidor de Desenvolvimento rodando: http://127.0.0.1:{port}")
        app.run(host="127.0.0.1", port=port, debug=True)
    else:
        logger.info(f"🚀 Servidor de Produção iniciado na porta {port}...")
        # AVISO: Na nuvem, acione via Gunicorn, ex: gunicorn -w 4 -b 0.0.0.0:$PORT app:app
        app.run(host="0.0.0.0", port=port, debug=False)
