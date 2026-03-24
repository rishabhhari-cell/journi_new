/**
 * Journi Project Dashboard
 * Features task management, team collaboration, calendar, and publications
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  Bell,
  Plus,
  MoreHorizontal,
  AlertCircle,
  Timer,
  X,
  Send,
  PanelLeft,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import ProjectSwitcher from '@/components/ProjectSwitcher';
import ListView from '@/components/dashboard/ListView';
import TaskDialog from '@/components/dashboard/TaskDialog';
import CollaboratorManager from '@/components/dashboard/CollaboratorManager';
import { useProject } from '@/contexts/ProjectContext';
import type { Task, TaskFormData } from '@/types';
import { format } from 'date-fns';

type SidebarTab = 'projects' | 'team' | 'calendar' | 'publications';

const sidebarItems: { icon: any; label: string; tab: SidebarTab }[] = [
  { icon: LayoutDashboard, label: 'Projects', tab: 'projects' },
  { icon: Users, label: 'Team', tab: 'team' },
  { icon: Calendar, label: 'Calendar', tab: 'calendar' },
  { icon: BookOpen, label: 'Publications', tab: 'publications' },
];

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

  const [activeTab, setActiveTab] = useState<SidebarTab>('projects');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    updateTask(taskId, updates);
  };

  const completedTasks = project.tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = project.tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const safeDate = (d: any): Date => (d instanceof Date ? d : new Date(d));

  const now = new Date();
  const upcomingDeadlines = project.tasks
    .filter((t) => t.status !== 'completed' && safeDate(t.endDate) > now)
    .sort((a, b) => safeDate(a.endDate).getTime() - safeDate(b.endDate).getTime())
    .slice(0, 3);

  const tasksByMonth: Record<string, Task[]> = {};
  project.tasks.forEach((task) => {
    const monthKey = format(safeDate(task.startDate), 'MMMM yyyy');
    if (!tasksByMonth[monthKey]) tasksByMonth[monthKey] = [];
    tasksByMonth[monthKey].push(task);
  });

  const statusConfig: Record<string, { color: string; label: string }> = {
    completed: { color: 'bg-status-completed', label: 'Completed' },
    progress: { color: 'bg-status-progress', label: 'In Progress' },
    pending: { color: 'bg-status-pending', label: 'Pending' },
    delayed: { color: 'bg-status-delayed', label: 'Delayed' },
    upcoming: { color: 'bg-status-upcoming', label: 'Upcoming' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* Sidebar — slim: project switcher + stats only */}
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={`
          fixed lg:relative top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-auto
          flex flex-col w-60 bg-card border-r border-border pt-6 pb-4 shrink-0 z-20
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="px-5 mb-4">
            <ProjectSwitcher variant="sidebar" onSwitch={() => setSidebarOpen(false)} />
            <span className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full bg-status-progress/15 text-status-progress text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-status-progress" />
              In Progress
            </span>
            <p className="text-xs text-muted-foreground mt-2">
              {project.collaborators.length} members &middot; {totalTasks} tasks &middot; {progressPercentage}% complete
            </p>
          </div>

          {project.collaborators[0] && (
            <div className="mt-auto px-5 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-journi-green/20 flex items-center justify-center text-xs font-bold text-journi-green">
                  {project.collaborators[0].initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{project.collaborators[0].name}</p>
                  <p className="text-xs text-muted-foreground">{project.collaborators[0].email}</p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 max-w-[1400px]">
            {/* Horizontal tab bar */}
            <div className="flex items-center gap-1 border-b border-border mb-6 -mx-6 lg:-mx-8 px-6 lg:px-8">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 mr-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <PanelLeft size={18} />
              </button>
              {sidebarItems.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                    ${activeTab === item.tab
                      ? 'border-journi-green text-journi-green'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">
                  {activeTab === 'projects' && 'Project Dashboard'}
                  {activeTab === 'team' && 'Team Management'}
                  {activeTab === 'calendar' && 'Calendar View'}
                  {activeTab === 'publications' && 'Publications'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'projects' && 'Track your research progress and milestones'}
                  {activeTab === 'team' && 'Manage your research team and collaborators'}
                  {activeTab === 'calendar' && 'View tasks and deadlines on a calendar'}
                  {activeTab === 'publications' && 'Track your publication submissions'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Notification Bell */}
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

                {activeTab === 'projects' && (
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

            {/* PROJECTS TAB */}
            {activeTab === 'projects' && (
              <>
                <motion.div
                  className="bg-card rounded-xl border border-border p-6 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-foreground">Task List</h2>
                  </div>

                  {project.tasks.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-muted-foreground mb-4">No tasks yet. Create your first task!</p>
                      <button
                        onClick={handleOpenNewTaskDialog}
                        className="inline-flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Plus size={16} />
                        Create Task
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
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div
                    className="bg-card rounded-xl border border-border p-5 lg:col-span-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <CollaboratorManager
                      collaborators={project.collaborators}
                      onAddCollaborator={addCollaborator}
                      onRemoveCollaborator={removeCollaborator}
                      onUpdateCollaborator={updateCollaborator}
                    />
                  </motion.div>

                  {/* Upcoming Deadlines */}
                  <motion.div
                    className="bg-card rounded-xl border border-border p-5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-foreground">Upcoming Deadlines</h3>
                      <MoreHorizontal size={16} className="text-muted-foreground" />
                    </div>
                    <div className="space-y-4">
                      {upcomingDeadlines.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No upcoming deadlines</p>
                      ) : (
                        upcomingDeadlines.map((task) => {
                          const endDate = safeDate(task.endDate);
                          const daysUntil = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          const isUrgent = daysUntil <= 7;
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
                                  Due: {format(endDate, 'MMM d, yyyy')} ({daysUntil} {daysUntil === 1 ? 'day' : 'days'})
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Activity Feed */}
                <motion.div
                  className="bg-card rounded-xl border border-border p-5 mt-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <h3 className="text-sm font-bold text-foreground mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {activities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-journi-green/15 flex items-center justify-center text-[10px] font-bold text-journi-green">
                            {activity.userInitials}
                          </div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">{activity.userName}</span>{' '}
                            <span className="text-muted-foreground">{activity.action}</span>
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(safeDate(activity.timestamp), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}

            {/* TEAM TAB */}
            {activeTab === 'team' && (
              <motion.div
                className="bg-card rounded-xl border border-border p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <CollaboratorManager
                  collaborators={project.collaborators}
                  onAddCollaborator={addCollaborator}
                  onRemoveCollaborator={removeCollaborator}
                  onUpdateCollaborator={updateCollaborator}
                />
              </motion.div>
            )}

            {/* CALENDAR TAB */}
            {activeTab === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {Object.keys(tasksByMonth).length === 0 ? (
                  <div className="bg-card rounded-xl border border-border p-12 text-center">
                    <Calendar size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No tasks scheduled yet</p>
                    <button
                      onClick={() => { setActiveTab('projects'); handleOpenNewTaskDialog(); }}
                      className="inline-flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Plus size={16} />
                      Create Task
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
                          const config = statusConfig[task.status] || { color: 'bg-muted', label: task.status };
                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-accent/50 cursor-pointer transition-colors"
                              onClick={() => { setActiveTab('projects'); handleOpenEditTaskDialog(task.id); }}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{task.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(safeDate(task.startDate), 'MMM d')} – {format(safeDate(task.endDate), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.color}/15 text-foreground`}>
                                {config.label}
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

            {/* PUBLICATIONS TAB */}
            {activeTab === 'publications' && (
              <motion.div
                className="bg-card rounded-xl border border-border p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="text-center py-8">
                  <Send size={32} className="text-journi-green mx-auto mb-3" />
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
