import { init, use } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, AriaComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, AriaComponent, SVGRenderer]);
const charts = new Map();
const font = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
const integer = value => Number(value).toLocaleString('ko-KR');
const ink = '#576dd0', light = '#c4cde5';
function mount(id, option, description) {
  const el = document.getElementById(id);
  if (!el) return;
  disposeChart(id);
  const chart = init(el, null, { renderer: 'svg' });
  chart.setOption({ animation: !matchMedia('(prefers-reduced-motion: reduce)').matches, animationDuration: 350, textStyle: { fontFamily: font, color: '#717989' }, aria: { enabled: true, label: { description } }, ...option });
  const observer = new ResizeObserver(() => { if (el.clientWidth && el.clientHeight && !chart.isDisposed()) chart.resize(); });
  observer.observe(el); charts.set(id, { chart, observer });
}
export function disposeChart(id) {
  const entry = charts.get(id);
  if (entry) { entry.observer.disconnect(); entry.chart.dispose(); charts.delete(id); }
}
export function clearCharts() { for (const id of [...charts.keys()]) disposeChart(id); }
export function resizeCharts() { for (const { chart } of charts.values()) if (chart.getDom().clientWidth) chart.resize(); }
const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 11, color: '#737d8c' } };
const tooltip = { trigger: 'axis', confine: true, backgroundColor: '#fff', borderColor: '#e5e8ef', padding: [12,16], textStyle: { fontFamily: font, fontSize: 12, color: '#333b4b' }, extraCssText: 'box-shadow:0 6px 24px rgba(24,35,58,.09);border-radius:8px' };
export function renderTrend(rows) {
  const extended = rows.length > 35;
  mount('trend-chart', {
    color: [ink, light],
    tooltip: { ...tooltip, valueFormatter: value => `${integer(value)}명` },
    legend: { data: ['활성 사용자','신규 가입'], top: 0, right: 0, itemWidth: 14, itemHeight: 8, itemGap: 20, textStyle: { fontFamily: font, fontSize: 11, color:'#687284' } },
    grid: { left: 42, right: 16, top: 52, bottom: extended ? 72 : 32 },
    xAxis: { ...axis, type: 'category', data: rows.map(b => b.date), axisLabel: { ...axis.axisLabel, hideOverlap: true, formatter: value => value.slice(5).replace('-','.') } },
    yAxis: { ...axis, type: 'value', min: 0, minInterval: 1, splitLine: { lineStyle: { color: '#edf0f5', type: 'dashed' } } },
    dataZoom: extended ? [{ type: 'slider', bottom: 6, height: 20, borderColor: '#e8ebf1', fillerColor:'#e4e9f6', handleStyle:{color:ink}, textStyle:{fontSize:10}, start: Math.max(0,100-35/rows.length*100), end:100 }] : [],
    series: [
      { name:'활성 사용자', type:'line', data:rows.map(b => b.activeUsers), symbol:'circle', symbolSize:5, showSymbol:rows.length <=14, lineStyle:{width:2.5}, itemStyle:{color:ink}, emphasis:{focus:'series'}, connectNulls:false },
      { name:'신규 가입', type:'bar', data:rows.map(b => b.members), barMaxWidth:24, itemStyle:{color:light,borderRadius:[3,3,0,0]}, emphasis:{focus:'series'} }
    ]
  }, '기간별 활성 사용자 선 그래프와 신규 가입 막대 그래프입니다. 정확한 수치는 아래 기간별 상세 지표 표에서 확인할 수 있습니다.');
}
export function renderRetention(summary) {
  const cohorts = ['d1','d7','d30'].map(key => ({ name:key.toUpperCase(), ...summary[key] }));
  mount('retention-chart', {
    tooltip: { ...tooltip, trigger:'item', formatter: p => { const c=cohorts[p.dataIndex]; return `${c.name} 리텐션<br>${(100*c.retained/c.eligible).toFixed(1)}% · ${integer(c.retained)} / ${integer(c.eligible)}명`; } },
    grid:{left:42,right:20,top:20,bottom:28},
    xAxis:{...axis,type:'category',data:cohorts.map(c=>c.name)},
    yAxis:{...axis,type:'value',min:0,max:100,interval:25,axisLabel:{...axis.axisLabel,formatter:'{value}%'},splitLine:{lineStyle:{color:'#edf0f5',type:'dashed'}}},
    series:[{type:'bar',barMaxWidth:60,data:cohorts.map(c=>c.eligible ? +(100*c.retained/c.eligible).toFixed(1) : null),itemStyle:{color:ink,borderRadius:[4,4,0,0]},label:{show:true,position:'top',fontSize:11,color:'#576282',formatter:'{c}%'}}]
  }, '가입 후 D1, D7, D30 리텐션입니다. 관찰 대상이 없는 구간은 막대를 표시하지 않습니다. 각 비율과 분모는 위의 요약 및 아래 코호트 표에 있습니다.');
}
