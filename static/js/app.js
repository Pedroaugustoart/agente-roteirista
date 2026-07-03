// Application State
let currentStep = 1;
let sessionId = null;
let lastGeneratedScript = "";
let briefingData = {
    plataforma: "",
    tipo: "",
    objetivo: "",
    mensagem_dor: "",
    publico: "",
    tom: "Descontraído / Humorístico",
    duracao: "1 minuto",
    referencias: "",
    cta: ""
};

// DOM Elements
const onboardingContainer = document.getElementById("onboarding-container");
const chatContainer = document.getElementById("chat-container");
const formSteps = document.querySelectorAll(".form-step");
const stepDots = document.querySelectorAll(".step-dot");
const progressIndicator = document.getElementById("progress-indicator");

const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnNew = document.getElementById("btn-new");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");

const scriptRenderedContent = document.getElementById("script-rendered-content");
const btnCopyScript = document.getElementById("btn-copy-script");
const btnDownloadScript = document.getElementById("btn-download-script");
const activeInfo = document.getElementById("active-info");

// Initialize Onboarding Logic
document.addEventListener("DOMContentLoaded", () => {
    initOptionCards();
    initNavigation();
    initChatActions();
    initSidebar();
});

// Setup click handlers for platform and template option cards
function initOptionCards() {
    // Plataformas
    const platCards = document.querySelectorAll("#grid-plataforma .option-card");
    platCards.forEach(card => {
        card.addEventListener("click", () => {
            platCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            briefingData.plataforma = card.getAttribute("data-val");
        });
    });

    // Tipos de roteiro
    const tipoCards = document.querySelectorAll("#grid-tipo .option-card");
    tipoCards.forEach(card => {
        card.addEventListener("click", () => {
            tipoCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            briefingData.tipo = card.getAttribute("data-val");
        });
    });
}

// Wizard steps navigation logic
function initNavigation() {
    btnNext.addEventListener("click", () => {
        if (validateStep(currentStep)) {
            if (currentStep < 4) {
                currentStep++;
                updateWizardUI();
            } else {
                // Último passo: Enviar e gerar roteiro
                submeterBriefing();
            }
        }
    });

    btnPrev.addEventListener("click", () => {
        if (currentStep > 1) {
            currentStep--;
            updateWizardUI();
        }
    });
}

function validateStep(step) {
    if (step === 1) {
        if (!briefingData.plataforma) {
            alert("Por favor, selecione uma Plataforma.");
            return false;
        }
        if (!briefingData.tipo) {
            alert("Por favor, selecione um Tipo de Vídeo (Template).");
            return false;
        }
    } else if (step === 2) {
        const obj = document.getElementById("input-objetivo").value.trim();
        const msg = document.getElementById("input-mensagem").value.trim();
        if (!obj) {
            alert("Por favor, preencha o objetivo do vídeo.");
            return false;
        }
        if (!msg) {
            alert("Por favor, preencha a mensagem ou dor principal.");
            return false;
        }
        briefingData.objetivo = obj;
        briefingData.mensagem_dor = msg;
    } else if (step === 3) {
        const pub = document.getElementById("input-publico").value.trim();
        if (!pub) {
            alert("Por favor, detalhe o seu público-alvo (Persona).");
            return false;
        }
        briefingData.publico = pub;
    } else if (step === 4) {
        briefingData.tom = document.getElementById("input-tom").value;
        briefingData.duracao = document.getElementById("input-duracao").value.trim();
        briefingData.referencias = document.getElementById("input-referencias").value.trim();
        briefingData.cta = document.getElementById("input-cta").value.trim();
        
        if (!briefingData.duracao) {
            alert("Por favor, defina uma duração aproximada.");
            return false;
        }
        if (!briefingData.cta) {
            alert("Por favor, defina a chamada para ação (CTA) final.");
            return false;
        }
    }
    return true;
}

function updateWizardUI() {
    // Exibe o passo correto e esconde os outros
    formSteps.forEach(step => {
        step.classList.remove("active");
        if (parseInt(step.getAttribute("data-step")) === currentStep) {
            step.classList.add("active");
        }
    });

    // Atualiza os círculos indicadores
    stepDots.forEach(dot => {
        const dStep = parseInt(dot.getAttribute("data-step"));
        dot.classList.remove("active", "completed");
        if (dStep === currentStep) {
            dot.classList.add("active");
        } else if (dStep < currentStep) {
            dot.classList.add("completed");
        }
    });

    // Atualiza barra de progresso
    const progressPercents = { 1: 25, 2: 50, 3: 75, 4: 100 };
    progressIndicator.style.width = `${progressPercents[currentStep]}%`;

    // Atualiza visibilidade dos botões
    btnPrev.style.display = currentStep === 1 ? "none" : "inline-flex";
    btnNext.innerHTML = currentStep === 4 
        ? `Gerar Roteiro <i class="fa-solid fa-wand-magic-sparkles"></i>` 
        : `Próximo <i class="fa-solid fa-arrow-right"></i>`;
}

// API Call - Submit form briefing and generate first script version
async function submeterBriefing() {
    // Transiciona para a tela de carregamento/chat
    onboardingContainer.style.display = "none";
    chatContainer.style.display = "flex";
    
    // Configura a barra lateral esquerda
    atualizarSidebarInfo();

    // Limpa chat e injeta placeholders
    chatMessages.innerHTML = "";
    scriptRenderedContent.innerHTML = `
        <div class="generating-placeholder">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Gerando seu roteiro de alta retenção no Gemini...</p>
        </div>
    `;

    appendMessage("sistema", `Gerando o roteiro para você com base no briefing coletado...`);
    showTypingIndicator();

    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(briefingData)
        });

        const data = await response.json();
        hideTypingIndicator();

        if (response.ok) {
            sessionId = data.session_id;
            lastGeneratedScript = data.script;
            
            // Renderiza roteiro no painel da direita
            exibirRoteiro(data.script);
            
            appendMessage("agent", "Roteiro inicial gerado com sucesso! 🎉 Veja a tabela detalhada ao lado. Se quiser mudar alguma coisa (ex: tornar o gancho inicial mais forte, diminuir o tempo de gravação, ou incluir um meme), é só me pedir aqui no chat.");
        } else {
            appendMessage("agent", `⚠️ Erro ao gerar roteiro: ${data.error || "Erro desconhecido"}`);
            scriptRenderedContent.innerHTML = `<p class="empty-state-text" style="color: #f43f5e; padding: 20px;">Falha ao obter roteiro do servidor.</p>`;
        }
    } catch (err) {
        hideTypingIndicator();
        appendMessage("agent", `❌ Erro de conexão com o servidor local.`);
        console.error(err);
    }
}

// API Call - Chat integration for script refinement
async function enviarMensagemRefinacao() {
    const text = chatInput.value.trim();
    if (!text || !sessionId) return;

    chatInput.value = "";
    appendMessage("user", text);
    showTypingIndicator();

    // Mostra indicador de carregamento no painel do roteiro
    scriptRenderedContent.innerHTML = `
        <div class="generating-placeholder">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Atualizando e refinando o roteiro...</p>
        </div>
    `;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_id: sessionId,
                message: text
            })
        });

        const data = await response.json();
        hideTypingIndicator();

        if (response.ok) {
            lastGeneratedScript = data.script;
            exibirRoteiro(data.script);
            appendMessage("agent", "Roteiro atualizado com sucesso! As alterações foram aplicadas na tabela ao lado.");
        } else {
            appendMessage("agent", `⚠️ Erro ao aplicar ajustes: ${data.error}`);
            exibirRoteiro(lastGeneratedScript); // restaura anterior
        }
    } catch (err) {
        hideTypingIndicator();
        appendMessage("agent", `❌ Erro de conexão ao enviar mensagem.`);
        exibirRoteiro(lastGeneratedScript);
        console.error(err);
    }
}

// Visual Helpers
function appendMessage(sender, text) {
    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble", sender === "user" ? "user" : "agent");
    
    if (sender === "sistema") {
        bubble.innerHTML = `<strong>Assistente:</strong> ${text}`;
    } else {
        bubble.textContent = text;
    }
    
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement("div");
    indicator.id = "typing-indicator";
    indicator.classList.add("chat-bubble", "agent");
    indicator.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
        indicator.remove();
    }
}

function exibirRoteiro(markdownText) {
    // Configura o Marked.js para permitir quebras de linhas simples
    marked.setOptions({
        breaks: true,
        gfm: true
    });
    
    // Converte o Markdown em HTML e insere
    scriptRenderedContent.innerHTML = marked.parse(markdownText);
}

function atualizarSidebarInfo() {
    activeInfo.innerHTML = `
        <div class="info-item">
            <span class="info-label">Plataforma</span>
            <span class="info-val">${briefingData.plataforma}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Estrutura</span>
            <span class="info-val">${briefingData.tipo.toUpperCase()}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Tom</span>
            <span class="info-val">${briefingData.tom}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Duração</span>
            <span class="info-val">${briefingData.duracao}</span>
        </div>
    `;
}

// Copy & Download Script Actions
function initChatActions() {
    // Enviar mensagem de texto no chat
    btnSend.addEventListener("click", enviarMensagemRefinacao);
    
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviarMensagemRefinacao();
        }
    });

    // Copiar roteiro
    btnCopyScript.addEventListener("click", () => {
        if (!lastGeneratedScript) return;
        navigator.clipboard.writeText(lastGeneratedScript)
            .then(() => {
                alert("Roteiro em Markdown copiado para a área de transferência!");
            })
            .catch(err => {
                console.error("Erro ao copiar: ", err);
            });
    });

    // Baixar roteiro (.md)
    btnDownloadScript.addEventListener("click", async () => {
        if (!lastGeneratedScript) return;
        
        try {
            const response = await fetch("/api/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: lastGeneratedScript,
                    tipo: briefingData.tipo
                })
            });

            if (response.ok) {
                // Força o navegador a iniciar o download do blob retornado
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `roteiro_${briefingData.tipo}_${new Date().toISOString().slice(0,10)}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error("Erro ao baixar arquivo: ", err);
        }
    });
}

// Sidebar Buttons / Actions
function initSidebar() {
    btnNew.addEventListener("click", () => {
        if (confirm("Deseja realmente iniciar um novo roteiro? O histórico atual será perdido.")) {
            resetWizard();
        }
    });
}

function resetWizard() {
    sessionId = null;
    lastGeneratedScript = "";
    briefingData = {
        plataforma: "",
        tipo: "",
        objetivo: "",
        mensagem_dor: "",
        publico: "",
        tom: "Descontraído / Humorístico",
        duracao: "1 minuto",
        referencias: "",
        cta: ""
    };

    currentStep = 1;
    updateWizardUI();

    // Reseta inputs
    document.getElementById("input-objetivo").value = "";
    document.getElementById("input-mensagem").value = "";
    document.getElementById("input-publico").value = "";
    document.getElementById("input-tom").value = "Descontraído / Humorístico";
    document.getElementById("input-duracao").value = "1 minuto";
    document.getElementById("input-referencias").value = "";
    document.getElementById("input-cta").value = "";

    document.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));

    activeInfo.innerHTML = `<p class="empty-state-text">Nenhum briefing preenchido ainda.</p>`;
    
    // Troca telas
    chatContainer.style.display = "none";
    onboardingContainer.style.display = "flex";
}
