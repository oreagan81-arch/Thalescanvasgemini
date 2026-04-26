import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, MessageSquare, RefreshCw, Send } from 'lucide-react';

export const RecentActivity: React.FC = React.memo(() => {
  const activities = [
    { id: 1, type: 'assignment', text: 'Math Test 18 drafted by AI', time: '12m ago', icon: <Send className="w-3 h-3" /> },
    { id: 2, type: 'sync', text: 'Canvas Sync completed (14 resources)', time: '45m ago', icon: <RefreshCw className="w-3 h-3" /> },
    { id: 3, type: 'announcement', text: 'Weekly Update generated', time: '2h ago', icon: <MessageSquare className="w-3 h-3" /> },
    { id: 4, type: 'system', text: 'Thales OS kernel update applied', time: '5h ago', icon: <Activity className="w-3 h-3" /> }
  ];

  return (
    <Card className="rounded-2xl border border-white/10 bg-[#121216] h-full overflow-hidden">
      <CardHeader className="border-b border-white/5 px-6 py-5">
        <CardTitle className="text-slate-100 flex items-center gap-2 text-sm uppercase tracking-widest">
          <Activity className="w-4 h-4 text-blue-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/5">
          {activities.map((activity) => (
            <div key={activity.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                {activity.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{activity.text}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-6 text-center">
            <button className="text-[10px] items-center gap-1.5 font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors inline-flex">
                View Performance Audit
                <span className="text-xs">→</span>
            </button>
        </div>
      </CardContent>
    </Card>
  );
});
