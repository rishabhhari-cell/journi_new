/**
 * Gantt Chart Component with Drag-to-Resize Functionality
 * Displays tasks on a timeline with editable date ranges
 */
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Task } from '@/types';
import { format } from 'date-fns';
import {
  calculateTaskBar,
  pixelToDate,
  getMonthLabels,
  getDateRange,
} from '@/lib/date-utils';

interface GanttChartProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskClick?: (taskId: string) => void;
}

const statusConfig = {
  completed: { color: 'bg-status-completed', label: 'Completed', textColor: 'text-white' },
  progress: { color: 'bg-status-progress', label: 'In Progress', textColor: 'text-white' },
  pending: { color: 'bg-status-pending', label: 'Pending', textColor: 'text-white' },
  delayed: { color: 'bg-status-delayed', label: 'Delayed', textColor: 'text-white' },
  upcoming: { color: 'bg-status-upcoming', label: 'Upcoming', textColor: 'text-white' },
};

export default function GanttChart({ tasks, onTaskUpdate, onTaskClick }: GanttChartProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragEdge, setDragEdge] = useState<'start' | 'end' | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Calculate date range for the chart (earliest task start to latest task end + buffer)
  const { rangeStart, rangeEnd } = getDateRange(tasks);
  const monthLabels = getMonthLabels(rangeStart, rangeEnd);

  // Handle mouse down on bar edges
  const handleEdgeMouseDown = (
    e: React.MouseEvent,
    taskId: string,
    edge: 'start' | 'end'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragTaskId(taskId);
    setDragEdge(edge);
  };

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragTaskId || !dragEdge || !chartRef.current) return;

      const chartRect = chartRef.current.getBoundingClientRect();
      const chartWidth = chartRect.width - 160; // Subtract task name column width
      const mouseX = e.clientX - chartRect.left - 160; // Offset by task name column
      const percentage = Math.max(0, Math.min(100, (mouseX / chartWidth) * 100));

      // Convert percentage to date
      const newDate = pixelToDate(percentage, rangeStart, rangeEnd);

      // Find the task being dragged
      const task = tasks.find((t) => t.id === dragTaskId);
      if (!task) return;

      // Update the task date
      if (dragEdge === 'start') {
        // Ensure start date is before end date
        if (newDate < task.endDate) {
          onTaskUpdate(dragTaskId, { startDate: newDate });
        }
      } else {
        // Ensure end date is after start date
        if (newDate > task.startDate) {
          onTaskUpdate(dragTaskId, { endDate: newDate });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragTaskId(null);
      setDragEdge(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragTaskId, dragEdge, tasks, onTaskUpdate, rangeStart, rangeEnd]);

  return (
    <div ref={chartRef} className="select-none">
      {/* Month headers */}
      <div className="flex mb-4">
        <div className="w-40 shrink-0" />
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${monthLabels.length}, 1fr)` }}>
          {monthLabels.map((label, idx) => (
            <div key={idx} className="text-xs font-medium text-muted-foreground text-center">
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Gantt Rows */}
      <div className="space-y-3">
        {tasks.map((task, i) => {
          const config = statusConfig[task.status];
          const { left, width } = calculateTaskBar(
            task.startDate,
            task.endDate,
            rangeStart,
            rangeEnd
          );

          const isBeingDragged = dragTaskId === task.id;

          return (
            <motion.div
              key={task.id}
              className="flex items-center group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              {/* Task Name */}
              <div className="w-40 shrink-0 pr-4">
                <p
                  className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-journi-green transition-colors"
                  onClick={() => onTaskClick?.(task.id)}
                  title={task.name}
                >
                  {task.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(task.startDate, 'MMM d')} – {format(task.endDate, 'MMM d')}
                </p>
              </div>

              {/* Timeline Track */}
              <div className="flex-1 relative h-9 bg-muted/50 rounded-md">
                {/* Grid lines */}
                {[20, 40, 60, 80].map((pos) => (
                  <div
                    key={pos}
                    className="absolute top-0 bottom-0 w-px bg-border"
                    style={{ left: `${pos}%` }}
                  />
                ))}

                {/* Task Bar */}
                <div
                  className={`absolute top-1 bottom-1 rounded-md ${config.color} flex items-center justify-center cursor-pointer hover:opacity-90 transition-all ${
                    isBeingDragged ? 'ring-2 ring-journi-green ring-offset-2' : ''
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                  onClick={() => onTaskClick?.(task.id)}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-l-md group/handle"
                    onMouseDown={(e) => handleEdgeMouseDown(e, task.id, 'start')}
                  >
                    <div className="absolute inset-y-1/2 left-0.5 w-0.5 h-3 -translate-y-1/2 bg-white/40 rounded-full opacity-0 group-hover/handle:opacity-100" />
                  </div>

                  {/* Label */}
                  <span className={`text-[10px] font-semibold ${config.textColor} whitespace-nowrap px-2 pointer-events-none`}>
                    {config.label}
                  </span>

                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-r-md group/handle"
                    onMouseDown={(e) => handleEdgeMouseDown(e, task.id, 'end')}
                  >
                    <div className="absolute inset-y-1/2 right-0.5 w-0.5 h-3 -translate-y-1/2 bg-white/40 rounded-full opacity-0 group-hover/handle:opacity-100" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border">
        {Object.entries(statusConfig).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-sm ${val.color}`} />
            <span className="text-xs text-muted-foreground">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
