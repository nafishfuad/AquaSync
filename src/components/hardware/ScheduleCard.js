// src/components/hardware/ScheduleCard.js

export function renderSchedulesStack(container, device, commandHook) {
    const m = device.metrics;
    container.innerHTML = `<div class="space-y-6 pb-10 mt-2"></div>`;
    const wrapper = container.querySelector('div');

    // Helper: SVG Icon for Stepper Minus
    const svgMinus = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>`;
    // Helper: SVG Icon for Stepper Plus
    const svgPlus = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`;

    // Helper: Generates the plus/minus stepper UI
    const createStepper = (id, value, unit) => `
        <div class="flex items-center justify-between bg-[#121212] border border-gray-700 rounded-lg px-1 py-1">
            <button id="${id}-sub" class="w-8 h-8 flex items-center justify-center bg-cardbg rounded-md text-gray-400 hover:text-white hover:bg-gray-700 active:scale-95 transition-all">${svgMinus}</button>
            <div class="text-white font-bold">${value}<span class="text-[10px] text-gray-500 ml-1">${unit}</span></div>
            <button id="${id}-add" class="w-8 h-8 flex items-center justify-center bg-cardbg rounded-md text-gray-400 hover:text-white hover:bg-gray-700 active:scale-95 transition-all">${svgPlus}</button>
        </div>
    `;

    // Helper: Generates a premium card with optional toggle logic
    const createCard = (title, iconHTML, borderColor, isToggleable, isEnabled, toggleKey, disabledNote, bodyHTML) => {
        const card = document.createElement('div');
        card.className = `bg-cardbg rounded-2xl p-5 shadow-lg border ${borderColor} relative overflow-hidden transition-all`;
        
        let html = `
            <div class="flex justify-between items-center ${bodyHTML && (!isToggleable || isEnabled) ? 'mb-5 pb-4 border-b border-gray-800' : 'mb-2'}">
                <h2 class="text-sm uppercase text-gray-400 font-semibold flex items-center">${iconHTML} <span class="ml-2">${title}</span></h2>
        `;
        
        if (isToggleable) {
            const toggleColor = isEnabled ? (toggleKey === 'isFanEnabled' ? 'bg-blue-500' : (toggleKey === 'isCO2ScheduleSeparate' ? 'bg-green-400' : 'bg-aqua')) : 'bg-gray-700';
            html += `
                <label class="relative inline-flex items-center cursor-pointer" id="tog-wrapper-${toggleKey}">
                    <div class="w-11 h-6 ${toggleColor} rounded-full relative transition-colors duration-300">
                        <div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-300 shadow-sm ${isEnabled ? 'left-[22px]' : 'left-0.5'}"></div>
                    </div>
                </label>
            `;
        }
        html += `</div>`;
        
        if (isToggleable && disabledNote) {
            html += `<p class="text-[10px] text-gray-500 italic block transition-all ${isEnabled ? 'hidden' : 'mt-2'}">${disabledNote}</p>`;
        }
        
        if (bodyHTML) {
            html += `<div class="space-y-4 transition-all duration-300 ${isToggleable && !isEnabled ? 'hidden opacity-0' : 'block opacity-100 mt-4'}">${bodyHTML}</div>`;
        }
        
        card.innerHTML = html;

        if (isToggleable) {
            card.querySelector(`#tog-wrapper-${toggleKey}`).onclick = () => commandHook({ [toggleKey]: !isEnabled });
        }
        wrapper.appendChild(card);
        return card;
    };

    // --- 1. PRIMARY LIGHTING ---
    const lightHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Start Time</label>
                <input type="time" id="inp-start" value="${m.startTime}" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400 transition-colors" />
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Photoperiod</label>
                ${createStepper('photo', m.photoperiod, 'hrs')}
            </div>
        </div>
    `;
    const lightCard = createCard('Primary Lighting', '<span class="text-amber-400 text-lg">☀️</span>', 'border-gray-800', false, true, null, null, lightHTML);
    lightCard.querySelector('#inp-start').onchange = (e) => commandHook({ startTime: e.target.value });
    lightCard.querySelector('#photo-sub').onclick = () => commandHook({ photoperiod: Math.max(1, m.photoperiod - 1) });
    lightCard.querySelector('#photo-add').onclick = () => commandHook({ photoperiod: Math.min(24, m.photoperiod + 1) });

    // --- 2. CINEMATIC DIMMING ---
    const dimmerHTML = `
        <div>
            <div class="flex justify-between mb-1">
                <label class="text-[10px] text-gray-500 uppercase tracking-wider">Max Brightness</label>
                <span class="text-xs text-aqua font-bold">${m.maxBrightness}%</span>
            </div>
            <input type="range" id="inp-max-bright" min="10" max="100" value="${m.maxBrightness}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aqua" />
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Sunrise Ramp</label>
                ${createStepper('sunrise', m.sunriseMins, 'min')}
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Sunset Fade</label>
                ${createStepper('sunset', m.sunsetMins, 'min')}
            </div>
        </div>
    `;
    const dimCard = createCard('Cinematic Dimming', '<span class="text-aqua text-lg">🌊</span>', 'border-gray-800', true, m.isDimmerEnabled, 'isDimmerEnabled', 'Lights will instantly turn ON and OFF without ramping.', dimmerHTML);
    if (m.isDimmerEnabled) {
        dimCard.querySelector('#inp-max-bright').onchange = (e) => commandHook({ maxBrightness: parseInt(e.target.value) });
        dimCard.querySelector('#sunrise-sub').onclick = () => commandHook({ sunriseMins: Math.max(0, m.sunriseMins - 5) });
        dimCard.querySelector('#sunrise-add').onclick = () => commandHook({ sunriseMins: Math.min(120, m.sunriseMins + 5) });
        dimCard.querySelector('#sunset-sub').onclick = () => commandHook({ sunsetMins: Math.max(0, m.sunsetMins - 5) });
        dimCard.querySelector('#sunset-add').onclick = () => commandHook({ sunsetMins: Math.min(120, m.sunsetMins + 5) });
    }

    // --- 3. SEPARATE CO2 ---
    const co2HTML = `
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">CO2 ON</label>
                <input type="time" id="inp-co2-start" value="${m.co2OnTime}" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-400" />
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">CO2 OFF</label>
                <input type="time" id="inp-co2-end" value="${m.co2OffTime}" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-400" />
            </div>
        </div>
    `;
    const co2Card = createCard('Separate CO2 Schedule', '<span class="text-green-400 text-lg">🫧</span>', 'border-gray-800', true, m.isCO2ScheduleSeparate, 'isCO2ScheduleSeparate', 'Currently syncing perfectly with the primary lighting schedule.', co2HTML);
    if (m.isCO2ScheduleSeparate) {
        co2Card.querySelector('#inp-co2-start').onchange = (e) => commandHook({ co2OnTime: e.target.value });
        co2Card.querySelector('#inp-co2-end').onchange = (e) => commandHook({ co2OffTime: e.target.value });
    }

// --- 4. SURFACE COOLING (FAN) ---
    const fanHTML = `
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fan Start</label>
                <input type="time" id="inp-fan-start" value="${m.fanOnTime}" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500" />
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fan End</label>
                <input type="time" id="inp-fan-end" value="${m.fanOffTime}" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500" />
            </div>
        </div>
        <div>
            <div class="flex justify-between items-center mb-1">
                <label class="text-[10px] text-gray-500 uppercase tracking-wider">Fan Speed</label>
                <span class="text-xs font-bold text-blue-400">${m.fanSpeed}%</span>
            </div>
            <input type="range" id="inp-fan-speed" min="20" max="100" step="5" value="${m.fanSpeed}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
        </div>
    `;
    
    const fanCard = createCard('Surface Cooling', '<span class="text-blue-400 text-lg">❄️</span>', 'border-blue-900/50', true, m.isFanEnabled, 'isFanEnabled', 'Cooling fan schedule is disabled.', fanHTML);
    
    // 🔥 THE FIX: Safely inject the glow without killing the toggle listeners
    fanCard.insertAdjacentHTML('afterbegin', `<div class="absolute -top-10 -right-10 w-32 h-32 bg-blue-500 opacity-5 rounded-full blur-2xl pointer-events-none"></div>`);
    
    if (m.isFanEnabled) {
        fanCard.querySelector('#inp-fan-start').onchange = (e) => commandHook({ fanOnTime: e.target.value });
        fanCard.querySelector('#inp-fan-end').onchange = (e) => commandHook({ fanOffTime: e.target.value });
        fanCard.querySelector('#inp-fan-speed').onchange = (e) => commandHook({ fanSpeed: parseInt(e.target.value) });
    }

    // --- 5. LOAD SHEDDING SAFETY ---
    const recoveryHTML = `
        <p class="text-[10px] text-gray-500 mb-4 leading-relaxed">When power returns, the system will slowly ramp up the lights to avoid shocking the fish.</p>
        <div>
            <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Recovery Ramp Time</label>
            <div class="w-1/2">
                ${createStepper('recovery', m.recoveryMins, 'min')}
            </div>
        </div>
    `;
    const recCard = createCard('Load Shedding Safety', '<span class="text-red-500 text-lg">⚡</span>', 'border-red-900/50', false, true, null, null, recoveryHTML);
    
    // 🔥 THE FIX: Safely inject the glow without killing the stepper listeners
    recCard.insertAdjacentHTML('afterbegin', `<div class="absolute -top-10 -right-10 w-32 h-32 bg-red-500 opacity-5 rounded-full blur-2xl pointer-events-none"></div>`);
    
    recCard.querySelector('#recovery-sub').onclick = () => commandHook({ recoveryMins: Math.max(0, m.recoveryMins - 5) });
    recCard.querySelector('#recovery-add').onclick = () => commandHook({ recoveryMins: Math.min(60, m.recoveryMins + 5) });
}