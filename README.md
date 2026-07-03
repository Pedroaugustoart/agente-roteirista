# Gravy Scriptwriter - Agente de IA Roteirista 🎬

O **Gravy Scriptwriter** é uma plataforma web local e inteligente especializada na produção de roteiros de alta performance para redes sociais (TikTok, Instagram Reels, YouTube Shorts, Vídeos Longos e Anúncios/Ads).

Ele possui uma interface moderna **estilo ChatGPT/Claude**, combinando um formulário de briefing passo a passo com um chat em tempo real para refinar e ajustar os roteiros gerados de forma interativa.

---

## 📁 Arquitetura do Projeto

O projeto é estruturado da seguinte forma:

```text
agente_roteirista/
├── .env                      # Configuração de chave de API do Gemini
├── requirements.txt          # Dependências do projeto (google-genai, Flask, python-dotenv)
├── README.md                 # Manual de instruções de uso
├── config.py                 # Inicializador da API do Gemini
├── agent.py                  # Classe controladora e persistência de sessões de chat
├── app.py                    # Servidor backend Flask (APIs e rotas)
├── main.py                   # Ponto de entrada que inicia o servidor local e abre o navegador
├── roteiros_gerados/         # Pasta de backup local onde os roteiros gerados são salvos
├── templates/
│   └── index.html            # Estrutura HTML da interface web
└── static/
    ├── css/
    │   └── style.css         # Visual Dark Mode Premium com Glassmorphism
    └── js/
        └── app.js            # Lógica do questionário, do chat e exportação do roteiro
```

---

## 🛠️ Configuração e Instalação

### 1. Pré-requisitos
Certifique-se de ter o **Python 3.9+** instalado na sua máquina.

### 2. Instalar Dependências
Navegue até a pasta do projeto no terminal e instale as bibliotecas necessárias:

```bash
pip3 install -r requirements.txt
```

### 3. Configurar API Key do Gemini
1. Se você já configurou o seu arquivo `.env`, não precisa fazer nada!
2. Caso ainda não tenha feito, crie um arquivo chamado `.env` na pasta do projeto e adicione sua chave:
   ```text
   GEMINI_API_KEY=sua_chave_aqui
   GEMINI_MODEL=gemini-2.5-flash
   ```
   *(Obtenha sua chave gratuita em: https://aistudio.google.com/)*

---

## 🚀 Como Executar

Para rodar a plataforma web, basta rodar o comando abaixo no terminal dentro da pasta do projeto:

```bash
python3 main.py
```

> **Atalho:** Se você configurou o atalho anteriormente, basta abrir o terminal e digitar apenas `roteiro`.

### O que acontece em seguida:
1. O servidor local será iniciado.
2. O seu navegador padrão se abrirá automaticamente acessando a página: **`http://127.0.0.1:5001`**

---

## 🎨 Funcionalidades da Interface

* **Formulário de Briefing em Passos:** Responda às perguntas sobre canal, objetivos, persona, tom de voz e referências através de um assistente visual elegante.
* **Chat de Refinação em Tempo Real:** Se o roteiro gerado não estiver perfeito, use o chat para conversar com o agente e pedir correções (ex: *"deixe a introdução mais curta"*, *"adicione uma piada de anime no meio"*).
* **Painel Split-Screen:** O roteiro gerado aparece na coluna direita formatado em uma tabela profissional de duas colunas (**Visual & Edição** e **Áudio & Locução**).
* **Exportação Rápida:** Use os botões no canto superior direito do painel de roteiro para **Copiar para a Área de Transferência** ou **Baixar o arquivo Markdown (.md)** diretamente para o seu computador.
