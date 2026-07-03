import os
import sys
from threading import Timer
from app import app, inicializar_agente, open_browser

# Esse arquivo foi adaptado para iniciar a versão Web App automaticamente.
# Assim, o seu atalho original 'roteiro' continuará funcionando perfeitamente!

if __name__ == "__main__":
    # Inicializa o agente carregando as chaves de API
    inicializar_agente()
    
    port = int(os.environ.get("PORT", 5001))
    
    # Abre o navegador automaticamente apenas se rodando localmente (sem PORT)
    if "PORT" not in os.environ:
        Timer(1.5, lambda: open_browser(port)).start()
        
        print("\n" + "="*60)
        print("🎬 INICIANDO WEB APP GRAVY SCRIPTWRITER (VIA MAIN.PY) 🎬")
        print("Se o seu navegador não abrir automaticamente, acesse:")
        print(f"👉 http://127.0.0.1:{port}")
        print("="*60 + "\n")
    else:
        print(f"🎬 INICIANDO WEB APP GRAVY SCRIPTWRITER EM MODO NUVEM NA PORTA {port}... 🎬")
    
    # Na nuvem (Render), precisamos escutar em '0.0.0.0' para aceitar conexões externas
    host = "0.0.0.0" if "PORT" in os.environ else "127.0.0.1"
    app.run(host=host, port=port, debug=False)
