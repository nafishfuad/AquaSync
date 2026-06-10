// src/components/system/AboutModal.js

export function renderAboutModal() {
    const slot = document.getElementById("slot-global-overlays");
    if (!slot) return;

    slot.innerHTML = `
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] px-4 animate-fade-in" id="about-overlay">
            <div class="bg-[#1a1a1a] rounded-3xl p-8 shadow-2xl border border-gray-800 w-full max-w-sm relative flex flex-col items-center text-center">
                
                <button type="button" id="btn-close-about" class="absolute top-2 right-2 w-12 h-12 flex items-center justify-center text-gray-500 hover:text-white text-3xl transition-colors z-[500] cursor-pointer">&times;</button>

                <div class="w-20 h-20 bg-gradient-to-br from-aqua to-blue-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,242,254,0.3)] mb-4">
                    <span class="text-4xl text-white">🌊</span>
                </div>

                <h2 class="text-xl font-bold text-white tracking-wide">AquaControl Pro</h2>
                <p class="text-[10px] text-aqua font-bold uppercase tracking-widest mb-6">Version 1.0.0</p>

                <p class="text-xs text-gray-400 leading-relaxed mb-8 border-b border-gray-800 pb-8">
                    Precision hardware and software engineered to automate your planted tank. Built with an ESP32-C3 core, featuring seamless load-shedding recovery and cinematic dimming logic.
                </p>

                <p class="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-4">Developed By</p>

                <div class="flex items-center gap-4 bg-[#121212] px-4 py-3 rounded-2xl border border-gray-800/50 w-full">
                    <div class="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-lg">👨‍💻</div>
                    <div class="text-left">
                        <p class="text-sm font-bold text-white tracking-wide">Nafish Fuad</p>
                        <p class="text-[8px] text-gray-500 uppercase tracking-widest">Engineered in Dhaka, Bangladesh</p>
                    </div>
                </div>

            </div>
        </div>
    `;

    slot.classList.remove("hidden");
    slot.classList.add("flex");

    const closeHandler = (e) => {
        if (e) e.stopPropagation(); // Prevent clicks from bleeding through
        slot.classList.add("hidden");
        slot.classList.remove("flex");
        slot.innerHTML = "";
    };

    // FIX: Bind explicitly to the DOM after injection
    document.getElementById("btn-close-about").addEventListener('click', closeHandler);
    
    // Close if clicking outside the modal
    document.getElementById("about-overlay").addEventListener('click', (e) => {
        if (e.target.id === 'about-overlay') closeHandler(e);
    });
}