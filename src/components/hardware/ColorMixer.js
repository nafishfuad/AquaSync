// src/components/hardware/ColorMixer.js

export function renderColorSpectrum(previewSlot, presetsSlot, manualSlot, currentSpectrum, onUpdateHook) {
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
            <h2 class="text-sm uppercase text-gray-400 font-semibold mb-2 flex items-center"><span class="text-white text-lg mr-2">🎚️</span> Manual Mix</h2>
            ${buildSlider("White", "text-white", currentSpectrum.w, "w")}
            ${buildSlider("Red", "text-red-500", currentSpectrum.r, "r")}
            ${buildSlider("Green", "text-green-500", currentSpectrum.g, "g")}
            ${buildSlider("Blue", "text-blue-500", currentSpectrum.b, "b")}
        </div>
    `;

    // Attach Slider Listeners
    ['w', 'r', 'g', 'b'].forEach(key => {
        const slider = manualSlot.querySelector(`#slide-${key}`);
        const valText = manualSlot.querySelector(`#val-${key}`);
        
        slider.addEventListener("input", (e) => {
            valText.innerText = `${e.target.value}%`;
            // Live update the preview box purely in the DOM
            const newColors = { ...currentSpectrum, [key]: parseInt(e.target.value) };
            document.getElementById("color-preview-box").style.backgroundColor = calcPreviewColor(newColors.w, newColors.r, newColors.g, newColors.b);
        });

        slider.addEventListener("change", (e) => {
            onUpdateHook({ ...currentSpectrum, [key]: parseInt(e.target.value) });
        });
    });
}