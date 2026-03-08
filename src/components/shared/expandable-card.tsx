'use client';

import { useState } from 'react';
import { Maximize2, MousePointer2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ExpandableCardProps {
  title: string;
  description?: string;
  interactionHint?: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}

export function ExpandableCard({ title, description, interactionHint, legend, children }: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
              {interactionHint && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-blue-600">
                  <MousePointer2 className="h-3 w-3 shrink-0" />
                  {interactionHint}
                </p>
              )}
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label={`Expand ${title}`}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {children}
          {legend && <div className="mt-3">{legend}</div>}
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="mt-4 min-h-[60vh]">
            {children}
            {legend && <div className="mt-3">{legend}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
