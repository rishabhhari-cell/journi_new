/**
 * Journi Project Dashboard
 * Sidebar nav (Linear-style) with Overview, Tasks, Team, Calendar, Publications
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  CheckSquare,
  Users,
  Calendar,
  BookOpen,
  Bell,
  Plus,
  AlertCircle,
  Timer,
  X,
  Send,
  PanelLeft,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import ProjectSwitcher from '@/components/ProjectSwitcher';
import ListView from '@/components/dashboard/ListView';
import TaskDialog from '@/components/dashboard/TaskDialog';
import CollaboratorManager from '@/components/dashboard/CollaboratorManager';
import { useProject } from '@/contexts/ProjectContext';
import type { Task, TaskFormData } from '@/types';
import { format, differenceInDays } from 'date-fns';

type DashboardTab = 'overview' | 'tasks' | 'team' | 'calendar' | 'publications';

const sidebarItems: { icon: any; label: string; tab: DashboardTab }[] = [
  { icon: LayoutGrid,   label: 'Overview',      tab: 'overview'      },
  { icon: CheckSquare,  label: 'Tasks',         tab: 'tasks'         },
  { icon: Users,        label: 'Team',          tab: 'team'          },
  { icon: Calendar,     label: 'Calendar',      tab: 'calendar'      },
  { icon: BookOpen,     label: 'Publications',  tab: 'publications'  },
];

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  completed: { color: 'bg-status-completed', bg: 'bg-status-completed/15', label: 'Completed' },
  progress:  { color: 'bg-status-progress',  bg: 'bg-status-progress/15',  label: 'In Progress' },
  pending:   { color: 'bg-status-pending',   bg: 'bg-status-pending/15',   label: 'Pending' },
  delayed:   { color: 'bg-status-delayed',   bg: 'bg-status-delayed/15',   label: 'Delayed' },
  upcoming:  { color: 'bg-status-upcoming',  bg: 'bg-status-upcoming/15',  label: 'Upcoming' },
};

export default function Dashboard() {
  const {
    project,
    activities,
    addTask,
    updateTask,
    deleteTask,
    addCollaborator,
    removeCollaborator,
    updateCollaborator,
  } = useProject();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const safeDate = (d: any): Date => (d instanceof Date ? d : new Date(d));

  const completedTasks = project.tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = project.tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const delayedTasks = project.tasks.filter((t) => t.status === 'delayed').length;

  const now = new Date();
  const daysUntilDue = project.dueDate
    ? differenceInDays(safeDate(project.dueDate), now)
    : null;

  // Urgent tasks: delayed OR due within 7 days
  const urgentTasks = project.tasks
    .filter((t) => {
      if (t.status === 'completed') return false;
      if (t.status === 'delayed') return true;
      const days = differenceInDays(safeDate(t.endDate), now);
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => safeDate(a.endDate).getTime() - safeDate(b.endDate).getTime())
    .slice(0, 5);

  const upcomingDeadlines = project.tasks
    .filter((t) => t.status !== 'completed' && safeDate(t.endDate) > now)
    .sort((a, b) => safeDate(a.endDate).getTime() - safeDate(b.endDate).getTime())
    .slice(0, 4);

  const tasksByMonth: Record<string, Task[]> = {};
  project.tasks.forEach((task) => {
    const monthKey = format(safeDate(task.startDate), 'MMMM yyyy');
    if (!tasksByMonth[monthKey]) tasksByMonth[monthKey] = [];
    tasksByMonth[monthKey].push(task);
  });

  const handleOpenNewTaskDialog = () => {
    setEditingTask(undefined);
    setIsTaskDialogOpen(true);
  };

  const handleOpenEditTaskDialog = (taskId: string) => {
    const task = project.tasks.find((t) => t.id === taskId);
    setEditingTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleTaskSubmit = (taskData: TaskFormData) => {
    if (editingTask) {
      updateTask(editingTask.id, taskData);
    } else {
      addTask(taskData);
    }
  };

  const tabHeadings: Record<DashboardTab, { title: string; subtitle: string }> = {
    overview:     { title: 'Overview',           subtitle: `${project.title} — project snapshot` },
    tasks:        { title: 'Tasks',              subtitle: 'Manage tasks and milestones' },
    team:         { title: 'Team',               subtitle: 'Manage collaborators and roles' },
    calendar:     { title: 'Calendar',           subtitle: 'Tasks and deadlines by date' },
    publications: { title: 'Publications',       subtitle: 'Track your journal submissions' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:relative top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-auto
          flex flex-col w-64 bg-card border-r border-border pt-6 pb-4 shrink-0 z-20
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Project switcher + stats */}
          <div className="px-4 mb-4">
            <ProjectSwitcher variant="sidebar" onSwitch={() => setSidebarOpen(false)} />
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-progress/15 text-status-progress text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-status-progress" />
                In Progress
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {project.collaborators.length} members &middot; {totalTasks} tasks &middot; {progressPercentage}% done
            </p>
            {/* Progress bar */}
            <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-journi-green rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 space-y-0.5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Project
            </p>
            {sidebarItems.map((item) => (
              <button
                key={item.tab}
                onClick={() => { setActiveTab(item.tab); setSidebarOpen(false); }}
                className={`
                  relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${activeTab === item.tab
                    ? 'bg-journi-green/10 text-journi-green'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }
                `}
              >
                {activeTab === item.tab && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-journi-green rounded-full" />
                )}
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Bottom: first collaborator */}
          {project.collaborators[0] && (
            <div className="px-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-journi-green/20 flex items-center justify-center text-xs font-bold text-journi-green shrink-0">
                  {project.collaborators[0].initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{project.collaborators[0].name}</p>
                  <p className="text-xs text-muted-foreground truncate">{project.collaborators[0].email}</p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 max-w-[1400px]">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {/* Mobile sidebar toggle */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <PanelLeft size={18} />
                </button>
                <div>
                  <h1 className="text-2xl font-extrabold text-foreground">
                    {tabHeadings[activeTab].title}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {tabHeadings[activeTab].subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Notification bell */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground relative"
                  >
                    <Bell size={18} />
                    {activities.length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-status-delayed rounded-full" />
                    )}
                  </button>
                  {showNotifications && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                      <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-40 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                          <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                          <button onClick={() => setShowNotifications(false)} className="text-muted-foreground hover:text-foreground">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {activities.slice(0, 8).map((activity) => (
                            <div key={activity.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-journi-green/15 flex items-center justify-center text-[9px] font-bold text-journi-green shrink-0">
                                  {activity.userInitials}
                                </div>
                                <p className="text-xs text-foreground">
                                  <span className="font-medium">{activity.userName}</span>{' '}
                                  <span className="text-muted-foreground">{activity.action}</span>
                                </p>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1 ml-8">
                                {format(safeDate(activity.timestamp), 'MMM d, h:mm a')}
                              </p>
                            </div>
                          ))}
                          {activities.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-6">No notifications</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {activeTab === 'tasks' && (
                  <button
                    onClick={handleOpenNewTaskDialog}
                    className="inline-flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <Plus size={16} />
                    New Task
                  </button>
                )}
              </div>
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Stats row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Tasks Complete',
                      value: `${completedTasks}/${totalTasks}`,
                      sub: `${progressPercentage}% done`,
                      icon: CheckSquare,
                      accent: 'text-journi-green',
                      bg: 'bg-journi-green/10',
                    },
                    {
                      label: 'Team Members',
                      value: project.collaborators.length,
                      sub: 'collaborators',
                      icon: Users,
                      accent: 'text-blue-500',
                      bg: 'bg-blue-500/10',
                    },
                    {
                      label: 'Delayed Tasks',
                      value: delayedTasks,
                      sub: delayedTasks > 0 ? 'need attention' : 'on track',
                      icon: AlertCircle,
                      accent: delayedTasks > 0 ? 'text-status-delayed' : 'text-status-completed',
                      bg: delayedTasks > 0 ? 'bg-status-delayed/10' : 'bg-status-completed/10',
                    },
                    {
                      label: 'Days Until Due',
                      value: daysUntilDue != null ? daysUntilDue : '—',
                      sub: project.dueDate ? format(safeDate(project.dueDate), 'MMM d, yyyy') : 'No due date',
                      icon: Clock,
                      accent: daysUntilDue != null && daysUntilDue <= 14 ? 'text-amber-500' : 'text-muted-foreground',
                      bg: daysUntilDue != null && daysUntilDue <= 14 ? 'bg-amber-500/10' : 'bg-muted',
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                          <p className={`text-2xl font-extrabold ${stat.accent}`}>{stat.value}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                        </div>
                        <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                          <stat.icon size={18} className={stat.accent} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Urgent tasks + Team snapshot */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Urgent / Key tasks */}
                  <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <AlertCircle size={16} className="text-status-delayed" />
                        Urgent & Key Tasks
                      </h2>
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className="text-xs text-journi-green hover:underline flex items-center gap-1"
                      >
                        View all <ArrowRight size={12} />
                      </button>
                    </div>
                    {urgentTasks.length === 0 ? (
                      <div className="py-8 text-center">
                        <TrendingUp size={24} className="text-journi-green mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No urgent tasks — great work!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {urgentTasks.map((task) => {
                          const cfg = statusConfig[task.status] || statusConfig.pending;
                          const daysLeft = differenceInDays(safeDate(task.endDate), now);
                          const assignees = project.collaborators.filter((c) =>
                            task.assignedTo?.includes(c.id)
                          );
                          return (
                            <div
                              key={task.id}
                              onClick={() => handleOpenEditTaskDialog(task.id)}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-border"
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.color}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Due {format(safeDate(task.endDate), 'MMM d')}
                                  {daysLeft === 0 ? ' — today!' : daysLeft < 0 ? ` — ${Math.abs(daysLeft)}d overdue` : ` — ${daysLeft}d left`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${task.status === 'delayed' ? 'text-status-delayed' : 'text-foreground'}`}>
                                  {cfg.label}
                                </span>
                                {assignees.length > 0 && (
                                  <div className="flex -space-x-1.5 ml-1">
                                    {assignees.slice(0, 2).map((a) => (
                                      <div key={a.id} className="w-6 h-6 rounded-full bg-journi-green/20 border-2 border-card flex items-center justify-center text-[9px] font-bold text-journi-green">
                                        {a.initials}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Team snapshot */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Users size={16} className="text-blue-500" />
                        Team
                      </h2>
                      <button
                        onClick={() => setActiveTab('team')}
                        className="text-xs text-journi-green hover:underline flex items-center gap-1"
                      >
                        Manage <ArrowRight size={12} />
                      </button>
                    </div>
                    {project.collaborators.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No team members yet</p>
                    ) : (
                      <div className="space-y-2.5">
                        {project.collaborators.slice(0, 5).map((c) => (
                          <div key={c.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-journi-green/20 flex items-center justify-center text-xs font-bold text-journi-green shrink-0">
                              {c.initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {c.role.replace('_', ' ')}
                              </p>
                            </div>
                            {c.online && (
                              <span className="w-2 h-2 rounded-full bg-journi-green shrink-0" title="Online" />
                            )}
                          </div>
                        ))}
                        {project.collaborators.length > 5 && (
                          <p className="text-xs text-muted-foreground pt-1">
                            +{project.collaborators.length - 5} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h2 className="text-sm font-bold text-foreground mb-4">Recent Activity</h2>
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recent activity</p>
                  ) : (
                    <div className="space-y-3">
                      {activities.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-journi-green/15 flex items-center justify-center text-[10px] font-bold text-journi-green shrink-0">
                              {activity.userInitials}
                            </div>
                            <p className="text-sm text-foreground">
                              <span className="font-medium">{activity.userName}</span>{' '}
                              <span className="text-muted-foreground">{activity.action}</span>
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                            {format(safeDate(activity.timestamp), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Publications snapshot */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-journi-green/10 flex items-center justify-center">
                        <Send size={18} className="text-journi-green" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Publication Tracking</p>
                        <p className="text-xs text-muted-foreground">Manage journal submissions and review status</p>
                      </div>
                    </div>
                    <a
                      href="/publication"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-journi-green hover:underline"
                    >
                      Open portal <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TASKS TAB ── */}
            {activeTab === 'tasks' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Task list */}
                  <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-foreground">All Tasks</h2>
                      <button
                        onClick={handleOpenNewTaskDialog}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-journi-green hover:underline"
                      >
                        <Plus size={13} /> Add task
                      </button>
                    </div>
                    {project.tasks.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground mb-4">No tasks yet. Create your first task!</p>
                        <button
                          onClick={handleOpenNewTaskDialog}
                          className="inline-flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                        >
                          <Plus size={16} /> Create Task
                        </button>
                      </div>
                    ) : (
                      <ListView
                        tasks={project.tasks}
                        collaborators={project.collaborators}
                        onTaskClick={handleOpenEditTaskDialog}
                        onTaskDelete={deleteTask}
                      />
                    )}
                  </div>

                  {/* Upcoming deadlines */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4">Upcoming Deadlines</h3>
                    {upcomingDeadlines.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No upcoming deadlines</p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingDeadlines.map((task) => {
                          const endDate = safeDate(task.endDate);
                          const daysLeft = differenceInDays(endDate, now);
                          const isUrgent = daysLeft <= 7;
                          return (
                            <div
                              key={task.id}
                              className="flex items-start gap-3 cursor-pointer hover:bg-accent/50 rounded-lg p-2 -m-2 transition-colors"
                              onClick={() => handleOpenEditTaskDialog(task.id)}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUrgent ? 'bg-status-delayed/15' : 'bg-journi-green/15'}`}>
                                {isUrgent
                                  ? <AlertCircle size={16} className="text-status-delayed" />
                                  : <Timer size={16} className="text-journi-green" />
                                }
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{task.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Due: {format(endDate, 'MMM d, yyyy')} ({daysLeft}d)
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TEAM TAB ── */}
            {activeTab === 'team' && (
              <motion.div
                className="bg-card rounded-xl border border-border p-6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CollaboratorManager
                  collaborators={project.collaborators}
                  onAddCollaborator={addCollaborator}
                  onRemoveCollaborator={removeCollaborator}
                  onUpdateCollaborator={updateCollaborator}
                />
              </motion.div>
            )}

            {/* ── CALENDAR TAB ── */}
            {activeTab === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {Object.keys(tasksByMonth).length === 0 ? (
                  <div className="bg-card rounded-xl border border-border p-12 text-center">
                    <Calendar size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No tasks scheduled yet</p>
                    <button
                      onClick={() => { setActiveTab('tasks'); handleOpenNewTaskDialog(); }}
                      className="inline-flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Plus size={16} /> Create Task
                    </button>
                  </div>
                ) : (
                  Object.entries(tasksByMonth).map(([month, tasks]) => (
                    <div key={month} className="bg-card rounded-xl border border-border p-5">
                      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <Calendar size={16} className="text-journi-green" />
                        {month}
                      </h3>
                      <div className="space-y-3">
                        {tasks.map((task) => {
                          const cfg = statusConfig[task.status] || { color: 'bg-muted', bg: 'bg-muted/15', label: task.status };
                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-accent/50 cursor-pointer transition-colors"
                              onClick={() => { setActiveTab('tasks'); handleOpenEditTaskDialog(task.id); }}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.color}`} />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{task.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(safeDate(task.startDate), 'MMM d')} – {format(safeDate(task.endDate), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.bg} text-foreground`}>
                                {cfg.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* ── PUBLICATIONS TAB ── */}
            {activeTab === 'publications' && (
              <motion.div
                className="bg-card rounded-xl border border-border p-6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-xl bg-journi-green/10 flex items-center justify-center mx-auto mb-4">
                    <Send size={28} className="text-journi-green" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Publication Tracking</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Manage your journal submissions and track review progress in the Publication Portal.
                  </p>
                  <a
                    href="/publication"
                    className="inline-flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <BookOpen size={16} />
                    Go to Publication Portal
                  </a>
                </div>
              </motion.div>
            )}
          </div>
        </main>
      </div>

      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        onSubmit={handleTaskSubmit}
        task={editingTask}
        collaborators={project.collaborators}
      />
    </div>
  );
}
