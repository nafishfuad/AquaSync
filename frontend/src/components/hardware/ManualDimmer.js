// src/components/hardware/ManualDimmer.js

/**
 * Contextual UI Card: Appears ONLY when in Manual Mode + Light is ON
 * This allows setting a specific brightness independent of the auto photoperiod schedule.
 */
export function renderManualDimmer(container, device, commandHook) {
    const m = device.metrics;
    
    // 🔥 CONTEXTUAL HIDING LOGIC: Only render if Manual Override is active AND Light is ON
    if (m.isAutoMode || !m.isLightOn || !device.capabilities.hasLight) {
        container.innerHTML = "";
        return;
    }

    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 mb-6 shadow-xl border border-gray-800 animate-slide-up-in";
    
    // We use currentBrightness for the manual override value, NOT maxBrightness (which is schedule data)
    div.innerHTML = `
        <div class="flex items-center gap-3 mb-5">
            <span class="text-xl drop-shadow-[0_0_10px_rgba(0,242,254,0.8)]">💡</span>
            <h3 class="text-xs uppercase text-white font-bold tracking-widest flex-1">Manual Brightness Override</h3>
            <span class="text-xs text-aqua font-bold transition-all tabular-nums">${m.currentBrightness}%</span>
        </div>
        
        <div class="space-y-4">
            <input type="range" id="inp-manual-bright" min="0" max="100" value="${m.currentBrightness}" class="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-aqua">
            <p class="text-[10px] text-amber-400 font-medium leading-relaxed bg-amber-400/5 p-3 rounded-lg border border-amber-400/20">
                You are forcing the light state. The automated photoperiod schedule (including sunrise/sunset ramps) will be ignored until you click "Resume Auto."
            </p>
        </div>
    `;

    // Handle instant "Optimistic Fast Update" to UI, followed by network push
    div.querySelector('#inp-manual-bright').oninput = (e) => {
        const newBright = parseInt(e.target.value);
        commandHook({ 
            isAutoMode: false, 
            isLightOn: newBright > 0, // Automatically flip light off if slider hits 0
            currentBrightness: newBright 
        }, true); // The true flag tells commandHook to redraw UI immediately but throttle network
    };

    container.appendChild(div);
}