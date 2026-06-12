// src/components/analytics/Charts.js

export function renderCharts(container, analyticsData) {
    const template = document.getElementById("tpl-analytics-chart-card");
    if (!template) return;

    // Apply global Chart.js aesthetic defaults
    Chart.defaults.color = "#6b7280";
    Chart.defaults.font.family = "sans-serif";
    Chart.defaults.plugins.legend.display = false;

    // 🔥 THE TYPOGRAPHY ENGINE (For the Chart Headers)
    const styleTimeStr = (str) => {
        const match = str.match(/(\d{2})h (\d{2})m/);
        if (match) return `<span class="text-3xl font-black tracking-tight">${match[1]}</span><span class="text-[12px] opacity-50 mx-0.5 font-bold tracking-wide">h</span><span class="text-3xl font-black tracking-tight ml-1">${match[2]}</span><span class="text-[12px] opacity-50 mx-0.5 font-bold tracking-wide">m</span>`;
        return `<span class="text-3xl font-black tracking-tight">${str}</span>`;
    };

    // Factory function to spawn chart layouts safely
    const createChartCard = (title, statsArray, chartConfigBuilder) => {
        const clone = template.content.cloneNode(true);
        clone.querySelector(".tpl-chart-title").innerText = title;
        
        const statsGrid = clone.querySelector(".tpl-stats-grid");
        statsGrid.className = `grid grid-cols-${statsArray.length} gap-4 mb-4 pb-6 border-b border-gray-800/60`;
        
        let statsHTML = "";
        statsArray.forEach((stat, index) => {
            let alignClass = "text-left";
            if (statsArray.length === 2 && index === 1) alignClass = "text-right";
            else if (statsArray.length === 3) {
                if (index === 1) alignClass = "text-center";
                if (index === 2) alignClass = "text-right";
            }

            // Notice we stripped 'text-lg' so the 3xl span can take over
            statsHTML += `
                <div class="${alignClass}">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">${stat.label}</p>
                    <div class="${stat.color}">${styleTimeStr(stat.value)}</div>
                </div>
            `;
        });
        statsGrid.innerHTML = statsHTML;
        
        const canvas = clone.querySelector(".tpl-chart-canvas");
        container.appendChild(clone); 
        
        // Build the chart config using the active canvas context for gradients
        const ctx = canvas.getContext('2d');
        const finalConfig = chartConfigBuilder(ctx);
        new Chart(canvas, finalConfig);
    };

    // --- Dynamic Time Generators ---
    const getLast24HoursLabels = () => {
        const labels = [];
        const d = new Date();
        for (let i = 23; i >= 0; i--) {
            const hour = new Date(d.getTime() - (i * 60 * 60 * 1000)).getHours();
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const h = hour % 12 || 12;
            labels.push(`${h}${ampm}`);
        }
        return labels;
    };

    const getLast7DaysLabels = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const labels = [];
        const today = new Date().getDay();
        for (let i = 6; i >= 0; i--) {
            labels.push(days[(today - i + 7) % 7]);
        }
        return labels;
    };

    // Helper to generate the exact glowing gradients from the screenshots
    const getGradient = (ctx, r, g, b) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 150);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`); // Bright top
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`); // Faded bottom
        return gradient;
    };


    // 1. TODAY'S HOURLY GRAPH (Stepped Line with Area Fill & Segmented Color)
    createChartCard(
        "Today's Hourly Activity", 
        [
            { label: "Total Active", value: analyticsData.today.totalActive, color: "text-white" },
            { label: "Load Shedding", value: analyticsData.today.loadShedding, color: "text-red-500" }
        ],
        (ctx) => ({
            type: 'line',
            data: {
                labels: getLast24HoursLabels(),
                datasets: [{
                    data: analyticsData.today.hourlyGraph,
                    borderWidth: 3,
                    stepped: true,
                    fill: true,
                    backgroundColor: getGradient(ctx, 0, 242, 254), // Aqua Gradient
                    pointRadius: 0,
                    // 🔥 THE SEGMENT FIX: Cyan when ON, Dark Grey when OFF
                    segment: {
                        borderColor: (segmentCtx) => {
                            if (segmentCtx.p0.parsed.y > 0 || segmentCtx.p1.parsed.y > 0) return '#00f2fe';
                            return '#374151'; // Tailwind gray-700
                        }
                    }
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { 
                        min: -0.1, max: 1.2, 
                        ticks: { stepSize: 1, callback: v => v === 1 ? 'ON' : v === 0 ? 'OFF' : '' }, 
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } 
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { maxTicksLimit: 12, maxRotation: 45, minRotation: 45 } 
                    }
                }
            }
        })
    );

    // 2. 7-DAY GRAPH (Aqua Curve with Gradient & Hollow Points)
    createChartCard(
        "7-Day Overview", 
        [
            { label: "Total Active", value: analyticsData.week.totalActive, color: "text-white" },
            { label: "Daily Avg", value: analyticsData.week.avgLight, color: "text-aqua" },
            { label: "Load Shedding", value: analyticsData.week.loadShedding, color: "text-red-500" }
        ],
        (ctx) => ({
            type: 'line',
            data: {
                labels: getLast7DaysLabels(),
                datasets: [{
                    data: analyticsData.week.dailyGraph,
                    borderColor: '#00f2fe',
                    backgroundColor: getGradient(ctx, 0, 242, 254), // Aqua Gradient
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4, // Smooth curve
                    pointBackgroundColor: '#121212', // Hollow center
                    pointBorderColor: '#00f2fe',     // Aqua ring
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false } } 
                }
            }
        })
    );

    // 3. 30-DAY GRAPH (Purple Smooth Area, No Points)
    createChartCard(
        "30-Day Overview", 
        [
            { label: "Total Active", value: analyticsData.month.totalActive, color: "text-white" },
            { label: "Daily Avg", value: analyticsData.month.avgLight, color: "text-purple-400" },
            { label: "Load Shedding", value: analyticsData.month.loadShedding, color: "text-red-500" }
        ],
        (ctx) => ({
            type: 'line',
            data: {
                labels: Array.from({length: 30}, (_, i) => i+1),
                datasets: [{
                    data: analyticsData.month.dailyGraph,
                    borderColor: '#a855f7', 
                    backgroundColor: getGradient(ctx, 168, 85, 247), // Purple Gradient
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0 // No points on the 30-day graph to keep it clean
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } 
                }
            }
        })
    );
}