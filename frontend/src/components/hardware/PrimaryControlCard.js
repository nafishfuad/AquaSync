// src/components/hardware/PrimaryControlCard.js

export function renderPrimaryControlCard(container, device, commandHook) {
    const m = device.metrics;
    const cap = device.capabilities;
    const isAuto = m.isAutoMode;

    container.innerHTML = "";
    const card = document.createElement('div');
    card.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800 mb-6";

    card.innerHTML = `
        <div class="flex justify-between items-center mb-5 pb-5 border-b border-gray-800">
            <div>
                <h2 class="text-sm uppercase font-semibold flex items-center transition-colors">
                    <span class="text-lg mr-2">${isAuto ? '🤖' : '🖐️'}</span>
                    <span class="${isAuto ? 'text-aqua' : 'text-amber-400'} tracking-wider">${isAuto ? 'Auto Mode' : 'Manual Override'}</span>
                </h2>
                <p class="text-[10px] text-gray-500 uppercase tracking-wider mt-1">${isAuto ? 'Following Schedule' : 'Schedule Suspended'}</p>
            </div>
            <button id="btn-toggle-mode" class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${isAuto ? 'bg-cardbg text-gray-400 border border-gray-700 hover:text-white' : 'bg-transparent text-aqua border border-aqua shadow-[0_0_10px_rgba(0,242,254,0.15)]'}">
                ${isAuto ? 'Set Manual' : 'Resume Auto'}
            </button>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-5">
            ${cap.hasLight ? `
            <button id="btn-light" class="bg-cardbg border-2 ${m.isLightOn ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.15)]' : 'border-gray-800 opacity-60 hover:opacity-100'} rounded-2xl p-4 flex flex-col items-center justify-center active:scale-95 transition-all h-28">
                <span class="text-2xl mb-1">💡</span>
                <span class="text-[10px] uppercase tracking-wider font-bold ${m.isLightOn ? 'text-amber-400' : 'text-gray-500'}">Light: ${m.isLightOn ? 'ON' : 'OFF'}</span>
            </button>` : ''}
            
            ${cap.hasCO2 ? `
            <button id="btn-co2" class="bg-cardbg border-2 ${m.isCO2On ? 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.15)]' : 'border-gray-800 opacity-60 hover:opacity-100'} rounded-2xl p-4 flex flex-col items-center justify-center active:scale-95 transition-all h-28">
                <span class="text-2xl mb-1">🫧</span>
                <span class="text-[10px] uppercase tracking-wider font-bold ${m.isCO2On ? 'text-green-400' : 'text-gray-500'}">CO2: ${m.isCO2On ? 'ON' : 'OFF'}</span>
            </button>` : ''}
            
            ${cap.hasFan && m.isFanEnabled ? `
            <button id="btn-fan" class="bg-cardbg border-2 ${m.isFanOn ? 'border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.15)]' : 'border-gray-800 opacity-60 hover:opacity-100'} rounded-2xl p-4 flex flex-col items-center justify-center active:scale-95 transition-all h-28">
                <span class="text-xl mb-1 ${m.isFanOn ? 'animate-spin-slow' : ''}">${m.isFanOn ? '🌀' : '❄️'}</span>
                <span class="text-[10px] uppercase tracking-wider font-bold ${m.isFanOn ? 'text-blue-400' : 'text-gray-500'}">Fan: ${m.isFanOn ? 'ON' : 'OFF'}</span>
            </button>` : ''}
        </div>

        <div class="transition-all duration-300 ${isAuto ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}">
            <div class="flex justify-between items-end mb-3">
                <div>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Live Brightness${isAuto ? '<span class="text-aqua ml-1">(Auto)</span>' : ''}</p>
                    <p class="text-xs text-gray-400">${isAuto ? 'System is controlling output' : 'Works in Manual Mode'}</p>
                </div>
                <span class="text-2xl font-bold text-gray-500">${m.currentBrightness}%</span>
            </div>
            <input type="range" id="inp-live-dimmer" min="0" max="100" value="${m.currentBrightness}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aqua" />
        </div>
    `;

    // Bind all events to instantly trigger Manual mode when touched
    card.querySelector('#btn-toggle-mode').onclick = () => commandHook({ isAutoMode: !isAuto });
    if(cap.hasLight) card.querySelector('#btn-light').onclick = () => commandHook({ isAutoMode: false, isLightOn: !m.isLightOn });
    if(cap.hasCO2) card.querySelector('#btn-co2').onclick = () => commandHook({ isAutoMode: false, isCO2On: !m.isCO2On });
    if(cap.hasFan && m.isFanEnabled) card.querySelector('#btn-fan').onclick = () => commandHook({ isAutoMode: false, isFanOn: !m.isFanOn });
    
    card.querySelector('#inp-live-dimmer').oninput = (e) => {
        const val = parseInt(e.target.value);
        commandHook({ isAutoMode: false, isLightOn: val > 0, currentBrightness: val }, true);
    };

    container.appendChild(card);
}