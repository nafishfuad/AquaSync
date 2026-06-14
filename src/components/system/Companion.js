// src/components/system/Companion.js

export function renderCompanionApp(container, device) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800";
    
    const currentAppVer = device.companion?.current || "v1.0.0";
    const latestAppVer = device.companion?.latest || "Unknown";
    const dlUrl = device.companion?.downloadUrl || "";

    // 🔥 THE FIX: Detect if we are offline and style the button dynamically
    const isOffline = latestAppVer === "Unknown" || latestAppVer === "Checking...";
    const btnStyle = isOffline 
        ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-70"
        : "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white shadow-[0_0_15px_rgba(59,130,246,0.15)]";
    const btnText = isOffline ? "Unavailable Offline" : "Download APK";

    div.innerHTML = `
        <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide mb-4">Companion App</h2>
        
        <div class="flex justify-between text-[10px] text-gray-400 mb-4 bg-[#121212] p-3 rounded-xl border border-gray-800 shadow-inner">
            <span>Current: <span class="text-white font-bold tracking-wider">${currentAppVer}</span></span>
            <span>Latest: <span class="${isOffline ? 'text-gray-500' : 'text-aqua'} font-bold tracking-wider">${latestAppVer}</span></span>
        </div>

        <p class="text-[10px] text-gray-500 mb-5 leading-relaxed">
            For the most reliable connection, faster pairing, and offline support, use the official AquaSync Android App.
        </p>

        <button id="btn-download-app" class="w-full font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 ${btnStyle}" ${isOffline ? 'disabled' : ''}>
            ${btnText}
        </button>
    `;

    const btn = div.querySelector('#btn-download-app');
    if (btn && !isOffline) {
        btn.onclick = () => {
            if (dlUrl) window.open(dlUrl, '_blank');
        };
    }

    container.appendChild(div);
}