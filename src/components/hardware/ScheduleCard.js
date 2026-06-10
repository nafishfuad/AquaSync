// src/components/hardware/ScheduleCard.js

export function renderSchedulesStack(container, device, commandHook) {
    const template = document.getElementById("tpl-schedule-config-card");
    if (!template) return;

    const metrics = device.metrics;
    const cap = device.capabilities;

    // Helper to generate a generic schedule card
    const createCard = (icon, title, hasToggle, toggleState, toggleKey, innerHTML, onMount) => {
        const clone = template.content.cloneNode(true);
        clone.querySelector(".tpl-card-icon").innerText = icon;
        clone.querySelector(".tpl-card-title").innerText = title;
        
        const toggleContainer = clone.querySelector(".tpl-toggle-container");
        const toggle = clone.querySelector(".tpl-card-toggle");
        const bodyContent = clone.querySelector(".tpl-body-content");

        if (hasToggle) {
            toggleContainer.classList.remove("hidden");
            toggle.checked = toggleState;
            toggle.addEventListener("change", (e) => {
                commandHook({ [toggleKey]: e.target.checked });
            });
            // Visually fade the body if disabled
            if (!toggleState) bodyContent.classList.add("opacity-40", "grayscale", "pointer-events-none");
        }

        bodyContent.innerHTML = innerHTML;
        onMount(bodyContent); // Hook to attach event listeners to the injected HTML
        container.appendChild(clone);
    };

    // 1. Primary Lighting Schedule
    if (cap.hasLight) {
        createCard("☀️", "Primary Lighting", false, null, null, `
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Start Time</label>
                <input type="time" id="inp-start-time" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aqua" />
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Photoperiod</label>
                <div class="flex items-center justify-between bg-[#121212] border border-gray-700 rounded-lg px-1 py-1">
                    <button id="btn-photo-down" class="w-8 h-8 flex items-center justify-center bg-cardbg rounded-md text-gray-400 hover:text-white hover:bg-gray-700">-</button>
                    <div class="text-white font-bold text-sm"><span id="val-photo">8</span><span class="text-[10px] text-gray-500 ml-1">hrs</span></div>
                    <button id="btn-photo-up" class="w-8 h-8 flex items-center justify-center bg-cardbg rounded-md text-gray-400 hover:text-white hover:bg-gray-700">+</button>
                </div>
            </div>
        `, (body) => {
            const timeInp = body.querySelector("#inp-start-time");
            const valPhoto = body.querySelector("#val-photo");
            
            timeInp.value = metrics.startTime;
            valPhoto.innerText = metrics.photoperiod;

            timeInp.addEventListener("change", (e) => commandHook({ startTime: e.target.value }));
            
            body.querySelector("#btn-photo-up").onclick = () => {
                if (metrics.photoperiod < 24) commandHook({ photoperiod: metrics.photoperiod + 1 });
            };
            body.querySelector("#btn-photo-down").onclick = () => {
                if (metrics.photoperiod > 1) commandHook({ photoperiod: metrics.photoperiod - 1 });
            };
        });
    }

    // 2. Cinematic Dimming
    if (cap.hasLight) {
        createCard("🌊", "Cinematic Dimming", true, metrics.isDimmerEnabled, "isDimmerEnabled", `
            <div class="col-span-2 mb-2">
                <div class="flex justify-between mb-1">
                    <label class="text-[10px] text-gray-500 uppercase tracking-wider">Max Brightness</label>
                    <span class="text-xs text-aqua font-bold" id="val-max-bright">100%</span>
                </div>
                <input type="range" id="inp-max-bright" min="10" max="100" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aqua" />
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Sunrise Ramp</label>
                <input type="number" id="inp-sunrise" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white" placeholder="Mins" />
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">Sunset Fade</label>
                <input type="number" id="inp-sunset" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white" placeholder="Mins" />
            </div>
        `, (body) => {
            const brightSlider = body.querySelector("#inp-max-bright");
            const brightVal = body.querySelector("#val-max-bright");
            const sunrise = body.querySelector("#inp-sunrise");
            const sunset = body.querySelector("#inp-sunset");

            brightSlider.value = metrics.maxBrightness;
            brightVal.innerText = `${metrics.maxBrightness}%`;
            sunrise.value = metrics.sunriseMins;
            sunset.value = metrics.sunsetMins;

            brightSlider.addEventListener("input", (e) => brightVal.innerText = `${e.target.value}%`);
            brightSlider.addEventListener("change", (e) => commandHook({ maxBrightness: parseInt(e.target.value) }));
            sunrise.addEventListener("change", (e) => commandHook({ sunriseMins: parseInt(e.target.value) }));
            sunset.addEventListener("change", (e) => commandHook({ sunsetMins: parseInt(e.target.value) }));
        });
    }

    // 3. Separate CO2 Schedule
    if (cap.hasCO2) {
        createCard("🫧", "Separate CO2 Schedule", true, metrics.isCO2ScheduleSeparate, "isCO2ScheduleSeparate", `
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">CO2 ON</label>
                <input type="time" id="inp-co2-on" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">CO2 OFF</label>
                <input type="time" id="inp-co2-off" class="w-full bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </div>
        `, (body) => {
            const onTime = body.querySelector("#inp-co2-on");
            const offTime = body.querySelector("#inp-co2-off");
            
            onTime.value = metrics.co2OnTime;
            offTime.value = metrics.co2OffTime;

            onTime.addEventListener("change", (e) => commandHook({ co2OnTime: e.target.value }));
            offTime.addEventListener("change", (e) => commandHook({ co2OffTime: e.target.value }));
        });
    }
}