// src/components/analytics/Overview.js

export function renderOverview(container, device) {
    const template = document.getElementById("tpl-insights-overview");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const metrics = device.metrics;

    // Element selection
    const lightStatus = clone.querySelector(".tpl-light-status");
    const co2Status = clone.querySelector(".tpl-co2-status");
    const sunrise = clone.querySelector(".tpl-sunrise-val");
    const sunset = clone.querySelector(".tpl-sunset-val");
    const photo = clone.querySelector(".tpl-photo-val");
    const recovery = clone.querySelector(".tpl-recovery-val");

    // Helper: Convert 24h format "14:30" to 12h "2:30 PM"
    const formatTime = (timeStr) => {
        if (!timeStr) return "--:--";
        let [h, m] = timeStr.split(':');
        h = parseInt(h);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    };

    // Helper: Calculate Sunset from Start Time + Photoperiod
    const calcSunset = (startStr, durationHrs) => {
        if (!startStr) return "--:--";
        let [h, m] = startStr.split(':');
        h = (parseInt(h) + durationHrs) % 24;
        let formattedH = h < 10 ? '0' + h : h;
        return formatTime(`${formattedH}:${m}`);
    };

    // --- Inject Live Values ---

    // 1. Light Status
    if (metrics.isLightOn) {
        lightStatus.innerHTML = `ON <span class="text-[10px] text-gray-500 font-bold ml-1">(${metrics.currentBrightness}%)</span>`;
    } else {
        lightStatus.innerHTML = `OFF`;
        lightStatus.classList.replace("text-green-400", "text-gray-500");
    }

    // 2. CO2 Status (Hide entirely if hardware doesn't support it)
    if (device.capabilities.hasCO2) {
        if (metrics.isCO2On) {
            co2Status.innerHTML = `ON`;
        } else {
            co2Status.innerHTML = `OFF`;
            co2Status.classList.replace("text-green-400", "text-gray-500");
        }
    } else {
        co2Status.parentElement.classList.add("hidden");
    }

    // 3. Time Mapping
    sunrise.innerText = formatTime(metrics.startTime);
    sunset.innerText = calcSunset(metrics.startTime, metrics.photoperiod);
    
    // Formatting e.g., "08h 00m"
    let pFormat = metrics.photoperiod < 10 ? `0${metrics.photoperiod}` : metrics.photoperiod;
    photo.innerHTML = `${pFormat}<span class="text-xs text-gray-500 ml-0.5">h</span> 00<span class="text-xs text-gray-500 ml-0.5">m</span>`;
    
    recovery.innerHTML = `${metrics.recoveryMins}<span class="text-xs text-red-500/70 ml-0.5">m</span>`;

    container.appendChild(clone);
}