import React from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, ReferenceLine, YAxis } from 'recharts';

const EvaluationGraph = ({ data, onMoveClick, currentIndex }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-48 bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm overflow-hidden flex flex-col mt-4">
      <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-700/50 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          Advantage Graph
        </h3>
        <span className="text-xs text-slate-500 font-mono">White (+) vs Black (-)</span>
      </div>
      
      <div className="flex-grow w-full p-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            onClick={(e) => {
              if (e && e.activeTooltipIndex !== undefined) {
                onMoveClick(e.activeTooltipIndex);
              }
            }}
            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            {currentIndex >= 0 && (
                <ReferenceLine x={currentIndex} stroke="#fff" strokeWidth={2} strokeDasharray="2 2" />
            )}
            <YAxis domain={[-8, 8]} hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
              itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
              formatter={(value) => [`${value > 0 ? '+' : ''}${value}`, 'Advantage']}
              labelFormatter={(index) => `Move ${Math.floor(index / 2) + 1}${index % 2 === 0 ? ' (White)' : ' (Black)'}`}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#evalGradient)" 
              activeDot={{ r: 4, fill: "#fff", stroke: "#10b981", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EvaluationGraph;