// src/components/system/Companion.js

export function renderCompanionApp(container) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800";
    
    // In reality, you'd fetch this from a manifest, but we'll mock it based on your UI
    const currentAppVer = "v2.0.0";
    const latestAppVer = "v2.0.0";

    div.innerHTML = `
        <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide mb-4">Companion App</h2>
        
        <div class="flex justify-between text-[10px] text-gray-400 mb-4 bg-[#121212] p-3 rounded-xl border border-gray-800 shadow-inner">
            <span>Current: <span class="text-white font-bold tracking-wider">${currentAppVer}</span></span>
            <span>Latest: <span class="text-aqua font-bold tracking-wider">${latestAppVer}</span></span>
        </div>

        <p class="text-[10px] text-gray-500 mb-5 leading-relaxed">
            For the most reliable connection, faster pairing, and offline support, use the official AquaSync Android App.
        </p>

        <button id="btn-download-app" class="w-full bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            Download Android App
        </button>
    `;

    div.querySelector('#btn-download-app').onclick = () => {
        // Replace with your actual APK download URL
        window.open("https://github.com/nafishfuad/Aqua-Fish/releases/latest", "_blank"); 
    };

    container.appendChild(div);
}