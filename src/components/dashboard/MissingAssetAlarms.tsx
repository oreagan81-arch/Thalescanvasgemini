import React, { useState, useEffect } from 'react';
import { AlertCircle, FileWarning, Search, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { canvasApiService } from '../../services/canvasApiService';
import { useThalesStore } from '../../store';

export function MissingAssetAlarms({ courseId, weekId }: { courseId: string, weekId: string }) {
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const canvasTokenConfigured = useThalesStore((state) => state.canvasTokenConfigured);

  // Simulated logic: find assignments that sound like they need a file
  // and check if a file with that name exists on Canvas
  useEffect(() => {
    const checkAssets = async () => {
      if (!courseId || !canvasTokenConfigured) return;
      setLoading(true);
      try {
        const files = await canvasApiService.getCourseFiles(courseId);
        const fileNames = files.map((f: any) => f.display_name.toLowerCase());
        
        // Mock targets for the demo week
        const targets = ['chapter_3_quiz', 'spelling_list_w1', 'math_lesson_4'];
        const missing = targets.filter(t => !fileNames.some(f => f.includes(t)));
        
        setMissingFiles(missing);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkAssets();
  }, [courseId, weekId, canvasTokenConfigured]);

  if (missingFiles.length === 0) return null;

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-600">
          <AlertCircle className="w-4 h-4" />
          Missing Asset Alarms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-amber-800/70">
          The AI detected mentioned assets in your Week Ahead that don't exist in Canvas /files:
        </p>
        <div className="space-y-2">
          {missingFiles.map(file => (
            <div key={file} className="flex items-center justify-between p-2 bg-white/50 rounded border border-amber-500/10">
              <div className="flex items-center gap-2">
                <FileWarning className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-mono font-medium truncate max-w-[150px]">{file}.pdf</span>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-600">
                <Search className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button className="w-full h-8 text-[10px] uppercase font-bold tracking-widest bg-amber-600 hover:bg-amber-700 text-white gap-2">
          Fix Orphaned References <ArrowRight className="w-3 h-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
