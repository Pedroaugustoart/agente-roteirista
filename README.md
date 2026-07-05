# Roit - Roteirista de IA Inteligente e Persuasivo 🎬

O **Roit** é uma plataforma web local e independente projetada para a produção de roteiros de altíssima performance para redes sociais (TikTok, Instagram Reels, YouTube Shorts e Vídeos Longos). 

Ele combina técnicas avançadas de copywriting com um **banco de dados local SQLite** para login e histórico, além de um motor de **treinamento exclusivo por categorias (RAG local)** que lê documentos enviados por você.

---

## 📁 Arquitetura do Projeto

```text
agente_roteirista/
├── .env                      # Chave de API do Gemini e modelo configurado
├── .gitignore                # Ignora banco de dados e arquivos de segredos (.env)
├── requirements.txt          # Dependências (google-genai, Flask, python-dotenv, pypdf)
├── README.md                 # Manual de instruções de uso
├── db.py                     # Controlador do banco de dados SQLite (roit_database.db)
├── config.py                 # Inicializador do SDK do Gemini
├── agent.py                  # Classe controladora com leitor de PDFs e TXTs (RAG)
├── app.py                    # Servidor backend Flask (APIs, Login, Sessões, Roteiros)
├── main.py                   # Ponto de entrada (inicia o Flask na porta 5001)
├── roit_database.db          # Arquivo SQLite gerado automaticamente para salvar dados
├── prompts/
│   ├── system_prompt.txt     # System Prompt focado nas falas (locução)
│   ├── templates/            # Modelos estruturais de roteiro (.txt)
│   └── conhecimento/         # 🧠 PASTAS DE TREINAMENTO (Base de Conhecimento)
│       ├── storytelling/     # Coloque PDFs/TXTs de storytelling aqui
│       ├── viral/            # Coloque PDFs/TXTs de vídeos virais aqui
│       ├── analise/          # Coloque PDFs/TXTs de reviews/análises aqui
│       └── educativo/        # Coloque PDFs/TXTs de tutoriais/dicas aqui
├── templates/
│   └── index.html            # Interface de página única Roit
└── static/
    ├── css/
    │   └── style.css         # Visual minimalista monocromático dark mode
    └── js/
        └── app.js            # Interações do cliente, login, formulários e chat
```

---

## 🛠️ Configuração e Instalação

### 1. Instalar as Dependências
Certifique-se de ter o **Python 3.9+** instalado no seu Mac. No terminal, dentro da pasta do projeto, instale as dependências:
```bash
pip3 install -r requirements.txt
```
*(Instalará `google-genai`, `Flask`, `python-dotenv` e a biblioteca `pypdf` para leitura de PDFs).*

### 2. Configurar a Chave no `.env`
Caso não tenha feito, crie um arquivo chamado `.env` na raiz do projeto e configure:
```text
GEMINI_API_KEY=sua_chave_de_api
GEMINI_MODEL=gemini-2.5-flash
```

---

## 🚀 Como Executar

Rode o comando de inicialização local:
```bash
python3 main.py
```
*(Ou use o seu atalho `roteiro` criado anteriormente).*

O navegador se abrirá automaticamente acessando: **`http://127.0.0.1:5001`**

---

## 🧠 Como Alimentar a Mente Pensante do Roit (RAG)

Para treinar o Roit com conceitos, regras, livros ou anotações específicas, de modo que ele use apenas esses dados para gerar os roteiros:

1. Acesse a pasta `prompts/conhecimento/` no seu computador.
2. Abra a subpasta correspondente à categoria desejada (ex: `storytelling/` para roteiros de storytelling).
3. **Cole seus arquivos lá dentro!** Você pode adicionar:
   - **Documentos PDF** (`.pdf`)
   - **Arquivos de Texto** (`.txt` ou `.md`)
4. **Pronto!** Na próxima vez que gerar um roteiro de "Storytelling", o Roit lerá **apenas** os arquivos dentro daquela pasta específica e usará essa base de conhecimento como guia estrito para as falas e ritmo do vídeo. O conhecimento de outras categorias (como `viral/`) não será acessado.

---

## 🎨 Funcionalidades do Site

* **Página Única (All-in-one):** Sem formulários chatos em passos. Todas as perguntas de briefing estão disponíveis e visíveis na mesma tela.
* **Sistema de Login e Histórico:** Você cria sua conta local na hora. Seus roteiros ficam guardados com segurança no banco de dados SQLite (`roit_database.db`) e aparecem listados na barra lateral sob a seção **"Roteiros feitos:"**.
* **Chat de Refinação de Roteiros Antigos:** Você pode clicar em qualquer roteiro no seu histórico para carregá-lo instantaneamente e bater papo com a IA para aplicar ajustes na locução, mesmo que tenha fechado a página ou reiniciado o computador!
* **Destaque para Falas:** A tabela gerada dá ênfase máxima à locução (falas do apresentador) na coluna direita, mantendo enquadramentos e edições concisas e simples na coluna esquerda.
