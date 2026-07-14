# Usar imagem oficial do Python otimizada (slim)
FROM python:3.11-slim

# Evitar a criação de arquivos .pyc e não fazer buffer no stdout (logs em tempo real)
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Definir o diretório de trabalho no container
WORKDIR /app

# Instalar dependências do sistema necessárias para compilar bibliotecas em C (se aplicável) e outras dependências
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar os arquivos de requisitos e instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o resto do código da aplicação
COPY . .

# Expor a porta que a aplicação vai rodar (usado apenas localmente, na nuvem a Render sobrepõe)
EXPOSE 5000

# Definir Gunicorn como o servidor de produção
# Na Render, a aplicação OBRIGATORIAMENTE precisa escutar na porta definida pela variável de ambiente $PORT.
# Usamos a sintaxe de string para que o shell consiga expandir a variável $PORT
CMD gunicorn --workers 4 --bind 0.0.0.0:${PORT:-5000} app:app
