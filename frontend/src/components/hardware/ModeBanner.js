// src/components/hardware/ModeBanner.js

export function renderModeBanner(container, isAutoMode, onToggle) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 mb-6 shadow-lg border border-gray-800 flex items-center justify-between transition-all";
    
    // UI logic based on current mode
    const icon = isAutoMode ? "🤖" : "🖐️";
    const title = isAutoMode ? "Auto Mode" : "Manual Override";
    const titleColor = isAutoMode ? "text-aqua" : "text-amber-400";
    const subtitle = isAutoMode ? "FOLLOWING SCHEDULE" : "HARDWARE LOCKED";
    
    const btnText = isAutoMode ? "SET MANUAL" : "RESUME AUTO";
    const btnClass = isAutoMode 
        ? "bg-[#121212] text-gray-400 border border-gray-700 hover:text-white" 
        : "bg-aqua/10 text-aqua border border-aqua/50 shadow-[0_0_15px_rgba(0,242,254,0.15)]";

    div.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="text-3xl drop-shadow-md">${icon}</div>
            <div>
                <h3 class="${titleColor} font-bold text-sm tracking-wide">${title}</h3>
                <p class="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">${subtitle}</p>
            </div>
        </div>
        <button id="btn-toggle-mode" class="px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 ${btnClass}">
            ${btnText}
        </button>
    `;

    div.querySelector('#btn-toggle-mode').onclick = () => {
        onToggle(!isAutoMode);
    };

    container.appendChild(div);
}