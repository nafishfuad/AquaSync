// src/components/system/OutageModal.js

export function showOutageModal(title, subtitle, houseOutageText, lostLightText) {
    // 1. Remove any old modal to prevent duplicates
    const existingModal = document.getElementById("custom-outage-modal");
    if (existingModal) existingModal.remove();

    // 2. Create the beautifully designed modal
    const modal = document.createElement("div");
    modal.id = "custom-outage-modal";
    modal.className = "fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-300 opacity-0 pointer-events-auto";
    
    modal.innerHTML = `
        <div class="bg-cardbg border border-gray-700 w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300" id="custom-outage-content">
            
            <div class="p-6 border-b border-gray-800/50 bg-gradient-to-br from-red-900/20 to-transparent flex items-center space-x-4">
                <div class="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    <svg class="w-6 h-6 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <div>
                    <h3 class="text-white font-bold text-lg tracking-wide leading-tight">${title}</h3>
                    <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">${subtitle}</p>
                </div>
            </div>
            
            <div class="p-6 space-y-4 bg-black/10">
                <div class="flex justify-between items-center bg-black/30 p-3.5 rounded-xl border border-white/5">
                    <div class="flex items-center space-x-2.5">
                        <span class="text-lg">🔌</span>
                        <span class="text-xs text-gray-400 uppercase tracking-wider font-bold">House Outage</span>
                    </div>
                    <span class="text-red-400 font-bold">${houseOutageText}</span>
                </div>
                
                <div class="flex justify-between items-center bg-black/30 p-3.5 rounded-xl border border-white/5">
                    <div class="flex items-center space-x-2.5">
                        <span class="text-lg">☀️</span>
                        <span class="text-xs text-gray-400 uppercase tracking-wider font-bold">Lost Light</span>
                    </div>
                    <span class="text-amber-400 font-bold">${lostLightText}</span>
                </div>
            </div>
            
            <div class="p-4 border-t border-gray-800/50 bg-[#1a1a1a]/50">
                <button id="btn-close-custom-modal" class="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 border border-white/5 shadow-md">Close Report</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    // 3. Animate it onto the screen smoothly
    setTimeout(() => {
        modal.classList.remove("opacity-0");
        document.getElementById("custom-outage-content").classList.remove("scale-95");
    }, 10);

    // 4. Close logic
    document.getElementById("btn-close-custom-modal").onclick = () => {
        modal.classList.add("opacity-0");
        document.getElementById("custom-outage-content").classList.add("scale-95");
        setTimeout(() => modal.remove(), 300); // Wait for fade out animation
    };
}