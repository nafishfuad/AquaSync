// src/components/hardware/OverrideGrid.js

export function renderOverrideGrid(container, device, commandHook) {
    const m = device.metrics;
    const cap = device.capabilities;

    // 🔥 Reverted Container: Back to small square grid layout
    container.innerHTML = `<div class="grid grid-cols-2 gap-4 mb-6" id="hardware-button-grid"></div>`;
    const grid = container.querySelector('#hardware-button-grid');

    // Helper to generate glowing square quick-action buttons (matches old screenshots)
    const createButton = (label, icon, isOn, stateKey) => {
        const btn = document.createElement('button');
        
        // Dynamic styling for ON/OFF state (Heavy glows on aqua)
        const activeContainer = isOn ? "bg-cardbg border-aqua shadow-[0_0_20px_rgba(0,242,254,0.15)]" : "bg-[#121212] border-gray-800 opacity-60 hover:opacity-100 hover:border-gray-700";
        const iconColor = isOn ? "text-aqua drop-shadow-[0_0_12px_rgba(0,242,254,1)]" : "text-gray-600";
        const textColor = isOn ? "text-aqua font-bold" : "text-gray-500 font-semibold";
        const stateText = isOn ? "ON" : "OFF";

        btn.className = `flex flex-col items-center justify-center py-6 rounded-2xl border ${activeContainer} transition-all active:scale-95 duration-300 h-full`;
        btn.innerHTML = `
            <span class="text-3xl mb-3 ${iconColor} transition-all duration-300">${icon}</span>
            <span class="text-[10px] uppercase tracking-widest ${textColor} text-center">${label}</span>
            <span class="text-[9px] font-bold text-gray-600 mt-0.5">${stateText}</span>
        `;
        
        btn.onclick = () => {
            // FIRE THE COMMAND: Snap to Manual AND flip specific state
            commandHook({ 
                isAutoMode: false, 
                [stateKey]: !isOn 
            });
        };
        grid.appendChild(btn);
    };

    // 1. Render Light (Always visible if hardware supports it)
    if (cap.hasLight) createButton('Light', '💡', m.isLightOn, 'isLightOn');
    
    // 2. Render CO2 (Always visible if hardware supports it)
    if (cap.hasCO2) createButton('CO2 Injection', '🫧', m.isCO2On, 'isCO2On');
    
    // 3. Render Fan (ONLY visible if hardware supports it AND the user enabled the Fan module)
    if (cap.hasFan && m.isFanEnabled) {
        const isOn = m.isFanOn;
        // Blue styling for fan
        const activeContainer = isOn ? "bg-cardbg border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.15)]" : "bg-[#121212] border-gray-800 opacity-60";
        const iconColor = isOn ? "text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,1)] animate-spin-slow" : "text-gray-600";
        const textColor = isOn ? "text-blue-400 font-bold" : "text-gray-500 font-semibold";
        
        const btn = document.createElement('button');
        btn.className = `flex flex-col items-center justify-center py-6 rounded-2xl border ${activeContainer} transition-all active:scale-95 duration-300 h-full`;
        btn.innerHTML = `
            <span class="text-3xl mb-3 ${iconColor}">${isOn ? '🌀' : '❄️'}</span>
            <span class="text-[10px] uppercase tracking-widest ${textColor} text-center">Cooling Fan</span>
            <span class="text-[9px] font-bold text-gray-600 mt-0.5">${isOn ? 'ON' : 'OFF'}</span>
        `;
        btn.onclick = () => commandHook({ isAutoMode: false, isFanOn: !isOn });
        grid.appendChild(btn);
    }
}