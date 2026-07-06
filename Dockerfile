# Usar imagem oficial do Python otimizada (slim)
FROM python:3.9-slim

# Evitar a criação de arquivos .pyc e não fazer buffer no stdout (logs em tempo real)
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Definir o diretório de trabalho no container
WORKDIR /app

# Instalar dependências do sistema necessárias para compilar bibliotecas em C (se aplicável) e outras dependências
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar os arquivos de requisitos e instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o resto do código da aplicação
COPY . .

# Expor a porta que a aplicação vai rodar (pode ser sobreposta pelo serviço na nuvem)
EXPOSE 5001

# Definir Gunicorn como o servidor de produção
# Usa 4 workers para gerenciar requisições concorrentes de forma eficiente
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:5001", "app:app"]
