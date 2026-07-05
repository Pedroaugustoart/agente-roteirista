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
    
    // Configura o Marked.js para permitir quebras de linhas
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

    // Login
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

    // Cadastro
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
                // Login automático imediato
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

    // Toggle Dropdown Usuário
    btnProfile.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.style.display = userDropdown.style.display === "none" ? "block" : "none";
    });

    document.addEventListener("click", () => {
        userDropdown.style.display = "none";
    });

    // Logout
    btnLogout.addEventListener("click", async () => {
        try {
            const response = await fetch("/api/logout", { method: "POST" });
            if (response.ok) {
                desautenticarUsuarioUI();
                resetForm();
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

// --- SELETORES DA PÁGINA ÚNICA ---
function initSelectors() {
    // Plataformas
    const options = document.querySelectorAll("#platform-selector .platform-option");
    options.forEach(opt => {
        opt.addEventListener("click", () => {
            options.forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            briefingData.plataforma = opt.getAttribute("data-val");
        });
    });

    // Foco Principal
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
        // Marca item como ativo na barra lateral
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
            
            // Popula os dados do briefing na tela caso queira ler
            preencherInputs(rot.briefing);
            
            // Ativa variáveis globais
            activeRoteiroId = rot.id;
            sessionId = "session-" + Math.random().toString(36).substring(2, 9); // Novo id de sessão
            lastGeneratedScript = rot.conteudo;
            
            // Transiciona telas
            formSection.style.display = "none";
            splitSection.style.display = "flex";
            
            // Limpa chat e exibe o roteiro
            chatMessages.innerHTML = "";
            appendMessage("sistema", "Você carregou um roteiro do histórico. Qualquer mensagem enviada abaixo ajustará este roteiro.");
            exibirRoteiro(rot.conteudo);
        }
    } catch (err) {
        console.error("Erro ao obter roteiro do histórico:", err);
        alert("Erro ao carregar o roteiro.");
    }
}

function preencherInputs(briefing) {
    briefingData = { ...briefing };
    
    // Inputs texto
    document.getElementById("input-ref").value = briefing.referencias || "";
    document.getElementById("input-dur").value = briefing.duracao || "";
    document.getElementById("input-pub").value = briefing.publico || "";
    document.getElementById("input-cta").value = briefing.cta || "";
    document.getElementById("input-obj").value = briefing.objetivo || "";
    document.getElementById("input-prob").value = briefing.mensagem_dor || "";
    
    // Seletores plataforma
    document.querySelectorAll("#platform-selector .platform-option").forEach(opt => {
        if (opt.getAttribute("data-val") === briefing.plataforma) {
            opt.classList.add("selected");
        } else {
            opt.classList.remove("selected");
        }
    });

    // Seletores foco
    document.querySelectorAll("#focus-selector .focus-btn").forEach(btn => {
        if (btn.getAttribute("data-val") === briefing.tipo) {
            btn.classList.add("selected");
        } else {
            btn.classList.remove("selected");
        }
    });
}

// --- FORMULÁRIO E CRIAÇÃO ---
function initFormActions() {
    btnGenerateScript.addEventListener("click", () => {
        // Validação
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
    // Muda telas
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
            appendMessage("agent", "Roteiro gerado com sucesso! 🎉 Destaquei as falas na coluna direita. Se precisar mudar alguma parte da locução, me envie uma mensagem no chat.");
            
            // Recarrega o histórico na barra lateral para incluir o novo
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

// --- SIDEBAR E RESETS ---
function initSidebarEvents() {
    btnNewRoteiro.addEventListener("click", () => {
        resetForm();
        formSection.style.display = "block";
        splitSection.style.display = "none";
        
        // Remove item ativo da sidebar
        document.querySelectorAll(".history-item").forEach(item => {
            item.classList.remove("active");
        });
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

// --- AJUDANTES ---
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
