// src/components/analytics/Charts.js

import { DeviceStore } from '../../state.js';

export function renderCharts(container, analyticsData) {
    const template = document.getElementById("tpl-analytics-chart-card");
    if (!template) return;

    // Grab active device context so we can read the exact schedule!
    const device = DeviceStore.getActiveDevice();
    const m = device ? device.metrics : null;

    // Apply global Chart.js aesthetic defaults
    Chart.defaults.color = "#6b7280";
    Chart.defaults.font.family = "sans-serif";
    Chart.defaults.plugins.legend.display = false;

    // 🔥 THE TYPOGRAPHY ENGINE (For the Chart Headers)
    const styleTimeStr = (str, colorClass="text-gray-200") => {
        const match = str.match(/(\d{2})h (\d{2})m/);
        if (match) return `<span class="text-2xl font-bold ${colorClass} tracking-tight">${match[1]}</span><span class="text-[10px] text-gray-500 font-bold mx-0.5">h</span> <span class="text-2xl font-bold ${colorClass} tracking-tight">${match[2]}</span><span class="text-[10px] text-gray-500 font-bold mx-0.5">m</span>`;
        return `<span class="text-2xl font-bold ${colorClass}">${str}</span>`;
    };

    // Factory function to spawn chart layouts safely
    const createChartCard = (title, statsArray, chartConfigBuilder) => {
        const clone = template.content.cloneNode(true);
        clone.querySelector(".tpl-chart-title").innerText = title;
        
        const statsGrid = clone.querySelector(".tpl-stats-grid");
        statsGrid.className = `grid grid-cols-${statsArray.length} gap-4 mb-4 pb-6 border-b border-gray-800/40`;
        
        let statsHTML = "";
        statsArray.forEach((stat, index) => {
            let alignClass = "text-left";
            if (statsArray.length === 2 && index === 1) alignClass = "text-right";
            else if (statsArray.length === 3) {
                if (index === 1) alignClass = "text-center";
                if (index === 2) alignClass = "text-right";
            }

            statsHTML += `
                <div class="${alignClass}">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">${stat.label}</p>
                    <div>${styleTimeStr(stat.value, stat.color)}</div>
                </div>
            `;
        });
        statsGrid.innerHTML = statsHTML;
        
        const canvas = clone.querySelector(".tpl-chart-canvas");
        container.appendChild(clone); 
        
        const ctx = canvas.getContext('2d');
        const finalConfig = chartConfigBuilder(ctx);
        new Chart(canvas, finalConfig);
    };

    // Helper to generate the exact glowing gradients
    const getGradient = (ctx, r, g, b) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 150);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`); 
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`); 
        return gradient;
    };


    // ==========================================
    // 1. TODAY'S DYNAMIC HOURLY TIMELINE
    // ==========================================
    let scheduleData = [];
    let actualData = [];
    let todayLabels = [];

    if (m) {
        const parseTime = (str) => {
            let [h, min] = str.split(':');
            return parseInt(h) + (parseInt(min) / 60);
        };
        const startH = parseTime(m.startTime);
        const endH = startH + m.photoperiod;
        const currentHour = new Date().getHours() + (new Date().getMinutes() / 60);

        for (let i = 0; i <= 24; i++) {
            // X-Axis Labels (e.g., 2PM, 4PM)
            let ampm = i >= 12 && i < 24 ? 'PM' : 'AM';
            let h = i % 12 || 12;
            todayLabels.push(`${h}${ampm}`);

            // The Grey Schedule Line (Handles midnight rollover)
            let isScheduled = false;
            if (endH <= 24) isScheduled = (i >= startH && i < endH);
            else isScheduled = (i >= startH || i < (endH - 24));
            scheduleData.push(isScheduled ? 1 : 0);

            // The Actual Progress Line
            if (i <= currentHour) {
                // If ESP32 recorded active minutes in this hour, it ran!
                let isActive = analyticsData.today.hourlyGraph[i] > 0;
                actualData.push(isActive ? 1 : 0);
            } else {
                actualData.push(null); // Don't draw the future
            }
        }
    }

    createChartCard(
        "Today's Hourly Activity", 
        [
            { label: "Total Active", value: analyticsData.today.totalActive, color: "text-white" },
            { label: "Load Shedding", value: analyticsData.today.loadShedding, color: "text-red-500" }
        ],
        (ctx) => ({
            type: 'line',
            data: {
                labels: todayLabels,
                datasets: [
                    {
                        label: 'Schedule Target',
                        data: scheduleData,
                        borderColor: '#374151', // Grey-700
                        borderWidth: 2,
                        stepped: 'middle',
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'Actual Progress',
                        data: actualData,
                        borderWidth: 3,
                        stepped: 'middle',
                        fill: true,
                        backgroundColor: getGradient(ctx, 0, 242, 254), // Aqua Gradient
                        pointRadius: 0,
                        segment: {
                            borderColor: (ctx) => {
                                const i = ctx.p0DataIndex;
                                // 🔥 THE LOAD SHEDDING HIGHLIGHT:
                                // If it was supposed to be ON, but the actual data is OFF -> Turn Red!
                                if (scheduleData[i] === 1 && actualData[i] === 0) return '#ef4444'; // Red
                                return '#00f2fe'; // Cyan
                            }
                        }
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { 
                        min: -0.1, max: 1.1, 
                        ticks: { stepSize: 1, callback: v => v === 1 ? 'ON' : v === 0 ? 'OFF' : '' }, 
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } 
                    },
                    x: { 
                        grid: { display: false }, 
                        // To make it look clean like Aqua Fish, only show every 2 hours
                        ticks: { maxTicksLimit: 12, maxRotation: 45, minRotation: 45, callback: function(val, index) { return index % 2 === 0 ? this.getLabelForValue(val) : ''; } } 
                    }
                }
            }
        })
    );


    // ==========================================
    // 2. 7-DAY GRAPH (Cyan Area & Hollow Dots)
    // ==========================================
    const getLast7DaysLabels = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const labels = [];
        const today = new Date().getDay();
        for (let i = 6; i >= 0; i--) labels.push(days[(today - i + 7) % 7]);
        return labels;
    };

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
                    backgroundColor: getGradient(ctx, 0, 242, 254),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4, 
                    pointBackgroundColor: '#121212', 
                    pointBorderColor: '#00f2fe',     
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.1)', drawBorder: false } }, 
                    x: { grid: { display: false } } 
                }
            }
        })
    );


    // ==========================================
    // 3. 30-DAY GRAPH (Purple Area, No Dots)
    // ==========================================
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
                    backgroundColor: getGradient(ctx, 168, 85, 247),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.1)', drawBorder: false } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } 
                }
            }
        })
    );
}