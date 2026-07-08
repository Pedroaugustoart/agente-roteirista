import os
import sqlite3
import uuid
import json
import urllib.parse
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import urllib.parse
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL")
is_production = "PORT" in os.environ

if is_production and not DATABASE_URL:
    raise RuntimeError("⚠️ ERRO CRÍTICO (FAIL-FAST): DATABASE_URL não configurada! Em produção (Render), o uso do SQLite local apaga os dados a cada deploy. Você DEVE configurar um banco PostgreSQL e colocar a URL dele na variável DATABASE_URL.")

USING_POSTGRES = DATABASE_URL is not None and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"))

pg_pool = None

class PooledConnectionWrapper:
    """Wrapper para interceptar o conn.close() e devolver a conexão ao Pool do psycopg2."""
    def __init__(self, pool, conn):
        self.pool = pool
        self.conn = conn
    def cursor(self):
        return self.conn.cursor()
    def commit(self):
        self.conn.commit()
    def rollback(self):
        self.conn.rollback()
    def close(self):
        self.pool.putconn(self.conn)

def get_db_connection():
    global pg_pool
    if USING_POSTGRES:
        if pg_pool is None:
            import psycopg2
            from psycopg2 import pool
            
            # psycopg2 exige 'postgresql://' mas a Render usa 'postgres://'
            dsn = DATABASE_URL
            if dsn.startswith("postgres://"):
                dsn = dsn.replace("postgres://", "postgresql://", 1)
            pg_pool = psycopg2.pool.SimpleConnectionPool(
                1, 10,
                dsn=dsn
            )
        
        # Pega uma conexão do pool e envelopa
        conn = pg_pool.getconn()
        return PooledConnectionWrapper(pg_pool, conn)
    else:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roit_database.db")
        conn = sqlite3.connect(db_path, check_same_thread=False)
        return conn

def execute_query(cursor, query, params=()):
    """
    Executa uma query convertendo placeholders de '?' para '%s'
    caso o banco de dados ativo seja o PostgreSQL.
    """
    if USING_POSTGRES:
        query = query.replace("?", "%s")
    cursor.execute(query, params)

def get_row_dict(cursor, row):
    """Converte uma linha de resultado em dicionário."""
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

def _executar_migracao(conn, cursor, sql):
    """
    Executa uma migração DDL que pode falhar (ex: coluna já existe).
    No PostgreSQL, qualquer erro aborta a transação inteira.
    Usamos SAVEPOINT para poder fazer rollback só desse trecho.
    """
    try:
        if USING_POSTGRES:
            cursor.execute("SAVEPOINT migration_sp")
        execute_query(cursor, sql)
        if USING_POSTGRES:
            cursor.execute("RELEASE SAVEPOINT migration_sp")
    except Exception:
        if USING_POSTGRES:
            cursor.execute("ROLLBACK TO SAVEPOINT migration_sp")
        # SQLite: ignora silenciosamente

def init_db():
    """Inicializa as tabelas do banco de dados se não existirem."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
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
    conn.commit()
    
    # Migrações para as colunas de Provedor (usando savepoint para não abortar transação)
    _executar_migracao(conn, cursor, "ALTER TABLE usuarios ADD COLUMN auth_provider TEXT DEFAULT 'local'")
    _executar_migracao(conn, cursor, "ALTER TABLE usuarios ADD COLUMN provider_id TEXT")
    conn.commit()
        
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
    
    # Tabela de Conhecimento do Usuário (RAG isolado)
    execute_query(cursor, """
    CREATE TABLE IF NOT EXISTS conhecimento_usuario (
        id TEXT PRIMARY KEY,
        usuario_id TEXT NOT NULL,
        nome_arquivo TEXT NOT NULL,
        categoria TEXT NOT NULL,
        conteudo_texto TEXT NOT NULL,
        data_criacao TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    )
    """)
    
    # Tabela de Chunks para Busca Semântica (RAG)
    execute_query(cursor, """
    CREATE TABLE IF NOT EXISTS conhecimento_chunks (
        id TEXT PRIMARY KEY,
        usuario_id TEXT NOT NULL,
        conhecimento_id TEXT NOT NULL,
        categoria TEXT NOT NULL,
        texto_chunk TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
        FOREIGN KEY (conhecimento_id) REFERENCES conhecimento_usuario (id) ON DELETE CASCADE
    )
    """)
    # Índices de performance para buscas frequentes
    _executar_migracao(conn, cursor, "CREATE INDEX IF NOT EXISTS idx_roteiros_usuario ON roteiros(usuario_id)")
    _executar_migracao(conn, cursor, "CREATE INDEX IF NOT EXISTS idx_conhecimento_usuario ON conhecimento_usuario(usuario_id)")
    _executar_migracao(conn, cursor, "CREATE INDEX IF NOT EXISTS idx_chunks_usuario_categoria ON conhecimento_chunks(usuario_id, categoria)")
    
    conn.commit()
    conn.close()
    import logging
    logging.getLogger("RoitApp").info(f"💾 Banco de dados {'PostgreSQL' if USING_POSTGRES else 'SQLite'} inicializado com sucesso!")

def registrar_usuario(username, password):
    """Cadastra um novo usuário local no banco."""
    username = username.strip().lower()
    if not username or not password:
        return False
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(cursor, "SELECT id FROM usuarios WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return False
        
    user_id = str(uuid.uuid4())
    import secrets
    salt = secrets.token_hex(16) # Agora utiliza um salt criptográfico verdadeiro (Removido hardcode)
    password_hash = generate_password_hash(password)
    data_criacao = datetime.now().isoformat()
    
    try:
        execute_query(
            cursor,
            "INSERT INTO usuarios (id, username, password_hash, salt, data_criacao, auth_provider) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, username, password_hash, salt, data_criacao, "local")
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
    
    execute_query(cursor, "SELECT id, username, password_hash FROM usuarios WHERE username = ? AND auth_provider = 'local'", (username,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    row_dict = get_row_dict(cursor, row)
    if check_password_hash(row_dict['password_hash'], password):
        return {
            "id": row_dict['id'],
            "username": row_dict['username']
        }
    return None

def obter_ou_criar_usuario_google(email, username, sub):
    """Retorna o user_id para um usuário do Google Sign-In usando o 'sub'."""
    email = email.strip().lower()
    username = username.strip().lower()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(cursor, "SELECT id, username FROM usuarios WHERE auth_provider = 'google' AND provider_id = ?", (sub,))
    row = cursor.fetchone()
    
    if row:
        row_dict = get_row_dict(cursor, row)
        user_id = row_dict['id']
        username = row_dict['username'] # Usa o username salvo
    else:
        user_id = str(uuid.uuid4())
        
        # Garante que o username gerado pelo Google não conflite com um local
        execute_query(cursor, "SELECT id FROM usuarios WHERE username = ?", (username,))
        if cursor.fetchone():
            username = f"{username}_{sub[:6]}"
            
        salt = "GOOGLE_OAUTH"
        password_hash = "GOOGLE_OAUTH"
        data_criacao = datetime.now().isoformat()
        
        try:
            execute_query(
                cursor,
                "INSERT INTO usuarios (id, username, password_hash, salt, data_criacao, auth_provider, provider_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, username, password_hash, salt, data_criacao, "google", sub)
            )
            conn.commit()
        except Exception as e:
            print(f"Erro ao criar usuário Google no banco: {e}")
            
    conn.close()
    return user_id, username

# --- FUNÇÕES DE CONTROLE DE CONHECIMENTO PERSONALIZADO (RAG) ---

def salvar_conhecimento_usuario(usuario_id, nome_arquivo, categoria, conteudo_texto):
    """Salva um novo documento de conhecimento para o usuário."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    conhecimento_id = str(uuid.uuid4())
    data_criacao = datetime.now().isoformat()
    
    try:
        execute_query(
            cursor,
            "INSERT INTO conhecimento_usuario (id, usuario_id, nome_arquivo, categoria, conteudo_texto, data_criacao) VALUES (?, ?, ?, ?, ?, ?)",
            (conhecimento_id, usuario_id, nome_arquivo, categoria, conteudo_texto, data_criacao)
        )
        conn.commit()
        success_id = conhecimento_id
    except Exception as e:
        print(f"Erro ao salvar conhecimento do usuário: {e}")
        success_id = None
    finally:
        conn.close()
        
    return success_id

def listar_conhecimento_usuario(usuario_id):
    """Retorna a lista de documentos de conhecimento de um usuário."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(
        cursor,
        "SELECT id, nome_arquivo, categoria, data_criacao FROM conhecimento_usuario WHERE usuario_id = ? ORDER BY data_criacao DESC",
        (usuario_id,)
    )
    rows = cursor.fetchall()
    dicts = get_rows_list(cursor, rows)
    conn.close()
    
    # Formata a data para visualização
    for d in dicts:
        try:
            iso_str = d['data_criacao']
            if "." in iso_str:
                iso_str = iso_str.split(".")[0]
            dt = datetime.fromisoformat(iso_str)
            d['data_criacao'] = dt.strftime("%d/%m/%Y %H:%M")
        except Exception:
            pass
            
    return dicts

def excluir_conhecimento_usuario(conhecimento_id, usuario_id):
    """Exclui um documento de conhecimento do usuário."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        execute_query(
            cursor,
            "DELETE FROM conhecimento_usuario WHERE id = ? AND usuario_id = ?",
            (conhecimento_id, usuario_id)
        )
        conn.commit()
        success = True
    except Exception as e:
        print(f"Erro ao excluir conhecimento: {e}")
        success = False
    finally:
        conn.close()
        
    return success

def obter_conteudo_conhecimento_usuario(usuario_id, categoria):
    """Recupera e concatena todo o texto de conhecimento do usuário daquela categoria."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(
        cursor,
        "SELECT nome_arquivo, conteudo_texto FROM conhecimento_usuario WHERE usuario_id = ? AND categoria = ?",
        (usuario_id, categoria.strip().lower())
    )
    rows = cursor.fetchall()
    dicts = get_rows_list(cursor, rows)
    conn.close()
    
    if not dicts:
        return ""
        
    textos = []
    for d in dicts:
        textos.append(f"--- Documento de Treinamento do Usuário ({d['nome_arquivo']}) ---\n{d['conteudo_texto']}")
        
    return "\n\n".join(textos)

# --- FUNÇÕES DE CHUNKING E EMBEDDINGS (RAG) ---

def salvar_chunks_usuario(usuario_id, conhecimento_id, categoria, chunks_dados):
    """
    Salva uma lista de chunks (trechos) com seus respectivos embeddings no banco de dados.
    chunks_dados = [{"texto": "...", "embedding": [0.1, 0.2, ...]}]
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        for chunk in chunks_dados:
            chunk_id = str(uuid.uuid4())
            execute_query(
                cursor,
                "INSERT INTO conhecimento_chunks (id, usuario_id, conhecimento_id, categoria, texto_chunk, embedding_json) VALUES (?, ?, ?, ?, ?, ?)",
                (chunk_id, usuario_id, conhecimento_id, categoria, chunk["texto"], json.dumps(chunk["embedding"]))
            )
        conn.commit()
        success = True
    except Exception as e:
        print(f"Erro ao salvar chunks de conhecimento: {e}")
        success = False
    finally:
        conn.close()
        
    return success

def obter_chunks_categoria(usuario_id, categoria):
    """
    Retorna todos os chunks de uma categoria de um usuário.
    Formato de retorno: [{"texto": "...", "embedding": [0.1, 0.2, ...]}]
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    execute_query(
        cursor,
        "SELECT texto_chunk, embedding_json FROM conhecimento_chunks WHERE usuario_id = ? AND categoria = ?",
        (usuario_id, categoria.strip().lower())
    )
    rows = cursor.fetchall()
    dicts = get_rows_list(cursor, rows)
    conn.close()
    
    chunks_recuperados = []
    for d in dicts:
        try:
            chunks_recuperados.append({
                "texto": d['texto_chunk'],
                "embedding": json.loads(d['embedding_json'])
            })
        except Exception as e:
            print(f"Aviso: Falha ao carregar embedding JSON de chunk: {e}")
            
    return chunks_recuperados

# --- FUNÇÕES DE SALVAMENTO DE ROTEIROS ---

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
