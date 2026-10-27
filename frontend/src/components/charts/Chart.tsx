import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  HeatmapChart,
  SankeyChart,
  ScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Download } from "lucide-react";
import { usePreferences } from "../../hooks/context";
echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  SankeyChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  ToolboxComponent,
  CanvasRenderer,
]);
export default function Chart({
  option,
  title,
  height = 280,
  onSelect,
}: {
  option: any;
  title: string;
  height?: number;
  onSelect?: (value: any) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts>(null);
  const { reduced } = usePreferences();
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, {
      renderer: "canvas",
    });
    instance.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);
  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    chart.setOption(
      {
        backgroundColor: "transparent",
        color: ["#35d9ff", "#8b5cf6", "#ff986b", "#36e4b5"],
        textStyle: { color: "#94a3b8", fontFamily: "Inter, sans-serif" },
        animation: !reduced,
        tooltip: {
          trigger: "axis",
          backgroundColor: "#121c2d",
          borderColor: "#34445a",
          textStyle: { color: "#f3f6fc" },
        },
        grid: { left: 52, right: 24, top: 32, bottom: 54 },
        ...option,
      },
      true,
    );
    chart.off("click");
    if (onSelect) chart.on("click", onSelect);
  }, [option, reduced, onSelect]);
  return (
    <div className="chart-wrap">
      <button
        className="chart-export icon-button"
        title={"Export " + title + " as PNG"}
        onClick={() => {
          const a = document.createElement("a");
          a.href = instance.current!.getDataURL({
            type: "png",
            pixelRatio: 2,
            backgroundColor: "#101725",
          });
          a.download = title + ".png";
          a.click();
        }}
      >
        <Download size={14} />
      </button>
      <div
        ref={element}
        style={{ height, width: "100%" }}
        role="img"
        aria-label={title}
      />
    </div>
  );
}
export function timeOption(rows: any[], key = "hour", rolling = false) {
  return {
    xAxis: {
      type: "category",
      data: rows.map((r) =>
        key === "hour" ? String(r[key]).padStart(2, "0") + ":00" : r[key],
      ),
      axisLine: { lineStyle: { color: "#293246" } },
    },
    yAxis: {
      type: "value",
      name: "Trips",
      splitLine: { lineStyle: { color: "#1c2637" } },
    },
    dataZoom: [
      { type: "inside" },
      {
        type: "slider",
        height: 12,
        bottom: 4,
        borderColor: "transparent",
        fillerColor: "#35d9ff22",
      },
    ],
    series: [
      {
        name: "Observed trips",
        type: "line",
        smooth: 0.25,
        showSymbol: false,
        lineStyle: { width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#35d9ff35" },
              { offset: 1, color: "#35d9ff00" },
            ],
          },
        },
        data: rows.map((r) => r.trips),
      },
      ...(rolling
        ? [
            {
              name: "7-day rolling average",
              type: "line",
              showSymbol: false,
              data: rows.map((_, i) =>
                i < 6
                  ? null
                  : rows.slice(i - 6, i + 1).reduce((s, r) => s + r.trips, 0) /
                    7,
              ),
            },
          ]
        : []),
    ],
  };
}
