// src/components/system/SystemModals.js

export function showSystemActionModal(type, deviceName, onConfirm) {
    const slot = document.getElementById("slot-global-overlays");
    if (!slot) return;

    // 🔥 THE FIX: Elevate the container above the Top Nav
    slot.style.zIndex = "500";

    const isReset = type === 'reset';
    const title = isReset ? 'Factory Reset' : 'System Reboot';
    const icon = isReset ? '🧨' : '🔄';
    const desc = isReset 
        ? `Are you absolutely sure? This will wipe all Wi-Fi credentials, schedules, and analytics from <span class="text-white font-bold">${deviceName}</span>. It will be permanently removed from this app.`
        : `Are you sure you want to reboot <span class="text-white font-bold">${deviceName}</span>? The lights and relays will briefly reset.`;
    const btnText = isReset ? 'Yes, Wipe Device' : 'Yes, Reboot';

    const glowClass = isReset ? 'bg-red-500/20' : 'bg-amber-500/20';
    const iconBorder = isReset ? 'border-red-500/30' : 'border-amber-500/30';
    const iconShadow = isReset ? 'shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'shadow-[0_0_15px_rgba(245,158,11,0.2)]';
    const confirmBtnClass = isReset 
        ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500 hover:text-white' 
        : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-white';

    slot.innerHTML = `
        <div id="system-action-overlay" class="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in pointer-events-auto">
            <div class="bg-cardbg rounded-3xl p-6 shadow-2xl border border-gray-800 w-full max-w-sm relative overflow-hidden transform transition-all animate-slide-up-in">
                <div class="flex flex-col items-center text-center relative z-10">
                    <div class="w-16 h-16 ${glowClass} rounded-full flex items-center justify-center text-3xl mb-4 border ${iconBorder} ${iconShadow}">
                        ${icon}
                    </div>
                    
                    <h2 class="text-xl font-bold text-white tracking-wide mb-2">${title}</h2>
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
        // 🔥 THE FIX: Reset the z-index so the welcome screen works normally again
        slot.style.zIndex = "";
        slot.classList.add("hidden");
        slot.classList.remove("flex");
        slot.innerHTML = "";
    };

    document.getElementById("btn-modal-cancel").onclick = close;
    
    document.getElementById("system-action-overlay").onclick = (e) => {
        if (e.target.id === 'system-action-overlay') close();
    };

    document.getElementById("btn-modal-confirm").onclick = () => {
        const btn = document.getElementById("btn-modal-confirm");
        btn.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Executing...`;
        btn.classList.add("opacity-50", "pointer-events-none");
        document.getElementById("btn-modal-cancel").classList.add("hidden");
        
        onConfirm();
    };
}