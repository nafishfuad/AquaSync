// src/components/hardware/ColorMixer.js
import { showPrompt } from '../system/CustomDialogs.js';

export function renderColorSpectrum(previewSlot, presetsSlot, manualSlot, customSlot, currentSpectrum, customColors, onUpdateHook, onSaveCustomHook, onDeleteCustomHook) {
    // 1. Live Preview Block
    const calcPreviewColor = (w, r, g, b) => {
        // Blends the white channel into the RGB channels to simulate WRGB output
        const mixR = Math.min(255, Math.round((w * 2.55) + (r * 2.55)));
        const mixG = Math.min(255, Math.round((w * 2.55) + (g * 2.55)));
        const mixB = Math.min(255, Math.round((w * 2.55) + (b * 2.55)));
        return `rgb(${mixR}, ${mixG}, ${mixB})`;
    };

    previewSlot.innerHTML = `
        <div id="color-preview-box" class="relative w-full h-24 rounded-2xl shadow-lg border border-gray-800 flex items-center justify-center overflow-hidden transition-all duration-300" style="background-color: ${calcPreviewColor(currentSpectrum.w, currentSpectrum.r, currentSpectrum.g, currentSpectrum.b)}">
            <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
            <span class="relative text-[10px] font-bold text-black uppercase tracking-wider bg-white/50 px-3 py-1 rounded-full backdrop-blur-md">Live Preview</span>
        </div>
    `;

    // 2. Presets Block
    presetsSlot.innerHTML = `
        <div class="bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800">
            <h2 class="text-sm uppercase text-gray-400 font-semibold mb-4">Quick Presets</h2>
            <div class="grid grid-cols-2 gap-3">
                <button id="preset-daylight" class="bg-[#121212] border border-gray-700 hover:border-white rounded-xl py-3 px-2 flex flex-col items-center transition-all active:scale-95">
                    <span class="text-white font-bold mb-1">☀️ Daylight</span>
                    <span class="text-[9px] text-gray-500 uppercase tracking-widest">Balanced Growth</span>
                </button>
                <button id="preset-color" class="bg-[#121212] border border-gray-700 hover:border-red-500 rounded-xl py-3 px-2 flex flex-col items-center transition-all active:scale-95">
                    <span class="text-red-400 font-bold mb-1">🍁 Color Boost</span>
                    <span class="text-[9px] text-gray-500 uppercase tracking-widest">Enhances Reds</span>
                </button>
                <button id="preset-lush" class="bg-[#121212] border border-gray-700 hover:border-green-500 rounded-xl py-3 px-2 flex flex-col items-center transition-all active:scale-95">
                    <span class="text-green-400 font-bold mb-1">🌿 Lush Green</span>
                    <span class="text-[9px] text-gray-500 uppercase tracking-widest">Forest Depth</span>
                </button>
                <button id="preset-moon" class="bg-[#121212] border border-gray-700 hover:border-blue-500 rounded-xl py-3 px-2 flex flex-col items-center transition-all active:scale-95">
                    <span class="text-blue-400 font-bold mb-1">🌙 Moonlight</span>
                    <span class="text-[9px] text-gray-500 uppercase tracking-widest">Deep Blue Night</span>
                </button>
            </div>
        </div>
    `;

    // Attach Preset Listeners
    const applyPreset = (w, r, g, b) => onUpdateHook({ w, r, g, b });
    presetsSlot.querySelector("#preset-daylight").onclick = () => applyPreset(100, 100, 100, 100);
    presetsSlot.querySelector("#preset-color").onclick = () => applyPreset(20, 100, 50, 20);
    presetsSlot.querySelector("#preset-lush").onclick = () => applyPreset(50, 20, 100, 20);
    presetsSlot.querySelector("#preset-moon").onclick = () => applyPreset(0, 0, 0, 40);

    // 3. Manual Mix Block
    const buildSlider = (label, colorClass, value, key) => `
        <div>
            <div class="flex justify-between mb-1">
                <label class="text-[10px] text-gray-400 uppercase tracking-wider font-bold">${label}</label>
                <span class="text-xs ${colorClass} font-bold" id="val-${key}">${value}%</span>
            </div>
            <input type="range" id="slide-${key}" min="0" max="100" value="${value}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
        </div>
    `;

    manualSlot.innerHTML = `
        <div class="bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800 space-y-5">
            <div class="flex justify-between items-center">
                <h2 class="text-sm uppercase text-gray-400 font-semibold flex items-center"><span class="text-white text-lg mr-2">🎚️</span> Manual Mix</h2>
                <button id="btn-save-custom" class="bg-aqua/10 text-aqua border border-aqua/30 hover:bg-aqua hover:text-black rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors active:scale-95">Save Mix</button>
            </div>
            ${buildSlider("White", "text-white", currentSpectrum.w, "w")}
            ${buildSlider("Red", "text-red-500", currentSpectrum.r, "r")}
            ${buildSlider("Green", "text-green-500", currentSpectrum.g, "g")}
            ${buildSlider("Blue", "text-blue-500", currentSpectrum.b, "b")}
        </div>
    `;

    manualSlot.querySelector("#btn-save-custom").onclick = async () => {
        const name = await showPrompt("Save Custom Color", "e.g. Deep Sea Blue");
        if (name && name.trim().length > 0) {
            onSaveCustomHook(name.trim(), currentSpectrum);
        }
    };

    // Attach Slider Listeners
    ['w', 'r', 'g', 'b'].forEach(key => {
        const slider = manualSlot.querySelector(`#slide-${key}`);
        const valText = manualSlot.querySelector(`#val-${key}`);
        
        slider.addEventListener("input", (e) => {
            valText.innerText = `${e.target.value}%`;
            // Live update the preview box purely in the DOM
            const newColors = { ...currentSpectrum, [key]: parseInt(e.target.value) };
            document.getElementById("color-preview-box").style.backgroundColor = calcPreviewColor(newColors.w, newColors.r, newColors.g, newColors.b);
            
            // Push to local IP instantly (fastUI = true)
            onUpdateHook(newColors, true);
        });

        slider.addEventListener("change", (e) => {
            const liveSpectrum = {
                w: parseInt(manualSlot.querySelector('#slide-w').value),
                r: parseInt(manualSlot.querySelector('#slide-r').value),
                g: parseInt(manualSlot.querySelector('#slide-g').value),
                b: parseInt(manualSlot.querySelector('#slide-b').value),
            };
            onUpdateHook(liveSpectrum, false);
        });
    });

    // 4. Custom Colors Block
    if (customColors && customColors.length > 0) {
        customSlot.innerHTML = `
            <div class="bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800">
                <h2 class="text-sm uppercase text-gray-400 font-semibold mb-4 flex items-center"><span class="text-white text-lg mr-2">✨</span> Custom Colors</h2>
                <div class="grid grid-cols-2 gap-3" id="custom-color-grid">
                    ${customColors.map((cc, i) => `
                        <div class="relative group">
                            <button data-index="${i}" class="custom-color-btn w-full bg-[#121212] border border-gray-700 hover:border-white rounded-xl py-3 px-2 flex flex-col items-center transition-all active:scale-95">
                                <span class="text-white font-bold mb-2 truncate w-full text-center px-1 text-sm">${cc.name}</span>
                                <div class="w-full flex justify-center space-x-1.5 mt-1 pb-1">
                                    <div class="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]" style="opacity: ${Math.max(0.2, cc.w/100)}"></div>
                                    <div class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" style="opacity: ${Math.max(0.2, cc.r/100)}"></div>
                                    <div class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" style="opacity: ${Math.max(0.2, cc.g/100)}"></div>
                                    <div class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" style="opacity: ${Math.max(0.2, cc.b/100)}"></div>
                                </div>
                            </button>
                            <button data-index="${i}" class="delete-custom-btn absolute top-[-5px] right-[-5px] bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-md">
                                &times;
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        customSlot.querySelectorAll(".custom-color-btn").forEach(btn => {
            btn.onclick = (e) => {
                if (e.target.closest(".delete-custom-btn")) return;
                const idx = btn.getAttribute("data-index");
                const cc = customColors[idx];
                applyPreset(cc.w, cc.r, cc.g, cc.b);
            };
        });

        customSlot.querySelectorAll(".delete-custom-btn").forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = btn.getAttribute("data-index");
                onDeleteCustomHook(idx);
            };
        });
        customSlot.classList.remove("hidden");
    } else {
        customSlot.innerHTML = "";
        customSlot.classList.add("hidden");
    }
}