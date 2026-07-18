// src/components/system/Connection.js

/**
 * Renders the live Wi-Fi connection and Cloud status engine card
 * @param {HTMLElement} container - The slot element to append into
 * @param {Object} networkState - The network metadata from the store
 * @param {Function} onDisconnect - Callback to trigger a Wi-Fi reset
 */
export function renderConnection(container, networkState, onDisconnect) {
    const div = document.createElement('div');
    div.className = "bg-cardbg border border-gray-800 rounded-2xl p-5 shadow-lg animate-fade-in";
    
    // Determine configuration values from our reactive state store
    const isConnected = networkState.isWiFiConnected;
    const currentSsid = networkState.ssid || "Connected via Cloud";
    
    const badgeColor = isConnected ? "text-aqua bg-aqua/10 border-aqua/20" : "text-amber-400 bg-amber-400/10 border-amber-400/20";
    const statusText = isConnected ? "Global Cloud Mode" : "Local Hotspot Mode";
    const pingIndicatorColor = isConnected ? "bg-aqua" : "bg-amber-400";

    div.innerHTML = `
        <div class="flex items-center justify-between mb-5">
            <div>
                <p class="text-[10px] ${badgeColor} uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border inline-block mb-1">
                    ${statusText}
                </p>
                <p class="text-xl text-white font-medium tracking-wide mt-1">${currentSsid}</p>
            </div>
            <div class="w-12 h-12 bg-[#121212] rounded-full flex items-center justify-center border border-gray-800">
                <span class="relative flex h-3 w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${pingIndicatorColor} opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 ${pingIndicatorColor}"></span>
                </span>
            </div>
        </div>
        <p class="text-xs text-gray-500 mb-5 leading-relaxed">
            Your AquaSync controller automatically synchronizes internal clocks via global NTP network servers when connected to the internet.
        </p>
        <button id="btn-forget-wifi" class="w-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white font-bold py-3.5 rounded-xl text-[11px] uppercase tracking-widest transition-all active:scale-95">
            Disconnect & Reset Wi-Fi
        </button>
    `;

    // Bind event execution to the forget button
    div.querySelector("#btn-forget-wifi").onclick = onDisconnect;

    container.appendChild(div);
}