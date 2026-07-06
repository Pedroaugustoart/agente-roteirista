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
const btnGenerateScript = document.getElementById("btn-generate-script");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnSendChat = document.getElementById("btn-send-chat");

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
    initSelectors();
    initAuthEvents();
    initFormActions();
    initChatActions();
    initSidebarEvents();
    initTabsEvents();
    initVoiceRecognition();
    initTextToSpeech();
    initPDFExport();
    
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

// --- SELETORES DA PÁGINA ÚNICA ---
function initSelectors() {
    const options = document.querySelectorAll("#platform-selector .platform-option");
    options.forEach(opt => {
        opt.addEventListener("click", () => {
            options.forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            briefingData.plataforma = opt.getAttribute("data-val");
        });
    });

    const focusBtns = document.querySelectorAll("#focus-selector .focus-btn");
    focusBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            focusBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            briefingData.tipo = btn.getAttribute("data-val");
        });
    });
}

// --- HISTÓRICO DA SIDEBAR ---
async function carregarHistorico() {
    try {
        const response = await fetch("/api/history");
        const data = await response.json();
        if (response.ok) {
            historyList.innerHTML = "";
            if (data.roteiros.length === 0) {
                historyList.innerHTML = `<p class="empty-state">Nenhum roteiro salvo.</p>`;
                return;
            }
            
            data.roteiros.forEach(item => {
                const card = document.createElement("div");
                card.classList.add("history-item");
                card.setAttribute("data-id", item.id);
                card.innerHTML = `
                    <div class="history-item-title">${item.titulo}</div>
                    <div class="history-item-meta">
                        <span>${item.plataforma}</span>
                        <span>${item.data_criacao}</span>
                    </div>
                `;
                
                card.addEventListener("click", () => carregarRoteiroHistorico(item.id));
                historyList.appendChild(card);
            });
        }
    } catch (err) {
        console.error("Erro ao carregar histórico:", err);
    }
}

async function carregarRoteiroHistorico(id) {
    try {
        document.querySelectorAll(".history-item").forEach(item => {
            if (item.getAttribute("data-id") === id) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        const response = await fetch(`/api/history/${id}`);
        const data = await response.json();
        
        if (response.ok) {
            const rot = data.roteiro;
            preencherInputs(rot.briefing);
            
            activeRoteiroId = rot.id;
            sessionId = "session-" + Math.random().toString(36).substring(2, 9);
            lastGeneratedScript = rot.conteudo;
            
            switchToTab("tab-generator");
            formSection.style.display = "none";
            splitSection.style.display = "flex";
            
            chatMessages.innerHTML = "";
            appendMessage("sistema", "Você carregou um roteiro do histórico. Qualquer mensagem enviada abaixo ajustará este roteiro.");
            exibirRoteiro(rot.conteudo);
            pararAudioLocucao();
        }
    } catch (err) {
        console.error("Erro ao obter roteiro do histórico:", err);
        alert("Erro ao carregar o roteiro.");
    }
}

function preencherInputs(briefing) {
    briefingData = { ...briefing };
    
    document.getElementById("input-ref").value = briefing.referencias || "";
    document.getElementById("input-dur").value = briefing.duracao || "";
    document.getElementById("input-pub").value = briefing.publico || "";
    document.getElementById("input-cta").value = briefing.cta || "";
    document.getElementById("input-obj").value = briefing.objetivo || "";
    document.getElementById("input-prob").value = briefing.mensagem_dor || "";
    
    document.querySelectorAll("#platform-selector .platform-option").forEach(opt => {
        if (opt.getAttribute("data-val") === briefing.plataforma) {
            opt.classList.add("selected");
        } else {
            opt.classList.remove("selected");
        }
    });

    document.querySelectorAll("#focus-selector .focus-btn").forEach(btn => {
        if (btn.getAttribute("data-val") === briefing.tipo) {
            btn.classList.add("selected");
        } else {
            btn.classList.remove("selected");
        }
    });
}

// --- FORMULÁRIO E GERAÇÃO ---
function initFormActions() {
    btnGenerateScript.addEventListener("click", () => {
        if (!briefingData.plataforma) return alert("Por favor, selecione uma plataforma.");
        if (!briefingData.tipo) return alert("Por favor, selecione um foco principal.");
        
        briefingData.referencias = document.getElementById("input-ref").value.trim();
        briefingData.duracao = document.getElementById("input-dur").value.trim();
        briefingData.publico = document.getElementById("input-pub").value.trim();
        briefingData.cta = document.getElementById("input-cta").value.trim();
        briefingData.objetivo = document.getElementById("input-obj").value.trim();
        briefingData.mensagem_dor = document.getElementById("input-prob").value.trim();
        
        if (!briefingData.duracao) return alert("Por favor, informe a duração estimada.");
        if (!briefingData.cta) return alert("Por favor, preencha o CTA do vídeo.");
        if (!briefingData.objetivo) return alert("Por favor, informe o objetivo do vídeo.");
        if (!briefingData.mensagem_dor) return alert("Por favor, informe o problema que o vídeo resolve.");

        gerarNovoRoteiro();
    });
}

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
    scriptViewport.innerHTML = marked.parse(markdownText);
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
        { id: "storytelling", label: "Storytelling", color: "#FF007A", angle: 0 },
        { id: "viral", label: "Viral", color: "#00F0FF", angle: Math.PI / 2 },
        { id: "analise", label: "Análise", color: "#AD00FF", angle: Math.PI },
        { id: "educativo", label: "Educativo", color: "#00FF66", angle: 3 * Math.PI / 2 }
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
                    color: pai.color,
                    meta: doc.data_criacao
                };
                
                nodes.push(fileNode);
                connections.push({ from: doc.categoria, to: doc.id, color: "rgba(255,255,255,0.25)" });
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
    
    // 3. Desenha os nós (neurônios)
    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        
        // Efeito de pulso para o centro
        if (node.type === "center") {
            const pulse = 1 + Math.sin(Date.now() / 400) * 0.06;
            ctx.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
            
            // Gradiente
            const grad = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, node.r);
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.7, "#1c1c24");
            grad.addColorStop(1, "#09090b");
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = "#121218";
        }
        
        ctx.strokeStyle = node.color;
        ctx.lineWidth = node.type === "file" ? 1.5 : 3;
        ctx.fill();
        ctx.stroke();
        
        // Detalhe de luz dentro do neurônio se selecionado
        if (selectedNode === node) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
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
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !uploadCategoryTarget) return;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("categoria", uploadCategoryTarget);
    
    // Limpa o seletor para aceitar o mesmo arquivo depois
    neuralFileInput.value = "";
    
    alert(`Enviando "${file.name}" para treinamento do neurônio de ${uploadCategoryTarget.toUpperCase()}...`);
    
    try {
        const res = await fetch("/api/conhecimento/upload", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        
        if (res.ok) {
            alert("Sucesso! Novo treinamento integrado ao Cérebro Neuronal.");
            // Recarrega e redesenha o cérebro
            carregarEConstruirRedeNeural();
        } else {
            alert(`Erro no upload: ${data.error}`);
        }
    } catch (err) {
        console.error("Erro ao subir arquivo de treinamento:", err);
        alert("Erro na conexão com o servidor ao fazer upload.");
    }
}
