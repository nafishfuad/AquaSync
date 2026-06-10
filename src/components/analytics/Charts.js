// src/components/analytics/Charts.js

export function renderCharts(container, analyticsData) {
    const template = document.getElementById("tpl-analytics-chart-card");
    if (!template) return;

    // Apply global Chart.js aesthetic defaults
    Chart.defaults.color = "#6b7280";
    Chart.defaults.font.family = "sans-serif";
    Chart.defaults.plugins.legend.display = false;

    // Factory function to spawn chart layouts safely with dynamic header columns
    const createChartCard = (title, statsArray, chartConfig) => {
        const clone = template.content.cloneNode(true);
        
        clone.querySelector(".tpl-chart-title").innerText = title;
        
        // Dynamically build the top stats grid (2 cols vs 3 cols)
        const statsGrid = clone.querySelector(".tpl-stats-grid");
        statsGrid.className = `grid grid-cols-${statsArray.length} gap-4 mb-4 pb-4 border-b border-gray-800/60 text-xs`;
        
        let statsHTML = "";
        statsArray.forEach((stat, index) => {
            // Logic to align text: Left, Center, Right
            let alignClass = "text-left";
            if (statsArray.length === 2 && index === 1) alignClass = "text-right";
            else if (statsArray.length === 3) {
                if (index === 1) alignClass = "text-center";
                if (index === 2) alignClass = "text-right";
            }

            statsHTML += `
                <div class="${alignClass}">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">${stat.label}</p>
                    <p class="text-lg font-bold ${stat.color}">${stat.value}</p>
                </div>
            `;
        });
        statsGrid.innerHTML = statsHTML;
        
        const canvas = clone.querySelector(".tpl-chart-canvas");
        container.appendChild(clone); 
        new Chart(canvas, chartConfig);
    };

    // --- Dynamic Time Generators ---
    
    // Generates ['3PM', '4PM', ... up to current hour]
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

    // Generates ['Thu', 'Fri', 'Sat', ...] ending on today
    const getLast7DaysLabels = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const labels = [];
        const today = new Date().getDay();
        for (let i = 6; i >= 0; i--) {
            labels.push(days[(today - i + 7) % 7]);
        }
        return labels;
    };


    // 1. TODAY'S HOURLY GRAPH (Stepped Line, 2 Columns)
    createChartCard(
        "Today's Hourly Activity", 
        [
            { label: "Total Active", value: analyticsData.today.totalActive, color: "text-white" },
            { label: "Load Shedding", value: analyticsData.today.loadShedding, color: "text-red-500" }
        ],
        {
            type: 'line',
            data: {
                labels: getLast24HoursLabels(),
                datasets: [{
                    data: analyticsData.today.hourlyGraph,
                    borderColor: '#00f2fe',
                    borderWidth: 2,
                    stepped: true,
                    fill: false,
                    pointRadius: 0
                }]
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
                        ticks: { maxTicksLimit: 12, maxRotation: 45, minRotation: 45 } 
                    }
                }
            }
        }
    );

    // 2. 7-DAY GRAPH (Aqua Curve with Hollow Points, 3 Columns)
    createChartCard(
        "7-Day Overview", 
        [
            { label: "Total Active", value: analyticsData.week.totalActive, color: "text-white" },
            { label: "Daily Avg", value: analyticsData.week.avgLight, color: "text-aqua" },
            { label: "Load Shedding", value: analyticsData.week.loadShedding, color: "text-red-500" }
        ],
        {
            type: 'line',
            data: {
                labels: getLast7DaysLabels(),
                datasets: [{
                    data: analyticsData.week.dailyGraph,
                    borderColor: '#00f2fe',
                    backgroundColor: 'rgba(0, 242, 254, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#121212', // Hollow center
                    pointBorderColor: '#00f2fe',     // Aqua ring
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false } } 
                }
            }
        }
    );

    // 3. 30-DAY GRAPH (Purple Smooth Area, 3 Columns)
    createChartCard(
        "30-Day Overview", 
        [
            { label: "Total Active", value: analyticsData.month.totalActive, color: "text-white" },
            { label: "Daily Avg", value: analyticsData.month.avgLight, color: "text-purple-400" },
            { label: "Load Shedding", value: analyticsData.month.loadShedding, color: "text-red-500" }
        ],
        {
            type: 'line',
            data: {
                labels: Array.from({length: 30}, (_, i) => i+1),
                datasets: [{
                    data: analyticsData.month.dailyGraph,
                    borderColor: '#a855f7', 
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0 // No points on the 30-day graph
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } 
                }
            }
        }
    );
}