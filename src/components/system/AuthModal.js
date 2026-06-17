// src/components/system/AuthModal.js

import { IdentityStore } from '../../state.js';

export function initAuthModal() {
    window.openAuthModal = () => renderAuthModal();
}

function renderAuthModal() {
    // 1. Remove existing to prevent duplicates
    const existing = document.getElementById("auth-modal-wrapper");
    if (existing) existing.remove();

    const isLight = document.body.classList.contains("light-theme");
    const bgClass = isLight ? "bg-white border-slate-200" : "bg-cardbg border-gray-800";
    const textMain = isLight ? "text-slate-800" : "text-white";
    const textMuted = isLight ? "text-slate-500" : "text-gray-400";
    const inputBg = isLight ? "bg-slate-50 border-slate-200 text-slate-800 focus:border-aqua focus:bg-white" : "bg-[#121212] border-gray-700 text-white focus:border-aqua";

    const modal = document.createElement('div');
    modal.id = "auth-modal-wrapper";
    modal.className = "fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999] animate-fade-in px-4 pointer-events-auto";

    modal.innerHTML = `
        <div class="${bgClass} rounded-3xl p-6 shadow-2xl border w-full max-w-sm relative overflow-hidden flex flex-col transition-colors">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-sm uppercase ${textMuted} font-bold tracking-wider" id="auth-title">Cloud Login</h2>
                <button id="btn-close-auth" class="${textMuted} hover:text-red-400 text-3xl p-2 -mr-2 leading-none transition-colors cursor-pointer z-50">&times;</button>
            </div>

            <div id="auth-alert" class="hidden mb-4 p-3 rounded-xl text-xs font-bold border"></div>

            <form id="auth-form" class="space-y-4">
                <div>
                    <label class="block text-[10px] ${textMuted} uppercase tracking-wider mb-2 ml-1">Email Address</label>
                    <input type="email" id="auth-email" required placeholder="you@example.com" class="w-full ${inputBg} rounded-xl px-4 py-3.5 outline-none transition-colors text-sm" />
                </div>
                <div id="wrapper-password">
                    <label class="block text-[10px] ${textMuted} uppercase tracking-wider mb-2 ml-1">Password</label>
                    <input type="password" id="auth-password" placeholder="••••••••" class="w-full ${inputBg} rounded-xl px-4 py-3.5 outline-none transition-colors text-sm" />
                </div>

                <button type="submit" id="btn-auth-submit" class="w-full bg-aqua text-black font-bold py-4 rounded-xl uppercase tracking-widest text-xs transition-all active:scale-95 shadow-[0_0_15px_rgba(0,242,254,0.2)] mt-2">
                    Sign In
                </button>
            </form>

            <div class="mt-6 flex flex-col space-y-3 text-center">
                <button id="btn-toggle-mode" class="text-xs ${textMuted} hover:${textMain} font-semibold transition-colors">Create a new account</button>
                <button id="btn-forgot-pass" class="text-[10px] text-aqua/70 hover:text-aqua font-bold uppercase tracking-wider transition-colors">Forgot Password?</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    let mode = 'login'; // 'login', 'signup', 'reset'
    
    const form = modal.querySelector('#auth-form');
    const emailInp = modal.querySelector('#auth-email');
    const passInp = modal.querySelector('#auth-password');
    const passWrapper = modal.querySelector('#wrapper-password');
    const btnSubmit = modal.querySelector('#btn-auth-submit');
    const btnToggle = modal.querySelector('#btn-toggle-mode');
    const btnForgot = modal.querySelector('#btn-forgot-pass');
    const title = modal.querySelector('#auth-title');
    const alertBox = modal.querySelector('#auth-alert');

    const showAlert = (msg, isError = true) => {
        alertBox.className = `mb-4 p-3 rounded-xl text-xs font-bold border ${isError ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`;
        alertBox.innerText = msg;
        alertBox.classList.remove('hidden');
    };

    const updateUI = () => {
        alertBox.classList.add('hidden');
        if (mode === 'login') {
            title.innerText = "Cloud Login";
            passWrapper.classList.remove('hidden');
            passInp.required = true;
            btnSubmit.innerText = "Sign In";
            btnToggle.innerText = "Create a new account";
            btnToggle.classList.remove('hidden');
            btnForgot.classList.remove('hidden');
        } else if (mode === 'signup') {
            title.innerText = "Register Account";
            passWrapper.classList.remove('hidden');
            passInp.required = true;
            btnSubmit.innerText = "Create Account";
            btnToggle.innerText = "Already have an account? Sign In";
            btnToggle.classList.remove('hidden');
            btnForgot.classList.add('hidden');
        } else if (mode === 'reset') {
            title.innerText = "Reset Password";
            passWrapper.classList.add('hidden');
            passInp.required = false;
            btnSubmit.innerText = "Send Reset Link";
            btnToggle.innerText = "Back to Login";
            btnToggle.classList.remove('hidden');
            btnForgot.classList.add('hidden');
        }
    };

    btnToggle.onclick = () => {
        mode = mode === 'login' ? 'signup' : 'login';
        updateUI();
    };

    btnForgot.onclick = () => {
        mode = 'reset';
        updateUI();
    };

    modal.querySelector('#btn-close-auth').onclick = () => modal.remove();

    form.onsubmit = async (e) => {
        e.preventDefault();
        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerText;
        btnSubmit.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Processing...`;
        alertBox.classList.add('hidden');

        const email = emailInp.value.trim();
        const password = passInp.value;

        if (mode === 'login') {
            const res = await IdentityStore.login(email, password);
            if (res.success) {
                modal.remove();
                window.location.reload(); 
            } else {
                showAlert(res.message);
            }
        } else if (mode === 'signup') {
            const res = await IdentityStore.signup(email, password);
            if (res.success) {
                showAlert("Account created! Please check your email to verify your address before logging in.", false);
                mode = 'login';
                updateUI();
                emailInp.value = "";
                passInp.value = "";
            } else {
                showAlert(res.message);
            }
        } else if (mode === 'reset') {
            const res = await IdentityStore.resetPassword(email);
            showAlert(res.message, !res.success);
            if (res.success) {
                setTimeout(() => { mode = 'login'; updateUI(); }, 3000);
            }
        }

        btnSubmit.disabled = false;
        btnSubmit.innerText = originalText;
    };
}