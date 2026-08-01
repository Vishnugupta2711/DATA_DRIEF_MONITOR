// import { useEffect, useRef } from "react";
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   LineController,
//   Tooltip,
//   Legend,
//   Filler,
// } from "chart.js";

// ChartJS.register(
//   LineController,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Tooltip,
//   Legend,
//   Filler
// );

// export default function DriftChart({
//   labels,
//   values,
//   thresholds = null,
//   showPrediction = false,
// }) {
//   const canvasRef = useRef(null);
//   const chartRef = useRef(null);

//   useEffect(() => {
//     if (!canvasRef.current) return;

//     // Destroy previous chart instance if it exists
//     if (chartRef.current) {
//       chartRef.current.destroy();
//     }

//     // Create gradient
//     const ctx = canvasRef.current.getContext("2d");
//     const gradient = ctx.createLinearGradient(0, 0, 0, 400);
//     gradient.addColorStop(0, "rgba(59, 130, 246, 0.5)");
//     gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.3)");
//     gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

//     // Create danger gradient for high drift areas
//     const dangerGradient = ctx.createLinearGradient(0, 0, 0, 400);
//     dangerGradient.addColorStop(0, "rgba(239, 68, 68, 0.4)");
//     dangerGradient.addColorStop(1, "rgba(239, 68, 68, 0)");

//     // Determine colors based on drift severity
//     const pointColors = values.map((v) => {
//       if (v >= 0.5) return "rgb(239, 68, 68)"; // High - Red
//       if (v >= 0.3) return "rgb(251, 146, 60)"; // Medium - Orange
//       return "rgb(34, 197, 94)"; // Low - Green
//     });

//     // Build datasets
//     const datasets = [
//       {
//         label: "Drift Score",
//         data: values,
//         borderColor: "rgb(59, 130, 246)",
//         backgroundColor: gradient,
//         borderWidth: 3,
//         tension: 0.4,
//         fill: true,
//         pointRadius: 6,
//         pointHoverRadius: 8,
//         pointBackgroundColor: pointColors,
//         pointBorderColor: "#fff",
//         pointBorderWidth: 2,
//         pointHoverBackgroundColor: pointColors,
//         pointHoverBorderColor: "#fff",
//         pointHoverBorderWidth: 3,
//         segment: {
//           borderColor: (ctx) => {
//             // Color segments based on drift level
//             const value = ctx.p1.parsed.y;
//             if (value >= 0.5) return "rgb(239, 68, 68)";
//             if (value >= 0.3) return "rgb(251, 146, 60)";
//             return "rgb(59, 130, 246)";
//           },
//         },
//       },
//     ];

//     // Add threshold lines if provided
//     const annotations = [];
//     if (thresholds) {
//       if (thresholds.high) {
//         annotations.push({
//           type: "line",
//           yMin: thresholds.high,
//           yMax: thresholds.high,
//           borderColor: "rgba(239, 68, 68, 0.7)",
//           borderWidth: 2,
//           borderDash: [5, 5],
//           label: {
//             content: "High Threshold",
//             enabled: true,
//             position: "end",
//             backgroundColor: "rgba(239, 68, 68, 0.8)",
//             color: "#fff",
//             font: {
//               size: 10,
//             },
//           },
//         });
//       }
//       if (thresholds.medium) {
//         annotations.push({
//           type: "line",
//           yMin: thresholds.medium,
//           yMax: thresholds.medium,
//           borderColor: "rgba(251, 146, 60, 0.7)",
//           borderWidth: 2,
//           borderDash: [5, 5],
//           label: {
//             content: "Medium Threshold",
//             enabled: true,
//             position: "end",
//             backgroundColor: "rgba(251, 146, 60, 0.8)",
//             color: "#fff",
//             font: {
//               size: 10,
//             },
//           },
//         });
//       }
//     }

//     chartRef.current = new ChartJS(canvasRef.current, {
//       type: "line",
//       data: {
//         labels,
//         datasets,
//       },
//       options: {
//         responsive: true,
//         maintainAspectRatio: false,
//         interaction: {
//           mode: "index",
//           intersect: false,
//         },
//         plugins: {
//           legend: {
//             display: true,
//             position: "top",
//             labels: {
//               color: "#e5e7eb",
//               font: {
//                 size: 12,
//                 weight: "500",
//               },
//               padding: 15,
//               usePointStyle: true,
//               pointStyle: "circle",
//               generateLabels: function (chart) {
//                 const original =
//                   ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
//                 // Add custom legend items for severity levels
//                 return [
//                   ...original,
//                   {
//                     text: "Low (<30%)",
//                     fillStyle: "rgb(34, 197, 94)",
//                     strokeStyle: "rgb(34, 197, 94)",
//                     lineWidth: 2,
//                     hidden: false,
//                     index: 1,
//                   },
//                   {
//                     text: "Medium (30-50%)",
//                     fillStyle: "rgb(251, 146, 60)",
//                     strokeStyle: "rgb(251, 146, 60)",
//                     lineWidth: 2,
//                     hidden: false,
//                     index: 2,
//                   },
//                   {
//                     text: "High (>50%)",
//                     fillStyle: "rgb(239, 68, 68)",
//                     strokeStyle: "rgb(239, 68, 68)",
//                     lineWidth: 2,
//                     hidden: false,
//                     index: 3,
//                   },
//                 ];
//               },
//             },
//           },
//           tooltip: {
//             enabled: true,
//             backgroundColor: "rgba(15, 23, 42, 0.95)",
//             titleColor: "#fff",
//             bodyColor: "#e5e7eb",
//             borderColor: "rgba(139, 92, 246, 0.5)",
//             borderWidth: 1,
//             padding: 14,
//             displayColors: true,
//             callbacks: {
//               title: function (context) {
//                 return context[0].label;
//               },
//               label: function (context) {
//                 const value = context.parsed.y;
//                 const percentage = (value * 100).toFixed(2);
//                 let severity = "Low";
//                 let emoji = "✅";

//                 if (value >= 0.5) {
//                   severity = "High";
//                   emoji = "🚨";
//                 } else if (value >= 0.3) {
//                   severity = "Medium";
//                   emoji = "⚠️";
//                 }

//                 return [
//                   `Drift Score: ${percentage}%`,
//                   `Severity: ${emoji} ${severity}`,
//                 ];
//               },
//               afterLabel: function (context) {
//                 const value = context.parsed.y;

//                 // Add recommendations
//                 if (value >= 0.5) {
//                   return [
//                     "",
//                     "💡 Action Required:",
//                     "• Consider model retraining",
//                     "• Review data pipeline",
//                   ];
//                 } else if (value >= 0.3) {
//                   return [
//                     "",
//                     "💡 Recommendation:",
//                     "• Monitor closely",
//                     "• Investigate causes",
//                   ];
//                 }
//                 return "";
//               },
//             },
//           },
//         },
//         scales: {
//           x: {
//             type: "category",
//             grid: {
//               display: true,
//               color: "rgba(255, 255, 255, 0.05)",
//               drawBorder: false,
//             },
//             ticks: {
//               color: "#9ca3af",
//               font: {
//                 size: 11,
//                 weight: "500",
//               },
//               maxRotation: 45,
//               minRotation: 0,
//               autoSkip: true,
//               maxTicksLimit: 10,
//             },
//             border: {
//               display: false,
//             },
//           },
//           y: {
//             beginAtZero: true,
//             max: 1,
//             grid: {
//               display: true,
//               color: "rgba(255, 255, 255, 0.08)",
//               drawBorder: false,
//             },
//             ticks: {
//               color: "#9ca3af",
//               font: {
//                 size: 11,
//                 weight: "500",
//               },
//               callback: function (value) {
//                 return (value * 100).toFixed(0) + "%";
//               },
//               stepSize: 0.1,
//             },
//             border: {
//               display: false,
//             },
//           },
//         },
//         animation: {
//           duration: 750,
//           easing: "easeInOutQuart",
//         },
//       },
//     });

//     return () => {
//       if (chartRef.current) {
//         chartRef.current.destroy();
//       }
//     };
//   }, [labels, values, thresholds, showPrediction]);

//   return (
//     <div style={{ position: "relative", height: "350px", width: "100%" }}>
//       <canvas ref={canvasRef} />
//     </div>
//   );
// }

// // Additional component for multi-metric comparison chart
// export function MultiMetricChart({ labels, datasets }) {
//   const canvasRef = useRef(null);
//   const chartRef = useRef(null);

//   useEffect(() => {
//     if (!canvasRef.current) return;

//     if (chartRef.current) {
//       chartRef.current.destroy();
//     }

//     // Create different gradients for each dataset
//     const colors = [
//       { border: "rgb(59, 130, 246)", bg: "rgba(59, 130, 246, 0.2)" },
//       { border: "rgb(139, 92, 246)", bg: "rgba(139, 92, 246, 0.2)" },
//       { border: "rgb(236, 72, 153)", bg: "rgba(236, 72, 153, 0.2)" },
//       { border: "rgb(34, 197, 94)", bg: "rgba(34, 197, 94, 0.2)" },
//     ];

//     const chartDatasets = datasets.map((dataset, idx) => ({
//       label: dataset.label,
//       data: dataset.data,
//       borderColor: colors[idx % colors.length].border,
//       backgroundColor: colors[idx % colors.length].bg,
//       borderWidth: 2,
//       tension: 0.4,
//       fill: true,
//       pointRadius: 4,
//       pointHoverRadius: 6,
//     }));

//     chartRef.current = new ChartJS(canvasRef.current, {
//       type: "line",
//       data: {
//         labels,
//         datasets: chartDatasets,
//       },
//       options: {
//         responsive: true,
//         maintainAspectRatio: false,
//         interaction: {
//           mode: "index",
//           intersect: false,
//         },
//         plugins: {
//           legend: {
//             display: true,
//             position: "top",
//             labels: {
//               color: "#e5e7eb",
//               font: {
//                 size: 12,
//               },
//               padding: 12,
//               usePointStyle: true,
//             },
//           },
//           tooltip: {
//             enabled: true,
//             backgroundColor: "rgba(15, 23, 42, 0.95)",
//             titleColor: "#fff",
//             bodyColor: "#e5e7eb",
//             borderColor: "rgba(139, 92, 246, 0.5)",
//             borderWidth: 1,
//             padding: 12,
//           },
//         },
//         scales: {
//           x: {
//             grid: {
//               color: "rgba(255, 255, 255, 0.05)",
//             },
//             ticks: {
//               color: "#9ca3af",
//             },
//           },
//           y: {
//             beginAtZero: true,
//             grid: {
//               color: "rgba(255, 255, 255, 0.05)",
//             },
//             ticks: {
//               color: "#9ca3af",
//             },
//           },
//         },
//       },
//     });

//     return () => {
//       if (chartRef.current) {
//         chartRef.current.destroy();
//       }
//     };
//   }, [labels, datasets]);

//   return (
//     <div style={{ position: "relative", height: "350px", width: "100%" }}>
//       <canvas ref={canvasRef} />
//     </div>
//   );
// }

// // Component for feature-level drift visualization
// export function FeatureDriftChart({ features }) {
//   const canvasRef = useRef(null);
//   const chartRef = useRef(null);

//   useEffect(() => {
//     if (!canvasRef.current || !features || features.length === 0) return;

//     if (chartRef.current) {
//       chartRef.current.destroy();
//     }

//     // Sort features by drift score
//     const sortedFeatures = [...features]
//       .sort((a, b) => b.drift_score - a.drift_score)
//       .slice(0, 10);
//     const labels = sortedFeatures.map((f) => f.name);
//     const values = sortedFeatures.map((f) => f.drift_score);

//     // Color bars based on drift level
//     const backgroundColors = values.map((v) => {
//       if (v >= 0.5) return "rgba(239, 68, 68, 0.7)";
//       if (v >= 0.3) return "rgba(251, 146, 60, 0.7)";
//       return "rgba(34, 197, 94, 0.7)";
//     });

//     chartRef.current = new ChartJS(canvasRef.current, {
//       type: "bar",
//       data: {
//         labels,
//         datasets: [
//           {
//             label: "Drift Score",
//             data: values,
//             backgroundColor: backgroundColors,
//             borderColor: backgroundColors.map((c) => c.replace("0.7", "1")),
//             borderWidth: 2,
//             borderRadius: 6,
//             borderSkipped: false,
//           },
//         ],
//       },
//       options: {
//         indexAxis: "y",
//         responsive: true,
//         maintainAspectRatio: false,
//         plugins: {
//           legend: {
//             display: false,
//           },
//           tooltip: {
//             backgroundColor: "rgba(15, 23, 42, 0.95)",
//             titleColor: "#fff",
//             bodyColor: "#e5e7eb",
//             padding: 12,
//             callbacks: {
//               label: function (context) {
//                 return `Drift: ${(context.parsed.x * 100).toFixed(1)}%`;
//               },
//             },
//           },
//         },
//         scales: {
//           x: {
//             beginAtZero: true,
//             max: 1,
//             grid: {
//               color: "rgba(255, 255, 255, 0.05)",
//             },
//             ticks: {
//               color: "#9ca3af",
//               callback: function (value) {
//                 return (value * 100).toFixed(0) + "%";
//               },
//             },
//           },
//           y: {
//             grid: {
//               display: false,
//             },
//             ticks: {
//               color: "#e5e7eb",
//               font: {
//                 size: 11,
//               },
//             },
//           },
//         },
//       },
//     });

//     return () => {
//       if (chartRef.current) {
//         chartRef.current.destroy();
//       }
//     };
//   }, [features]);

//   return (
//     <div style={{ position: "relative", height: "400px", width: "100%" }}>
//       <canvas ref={canvasRef} />
//     </div>
//   );
// }

import { useEffect, useRef } from "react";

const DriftChart = ({ labels = [], values = [] }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values.length) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 200 * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = "200px";
      ctx.scale(dpr, dpr);
    };

    resize();

    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const pad = { top: 24, right: 20, bottom: 36, left: 48 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    const maxV = Math.max(...values, 0.01);
    const minV = 0;
    const range = maxV - minV || 0.01;

    const getX = (i) =>
      pad.left + (i / Math.max(values.length - 1, 1)) * chartW;
    const getY = (v) => pad.top + chartH - ((v - minV) / range) * chartH;

    const draw = (progress) => {
      ctx.clearRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      const gridLines = 4;
      for (let i = 0; i <= gridLines; i++) {
        const y = pad.top + (i / gridLines) * chartH;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + chartW, y);
        ctx.stroke();

        // Y-axis labels
        const val = maxV - (i / gridLines) * maxV;
        ctx.fillStyle = "rgba(100,116,139,0.8)";
        ctx.font = `500 10px 'IBM Plex Mono', monospace`;
        ctx.textAlign = "right";
        ctx.fillText((val * 100).toFixed(0) + "%", pad.left - 8, y + 3.5);
      }

      // X-axis labels
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(100,116,139,0.7)";
      ctx.font = `500 9px 'IBM Plex Mono', monospace`;
      const labelStep = Math.max(1, Math.ceil(labels.length / 8));
      labels.forEach((label, i) => {
        if (i % labelStep !== 0 && i !== labels.length - 1) return;
        const x = getX(i);
        ctx.fillText(label, x, H - 8);
      });

      // Visible points up to progress
      const visibleCount = Math.max(2, Math.round(progress * values.length));
      const visibleValues = values.slice(0, visibleCount);

      if (visibleValues.length < 2) return;

      const gradientFill = ctx.createLinearGradient(
        0,
        pad.top,
        0,
        pad.top + chartH,
      );
      gradientFill.addColorStop(0, "rgba(59,130,246,0.22)");
      gradientFill.addColorStop(0.5, "rgba(59,130,246,0.08)");
      gradientFill.addColorStop(1, "rgba(59,130,246,0.01)");

      // Fill area
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(visibleValues[0]));
      visibleValues.forEach((v, i) => {
        if (i === 0) return;
        const x0 = getX(i - 1),
          y0 = getY(visibleValues[i - 1]);
        const x1 = getX(i),
          y1 = getY(v);
        const cpx = (x0 + x1) / 2;
        ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
      });
      ctx.lineTo(getX(visibleValues.length - 1), pad.top + chartH);
      ctx.lineTo(getX(0), pad.top + chartH);
      ctx.closePath();
      ctx.fillStyle = gradientFill;
      ctx.fill();

      // Line stroke gradient
      const lineGrad = ctx.createLinearGradient(
        pad.left,
        0,
        pad.left + chartW,
        0,
      );
      lineGrad.addColorStop(0, "rgba(59,130,246,0.5)");
      lineGrad.addColorStop(0.5, "#3b82f6");
      lineGrad.addColorStop(1, "#60a5fa");

      ctx.beginPath();
      ctx.moveTo(getX(0), getY(visibleValues[0]));
      visibleValues.forEach((v, i) => {
        if (i === 0) return;
        const x0 = getX(i - 1),
          y0 = getY(visibleValues[i - 1]);
        const x1 = getX(i),
          y1 = getY(v);
        const cpx = (x0 + x1) / 2;
        ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
      });
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // Threshold line at 30%
      const threshold = 0.3;
      const ty = getY(threshold);
      if (ty >= pad.top && ty <= pad.top + chartH) {
        ctx.beginPath();
        ctx.setLineDash([4, 6]);
        ctx.moveTo(pad.left, ty);
        ctx.lineTo(pad.left + chartW, ty);
        ctx.strokeStyle = "rgba(245,158,11,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(245,158,11,0.6)";
        ctx.font = "500 9px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("30% threshold", pad.left + 4, ty - 4);
      }

      // Dots on visible points
      ctx.setLineDash([]);
      visibleValues.forEach((v, i) => {
        const x = getX(i),
          y = getY(v);
        const isHigh = v > 0.5;
        const isMed = v > 0.3;
        const dotColor = isHigh ? "#ef4444" : isMed ? "#f59e0b" : "#3b82f6";

        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      });

      // Last point glow
      const lastX = getX(visibleValues.length - 1);
      const lastY = getY(visibleValues[visibleValues.length - 1]);
      const glow = ctx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 10);
      glow.addColorStop(0, "rgba(96,165,250,0.35)");
      glow.addColorStop(1, "rgba(96,165,250,0)");
      ctx.beginPath();
      ctx.arc(lastX, lastY, 10, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    };

    // Animate in
    progressRef.current = 0;
    const startTime = performance.now();
    const duration = 900;

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-out-cubic
      const progress = 1 - Math.pow(1 - t, 3);
      draw(progress);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    const ro = new ResizeObserver(() => {
      resize();
      draw(1);
    });
    ro.observe(canvas.parentElement);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [labels, values]);

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <canvas ref={canvasRef} style={{ display: "block", borderRadius: 6 }} />
    </div>
  );
};

export default DriftChart;