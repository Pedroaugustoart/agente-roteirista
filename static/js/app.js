// Global State variables
let sessionId = null;
let activeRoteiroId = null;
let lastGeneratedScript = "";
let briefingData = {
    plataforma: "",
    tipo: "",
    referencias: "",
    duracao: "",
    publico: "",
    cta: "",
    objetivo: "",
    mensagem_dor: "",
    tom: "Didático / Informativo / Calmo"
};

// --- ÁUDIO (VOICE INPUT & OUTPUT) ---
let recognition = null;
let isListening = false;
let synth = window.speechSynthesis;
let utterance = null;
let isSpeaking = false;

// --- CANVAS DE REDE NEURAL (MAPA MENTAL) ---
let canvas = null;
let ctx = null;
let nodes = [];
let connections = [];
let draggedNode = null;
let selectedNode = null;
let offset = { x: 0, y: 0 };
let animFrameId = null;
let particles = [];
let uploadCategoryTarget = ""; // Guarda qual categoria vai receber o upload

// DOM Elements
const authModal = document.getElementById("auth-modal");
const loginForm = document.getElementById("login-form-container");
const registerForm = document.getElementById("register-form-container");
const authErrorMsg = document.getElementById("auth-error-msg");

const linkShowRegister = document.getElementById("link-show-register");
const linkShowLogin = document.getElementById("link-show-login");
const btnSubmitLogin = document.getElementById("btn-submit-login");
const btnSubmitRegister = document.getElementById("btn-submit-register");

const btnProfile = document.getElementById("btn-profile");
const userDropdown = document.getElementById("user-dropdown");
const dropdownUsername = document.getElementById("dropdown-username");
const btnLogout = document.getElementById("btn-logout");

const userStatusSidebar = document.getElementById("user-status-sidebar");
const historyList = document.getElementById("history-list");

const formSection = document.getElementById("form-section");
const splitSection = document.getElementById("split-section");

const btnNewRoteiro = document.getElementById("btn-new-roteiro");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnSendChat = document.getElementById("btn-send-chat");

// Elementos da Nova Conversational UI
const chatFeed = document.getElementById("chat-feed");
const chatInputBar = document.getElementById("chat-input-bar");
const chatInputField = document.getElementById("chat-input-field");
const btnChatSendNew = document.getElementById("btn-chat-send");
const chatOptionsBar = document.getElementById("chat-options-bar");

// Novos Elementos de Áudio, Abas e Canvas
const tabGenerator = document.getElementById("tab-generator");
const tabNeuralBrain = document.getElementById("tab-neural-brain");
const tabsNav = document.getElementById("main-tabs-nav");

const btnVoiceChat = document.getElementById("btn-voice-chat");
const btnPlayVoice = document.getElementById("btn-play-voice");
const btnExportPdf = document.getElementById("btn-export-pdf");

const neuralCanvas = document.getElementById("neural-canvas");
const neuralNodeBalloon = document.getElementById("neural-node-balloon");
const balloonFilename = document.getElementById("balloon-filename");
const balloonMeta = document.getElementById("balloon-meta");
const btnDeleteNode = document.getElementById("btn-delete-node");
const neuralFileInput = document.getElementById("neural-file-input");

const scriptViewport = document.getElementById("script-viewport");
const btnCopy = document.getElementById("btn-copy");
const btnDownload = document.getElementById("btn-download");

document.addEventListener("DOMContentLoaded", () => {
    verificarSessao();
    initConversationalUI();
    initAuthEvents();
    initChatActions();
    initSidebarEvents();
    initTabsEvents();
    initVoiceRecognition();
    initTextToSpeech();
    initPDFExport();
    initUploadWidgetControls();
    
    marked.setOptions({
        breaks: true,
        gfm: true
    });
});

// --- VERIFICAÇÃO DE SESSÃO ---
async function verificarSessao() {
    try {
        const response = await fetch("/api/session");
        const data = await response.json();
        if (data.logged_in) {
            autenticarUsuarioUI(data.user.username);
        } else {
            desautenticarUsuarioUI();
        }
    } catch (err) {
        console.error("Erro ao verificar sessão:", err);
    }
}

function autenticarUsuarioUI(username) {
    authModal.style.display = "none";
    dropdownUsername.textContent = `@${username}`;
    userStatusSidebar.classList.add("active");
    userStatusSidebar.querySelector(".user-status-name").textContent = `@${username}`;
    carregarHistorico();
}

function desautenticarUsuarioUI() {
    authModal.style.display = "flex";
    userStatusSidebar.classList.remove("active");
    userStatusSidebar.querySelector(".user-status-name").textContent = "Desconectado";
    historyList.innerHTML = `<p class="empty-state">Faça login para ver seu histórico.</p>`;
}

// --- CONTROLE DE AUTENTICAÇÃO ---
function initAuthEvents() {
    linkShowRegister.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.style.display = "none";
        registerForm.style.display = "flex";
        authErrorMsg.style.display = "none";
    });

    linkShowLogin.addEventListener("click", (e) => {
        e.preventDefault();
        registerForm.style.display = "none";
        loginForm.style.display = "flex";
        authErrorMsg.style.display = "none";
    });

    btnSubmitLogin.addEventListener("click", async () => {
        const user = document.getElementById("login-username").value.trim();
        const pass = document.getElementById("login-password").value.trim();
        if (!user || !pass) {
            exhibirErroAuth("Preencha todos os campos");
            return;
        }

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await response.json();
            if (response.ok) {
                autenticarUsuarioUI(data.user.username);
            } else {
                exhibirErroAuth(data.error);
            }
        } catch (err) {
            exhibirErroAuth("Erro de rede ao logar");
        }
    });

    btnSubmitRegister.addEventListener("click", async () => {
        const user = document.getElementById("reg-username").value.trim();
        const pass = document.getElementById("reg-password").value.trim();
        if (!user || !pass) {
            exhibirErroAuth("Preencha todos os campos");
            return;
        }

        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await response.json();
            if (response.ok) {
                btnSubmitRegister.disabled = true;
                const loginResponse = await fetch("/api/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: user, password: pass })
                });
                const loginData = await loginResponse.json();
                btnSubmitRegister.disabled = false;
                autenticarUsuarioUI(loginData.user.username);
            } else {
                exhibirErroAuth(data.error);
            }
        } catch (err) {
            exhibirErroAuth("Erro de rede ao cadastrar");
        }
    });

    btnProfile.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.style.display = userDropdown.style.display === "none" ? "block" : "none";
    });

    document.addEventListener("click", () => {
        userDropdown.style.display = "none";
        neuralNodeBalloon.style.display = "none";
    });

    btnLogout.addEventListener("click", async () => {
        try {
            const response = await fetch("/api/logout", { method: "POST" });
            if (response.ok) {
                desautenticarUsuarioUI();
                resetForm();
                switchToTab("tab-generator");
            }
        } catch (err) {
            console.error("Erro ao fazer logout:", err);
        }
    });
}

function exhibirErroAuth(msg) {
    authErrorMsg.textContent = msg;
    authErrorMsg.style.display = "block";
}

// --- CONTROLE DE ABAS ---
function initTabsEvents() {
    const tabBtns = document.querySelectorAll("#main-tabs-nav .tab-nav-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const targetTab = btn.getAttribute("data-tab");
            switchToTab(targetTab);
        });
    });
}

function switchToTab(tabId) {
    if (tabId === "tab-generator") {
        tabGenerator.style.display = "flex";
        tabNeuralBrain.style.display = "none";
        cancelAnimationFrame(animFrameId);
    } else if (tabId === "tab-neural-brain") {
        tabGenerator.style.display = "none";
        tabNeuralBrain.style.display = "flex";
        initNeuralNetworkCanvas();
    }
}

// --- CONVERSATIONAL UI STATE MACHINE ---
let convStep = 0;
const convSteps = [
    { key: "objetivo", prompt: "Olá. Qual é o objetivo principal do vídeo que vamos criar hoje?", type: "text", placeholder: "Ex: Vender meu curso de design, explicar como investir..." },
    { key: "plataforma", prompt: "Excelente. Em qual plataforma você planeja postar?", type: "options", options: ["TikTok", "Instagram Reels", "YouTube Shorts"] },
    { key: "tipo", prompt: "Qual será o foco narrativo?", type: "options", options: ["storytelling", "viral", "analise", "educativo"] },
    { key: "publico", prompt: "Para quem estamos falando? (Público-alvo e Tom de voz)", type: "text", placeholder: "Ex: Jovens de 20 anos. Tom animado e informal." },
    { key: "mensagem_dor", prompt: "Qual problema ou dor do seu público este vídeo resolve?", type: "text", placeholder: "Ex: Eles não sabem precificar seus serviços." },
    { key: "duracao", prompt: "Qual a duração estimada?", type: "text", placeholder: "Ex: Cerca de 30 a 60 segundos." },
    { key: "cta", prompt: "E para fechar: Qual será a chamada para ação (CTA) no final do vídeo?", type: "text", placeholder: "Ex: Comente EU QUERO para receber o link no direct." }
];

function initConversationalUI() {
    convStep = 0;
    chatFeed.innerHTML = "";
    briefingData = {
        plataforma: "", tipo: "", referencias: "", duracao: "",
        publico: "", cta: "", objetivo: "", mensagem_dor: "", tom: "Didático / Informativo / Calmo"
    };
    
    // Usando tanto onclick quanto listener para garantir
    btnChatSendNew.onclick = (e) => { e.preventDefault(); handleChatSend(); };
    btnChatSendNew.addEventListener("click", (e) => { e.preventDefault(); handleChatSend(); });
    chatInputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleChatSend();
        }
    });
    
    // Inicia a primeira pergunta
    askNextQuestion();
}

function askNextQuestion() {
    if (convStep >= convSteps.length) {
        appendConversationalMessage("system", "Tudo pronto. Iniciando sinapses cerebrais para gerar seu roteiro mágico...");
        chatInputBar.style.display = "none";
        setTimeout(() => gerarNovoRoteiro(), 1500);
        return;
    }
    
    const stepData = convSteps[convStep];
    
    // Fade out previous messages
    document.querySelectorAll(".chat-message").forEach(el => el.classList.add("faded"));
    
    // Add typing indicator
    const typingId = "typing-" + Date.now();
    chatFeed.insertAdjacentHTML("beforeend", `
        <div class="chat-message system" id="${typingId}">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `);
    scrollToBottomFeed();
    
    setTimeout(() => {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        
        appendConversationalMessage("system", stepData.prompt);
        
        if (stepData.type === "options") {
            chatInputBar.style.display = "none";
            chatOptionsBar.style.display = "flex";
            chatOptionsBar.innerHTML = "";
            stepData.options.forEach(opt => {
                const btn = document.createElement("button");
                btn.className = "chat-option-btn";
                btn.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
                btn.onclick = () => handleChatOption(opt);
                chatOptionsBar.appendChild(btn);
            });
        } else {
            chatInputBar.style.display = "flex";
            chatOptionsBar.style.display = "none";
            chatInputField.value = "";
            chatInputField.placeholder = stepData.placeholder || "Digite sua resposta...";
            chatInputField.focus();
        }
    }, 600); // 600ms of "thinking"
}

function handleChatSend() {
    const val = chatInputField.value.trim();
    if (!val) return;
    
    const stepData = convSteps[convStep];
    briefingData[stepData.key] = val;
    
    appendConversationalMessage("user", val);
    chatInputField.value = "";
    
    convStep++;
    askNextQuestion();
}

function handleChatOption(opt) {
    const stepData = convSteps[convStep];
    briefingData[stepData.key] = opt;
    
    appendConversationalMessage("user", opt.charAt(0).toUpperCase() + opt.slice(1));
    
    convStep++;
    askNextQuestion();
}

function appendConversationalMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `chat-message ${role}`;
    msg.innerHTML = `<div class="message-bubble">${DOMPurify.sanitize(text)}</div>`;
    chatFeed.appendChild(msg);
    scrollToBottomFeed();
}

function scrollToBottomFeed() {
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

// Adaptação para histórico
function preencherInputs(briefing) {
    briefingData = { ...briefing };
    // O chat é bypassado se clicar no histórico, vai direto pra Split Screen
}

// --- GERAÇÃO DE ROTEIRO ---

async function gerarNovoRoteiro() {
    formSection.style.display = "none";
    splitSection.style.display = "flex";

    chatMessages.innerHTML = "";
    scriptViewport.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Roit está analisando seu briefing e base de conhecimento...</p>
        </div>
    `;

    appendMessage("sistema", "Iniciando motor de inteligência artificial Roit...");
    showTypingIndicator();
    pararAudioLocucao();

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
            activeRoteiroId = data.roteiro_id;
            lastGeneratedScript = data.script;

            exibirRoteiro(data.script);
            appendMessage("agent", "Roteiro gerado com sucesso! 🎉 Destaquei as falas na coluna direita. Se precisar mudar alguma parte, me envie uma mensagem por texto ou clique no microfone e fale comigo.");
            carregarHistorico();
        } else {
            appendMessage("agent", `⚠️ Falha ao gerar roteiro: ${data.error}`);
            scriptViewport.innerHTML = `<p class="empty-state" style="color: #ef4444;">Erro na geração.</p>`;
        }
    } catch (err) {
        hideTypingIndicator();
        appendMessage("agent", "❌ Erro de conexão com o servidor local.");
    }
}

// --- CHAT DE REFINAÇÃO ---
function initChatActions() {
    btnSendChat.addEventListener("click", enviarMensagem);
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviarMensagem();
        }
    });

    btnCopy.addEventListener("click", () => {
        if (!lastGeneratedScript) return;
        navigator.clipboard.writeText(lastGeneratedScript)
            .then(() => alert("Copiado para a área de transferência!"))
            .catch(err => console.error("Erro ao copiar:", err));
    });

    btnDownload.addEventListener("click", async () => {
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
            console.error("Erro ao fazer download:", err);
        }
    });
}

async function enviarMensagem() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    appendMessage("user", text);
    showTypingIndicator();
    pararAudioLocucao();

    scriptViewport.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Roit está reescrevendo as falas com base no seu ajuste...</p>
        </div>
    `;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_id: sessionId,
                message: text,
                roteiro_id: activeRoteiroId
            })
        });

        const data = await response.json();
        hideTypingIndicator();

        if (response.ok) {
            lastGeneratedScript = data.script;
            exibirRoteiro(data.script);
            appendMessage("agent", "Roteiro atualizado! Ajustes aplicados na coluna ao lado.");
        } else {
            appendMessage("agent", `⚠️ Erro ao ajustar: ${data.error}`);
            exibirRoteiro(lastGeneratedScript);
        }
    } catch (err) {
        hideTypingIndicator();
        appendMessage("agent", "❌ Erro ao enviar mensagem.");
        exibirRoteiro(lastGeneratedScript);
    }
}

// --- ENTRADA DE VOZ (MICROFONE) ---
function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        btnVoiceChat.style.display = "none"; // Esconde o botão se o navegador não suportar
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    btnVoiceChat.addEventListener("click", () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isListening = true;
        btnVoiceChat.classList.add("listening");
        chatInput.placeholder = "Escutando sua voz...";
    };

    recognition.onend = () => {
        isListening = false;
        btnVoiceChat.classList.remove("listening");
        chatInput.placeholder = "Fale ou digite modificações nas falas do roteiro...";
    };

    recognition.onresult = (event) => {
        const speechToText = event.results[0][0].transcript;
        chatInput.value = speechToText;
        chatInput.focus();
    };

    recognition.onerror = (event) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        alert("Ocorreu um erro no reconhecimento de voz: " + event.error);
    };
}

// --- SAÍDA DE ÁUDIO (PLAYER DE LOCUÇÃO) ---
function initTextToSpeech() {
    btnPlayVoice.addEventListener("click", () => {
        if (isSpeaking) {
            pararAudioLocucao();
        } else {
            iniciarAudioLocucao();
        }
    });
}

function iniciarAudioLocucao() {
    if (!lastGeneratedScript) return;
    
    // 1. Extrair as falas do Roteiro (filtra o Markdown da tabela)
    const falas = extrairFalasDoRoteiro(lastGeneratedScript);
    if (!falas) {
        alert("Nenhum texto de locução legível encontrado neste roteiro.");
        return;
    }

    synth.cancel(); // Para qualquer outra voz tocando
    utterance = new SpeechSynthesisUtterance(falas);
    utterance.lang = "pt-BR";

    // 2. Tenta selecionar uma voz de alta qualidade (Siri ou Luciana no macOS)
    const voices = synth.getVoices();
    const voiceFavorita = voices.find(v => 
        (v.lang === "pt-BR" || v.lang === "pt_BR") && 
        (v.name.includes("Siri") || v.name.includes("Luciana") || v.name.includes("Google"))
    );
    if (voiceFavorita) {
        utterance.voice = voiceFavorita;
    }

    // 3. Ajustar o tom de voz dinamicamente baseado nas respostas de Público/Tom de Voz
    const publicoTomStr = briefingData.publico.toLowerCase();
    
    // Velocidade padrão
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;

    // Detecta palavras-chaves de tom
    if (publicoTomStr.includes("calmo") || publicoTomStr.includes("sério") || publicoTomStr.includes("didático")) {
        utterance.rate = 0.93; // Fala mais calma e pausada
    } else if (publicoTomStr.includes("divertido") || publicoTomStr.includes("enérgico") || publicoTomStr.includes("viral") || publicoTomStr.includes("jovens")) {
        utterance.rate = 1.15; // Fala dinâmica de alta retenção
        utterance.pitch = 1.08; // Levemente mais agudo/animado
    }

    utterance.onstart = () => {
        isSpeaking = true;
        btnPlayVoice.innerHTML = '<i class="fa-solid fa-pause"></i>';
        btnPlayVoice.title = "Pausar locução";
    };

    utterance.onend = () => {
        isSpeaking = false;
        btnPlayVoice.innerHTML = '<i class="fa-solid fa-play"></i>';
        btnPlayVoice.title = "Ouvir locução do roteiro";
    };

    utterance.onerror = (e) => {
        console.error("Erro na síntese de voz:", e);
        isSpeaking = false;
        btnPlayVoice.innerHTML = '<i class="fa-solid fa-play"></i>';
    };

    synth.speak(utterance);
}

function pararAudioLocucao() {
    synth.cancel();
    isSpeaking = false;
    btnPlayVoice.innerHTML = '<i class="fa-solid fa-play"></i>';
    btnPlayVoice.title = "Ouvir locução do roteiro";
}

function extrairFalasDoRoteiro(scriptMarkdown) {
    // Procura por todas as linhas da tabela e pega apenas a coluna de locução (coluna 2)
    const linhas = scriptMarkdown.split("\n");
    let textoLocucao = [];

    linhas.forEach(linha => {
        if (linha.startsWith("|") && !linha.includes("Visual & Edição") && !linha.includes(":---")) {
            const colunas = linha.split("|");
            if (colunas.length >= 3) {
                // A coluna do áudio é a segunda coluna real da tabela
                let colunaAudio = colunas[2].trim();
                
                // Remove marcações do roteiro e HTML tags do marked
                colunaAudio = colunaAudio
                    .replace(/\[Locutor\]/g, "")
                    .replace(/\[SFX\]:?\s*\[.*?\]/g, "")
                    .replace(/\[BGM\]:?\s*\[.*?\]/g, "")
                    .replace(/\*\*\[Locutor\]\*\*:/g, "")
                    .replace(/\<br\s*\/?\>/gi, " ")
                    .replace(/\*\*.*?\*\*:/g, "") // remove negritos com títulos
                    .replace(/\[.*?\]/g, "") // remove qualquer metadado entre colchetes
                    .trim();
                
                if (colunaAudio) {
                    textoLocucao.push(colunaAudio);
                }
            }
        }
    });

    return textoLocucao.join(" \n ");
}

// --- EXPORTAÇÃO PARA PDF ---
function initPDFExport() {
    btnExportPdf.addEventListener("click", () => {
        if (!lastGeneratedScript) return;
        
        const element = document.getElementById("script-viewport");
        
        // Estilo customizado para a impressão ficar com layout de documento profissional
        const opt = {
            margin:       [0.5, 0.5, 0.5, 0.5],
            filename:     `roit_roteiro_${briefingData.tipo || "script"}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, backgroundColor: '#09090b', useCORS: true },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Roda a conversão client-side direto no navegador do usuário
        html2pdf().set(opt).from(element).save();
    });
}

// --- SIDEBAR E RESETS ---
function initSidebarEvents() {
    btnNewRoteiro.addEventListener("click", () => {
        resetForm();
        switchToTab("tab-generator");
        formSection.style.display = "block";
        splitSection.style.display = "none";
        
        document.querySelectorAll(".history-item").forEach(item => {
            item.classList.remove("active");
        });
        pararAudioLocucao();
    });
}

function resetForm() {
    sessionId = null;
    activeRoteiroId = null;
    lastGeneratedScript = "";
    briefingData = {
        plataforma: "",
        tipo: "",
        referencias: "",
        duracao: "",
        publico: "",
        cta: "",
        objetivo: "",
        mensagem_dor: "",
        tom: "Didático / Informativo / Calmo"
    };

    document.getElementById("input-ref").value = "";
    document.getElementById("input-dur").value = "";
    document.getElementById("input-pub").value = "";
    document.getElementById("input-cta").value = "";
    document.getElementById("input-obj").value = "";
    document.getElementById("input-prob").value = "";

    document.querySelectorAll("#platform-selector .platform-option").forEach(o => o.classList.remove("selected"));
    document.querySelectorAll("#focus-selector .focus-btn").forEach(b => b.classList.remove("selected"));
}

// --- AJUDANTES DO CHAT ---
function appendMessage(sender, text) {
    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble", sender === "user" ? "user" : "agent");
    if (sender === "sistema") {
        bubble.innerHTML = `<strong>Roit:</strong> ${text}`;
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
    if (indicator) indicator.remove();
}

function exibirRoteiro(markdownText) {
    scriptViewport.innerHTML = DOMPurify.sanitize(marked.parse(markdownText));
}

// --- CALLBACK DO GOOGLE LOGIN ---
window.handleCredentialResponse = async function(response) {
    const token = response.credential;
    try {
        const res = await fetch("/api/login/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: token })
        });
        const data = await res.json();
        if (res.ok) {
            autenticarUsuarioUI(data.user.username);
        } else {
            exhibirErroAuth(data.error || "Erro ao fazer login com o Google");
        }
    } catch (err) {
        console.error("Erro de rede no Google Login:", err);
        exhibirErroAuth("Erro de conexão ao autenticar com o Google.");
    }
}

// ==========================================
// 🧠 CANVAS DO MAPA MENTAL NEURONAL (RAG)
// ==========================================

function initNeuralNetworkCanvas() {
    canvas = document.getElementById("neural-canvas");
    ctx = canvas.getContext("2d");
    
    // Redimensiona o canvas para caber na div container
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    // Configura os eventos de arrastar/clicar
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onCanvasClick);
    
    // Evento de input do uploader oculto
    neuralFileInput.addEventListener("change", handleFileUpload);
    
    // Configuração do botão de deletar neurônio de arquivo
    btnDeleteNode.onclick = async (e) => {
        e.stopPropagation();
        if (selectedNode && selectedNode.type === "file") {
            if (confirm(`Deseja mesmo excluir o treinamento "${selectedNode.label}"?`)) {
                try {
                    const res = await fetch(`/api/conhecimento/${selectedNode.id}`, {
                        method: "DELETE"
                    });
                    if (res.ok) {
                        // Remove da rede
                        nodes = nodes.filter(n => n.id !== selectedNode.id);
                        connections = connections.filter(c => c.to !== selectedNode.id);
                        neuralNodeBalloon.style.display = "none";
                        selectedNode = null;
                    } else {
                        alert("Erro ao excluir arquivo de treinamento.");
                    }
                } catch (err) {
                    console.error("Erro ao deletar nó:", err);
                }
            }
        }
    };
    
    // Carrega dados de treinamento do banco e inicia a simulação física do cérebro
    carregarEConstruirRedeNeural();
}

function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

async function carregarEConstruirRedeNeural() {
    // 1. Limpa nós e conexões antigos
    nodes = [];
    connections = [];
    particles = [];
    ambientParticles = [];
    
    // Gera partículas ambientes
    for (let i = 0; i < 50; i++) {
        ambientParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1
        });
    }
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 2. Neurônio Central (Cérebro do Roit)
    const centerNode = {
        id: "roit-mind",
        x: centerX,
        y: centerY,
        vx: 0, vy: 0,
        r: 34,
        label: "Roit Mind",
        type: "center",
        color: "#ffffff"
    };
    nodes.push(centerNode);
    
    // 3. Os 4 Ramos Principais (Focos / Categorias)
    const categorias = [
        { id: "storytelling", label: "Storytelling", color: "#00E5FF", angle: 0 },
        { id: "viral", label: "Viral", color: "#00E5FF", angle: Math.PI / 2 },
        { id: "analise", label: "Análise", color: "#00E5FF", angle: Math.PI },
        { id: "educativo", label: "Educativo", color: "#00E5FF", angle: 3 * Math.PI / 2 }
    ];
    
    const distCategorias = 150;
    
    categorias.forEach(cat => {
        const catNode = {
            id: cat.id,
            x: centerX + Math.cos(cat.angle) * distCategorias,
            y: centerY + Math.sin(cat.angle) * distCategorias,
            vx: 0, vy: 0,
            r: 22,
            label: cat.label,
            type: "category",
            color: cat.color
        };
        nodes.push(catNode);
        
        // Conecta categoria ao centro
        connections.push({ from: "roit-mind", to: cat.id, color: cat.color });
    });
    
    // 4. Busca os PDFs do Usuário e anexa na rede
    try {
        const res = await fetch("/api/conhecimento");
        const data = await res.json();
        if (res.ok && data.documentos) {
            data.documentos.forEach(doc => {
                // Encontra a categoria correspondente para posicionar o arquivo perto dela
                const pai = nodes.find(n => n.id === doc.categoria);
                const angle = Math.random() * Math.PI * 2;
                const dist = 70 + Math.random() * 40;
                
                const fileNode = {
                    id: doc.id,
                    x: pai.x + Math.cos(angle) * dist,
                    y: pai.y + Math.sin(angle) * dist,
                    vx: 0, vy: 0,
                    r: 12,
                    label: doc.nome_arquivo,
                    type: "file",
                    color: "#1877F2",
                    meta: doc.data_criacao
                };
                
                nodes.push(fileNode);
                connections.push({ from: doc.categoria, to: doc.id, color: "rgba(24, 119, 242, 0.4)" });
            });
        }
    } catch (err) {
        console.error("Erro ao buscar base de dados do mapa mental:", err);
    }
    
    // Inicia a animação do loop Canvas
    if (animFrameId) cancelAnimationFrame(animFrameId);
    loopAnimacaoCanvas();
}

// --- LOOP DE ANIMAÇÃO COM FÍSICA E PARTÍCULAS ---
function loopAnimacaoCanvas() {
    aplicarFisicaEForcas();
    desenharCanvas();
    animFrameId = requestAnimationFrame(loopAnimacaoCanvas);
}

function aplicarFisicaEForcas() {
    const k = 0.035;       // Constante de atração da mola
    const repulsao = 1800; // Força de repulsão entre nós satélites
    
    // 1. Calcula as forças da mola para todas as conexões
    connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return;
        
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Distância de repouso depende do tipo de conexão
        const restLength = fromNode.type === "center" ? 140 : 80;
        
        const force = k * (dist - restLength);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        // Nós centrais não se movem facilmente
        if (fromNode.type !== "center" && fromNode !== draggedNode) {
            fromNode.vx += fx * 0.4;
            fromNode.vy += fy * 0.4;
        }
        if (toNode !== draggedNode) {
            toNode.vx -= fx * 0.4;
            toNode.vy -= fy * 0.4;
        }
    });
    
    // 2. Calcula a repulsão entre todos os nós satélites para não se atropelarem
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (dist < 150) {
                const force = repulsao / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                if (n1.type !== "center" && n1 !== draggedNode) {
                    n1.vx -= fx;
                    n1.vy -= fy;
                }
                if (n2.type !== "center" && n2 !== draggedNode) {
                    n2.vx += fx;
                    n2.vy += fy;
                }
            }
        }
    }
    
    // 3. Atualiza as posições aplicando amortecimento
    nodes.forEach(node => {
        if (node === draggedNode) return;
        if (node.type === "center") {
            // Segura o centro no meio do canvas
            node.x = canvas.width / 2;
            node.y = canvas.height / 2;
            return;
        }
        
        node.vx *= 0.85; // Amortecimento de velocidade
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;
        
        // Mantém dentro das bordas do Canvas
        node.x = Math.max(node.r + 10, Math.min(canvas.width - node.r - 10, node.x));
        node.y = Math.max(node.r + 10, Math.min(canvas.height - node.r - 10, node.y));
    });
    
    // 4. Cria e atualiza as partículas de luz correndo nas conexões
    if (Math.random() < 0.08) { // Chance de disparar impulso elétrico
        const conn = connections[Math.floor(Math.random() * connections.length)];
        const from = nodes.find(n => n.id === conn.from);
        const to = nodes.find(n => n.id === conn.to);
        if (from && to) {
            particles.push({
                fx: from.x, fy: from.y,
                tx: to.x, ty: to.y,
                progress: 0,
                speed: 0.015 + Math.random() * 0.01,
                color: conn.color
            });
        }
    }
    
    particles.forEach((p, idx) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
            particles.splice(idx, 1);
        }
    });
}

function desenharCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 0. Desenha partículas ambientes (Background Neural)
    if (typeof ambientParticles !== 'undefined') {
        ambientParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0, 229, 255, 0.3)";
            ctx.fill();
        });
        
        // Linhas ambientes
        for (let i = 0; i < ambientParticles.length; i++) {
            for (let j = i + 1; j < ambientParticles.length; j++) {
                const dx = ambientParticles[i].x - ambientParticles[j].x;
                const dy = ambientParticles[i].y - ambientParticles[j].y;
                const dist = dx * dx + dy * dy;
                if (dist < 15000) {
                    ctx.beginPath();
                    ctx.moveTo(ambientParticles[i].x, ambientParticles[i].y);
                    ctx.lineTo(ambientParticles[j].x, ambientParticles[j].y);
                    ctx.strokeStyle = `rgba(24, 119, 242, ${1 - dist/15000})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }
    
    // 1. Desenha as conexões (linhas de sinapse)
    connections.forEach(conn => {
        const from = nodes.find(n => n.id === conn.from);
        const to = nodes.find(n => n.id === conn.to);
        if (!from || !to) return;
        
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = conn.color;
        ctx.lineWidth = from.type === "center" ? 2 : 1;
        ctx.stroke();
    });
    
    // 2. Desenha as partículas elétricas (sinapses brilhantes)
    particles.forEach(p => {
        const x = p.fx + (p.tx - p.fx) * p.progress;
        const y = p.fy + (p.ty - p.fy) * p.progress;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0; // Reseta sombra
    });
    
    // 3. Desenha os nós (neurônios) com estilo tecnológico
    nodes.forEach(node => {
        ctx.beginPath();
        
        if (node.type === "center") {
            const pulse = 1 + Math.sin(Date.now() / 300) * 0.08;
            
            // Anel externo rodando
            const angleOffset = Date.now() / 1000;
            ctx.setLineDash([10, 15]);
            ctx.arc(node.x, node.y, (node.r * pulse) + 12, angleOffset, Math.PI * 2 + angleOffset);
            ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Glow e preenchimento escuro com borda brilhante
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
            ctx.shadowBlur = 20;
            ctx.shadowColor = "rgba(0, 229, 255, 0.6)";
            ctx.fillStyle = "#020810";
            ctx.fill();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#00E5FF";
            ctx.stroke();
            ctx.shadowBlur = 0;
            
        } else {
            // Nós de categorias e arquivos
            ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            ctx.shadowBlur = 15;
            ctx.shadowColor = node.color;
            ctx.fillStyle = "#0A0A0E";
            ctx.fill();
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = node.color;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        // Detalhe de luz dentro do neurônio se selecionado
        if (selectedNode === node) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r + 6, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0, 229, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // 4. Texto dos Nós
        ctx.font = node.type === "center" ? "bold 13px Outfit" : "500 11px Inter";
        ctx.fillStyle = node.type === "center" ? "#ffffff" : "#D4D4D8";
        ctx.textAlign = "center";
        
        // Corta textos de arquivos que forem muito grandes no Canvas
        let label = node.label;
        if (node.type === "file" && label.length > 15) {
            label = label.substring(0, 12) + "...";
        }
        
        ctx.fillText(label, node.x, node.y + node.r + 18);
    });
}

// --- EVENTOS DO CANVAS ---
function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Encontra se algum nó foi clicado
    draggedNode = nodes.find(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx * dx + dy * dy) < node.r;
    });
    
    if (draggedNode) {
        offset.x = x - draggedNode.x;
        offset.y = y - draggedNode.y;
    }
}

function onMouseMove(e) {
    if (!draggedNode) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Atualiza a posição do nó arrastado
    if (draggedNode.type !== "center") { // Não permite arrastar o centro
        draggedNode.x = x - offset.x;
        draggedNode.y = y - offset.y;
    }
}

function onMouseUp() {
    draggedNode = null;
}

function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Procura por nó sob o mouse
    const clickedNode = nodes.find(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx * dx + dy * dy) < node.r;
    });
    
    if (clickedNode) {
        selectedNode = clickedNode;
        
        if (clickedNode.type === "category") {
            // Abre o prompt de upload de arquivo para este neurônio de categoria
            uploadCategoryTarget = clickedNode.id;
            neuralFileInput.click();
            neuralNodeBalloon.style.display = "none";
        } 
        else if (clickedNode.type === "file") {
            // Abre o balão de exclusão ao lado do arquivo
            balloonFilename.textContent = clickedNode.label;
            balloonMeta.textContent = `Enviado em: ${clickedNode.meta || "Recente"}`;
            
            // Posiciona o balão próximo ao nó no Canvas
            neuralNodeBalloon.style.left = `${clickedNode.x + 15}px`;
            neuralNodeBalloon.style.top = `${clickedNode.y - 15}px`;
            neuralNodeBalloon.style.display = "block";
            e.stopPropagation();
        } else {
            neuralNodeBalloon.style.display = "none";
        }
    } else {
        selectedNode = null;
        neuralNodeBalloon.style.display = "none";
    }
}

// --- ENVIO DO PDF PARA O BANCO DE DADOS PELO CANVAS ---
let activeXhr = null;

function initUploadWidgetControls() {
    const btnMinimize = document.getElementById("btn-minimize-widget");
    const btnClose = document.getElementById("btn-close-widget");
    const widget = document.getElementById("upload-progress-widget");
    const minimizedIcon = document.getElementById("upload-minimized-icon");

    btnMinimize.addEventListener("click", () => {
        widget.style.display = "none";
        minimizedIcon.style.display = "flex";
    });

    minimizedIcon.addEventListener("click", () => {
        minimizedIcon.style.display = "none";
        widget.style.display = "flex";
    });

    btnClose.addEventListener("click", () => {
        if (activeXhr) {
            activeXhr.abort();
            activeXhr = null;
        }
        widget.style.display = "none";
        minimizedIcon.style.display = "none";
    });
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !uploadCategoryTarget) return;

    const widget = document.getElementById("upload-progress-widget");
    const minimizedIcon = document.getElementById("upload-minimized-icon");
    const filenameLabel = document.getElementById("widget-filename");
    const progressFill = document.getElementById("widget-progress-fill");
    const statusText = document.getElementById("widget-status-text");
    const percentageText = document.getElementById("widget-percentage");
    const minimizedProgressText = document.getElementById("minimized-progress-text");

    filenameLabel.textContent = file.name;
    progressFill.style.width = "0%";
    progressFill.classList.remove("processing", "success");
    statusText.textContent = "Iniciando upload...";
    percentageText.textContent = "0%";
    minimizedProgressText.textContent = "0%";

    widget.style.display = "flex";
    minimizedIcon.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("categoria", uploadCategoryTarget);

    neuralFileInput.value = ""; // Limpa input

    const xhr = new XMLHttpRequest();
    activeXhr = xhr;

    xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = `${percentComplete}%`;
            percentageText.textContent = `${percentComplete}%`;
            minimizedProgressText.textContent = `${percentComplete}%`;
            statusText.textContent = `Enviando: ${percentComplete}%`;
        }
    });

    xhr.addEventListener("load", () => {
        activeXhr = null;
        if (xhr.status >= 200 && xhr.status < 300) {
            statusText.textContent = "Processando e Integrando...";
            progressFill.classList.add("processing");
            
            try {
                // Aguarda 1.2s para o usuário ver o "sucesso"
                setTimeout(() => {
                    progressFill.classList.remove("processing");
                    progressFill.classList.add("success");
                    statusText.textContent = "Treinamento integrado!";
                    percentageText.textContent = "OK";
                    minimizedProgressText.textContent = "OK";
                    
                    setTimeout(() => {
                        widget.style.display = "none";
                        minimizedIcon.style.display = "none";
                        carregarEConstruirRedeNeural();
                    }, 1500);
                }, 1200);
            } catch (err) {
                exibirErroUpload("Resposta inválida.");
            }
        } else {
            let errorMsg = "Erro no processamento.";
            try {
                const data = JSON.parse(xhr.responseText);
                errorMsg = data.error || errorMsg;
            } catch(e){}
            exibirErroUpload(errorMsg);
        }
    });

    xhr.addEventListener("error", () => {
        activeXhr = null;
        exibirErroUpload("Conexão interrompida.");
    });

    xhr.addEventListener("abort", () => {
        activeXhr = null;
    });

    xhr.open("POST", "/api/conhecimento/upload");
    xhr.send(formData);
}

function exibirErroUpload(msg) {
    const progressFill = document.getElementById("widget-progress-fill");
    const statusText = document.getElementById("widget-status-text");
    const percentageText = document.getElementById("widget-percentage");
    
    progressFill.classList.remove("processing");
    progressFill.style.width = "100%";
    progressFill.style.backgroundColor = "#EF4444";
    statusText.textContent = `Erro: ${msg}`;
    percentageText.textContent = "Erro";
}
