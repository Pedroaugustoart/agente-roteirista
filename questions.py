def obter_resposta_opcao(pergunta, opcoes):
    """
    Exibe uma pergunta de múltipla escolha e valida a resposta do usuário.
    """
    print(f"\n⚡ {pergunta}")
    for idx, opcao in enumerate(opcoes, 1):
        print(f"  [{idx}] {opcao}")
    
    while True:
        try:
            resposta = input("👉 Escolha uma opção (número): ").strip()
            num = int(resposta)
            if 1 <= num <= len(opcoes):
                return opcoes[num - 1]
            else:
                print(f"⚠️ Por favor, escolha um número de 1 a {len(opcoes)}.")
        except ValueError:
            print("⚠️ Entrada inválida. Digite apenas o número da opção desejada.")

def obter_resposta_texto(pergunta, obrigatorio=True, placeholder=""):
    """
    Exibe uma pergunta aberta e coleta a resposta textual.
    """
    print(f"\n📝 {pergunta}")
    if placeholder:
        print(f"   (Exemplo: {placeholder})")
    
    while True:
        resposta = input("👉 ").strip()
        if not resposta and obrigatorio:
            print("⚠️ Esta pergunta é obrigatória. Por favor, responda.")
        else:
            return resposta if resposta else "Não especificado."

def executar_questionario():
    """
    Roda o fluxo de perguntas interativo e retorna as respostas estruturadas.
    """
    print("\n" + "="*50)
    print("🚀 INICIANDO O QUESTIONÁRIO DE BRIEFING DO ROTEIRO 🚀")
    print("Responda às perguntas abaixo para alimentar o agente.")
    print("="*50)

    # 1. Plataforma
    plataformas = ["TikTok", "Instagram Reels", "YouTube Shorts", "YouTube Vídeo Longo", "TikTok/Reels Ads (Anúncios)", "Outro"]
    plataforma = obter_resposta_opcao("Qual a plataforma principal do vídeo?", plataformas)
    if plataforma == "Outro":
        plataforma = obter_resposta_texto("Especifique a plataforma:")

    # 2. Tipo de Roteiro
    tipos = ["educativo", "venda", "viral", "storytelling", "anuncio", "review"]
    tipo_selecionado = obter_resposta_opcao("Qual o tipo / objetivo estrutural do vídeo?", tipos)

    # 3. Objetivo do vídeo
    objetivo = obter_resposta_texto(
        "Qual o objetivo principal do vídeo?", 
        placeholder="Vender um curso de Python, ganhar seguidores no nicho de finanças, gerar compartilhamento sobre UI/UX, etc."
    )

    # 4. Público-Alvo
    publico = obter_resposta_texto(
        "Quem é o público-alvo (persona) do vídeo?", 
        placeholder="Programadores iniciantes de 18 a 25 anos, gamers viciados em RPG, jovens empreendedores, etc."
    )

    # 5. Mensagem Principal ou Dor Principal
    mensagem_dor = obter_resposta_texto(
        "Qual a mensagem central ou dor que o vídeo resolve?",
        placeholder="Eles sofrem para aprender orientação a objetos, ou precisam de um script automático de backup."
    )

    # 6. Tom de Voz
    tons = ["Descontraído / Humorístico", "Super Enérgico / Motivacional", "Didático / Informativo / Calmo", "Sarcástico / Ironia Gamer", "Corporativo / Sério", "Outro"]
    tom = obter_resposta_opcao("Qual o tom de voz do vídeo?", tons)
    if tom == "Outro":
        tom = obter_resposta_texto("Especifique o tom de voz desejado:")

    # 7. Referências e Cultura Pop
    referencias = obter_resposta_texto(
        "Deseja incluir referências de cultura pop, memes, games ou animes? Se sim, quais?",
        obrigatorio=False,
        placeholder="Meme do Pedro Pascal, referências de Elden Ring, animes de luta, etc. (Pressione Enter para pular)"
    )

    # 8. Duração Estimada
    duracao = obter_resposta_texto(
        "Qual a duração aproximada ou limite do vídeo?",
        placeholder="30 segundos, 1 minuto, 5 minutos, 10 minutos."
    )

    # 9. CTA (Call To Action)
    cta = obter_resposta_texto(
        "Qual a Chamada para Ação (CTA) final?",
        placeholder="Comente 'QUERO' para receber o link, se inscreva no canal, compre pelo link da bio."
    )

    briefing = {
        "plataforma": plataforma,
        "tipo": tipo_selecionado,
        "objetivo": objetivo,
        "publico": publico,
        "mensagem_dor": mensagem_dor,
        "tom": tom,
        "referencias": referencias,
        "duracao": duracao,
        "cta": cta
    }

    print("\n" + "="*50)
    print("✅ BRIEFING COLETADO COM SUCESSO!")
    print("="*50 + "\n")
    
    return briefing
