// src/components/hardware/OverrideGrid.js

export function renderOverrideGrid(container, device, commandHook) {
    const template = document.getElementById("tpl-quick-override-box");
    if (!template) return;

    const metrics = device.metrics;
    const cap = device.capabilities;

    // Helper function to stamp out identical boxes with different colors
    const createBox = (iconText, labelText, isOn, activeColorClass, onClick) => {
        const clone = template.content.cloneNode(true);
        const btn = clone.querySelector("button");
        const icon = clone.querySelector(".tpl-box-icon");
        const label = clone.querySelector(".tpl-box-label");

        icon.innerText = iconText;
        label.innerText = labelText;

        if (isOn) {
            // Apply vibrant colored borders when ON
            btn.className = `bg-cardbg border-2 ${activeColorClass} rounded-2xl p-4 flex flex-col items-center justify-center transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.05)]`;
            label.classList.replace("text-gray-500", activeColorClass.replace("border-", "text-"));
        } else {
            // Dark muted state when OFF
            btn.className = "bg-cardbg border-2 border-gray-800 hover:border-gray-700 rounded-2xl p-4 flex flex-col items-center justify-center transition-all active:scale-95 shadow-md";
        }

        btn.addEventListener("click", () => {
            // Force manual mode whenever a user explicitly taps an override
            if (metrics.isAutoMode) commandHook({ isAutoMode: false });
            onClick();
        });

        container.appendChild(clone);
    };

    // 1. Light Box (Amber)
    if (cap.hasLight) {
        createBox("💡", `Light: ${metrics.isLightOn ? 'ON' : 'OFF'}`, metrics.isLightOn, "border-amber-400", () => {
            commandHook({ isLightOn: !metrics.isLightOn, currentBrightness: !metrics.isLightOn ? 40 : 0 });
        });
    }

    // 2. CO2 Box (Green)
    if (cap.hasCO2) {
        createBox("🫧", `CO2: ${metrics.isCO2On ? 'ON' : 'OFF'}`, metrics.isCO2On, "border-green-400", () => {
            commandHook({ isCO2On: !metrics.isCO2On });
        });
    }
    
    // 3. Fan Box (Blue / Disabled State)
    if (cap.hasFan) {
        if (metrics.isFanEnabled) {
            createBox("🌀", `Fan: ${metrics.isFanOn ? 'ON' : 'OFF'}`, metrics.isFanOn, "border-blue-400", () => {
                commandHook({ isFanOn: !metrics.isFanOn });
            });
        } else {
            // Renders the grayed-out "Disabled" state from your screenshot
            const clone = template.content.cloneNode(true);
            const btn = clone.querySelector("button");
            btn.className = "bg-cardbg border-2 border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center grayscale opacity-50 cursor-not-allowed";
            clone.querySelector(".tpl-box-icon").innerText = "🌀";
            clone.querySelector(".tpl-box-label").innerText = "Fan: Disabled";
            container.appendChild(clone);
        }
    }
}