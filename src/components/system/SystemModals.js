// src/components/system/SystemModals.js

export function showSystemActionModal(type, deviceName, onConfirm) {
    const slot = document.getElementById("slot-global-overlays");
    if (!slot) return;

    const isReset = type === 'reset';
    const title = isReset ? 'Factory Reset' : 'System Reboot';
    const icon = isReset ? '🧨' : '🔄';
    const desc = isReset 
        ? `Are you absolutely sure? This will wipe all Wi-Fi credentials, schedules, and analytics from <span class="text-white font-bold">${deviceName}</span>. It will be permanently removed from this app.`
        : `Are you sure you want to reboot <span class="text-white font-bold">${deviceName}</span>? The lights and relays will briefly reset.`;
    const btnText = isReset ? 'Yes, Wipe Device' : 'Yes, Reboot';

    // Safe styling classes to ensure Tailwind compiles them correctly
    const glowClass = isReset ? 'bg-red-500/20' : 'bg-amber-500/20';
    const iconBorder = isReset ? 'border-red-500/30' : 'border-amber-500/30';
    const iconShadow = isReset ? 'shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'shadow-[0_0_15px_rgba(245,158,11,0.2)]';
    const confirmBtnClass = isReset 
        ? 'bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white' 
        : 'bg-amber-500/10 border-amber-500/50 text-amber-400 hover:bg-amber-500 hover:text-white';

    // Detect light/dark theme for the modal background
    const isLight = document.body.classList.contains("light-theme");
    const bgClass = isLight ? 'bg-white border-slate-200' : 'bg-cardbg border-gray-800';
    const titleClass = isLight ? 'text-slate-900' : 'text-white';

    slot.innerHTML = `
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[500] px-4 animate-fade-in" id="system-action-overlay">
            <div class="${bgClass} border rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
                
                <div class="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 ${glowClass} blur-3xl rounded-full pointer-events-none"></div>

                <div class="flex flex-col items-center text-center relative z-10">
                    <div class="w-16 h-16 bg-[#121212] border ${iconBorder} rounded-2xl flex items-center justify-center text-3xl mb-4 ${iconShadow}">
                        ${icon}
                    </div>
                    
                    <h2 class="text-xl font-bold ${titleClass} tracking-wide mb-2">${title}</h2>
                    <p class="text-xs text-gray-400 leading-relaxed mb-8 px-2">${desc}</p>

                    <div class="flex gap-3 w-full">
                        <button id="btn-modal-cancel" class="flex-1 bg-[#121212] border border-gray-700 hover:bg-gray-800 text-gray-300 font-bold py-3.5 rounded-xl text-[11px] uppercase tracking-wider transition-all active:scale-95">
                            Cancel
                        </button>
                        <button id="btn-modal-confirm" class="flex-1 border ${confirmBtnClass} font-bold py-3.5 rounded-xl text-[11px] uppercase tracking-wider transition-all active:scale-95">
                            ${btnText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    slot.classList.remove("hidden");
    slot.classList.add("flex");

    const close = () => {
        slot.classList.add("hidden");
        slot.classList.remove("flex");
        slot.innerHTML = "";
    };

    document.getElementById("btn-modal-cancel").onclick = close;
    
    // Close if clicking the background blur
    document.getElementById("system-action-overlay").onclick = (e) => {
        if (e.target.id === 'system-action-overlay') close();
    };

    document.getElementById("btn-modal-confirm").onclick = () => {
        close();
        onConfirm(); // Execute the actual API call and UI updates
    };
}