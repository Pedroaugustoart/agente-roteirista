import os
import sqlite3
import hashlib
import uuid
import json
import urllib.parse
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL")
USING_POSTGRES = DATABASE_URL is not None and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"))

def get_db_connection():
    if USING_POSTGRES:
        import pg8000.dbapi
        # Modifica postgres:// para postgresql:// se necessário para compatibilidade
        url_str = DATABASE_URL
        if url_str.startswith("postgres://"):
            url_str = url_str.replace("postgres://", "postgresql://", 1)
            
        url = urllib.parse.urlparse(url_str)
        username = url.username
        password = url.password
        database = url.path[1:]
        hostname = url.hostname
        port = url.port or 5432
        
        # Conecta no PostgreSQL usando pg8000
        conn = pg8000.dbapi.connect(
            user=username,
            password=password,
            host=hostname,
            port=port,
            database=database
        )
        return conn
    else:
        # Conecta no SQLite local
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roit_database.db")
        conn = sqlite3.connect(db_path)
        return conn

def execute_query(cursor, query, params=()):
    """
    Executa uma query convertendo placeholders de '?' para '%s'
    caso o banco de dados ativo seja o PostgreSQL.
    """
    if USING_POSTGRES:
        # Substitui os placeholders de estilo SQLite '?' por placeholders estilo PostgreSQL '%s'
        query = query.replace("?", "%s")
    cursor.execute(query, params)

def get_row_dict(cursor, row):
    """Converte uma linha de resultado em dicionário baseando-se no cursor.description."""
    if not row:
        return None
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))

def get_rows_list(cursor, rows):
    """Converte várias linhas de resultado em lista de dicionários."""
    if not rows:
        return []
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, r)) for r in rows]

def init_db():
    """Inicializa as tabelas do banco de dados se não existirem."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Diferença de sintaxe: no PostgreSQL, TEXT PRIMARY KEY é idêntico
    # mas a tabela deve ser criada de forma compatível.
    
    # Tabela de Usuários
    execute_query(cursor, """
    CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        data_criacao TEXT NOT NULL
    )
    """)
    
    # Tabela de Roteiros
    execute_query(cursor, """
    CREATE TABLE IF NOT EXISTS roteiros (
        id TEXT PRIMARY KEY,
        usuario_id TEXT NOT NULL,
        titulo TEXT NOT NULL,
        plataforma TEXT NOT NULL,
        categoria TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        briefing_json TEXT NOT NULL,
        data_criacao TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()
    db_type = "PostgreSQL (Remoto)" if USING_POSTGRES else "SQLite (Local)"
    print(f"💾 Banco de dados {db_type} inicializado com sucesso!")

def _hash_senha(password, salt):
    """Gera o hash SHA-256 de uma senha usando um salt."""
    hash_obj = hashlib.sha256()
    hash_obj.update(password.encode('utf-8') + salt.encode('utf-8'))
    return hash_obj.hexdigest()

def registrar_usuario(username, password):
    """Cadastra um novo usuário local no banco."""
    username = username.strip().lower()
    if not username or not password:
        return False
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verifica se já existe
    execute_query(cursor, "SELECT id FROM usuarios WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return False
        
    user_id = str(uuid.uuid4())
    salt = os.urandom(16).hex()
    password_hash = _hash_senha(password, salt)
    data_criacao = datetime.now().isoformat()
    
    try:
        execute_query(
            cursor,
            "INSERT INTO usuarios (id, username, password_hash, salt, data_criacao) VALUES (?, ?, ?, ?, ?)",
            (user_id, username, password_hash, salt, data_criacao)
        )
        conn.commit()
        success = True
    except Exception as e:
        print(f"Erro ao registrar usuário: {e}")
        success = False
    finally:
        conn.close()
        
    return success

def verificar_usuario(username, password):
    """Valida as credenciais locais do usuário."""
    username = username.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(cursor, "SELECT id, username, password_hash, salt FROM usuarios WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    row_dict = get_row_dict(cursor, row)
    password_hash = _hash_senha(password, row_dict['salt'])
    if password_hash == row_dict['password_hash']:
        return {
            "id": row_dict['id'],
            "username": row_dict['username']
        }
    return None

def obter_ou_criar_usuario_google(email, username):
    """
    Retorna o user_id para um usuário do Google Sign-In. 
    Se o usuário não existir no banco de dados, cria-o.
    """
    email = email.strip().lower()
    username = username.strip().lower()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verifica se já existe pelo username (que para usuários Google será baseado no email)
    execute_query(cursor, "SELECT id FROM usuarios WHERE username = ?", (username,))
    row = cursor.fetchone()
    
    if row:
        row_dict = get_row_dict(cursor, row)
        user_id = row_dict['id']
    else:
        user_id = str(uuid.uuid4())
        # Como o login é via Google OAuth, não usamos senha local. Marcamos nos campos de senha.
        salt = "GOOGLE_OAUTH"
        password_hash = "GOOGLE_OAUTH"
        data_criacao = datetime.now().isoformat()
        
        try:
            execute_query(
                cursor,
                "INSERT INTO usuarios (id, username, password_hash, salt, data_criacao) VALUES (?, ?, ?, ?, ?)",
                (user_id, username, password_hash, salt, data_criacao)
            )
            conn.commit()
        except Exception as e:
            print(f"Erro ao criar usuário Google no banco: {e}")
            
    conn.close()
    return user_id

def salvar_roteiro(usuario_id, titulo, plataforma, categoria, conteudo, briefing_json, roteiro_id=None):
    """Salva ou atualiza um roteiro para o usuário."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if not roteiro_id:
        roteiro_id = str(uuid.uuid4())
        data_criacao = datetime.now().isoformat()
        try:
            execute_query(
                cursor,
                "INSERT INTO roteiros (id, usuario_id, titulo, plataforma, categoria, conteudo, briefing_json, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (roteiro_id, usuario_id, titulo, plataforma, categoria, conteudo, json.dumps(briefing_json), data_criacao)
            )
            conn.commit()
        except Exception as e:
            print(f"Erro ao salvar novo roteiro: {e}")
            roteiro_id = None
    else:
        try:
            execute_query(
                cursor,
                "UPDATE roteiros SET titulo = ?, plataforma = ?, categoria = ?, conteudo = ?, briefing_json = ? WHERE id = ? AND usuario_id = ?",
                (titulo, plataforma, categoria, conteudo, json.dumps(briefing_json), roteiro_id, usuario_id)
            )
            conn.commit()
        except Exception as e:
            print(f"Erro ao atualizar roteiro: {e}")
            roteiro_id = None
            
    conn.close()
    return roteiro_id

def listar_roteiros(usuario_id):
    """Retorna uma lista resumida de todos os roteiros salvos do usuário."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(
        cursor,
        "SELECT id, titulo, plataforma, categoria, data_criacao FROM roteiros WHERE usuario_id = ? ORDER BY data_criacao DESC",
        (usuario_id,)
    )
    rows = cursor.fetchall()
    
    roteiros_dicts = get_rows_list(cursor, rows)
    conn.close()
    
    roteiros = []
    for r in roteiros_dicts:
        try:
            # Tenta converter a string isoformat para exibição amigável
            # Se a string contiver fuso horário ou outros formatos, removemos milissegundos
            iso_str = r['data_criacao']
            if "." in iso_str:
                iso_str = iso_str.split(".")[0]
            dt = datetime.fromisoformat(iso_str)
            data_formatada = dt.strftime("%d/%m/%Y %H:%M")
        except Exception:
            data_formatada = r['data_criacao']
            
        roteiros.append({
            "id": r['id'],
            "titulo": r['titulo'],
            "plataforma": r['plataforma'],
            "categoria": r['categoria'],
            "data_criacao": data_formatada
        })
    return roteiros

def obter_roteiro(roteiro_id, usuario_id):
    """Retorna os detalhes completos de um roteiro específico."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(
        cursor,
        "SELECT id, titulo, plataforma, categoria, conteudo, briefing_json, data_criacao FROM roteiros WHERE id = ? AND usuario_id = ?",
        (roteiro_id, usuario_id)
    )
    row = cursor.fetchone()
    
    row_dict = get_row_dict(cursor, row)
    conn.close()
    
    if not row_dict:
        return None
        
    return {
        "id": row_dict['id'],
        "titulo": row_dict['titulo'],
        "plataforma": row_dict['plataforma'],
        "categoria": row_dict['categoria'],
        "conteudo": row_dict['conteudo'],
        "briefing": json.loads(row_dict['briefing_json']),
        "data_criacao": row_dict['data_criacao']
    }
