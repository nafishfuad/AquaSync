// src/components/hardware/ScheduleCard.js

export function renderSchedulesStack(container, device, commandHook) {
    const m = device.metrics;
    container.innerHTML = `<div class="space-y-4 pb-10"></div>`;
    const wrapper = container.querySelector('div');

    // Helper to generate the generic layout for each card
    const createCard = (title, icon, isToggleable, isEnabled, toggleKey, contentHTML) => {
        const card = document.createElement('div');
        card.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800 transition-all";
        
        // Header
        let headerHTML = `
            <div class="flex items-center gap-3 ${contentHTML ? 'mb-5' : ''}">
                <span class="text-xl drop-shadow-md">${icon}</span>
                <h3 class="text-xs uppercase text-gray-300 font-bold tracking-widest flex-1">${title}</h3>
        `;
        
        if (isToggleable) {
            headerHTML += `
                <button id="tog-${toggleKey}" class="w-11 h-6 rounded-full relative transition-colors duration-300 ${isEnabled ? 'bg-aqua' : 'bg-gray-700'}">
                    <div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-300 ${isEnabled ? 'left-[22px]' : 'left-0.5'}"></div>
                </button>
            `;
        }
        headerHTML += `</div>`;
        
        // Inject body content (hidden if toggleable and currently disabled)
        if (contentHTML) {
            headerHTML += `<div id="body-${toggleKey}" class="space-y-4 overflow-hidden transition-all duration-300 ${isToggleable && !isEnabled ? 'hidden' : 'block'}">${contentHTML}</div>`;
        }
        
        card.innerHTML = headerHTML;

        // Bind Toggle Event
        if (isToggleable) {
            card.querySelector(`#tog-${toggleKey}`).onclick = () => {
                commandHook({ [toggleKey]: !isEnabled });
            };
        }
        wrapper.appendChild(card);
        return card;
    };

    // 1. Primary Lighting Card
    const lightHTML = `
        <div class="flex gap-4">
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Start Time</label>
                <input type="time" id="inp-start" value="${m.startTime}" class="w-full bg-[#121212] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-aqua transition-colors text-sm" />
            </div>
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Photoperiod</label>
                <div class="flex items-center justify-between bg-[#121212] border border-gray-700 rounded-xl px-2 py-1.5">
                    <button id="btn-photo-sub" class="text-gray-500 hover:text-white px-3 py-1 text-lg active:scale-90">-</button>
                    <span class="text-white font-bold text-sm">${m.photoperiod} <span class="text-xs text-gray-500 font-normal">hrs</span></span>
                    <button id="btn-photo-add" class="text-gray-500 hover:text-white px-3 py-1 text-lg active:scale-90">+</button>
                </div>
            </div>
        </div>
    `;
    const lightCard = createCard('Primary Lighting', '☀️', false, true, 'light', lightHTML);
    lightCard.querySelector('#inp-start').onchange = (e) => commandHook({ startTime: e.target.value });
    lightCard.querySelector('#btn-photo-sub').onclick = () => commandHook({ photoperiod: Math.max(1, m.photoperiod - 1) });
    lightCard.querySelector('#btn-photo-add').onclick = () => commandHook({ photoperiod: Math.min(24, m.photoperiod + 1) });

    // 2. Cinematic Dimming Card
    const dimmerHTML = `
        <div>
            <div class="flex justify-between items-end mb-2">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest ml-1">Max Brightness</label>
                <span class="text-xs text-aqua font-bold">${m.maxBrightness}%</span>
            </div>
            <input type="range" id="inp-max-bright" min="5" max="100" value="${m.maxBrightness}" class="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-aqua">
        </div>
        <div class="flex gap-4 pt-2">
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Sunrise Ramp</label>
                <select id="inp-sunrise" class="w-full bg-[#121212] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-aqua transition-colors text-sm appearance-none">
                    <option value="0" ${m.sunriseMins === 0 ? 'selected' : ''}>Instant (0m)</option>
                    <option value="15" ${m.sunriseMins === 15 ? 'selected' : ''}>15 mins</option>
                    <option value="30" ${m.sunriseMins === 30 ? 'selected' : ''}>30 mins</option>
                    <option value="60" ${m.sunriseMins === 60 ? 'selected' : ''}>60 mins</option>
                </select>
            </div>
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Sunset Fade</label>
                <select id="inp-sunset" class="w-full bg-[#121212] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-aqua transition-colors text-sm appearance-none">
                    <option value="0" ${m.sunsetMins === 0 ? 'selected' : ''}>Instant (0m)</option>
                    <option value="15" ${m.sunsetMins === 15 ? 'selected' : ''}>15 mins</option>
                    <option value="30" ${m.sunsetMins === 30 ? 'selected' : ''}>30 mins</option>
                    <option value="60" ${m.sunsetMins === 60 ? 'selected' : ''}>60 mins</option>
                </select>
            </div>
        </div>
        <p class="text-[9px] text-gray-500 leading-relaxed px-1">Brightness will gradually climb from 0% to ${m.maxBrightness}% over ${m.sunriseMins} minutes starting at ${m.startTime}.</p>
    `;
    const dimCard = createCard('Cinematic Dimming', '🌊', true, m.isDimmerEnabled, 'isDimmerEnabled', dimmerHTML);
    if (m.isDimmerEnabled) {
        dimCard.querySelector('#inp-max-bright').onchange = (e) => commandHook({ maxBrightness: parseInt(e.target.value) });
        dimCard.querySelector('#inp-sunrise').onchange = (e) => commandHook({ sunriseMins: parseInt(e.target.value) });
        dimCard.querySelector('#inp-sunset').onchange = (e) => commandHook({ sunsetMins: parseInt(e.target.value) });
    }

    // 3. Separate CO2 Card
    const co2HTML = `
        <div class="flex gap-4">
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Inject Start</label>
                <input type="time" id="inp-co2-start" value="${m.co2OnTime}" class="w-full bg-[#121212] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-aqua transition-colors text-sm" />
            </div>
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Inject End</label>
                <input type="time" id="inp-co2-end" value="${m.co2OffTime}" class="w-full bg-[#121212] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-aqua transition-colors text-sm" />
            </div>
        </div>
        <p class="text-[9px] text-gray-500 leading-relaxed px-1">When turned off, CO2 injection will perfectly mirror the Primary Lighting schedule.</p>
    `;
    const co2Card = createCard('Separate CO2', '🫧', true, m.isCO2ScheduleSeparate, 'isCO2ScheduleSeparate', co2HTML);
    if (m.isCO2ScheduleSeparate) {
        co2Card.querySelector('#inp-co2-start').onchange = (e) => commandHook({ co2OnTime: e.target.value });
        co2Card.querySelector('#inp-co2-end').onchange = (e) => commandHook({ co2OffTime: e.target.value });
    }

    // 4. Cooling Fan Card
    const fanHTML = `
        <div class="flex gap-4 mb-2">
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Fan Start</label>
                <input type="time" id="inp-fan-start" value="${m.fanOnTime}" class="w-full bg-[#121212] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors text-sm" />
            </div>
            <div class="flex-1">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Fan End</label>
                <input type="time" id="inp-fan-end" value="${m.fanOffTime}" class="w-full bg-[#121212] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors text-sm" />
            </div>
        </div>
        <div>
            <div class="flex justify-between items-end mb-2">
                <label class="block text-[9px] text-gray-500 uppercase tracking-widest ml-1">Fan Speed</label>
                <span class="text-xs text-blue-400 font-bold">${m.fanSpeed}%</span>
            </div>
            <input type="range" id="inp-fan-speed" min="20" max="100" value="${m.fanSpeed}" class="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-400">
        </div>
    `;
    const fanCard = createCard('Cooling & Airflow', '🌀', true, m.isFanEnabled, 'isFanEnabled', fanHTML);
    if (m.isFanEnabled) {
        fanCard.querySelector('#inp-fan-start').onchange = (e) => commandHook({ fanOnTime: e.target.value });
        fanCard.querySelector('#inp-fan-end').onchange = (e) => commandHook({ fanOffTime: e.target.value });
        fanCard.querySelector('#inp-fan-speed').onchange = (e) => commandHook({ fanSpeed: parseInt(e.target.value) });
    }
}