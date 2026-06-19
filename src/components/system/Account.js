// src/components/system/Account.js

import { IdentityStore } from '../../state.js';

export function renderAccount(container) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800 mb-6";

    // 🔥 THE FIX: Use IdentityStore.currentUser instead of IdentityStore.user!
    const user = IdentityStore.currentUser;

    if (user) {
        // User is Logged In
        div.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide">Cloud Account</h2>
                <span class="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Synced</span>
            </div>
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 bg-[#121212] rounded-full border border-gray-700 flex items-center justify-center text-lg">👤</div>
                <div class="overflow-hidden">
                    <p class="text-white font-bold text-sm truncate">${user.email}</p>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Active Session</p>
                </div>
            </div>
            <button id="btn-sign-out" class="w-full bg-[#121212] text-gray-400 border border-gray-700 hover:text-red-400 hover:border-red-900/50 font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm">
                Sign Out
            </button>
        `;

        div.querySelector('#btn-sign-out').onclick = () => {
            if (confirm("Are you sure you want to sign out? You will lose remote cloud access until you sign back in.")) {
                // Ensure this method exactly matches your state.js implementation (logout or signOut)
                if (typeof IdentityStore.logout === 'function') {
                    IdentityStore.logout();
                } else if (typeof IdentityStore.signOut === 'function') {
                    IdentityStore.signOut();
                }
            }
        };
    } else {
        // User is Logged Out
        div.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide">Cloud Account</h2>
                <span class="text-[10px] bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Offline</span>
            </div>
            <p class="text-xs text-gray-400 mb-5 leading-relaxed">
                Sign in to securely sync your ecosystem, enable remote access from anywhere, and back up your tank's analytics.
            </p>
            <button id="btn-sign-in" class="w-full bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500 hover:text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                Log In / Register
            </button>
        `;

        div.querySelector('#btn-sign-in').onclick = () => {
            if (window.openAuthModal) window.openAuthModal();
        };
    }

    container.appendChild(div);
}