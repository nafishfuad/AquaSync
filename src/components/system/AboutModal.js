// src/components/system/AboutModal.js

export function renderAboutModal() {
    // 1. Remove any old modal to prevent duplicates
    const existing = document.getElementById("about-modal-wrapper");
    if (existing) existing.remove();

    // 2. Detect current theme dynamically
    const isLight = document.body.classList.contains("light-theme");

    // 3. Dynamic Tailwind classes based on the theme
    const bgClass = isLight ? "bg-white border-slate-200" : "bg-cardbg border-gray-800";
    const textMain = isLight ? "text-slate-800" : "text-white";
    const textMuted = isLight ? "text-slate-500" : "text-gray-400";
    const textTiny = isLight ? "text-slate-400" : "text-gray-500";
    const iconBg = isLight ? "bg-slate-100 border-slate-200" : "bg-gray-800 border-gray-700";
    const btnBg = isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700" : "bg-[#121212] hover:bg-gray-800 border-gray-700 text-gray-300";
    const borderDivider = isLight ? "border-slate-200" : "border-gray-800";

    // 4. Create the dedicated wrapper
    const modal = document.createElement("div");
    modal.id = "about-modal-wrapper";
    modal.className = "fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in pointer-events-auto";
    
    // 5. Inject the HTML
    modal.innerHTML = `
        <div class="rounded-3xl p-6 shadow-2xl border ${bgClass} w-full max-w-sm relative overflow-hidden transform transition-all animate-slide-up-in">
            <div class="absolute -top-16 -right-16 w-32 h-32 bg-aqua opacity-10 rounded-full blur-3xl pointer-events-none"></div>

            <div class="flex flex-col items-center text-center relative z-10">
                <div class="w-16 h-16 ${iconBg} rounded-full flex items-center justify-center text-3xl mb-4 border shadow-inner">
                    🌊
                </div>
                <h2 class="text-xl font-bold ${textMain} tracking-wider">AquaSync</h2>
                <p class="text-[10px] text-aqua font-semibold tracking-widest uppercase mb-4">Precision Automation</p>
                
                <p class="text-[11px] ${textMuted} leading-relaxed mb-6 px-2">
                    AquaSync provides pro-grade management of your aquarium's vital systems. By automating lighting cycles, CO2 injection, and surface cooling, this system ensures consistent environmental stability.
                </p>

                <div class="w-full border-t ${borderDivider} pt-5 mb-6">
                    <h3 class="text-[10px] uppercase ${textTiny} font-semibold mb-4 tracking-widest">Developed By</h3>
                    <div class="flex items-center justify-center">
                        <div class="w-10 h-10 ${iconBg} rounded-full flex items-center justify-center text-lg mr-3 border">👨‍💻</div>
                        <div class="text-left">
                            <p class="${textMain} font-bold text-sm tracking-wide">Nafish Fuad</p>
                            <p class="text-[9px] ${textTiny} uppercase tracking-wider mt-0.5">Coded by Gemini — bugs are features.</p>
                        </div>
                    </div>
                </div>

                <button id="btn-close-about" class="w-full ${btnBg} font-bold py-3.5 rounded-xl text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-sm">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 6. Close logic removes only this specific div!
    const close = () => {
        modal.remove();
    };

    document.getElementById("btn-close-about").onclick = close;
    
    modal.onclick = (e) => {
        if (e.target.id === 'about-modal-wrapper') close();
    };
}