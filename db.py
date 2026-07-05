import os
import sqlite3
import hashlib
import uuid
import json
from datetime import datetime

DATABASE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roit_database.db")

def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row  # Permite acessar colunas por nome
    return conn

def init_db():
    """Inicializa as tabelas do banco de dados se não existirem."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabela de Usuários
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        data_criacao TEXT NOT NULL
    )
    """)
    
    # Tabela de Roteiros
    cursor.execute("""
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
    print("💾 Banco de dados SQLite inicializado com sucesso!")

def _hash_senha(password, salt):
    """Gera o hash SHA-256 de uma senha usando um salt."""
    hash_obj = hashlib.sha256()
    hash_obj.update(password.encode('utf-8') + salt.encode('utf-8'))
    return hash_obj.hexdigest()

def registrar_usuario(username, password):
    """
    Cadastra um novo usuário no sistema. 
    Retorna True se cadastrado com sucesso, False se o usuário já existir.
    """
    username = username.strip().lower()
    if not username or not password:
        return False
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verifica se já existe
    cursor.execute("SELECT id FROM usuarios WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return False
        
    user_id = str(uuid.uuid4())
    salt = os.urandom(16).hex()
    password_hash = _hash_senha(password, salt)
    data_criacao = datetime.now().isoformat()
    
    try:
        cursor.execute(
            "INSERT INTO usuarios (id, username, password_hash, salt, data_criacao) VALUES (?, ?, ?, ?, ?)",
            (user_id, username, password_hash, salt, data_criacao)
        )
        conn.commit()
        success = True
    except sqlite3.Error as e:
        print(f"Erro ao registrar usuário: {e}")
        success = False
    finally:
        conn.close()
        
    return success

def verificar_usuario(username, password):
    """
    Valida as credenciais do usuário.
    Retorna o dicionário com dados do usuário se válido, caso contrário None.
    """
    username = username.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, password_hash, salt FROM usuarios WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    password_hash = _hash_senha(password, row['salt'])
    if password_hash == row['password_hash']:
        return {
            "id": row['id'],
            "username": row['username']
        }
    return None

def salvar_roteiro(usuario_id, titulo, plataforma, categoria, conteudo, briefing_json, roteiro_id=None):
    """
    Salva ou atualiza um roteiro para o usuário.
    Retorna o id do roteiro.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if not roteiro_id:
        roteiro_id = str(uuid.uuid4())
        data_criacao = datetime.now().isoformat()
        try:
            cursor.execute(
                "INSERT INTO roteiros (id, usuario_id, titulo, plataforma, categoria, conteudo, briefing_json, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (roteiro_id, usuario_id, titulo, plataforma, categoria, conteudo, json.dumps(briefing_json), data_criacao)
            )
            conn.commit()
        except sqlite3.Error as e:
            print(f"Erro ao salvar novo roteiro: {e}")
            roteiro_id = None
    else:
        # Atualiza roteiro existente
        try:
            cursor.execute(
                "UPDATE roteiros SET titulo = ?, plataforma = ?, categoria = ?, conteudo = ?, briefing_json = ? WHERE id = ? AND usuario_id = ?",
                (titulo, plataforma, categoria, conteudo, json.dumps(briefing_json), roteiro_id, usuario_id)
            )
            conn.commit()
        except sqlite3.Error as e:
            print(f"Erro ao atualizar roteiro: {e}")
            roteiro_id = None
            
    conn.close()
    return roteiro_id

def listar_roteiros(usuario_id):
    """Retorna uma lista resumida de todos os roteiros salvos do usuário."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, titulo, plataforma, categoria, data_criacao FROM roteiros WHERE usuario_id = ? ORDER BY data_criacao DESC",
        (usuario_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    
    roteiros = []
    for r in rows:
        # Formatar a data para exibição amigável (dd/mm/aaaa hh:mm)
        try:
            dt = datetime.fromisoformat(r['data_criacao'])
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
    
    cursor.execute(
        "SELECT id, titulo, plataforma, categoria, conteudo, briefing_json, data_criacao FROM roteiros WHERE id = ? AND usuario_id = ?",
        (roteiro_id, usuario_id)
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    return {
        "id": row['id'],
        "titulo": row['titulo'],
        "plataforma": row['plataforma'],
        "categoria": row['categoria'],
        "conteudo": row['conteudo'],
        "briefing": json.loads(row['briefing_json']),
        "data_criacao": row['data_criacao']
    }
