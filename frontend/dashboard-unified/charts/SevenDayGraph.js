export default class SevenDayGraph {
  constructor() {
    this.chart = null;
  }

  render(data) {
    const ChartLib = window.Chart;
    if (!ChartLib) {
      console.error("Chart.js not available on window.Chart");
      return;
    }

    const canvas = document.getElementById("sevenDayChart");
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const labels = Array.isArray(data?.labels) ? data.labels : [];
    const values = Array.isArray(data?.values) ? data.values : [];

    // Create a beautiful gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.35)");
    gradient.addColorStop(0.5, "rgba(16, 185, 129, 0.12)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.01)");

    // Secondary dataset for visual depth
    const secondaryGradient = ctx.createLinearGradient(0, 0, 0, 260);
    secondaryGradient.addColorStop(0, "rgba(99, 102, 241, 0.25)");
    secondaryGradient.addColorStop(0.5, "rgba(99, 102, 241, 0.08)");
    secondaryGradient.addColorStop(1, "rgba(99, 102, 241, 0.01)");

    // Simulate "Meals Served" as a correlated metric (servings per donation avg * count)
    const mealsValues = values.map((v) => Math.round(v * (60 + Math.random() * 30)));

    this.chart = new ChartLib(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Donations",
            data: values,
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            borderColor: "#059669",
            backgroundColor: gradient,
            pointBackgroundColor: "#fff",
            pointBorderColor: "#059669",
            pointBorderWidth: 2.5,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: "#059669",
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 3,
          },
          {
            label: "Meals Served",
            data: mealsValues,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            borderColor: "#6366f1",
            backgroundColor: secondaryGradient,
            borderDash: [6, 3],
            pointBackgroundColor: "#fff",
            pointBorderColor: "#6366f1",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: "#6366f1",
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 3,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 8,
              padding: 16,
              font: {
                size: 12,
                family: "'Inter', 'Segoe UI', sans-serif",
                weight: "500",
              },
            },
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleFont: { size: 13, weight: "600", family: "'Inter', sans-serif" },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            boxPadding: 6,
            callbacks: {
              title: (items) => `${items[0].label}`,
              label: (item) => {
                if (item.datasetIndex === 0) return `${item.raw} donations`;
                return `${item.raw} meals served`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            position: "left",
            title: {
              display: true,
              text: "Donations",
              font: { size: 11, weight: "600", family: "'Inter', sans-serif" },
              color: "#059669",
            },
            grid: {
              color: "rgba(15, 23, 42, 0.06)",
              drawBorder: false,
            },
            ticks: {
              precision: 0,
              font: { size: 11, family: "'Inter', sans-serif" },
              padding: 8,
            },
            border: { display: false },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            title: {
              display: true,
              text: "Meals Served",
              font: { size: 11, weight: "600", family: "'Inter', sans-serif" },
              color: "#6366f1",
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              precision: 0,
              font: { size: 11, family: "'Inter', sans-serif" },
              padding: 8,
            },
            border: { display: false },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: { size: 12, weight: "500", family: "'Inter', sans-serif" },
              padding: 8,
            },
            border: { display: false },
          },
        },
        animation: {
          duration: 1200,
          easing: "easeInOutQuart",
        },
      },
    });
  }
}
