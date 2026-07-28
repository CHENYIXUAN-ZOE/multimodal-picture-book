"use client";

import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  BadgeCheck,
  BookHeart,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LibraryBig,
  Menu,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSettings,
  BookPage,
  DashboardSummary,
  KimiConnectionResult,
  Project,
  QueueState,
  ServiceStatus,
  Subject,
} from "@/shared/types";
import { api, downloadUrl, isPublicDemo, jsonBody } from "../lib/api";

type View =
  | "dashboard"
  | "subjects"
  | "projects"
  | "progress"
  | "audit"
  | "settings";

type Toast = { type: "success" | "error" | "info"; message: string };

const navItems: Array<{
  id: View;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "创作首页", hint: "今天做什么", icon: LayoutDashboard },
  {
    id: "subjects",
    label: "灵感主体库",
    hint: isPublicDemo ? "精选演示主题" : "12,691 个主题",
    icon: LibraryBig,
  },
  { id: "projects", label: "绘本工坊", hint: "科普与故事", icon: FolderKanban },
  {
    id: "progress",
    label: "生成进度",
    hint: isPublicDemo ? "演示安全队列" : "单机安全队列",
    icon: Gauge,
  },
  { id: "audit", label: "内容审核", hint: "质量与安全", icon: ShieldCheck },
  { id: "settings", label: "创作设置", hint: "模型与提示词", icon: Settings },
];

const statusText: Record<string, string> = {
  pending: "待创作",
  idle: "待开始",
  queued: "排队中",
  planning: "规划中",
  processing: "生成中",
  review_needed: "待复核",
  complete: "已完成",
  paused: "已暂停",
  cancelled: "已取消",
  error: "出错了",
};

const statusTone: Record<string, string> = {
  pending: "neutral",
  idle: "neutral",
  queued: "blue",
  planning: "purple",
  processing: "purple",
  review_needed: "amber",
  complete: "green",
  paused: "amber",
  cancelled: "neutral",
  error: "red",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill status-${statusTone[status] || "neutral"}`}>
      <span className="status-dot" />
      {statusText[status] || status}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof BookOpen;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={`modal-card ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StudioApp() {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectTotal, setSubjectTotal] = useState(0);
  const [categories, setCategories] = useState<Array<{ level1: string; count: number }>>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectCategory, setSubjectCategory] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [services, setServices] = useState<ServiceStatus | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [workbenchTab, setWorkbenchTab] = useState<"science" | "story">("science");
  const [editingPage, setEditingPage] = useState<BookPage | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState("");
  const [createModal, setCreateModal] = useState(false);
  const [generateProject, setGenerateProject] = useState<Project | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [newSubjectModal, setNewSubjectModal] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await api<{ success: true; data: DashboardSummary }>("/dashboard");
      setDashboard(response.data);
      setQueue(response.data.queue);
      setServices(response.data.services);
    } catch (error) {
      notify({
        type: "error",
        message: error instanceof Error ? error.message : "无法加载创作首页",
      });
    }
  }, [notify]);

  const loadProjects = useCallback(async () => {
    try {
      const response = await api<{ success: true; data: Project[] }>("/projects");
      setProjects(response.data);
    } catch {
      // Dashboard already communicates the local service state.
    }
  }, []);

  const loadSubjects = useCallback(async () => {
    const params = new URLSearchParams({ limit: "80" });
    if (subjectSearch.trim()) params.set("search", subjectSearch.trim());
    if (subjectCategory) params.set("level1", subjectCategory);
    try {
      const response = await api<{
        success: true;
        data: Subject[];
        total: number;
      }>(`/subjects?${params}`);
      setSubjects(response.data);
      setSubjectTotal(response.total);
    } catch {
      // Keep the current list while the local service reconnects.
    }
  }, [subjectCategory, subjectSearch]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await api<{
        success: true;
        data: AppSettings;
        services: ServiceStatus;
      }>("/settings");
      setSettings(response.data);
      setServices(response.services);
    } catch {
      // The main dashboard error is enough.
    }
  }, []);

  const refreshProject = useCallback(
    async (id: string) => {
      try {
        const response = await api<{ success: true; data: Project }>(`/projects/${id}`);
        setSelectedProject(response.data);
        if (editingPage) {
          const updated = response.data.pages?.find((page) => page.id === editingPage.id);
          if (updated) setEditingPage(updated);
        }
      } catch {
        // Preserve workbench state on transient reconnects.
      }
    },
    [editingPage],
  );

  useEffect(() => {
    void Promise.all([loadDashboard(), loadProjects(), loadSettings()]);
    void api<{ success: true; data: Array<{ level1: string; count: number }> }>(
      "/subjects/categories",
    ).then((response) => setCategories(response.data));
  }, [loadDashboard, loadProjects, loadSettings]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSubjects(), 240);
    return () => window.clearTimeout(timer);
  }, [loadSubjects]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadDashboard();
      void loadProjects();
      if (selectedProject) void refreshProject(selectedProject.id);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [loadDashboard, loadProjects, refreshProject, selectedProject]);

  const openProject = async (project: Project) => {
    setBusy(`open-${project.id}`);
    try {
      const response = await api<{ success: true; data: Project }>(`/projects/${project.id}`);
      setSelectedProject(response.data);
      setWorkbenchTab("science");
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "无法打开项目" });
    } finally {
      setBusy("");
    }
  };

  const createTopicProject = async () => {
    if (!newTopic.trim()) return;
    setBusy("create-topic");
    try {
      const response = await api<{ success: true; data: Project[] }>("/projects", {
        method: "POST",
        ...jsonBody({ topic: newTopic.trim(), categories: ["自由创作"] }),
      });
      setCreateModal(false);
      setNewTopic("");
      await loadProjects();
      setGenerateProject(response.data[0]);
      notify({ type: "success", message: "新绘本项目已经准备好啦" });
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "创建失败" });
    } finally {
      setBusy("");
    }
  };

  const createSelectedProjects = async () => {
    if (!selectedSubjects.size) return;
    setBusy("create-selected");
    try {
      const response = await api<{ success: true; data: Project[] }>("/projects", {
        method: "POST",
        ...jsonBody({ subjectIds: [...selectedSubjects] }),
      });
      setSelectedSubjects(new Set());
      await Promise.all([loadProjects(), loadSubjects(), loadDashboard()]);
      setView("projects");
      notify({ type: "success", message: `已创建 ${response.data.length} 个绘本项目` });
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "创建失败" });
    } finally {
      setBusy("");
    }
  };

  const startGeneration = async (
    project: Project,
    mode: "local" | "kimi",
    acknowledgeCost: boolean,
  ) => {
    setBusy(`generate-${project.id}`);
    try {
      await api(`/projects/${project.id}/generate`, {
        method: "POST",
        ...jsonBody({ mode, acknowledgeCost }),
      });
      setGenerateProject(null);
      await Promise.all([loadProjects(), loadDashboard()]);
      notify({
        type: "success",
        message:
          mode === "local"
            ? "已加入本地生成队列，不会产生 API 费用"
            : "已确认并加入 Kimi 生成队列",
      });
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "无法开始生成" });
    } finally {
      setBusy("");
    }
  };

  const runAudit = async (project: Project, mode: "local" | "kimi" = "local") => {
    setBusy(`audit-${project.id}`);
    try {
      await api(`/projects/${project.id}/audit`, {
        method: "POST",
        ...jsonBody({ mode, acknowledgeCost: mode === "kimi" }),
      });
      await Promise.all([loadProjects(), loadDashboard()]);
      if (selectedProject?.id === project.id) await refreshProject(project.id);
      notify({
        type: "success",
        message: mode === "local" ? "本地规则审核完成" : "Kimi 内容审核完成",
      });
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "审核失败" });
    } finally {
      setBusy("");
    }
  };

  const removeProject = async (project: Project) => {
    if (!window.confirm(`确定删除“${project.topic}”吗？本地生成的页面也会一并删除。`)) return;
    setBusy(`delete-${project.id}`);
    try {
      await api(`/projects/${project.id}`, { method: "DELETE" });
      if (selectedProject?.id === project.id) setSelectedProject(null);
      await Promise.all([loadProjects(), loadDashboard(), loadSubjects()]);
      notify({ type: "success", message: "项目已从本机删除" });
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "删除失败" });
    } finally {
      setBusy("");
    }
  };

  const importWorkbook = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    setBusy("import");
    try {
      const response = await api<{
        success: true;
        data: { total: number; imported: number; skipped: number };
      }>("/subjects/import", { method: "POST", body: form });
      await Promise.all([loadSubjects(), loadDashboard()]);
      notify({
        type: "success",
        message: `已导入 ${response.data.imported} 条，跳过 ${response.data.skipped} 条重复数据`,
      });
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "导入失败" });
    } finally {
      setBusy("");
      if (importRef.current) importRef.current.value = "";
    }
  };

  const currentTitle = navItems.find((item) => item.id === view)?.label || "多模态绘本";

  return (
    <div className="studio-shell">
      {isPublicDemo ? (
        <div className="public-demo-banner" role="status">
          <ShieldCheck size={16} />
          <span>
            <strong>安全公开演示版</strong>
            数据仅保存在当前浏览器，不连接 Kimi、不上传文件，也不会产生 API 费用。
          </span>
        </div>
      ) : null}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <BookHeart size={25} />
            <span className="brand-star">✦</span>
          </div>
          <div>
            <strong>多模态绘本</strong>
            <span>让知识会讲故事</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setView(item.id);
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-icon">
                  <Icon size={19} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
                {view === item.id ? <span className="nav-spark">✦</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="safety-card">
            <div className="safety-icon">
              <ShieldCheck size={20} />
            </div>
            <div>
              <strong>{isPublicDemo ? "公开演示模式" : "单机安全模式"}</strong>
              <span>{isPublicDemo ? "数据只存在当前浏览器" : "数据只住在这台电脑"}</span>
            </div>
            <span className="live-dot" />
          </div>
          <div className="tiny-note">
            <CloudOff size={15} />
            默认零付费调用
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="mobile-menu"
              onClick={() => setMobileNavOpen((value) => !value)}
              aria-label="打开导航"
            >
              <Menu size={21} />
            </button>
            <div>
              <p className="eyebrow">MULTIMODAL STORY STUDIO</p>
              <h1>{currentTitle}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="service-chip" title="Kimi 调用状态">
              <span className={services?.kimi.enabled ? "service-orb online" : "service-orb"} />
              <div>
                <strong>{services?.kimi.enabled ? "Kimi 已启用" : "Kimi 安全关闭"}</strong>
                <small>
                  {isPublicDemo
                    ? "在线调用已完全禁用"
                    : `${services?.kimi.callsToday || 0}/${services?.kimi.dailyLimit || 20} 次今日调用`}
                </small>
              </div>
            </div>
            <button className="primary-button" onClick={() => setCreateModal(true)}>
              <Plus size={18} />
              新建绘本
            </button>
          </div>
        </header>

        <div className="content-area">
          {view === "dashboard" ? (
            <DashboardView
              dashboard={dashboard}
              projects={projects}
              onCreate={() => setCreateModal(true)}
              onOpenProject={openProject}
              onGenerate={setGenerateProject}
              busy={busy}
            />
          ) : null}
          {view === "subjects" ? (
            <SubjectsView
              subjects={subjects}
              total={subjectTotal}
              categories={categories}
              search={subjectSearch}
              category={subjectCategory}
              selected={selectedSubjects}
              busy={busy}
              onSearch={setSubjectSearch}
              onCategory={setSubjectCategory}
              onToggle={(id) =>
                setSelectedSubjects((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onCreateSelected={createSelectedProjects}
              onImport={() => importRef.current?.click()}
              onManual={() => setNewSubjectModal(true)}
            />
          ) : null}
          {view === "projects" ? (
            <ProjectsView
              projects={projects}
              busy={busy}
              onOpen={openProject}
              onGenerate={setGenerateProject}
              onAudit={runAudit}
              onDelete={removeProject}
              onCreate={() => setCreateModal(true)}
            />
          ) : null}
          {view === "progress" ? (
            <ProgressView
              queue={queue}
              projects={projects}
              onPause={async () => {
                await api("/queue/pause", { method: "POST" });
                await loadDashboard();
              }}
              onResume={async () => {
                await api("/queue/resume", { method: "POST" });
                await loadDashboard();
              }}
              onOpen={openProject}
            />
          ) : null}
          {view === "audit" ? (
            <AuditView
              projects={projects}
              busy={busy}
              onAudit={runAudit}
              onOpen={openProject}
            />
          ) : null}
          {view === "settings" && settings ? (
            <SettingsView
              settings={settings}
              services={services}
              onSave={async (next) => {
                setBusy("settings");
                try {
                  const response = await api<{
                    success: true;
                    data: AppSettings;
                    services: ServiceStatus;
                  }>("/settings", { method: "PATCH", ...jsonBody(next) });
                  setSettings(response.data);
                  setServices(response.services);
                  await loadDashboard();
                  notify({ type: "success", message: "创作设置已保存到本机" });
                } catch (error) {
                  notify({
                    type: "error",
                    message: error instanceof Error ? error.message : "保存失败",
                  });
                } finally {
                  setBusy("");
                }
              }}
              onResetPrompts={async () => {
                if (
                  !window.confirm(
                    "确定恢复完整默认提示词吗？当前自定义的提示词、图片风格和负向词会被覆盖。",
                  )
                ) {
                  return;
                }
                setBusy("prompt-reset");
                try {
                  const response = await api<{
                    success: true;
                    data: AppSettings;
                    services: ServiceStatus;
                  }>("/settings/reset-prompts", { method: "POST" });
                  setSettings(response.data);
                  setServices(response.services);
                  notify({ type: "success", message: "完整提示词预设已恢复" });
                } catch (error) {
                  notify({
                    type: "error",
                    message: error instanceof Error ? error.message : "恢复预设失败",
                  });
                } finally {
                  setBusy("");
                }
              }}
              onConfigureKimi={async (input) => {
                setBusy("kimi-key");
                try {
                  const response = await api<{
                    success: true;
                    data: AppSettings;
                    services: ServiceStatus;
                    connection: KimiConnectionResult;
                  }>("/settings/kimi-key", {
                    method: "POST",
                    ...jsonBody(input),
                  });
                  setSettings(response.data);
                  setServices(response.services);
                  await loadDashboard();
                  const balance = response.connection.balance;
                  notify({
                    type: "success",
                    message: balance
                      ? `Key 已验证并安全保存，可用余额 ¥${balance.available.toFixed(2)}`
                      : "Key 已验证并安全保存，Kimi 创作模式已启用",
                  });
                  return true;
                } catch (error) {
                  notify({
                    type: "error",
                    message: error instanceof Error ? error.message : "Kimi Key 验证失败",
                  });
                  return false;
                } finally {
                  setBusy("");
                }
              }}
              onTestKimi={async () => {
                setBusy("kimi-test");
                try {
                  const response = await api<{
                    success: true;
                    data: KimiConnectionResult;
                    services: ServiceStatus;
                  }>("/settings/test-kimi", { method: "POST" });
                  setServices(response.services);
                  const balance = response.data.balance;
                  notify({
                    type: "success",
                    message: balance
                      ? `Kimi 连接正常，可用余额 ¥${balance.available.toFixed(2)}`
                      : "Kimi 连接正常，所选模型可以使用",
                  });
                } catch (error) {
                  notify({
                    type: "error",
                    message: error instanceof Error ? error.message : "Kimi 连接检测失败",
                  });
                } finally {
                  setBusy("");
                }
              }}
              onRemoveKimi={async () => {
                if (!window.confirm("确定移除保存在本机的 Kimi API Key 吗？")) return;
                setBusy("kimi-remove");
                try {
                  const response = await api<{
                    success: true;
                    data: AppSettings;
                    services: ServiceStatus;
                  }>("/settings/kimi-key", { method: "DELETE" });
                  setSettings(response.data);
                  setServices(response.services);
                  await loadDashboard();
                  notify({ type: "success", message: "本机 Kimi API Key 已移除" });
                } catch (error) {
                  notify({
                    type: "error",
                    message: error instanceof Error ? error.message : "移除 Key 失败",
                  });
                } finally {
                  setBusy("");
                }
              }}
              busy={busy}
            />
          ) : null}
        </div>
      </main>

      <input
        ref={importRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importWorkbook(file);
        }}
      />

      {createModal ? (
        <Modal
          title="开启一本新绘本"
          subtitle="输入一个主题，先创建项目，再选择零费用本地模式或 Kimi 模式。"
          onClose={() => setCreateModal(false)}
        >
          <div className="modal-body">
            <label className="field-label" htmlFor="new-topic">
              想把什么变成绘本？
            </label>
            <div className="topic-input-wrap">
              <Sparkles size={20} />
              <input
                id="new-topic"
                value={newTopic}
                onChange={(event) => setNewTopic(event.target.value)}
                placeholder="例如：会发光的萤火虫"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createTopicProject();
                }}
              />
            </div>
            <div className="idea-row">
              {["月亮为什么会变形", "一颗种子的旅行", "故宫里的神兽"].map((idea) => (
                <button key={idea} onClick={() => setNewTopic(idea)}>
                  {idea}
                </button>
              ))}
            </div>
            <button
              className="primary-button full-button"
              disabled={!newTopic.trim() || busy === "create-topic"}
              onClick={() => void createTopicProject()}
            >
              {busy === "create-topic" ? <RefreshCw className="spin" size={18} /> : <Plus size={18} />}
              创建绘本项目
            </button>
          </div>
        </Modal>
      ) : null}

      {newSubjectModal ? (
        <NewSubjectModal
          onClose={() => setNewSubjectModal(false)}
          onCreated={async () => {
            setNewSubjectModal(false);
            await Promise.all([loadSubjects(), loadDashboard()]);
            notify({ type: "success", message: "新主题已经加入灵感库" });
          }}
        />
      ) : null}

      {generateProject ? (
        <GenerateModal
          project={generateProject}
          services={services}
          busy={busy === `generate-${generateProject.id}`}
          onClose={() => setGenerateProject(null)}
          onStart={startGeneration}
        />
      ) : null}

      {selectedProject ? (
        <Workbench
          project={selectedProject}
          tab={workbenchTab}
          busy={busy}
          onTab={setWorkbenchTab}
          onClose={() => {
            setEditingPage(null);
            setSelectedProject(null);
          }}
          onEdit={setEditingPage}
          onGenerate={() => setGenerateProject(selectedProject)}
          onAudit={() => void runAudit(selectedProject)}
          onRefresh={() => void refreshProject(selectedProject.id)}
        />
      ) : null}

      {editingPage ? (
        <PageEditor
          page={editingPage}
          onClose={() => setEditingPage(null)}
          onSaved={async () => {
            if (selectedProject) await refreshProject(selectedProject.id);
          }}
          notify={notify}
        />
      ) : null}

      {toast ? (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.type === "success" ? (
            <CheckCircle2 size={19} />
          ) : toast.type === "error" ? (
            <AlertTriangle size={19} />
          ) : (
            <Sparkles size={19} />
          )}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

function DashboardView({
  dashboard,
  projects,
  onCreate,
  onOpenProject,
  onGenerate,
  busy,
}: {
  dashboard: DashboardSummary | null;
  projects: Project[];
  onCreate: () => void;
  onOpenProject: (project: Project) => void;
  onGenerate: (project: Project) => void;
  busy: string;
}) {
  const cards = [
    {
      label: "灵感主题",
      value: dashboard?.subjectCount ?? "—",
      note: "完整主体库已就位",
      icon: LibraryBig,
      tone: "violet",
    },
    {
      label: "绘本项目",
      value: dashboard?.projectCount ?? "—",
      note: `${dashboard?.queuedCount || 0} 个正在路上`,
      icon: BookOpen,
      tone: "coral",
    },
    {
      label: "完成创作",
      value: dashboard?.completedCount ?? "—",
      note: `${dashboard?.generatedPages || 0} 个页面`,
      icon: BadgeCheck,
      tone: "mint",
    },
    {
      label: "等待复核",
      value: dashboard?.reviewCount ?? "—",
      note: "守护内容质量",
      icon: ShieldCheck,
      tone: "yellow",
    },
  ];
  const recent = projects.slice(0, 5);
  return (
    <div className="view-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker">
            <WandSparkles size={16} />
            今天的想象力已上线
          </span>
          <h2>
            把一个小小的<span>“为什么”</span>
            <br />
            变成孩子爱读的两本书。
          </h2>
          <p>
            {isPublicDemo
              ? "在线安全体验科普与故事绘本工作流；演示版不会连接任何付费 API。"
              : "一次创作，同时得到科普绘本与故事绘本。默认使用本地模式，不触发任何付费 API。"}
          </p>
          <div className="hero-actions">
            <button className="primary-button primary-large" onClick={onCreate}>
              <Sparkles size={19} />
              开始一本新绘本
            </button>
            <span className="safe-caption">
              <ShieldCheck size={16} />
              {isPublicDemo ? "浏览器演示数据" : "SQLite 本地存储"}
            </span>
          </div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="book-shape book-back">
            <span>为什么？</span>
          </div>
          <div className="book-shape book-front">
            <div className="book-face">
              <span className="book-eye" />
              <span className="book-eye" />
              <span className="book-smile" />
            </div>
            <strong>一起探索！</strong>
          </div>
          <span className="float-star star-one">✦</span>
          <span className="float-star star-two">✦</span>
          <span className="float-dot dot-one" />
        </div>
      </section>

      <section className="metric-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={`metric-card metric-${card.tone}`} key={card.label}>
              <div className="metric-icon">
                <Icon size={22} />
              </div>
              <div>
                <span>{card.label}</span>
                <strong>{typeof card.value === "number" ? card.value.toLocaleString() : card.value}</strong>
                <small>{card.note}</small>
              </div>
            </div>
          );
        })}
      </section>

      <div className="dashboard-columns">
        <section className="panel-card recent-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">RECENT CREATIONS</span>
              <h3>最近的绘本</h3>
            </div>
            <span className="soft-badge">{recent.length} 个项目</span>
          </div>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((project, index) => (
                <div className="recent-row" key={project.id}>
                  <div className={`mini-cover mini-cover-${(index % 4) + 1}`}>
                    <BookOpen size={22} />
                    <span>{project.topic.slice(0, 2)}</span>
                  </div>
                  <button className="recent-main" onClick={() => void onOpenProject(project)}>
                    <strong>{project.topic}</strong>
                    <span>{project.categories.filter(Boolean).join(" · ") || "自由创作"}</span>
                  </button>
                  <StatusPill status={project.status} />
                  <div className="recent-actions">
                    {project.status === "idle" || project.status === "error" ? (
                      <button className="small-primary" onClick={() => onGenerate(project)}>
                        <Play size={14} />
                        生成
                      </button>
                    ) : (
                      <button
                        className="round-action"
                        onClick={() => void onOpenProject(project)}
                        aria-label={`打开${project.topic}`}
                        disabled={busy === `open-${project.id}`}
                      >
                        <ChevronRight size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="第一本绘本正在等你"
              text="从一个孩子会问的问题开始，几分钟就能搭好内容骨架。"
              action={
                <button className="small-primary" onClick={onCreate}>
                  <Plus size={15} />
                  新建项目
                </button>
              }
            />
          )}
        </section>

        <section className="panel-card service-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">SAFE BY DEFAULT</span>
              <h3>服务守护台</h3>
            </div>
            <ShieldCheck className="heading-icon" size={22} />
          </div>
          <div className="service-list">
            <div className="service-row">
              <span className="service-symbol service-local">
                <BadgeCheck size={19} />
              </span>
              <div>
                <strong>{isPublicDemo ? "演示数据" : "本地数据"}</strong>
                <span>{isPublicDemo ? "仅保存在当前浏览器" : "SQLite 与素材都在本机"}</span>
              </div>
              <span className="service-state ready">已就绪</span>
            </div>
            <div className="service-row">
              <span className="service-symbol service-kimi">
                <Sparkles size={19} />
              </span>
              <div>
                <strong>Kimi 文本服务</strong>
                <span>{dashboard?.services.kimi.model || "kimi-k2.6"}</span>
              </div>
              <span
                className={`service-state ${dashboard?.services.kimi.enabled ? "ready" : "off"}`}
              >
                {dashboard?.services.kimi.enabled ? "已启用" : "安全关闭"}
              </span>
            </div>
            <div className="service-row">
              <span className="service-symbol service-image">
                <ImageIcon size={19} />
              </span>
              <div>
                <strong>图片位置</strong>
                <span>{isPublicDemo ? "示例内容 · 禁止上传" : "本地占位图 · 支持上传"}</span>
              </div>
              <span className="service-state ready">零费用</span>
            </div>
            <div className="service-row">
              <span className="service-symbol service-audio">
                <AudioLines size={19} />
              </span>
              <div>
                <strong>音频接口</strong>
                <span>接口保留，暂无供应商</span>
              </div>
              <span className="service-state off">已禁用</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SubjectsView({
  subjects,
  total,
  categories,
  search,
  category,
  selected,
  busy,
  onSearch,
  onCategory,
  onToggle,
  onCreateSelected,
  onImport,
  onManual,
}: {
  subjects: Subject[];
  total: number;
  categories: Array<{ level1: string; count: number }>;
  search: string;
  category: string;
  selected: Set<string>;
  busy: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onToggle: (id: string) => void;
  onCreateSelected: () => void;
  onImport: () => void;
  onManual: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="page-intro subject-intro">
        <div>
          <span className="section-kicker">IDEA LIBRARY</span>
          <h2>从一万多个“为什么”里，挑一个今天出发。</h2>
          <p>总表只导入一次，分类文件不会重复进入数据库。</p>
        </div>
        <div className="intro-actions">
          <button className="secondary-button" onClick={onImport} disabled={busy === "import"}>
            {busy === "import" ? <RefreshCw className="spin" size={17} /> : <Upload size={17} />}
            导入 Excel
          </button>
          <button className="primary-button" onClick={onManual}>
            <Plus size={17} />
            添加主题
          </button>
        </div>
      </section>

      <section className="panel-card">
        <div className="library-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="搜索中文名、英文名或标签…"
            />
            {search ? (
              <button onClick={() => onSearch("")} aria-label="清空搜索">
                <X size={16} />
              </button>
            ) : null}
          </div>
          <div className="filter-box">
            <SlidersHorizontal size={17} />
            <select value={category} onChange={(event) => onCategory(event.target.value)}>
              <option value="">全部一级分类</option>
              {categories.map((item) => (
                <option value={item.level1} key={item.level1}>
                  {item.level1}（{item.count}）
                </option>
              ))}
            </select>
          </div>
          <span className="result-count">
            找到 <strong>{total.toLocaleString()}</strong> 个主题
          </span>
        </div>

        {selected.size ? (
          <div className="selection-bar">
            <div>
              <span className="selection-check">
                <Check size={15} />
              </span>
              已选择 <strong>{selected.size}</strong> 个主题
            </div>
            <button
              className="small-primary"
              onClick={onCreateSelected}
              disabled={busy === "create-selected"}
            >
              {busy === "create-selected" ? (
                <RefreshCw className="spin" size={15} />
              ) : (
                <BookOpen size={15} />
              )}
              创建绘本项目
            </button>
          </div>
        ) : null}

        <div className="subject-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="check-column">选择</th>
                <th>编号</th>
                <th>主题</th>
                <th>分类路径</th>
                <th>描述</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.id} className={selected.has(subject.id) ? "row-selected" : ""}>
                  <td className="check-column">
                    <button
                      className={`custom-check ${selected.has(subject.id) ? "checked" : ""}`}
                      onClick={() => onToggle(subject.id)}
                      aria-label={`选择${subject.chineseName}`}
                    >
                      {selected.has(subject.id) ? <Check size={14} /> : null}
                    </button>
                  </td>
                  <td>
                    <span className="label-code">#{subject.labelId}</span>
                  </td>
                  <td>
                    <div className="subject-name">
                      <strong>{subject.chineseName}</strong>
                      <span>{subject.englishName || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="category-path">
                      {[subject.level1, subject.level2, subject.level3]
                        .filter(Boolean)
                        .map((item, index) => (
                          <span key={`${item}-${index}`}>{item}</span>
                        ))}
                    </div>
                  </td>
                  <td>
                    <p className="description-cell">{subject.description || "等待补充描述"}</p>
                  </td>
                  <td>
                    <StatusPill status={subject.generationStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ProjectsView({
  projects,
  busy,
  onOpen,
  onGenerate,
  onAudit,
  onDelete,
  onCreate,
}: {
  projects: Project[];
  busy: string;
  onOpen: (project: Project) => void;
  onGenerate: (project: Project) => void;
  onAudit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onCreate: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="page-intro projects-intro">
        <div>
          <span className="section-kicker">PICTURE BOOK WORKSHOP</span>
          <h2>每个主题，都会长成两种不同的想象。</h2>
          <p>科普页负责把世界讲清楚，故事页负责让知识留在心里。</p>
        </div>
        <button className="primary-button" onClick={onCreate}>
          <Plus size={17} />
          新建绘本
        </button>
      </section>

      {projects.length ? (
        <div className="project-grid">
          {projects.map((project, index) => (
            <article className="project-card" key={project.id}>
              <div className={`project-cover project-cover-${(index % 5) + 1}`}>
                <div className="cover-topline">
                  <span>#{project.labelId}</span>
                  <StatusPill status={project.status} />
                </div>
                <div className="cover-art">
                  <span className="cover-orb" />
                  <BookOpen size={48} strokeWidth={1.5} />
                  <span className="cover-spark">✦</span>
                </div>
                <strong>{project.topic}</strong>
              </div>
              <div className="project-card-body">
                <div className="project-meta">
                  <span>
                    <FileText size={15} />
                    {project.categories.filter(Boolean).join(" · ") || "自由创作"}
                  </span>
                  <span>
                    <Clock3 size={15} />
                    {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <p className="project-step">{project.currentStep}</p>
                {project.lastError ? <p className="project-error">{project.lastError}</p> : null}
                <div className="project-actions">
                  {["idle", "error", "cancelled"].includes(project.status) ? (
                    <button className="small-primary" onClick={() => onGenerate(project)}>
                      <Play size={15} />
                      开始生成
                    </button>
                  ) : (
                    <button
                      className="small-primary"
                      disabled={busy === `open-${project.id}`}
                      onClick={() => void onOpen(project)}
                    >
                      <BookOpen size={15} />
                      打开工坊
                    </button>
                  )}
                  {project.status === "complete" || project.status === "review_needed" ? (
                    <button
                      className="small-secondary"
                      onClick={() => void onAudit(project)}
                      disabled={busy === `audit-${project.id}`}
                    >
                      <ShieldCheck size={15} />
                      审核
                    </button>
                  ) : null}
                  <button
                    className="round-action danger-action"
                    onClick={() => void onDelete(project)}
                    aria-label={`删除${project.topic}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-card">
          <EmptyState
            icon={FolderKanban}
            title="绘本工坊还是空的"
            text="先创建一个主题，或者去灵感主体库批量挑选。"
            action={
              <button className="primary-button" onClick={onCreate}>
                <Plus size={17} />
                新建绘本
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function ProgressView({
  queue,
  projects,
  onPause,
  onResume,
  onOpen,
}: {
  queue: QueueState | null;
  projects: Project[];
  onPause: () => void;
  onResume: () => void;
  onOpen: (project: Project) => void;
}) {
  const active = projects.filter((project) =>
    ["queued", "planning", "processing", "paused"].includes(project.status),
  );
  return (
    <div className="view-stack">
      <section className="page-intro progress-intro">
        <div>
          <span className="section-kicker">LOCAL QUEUE</span>
          <h2>一次认真做好一本，不让请求偷偷变多。</h2>
          <p>单机队列固定并发为 1；Kimi 请求不自动重试，费用边界更清楚。</p>
        </div>
        <button
          className={queue?.paused ? "primary-button" : "secondary-button"}
          onClick={() => void (queue?.paused ? onResume() : onPause())}
        >
          {queue?.paused ? <Play size={17} /> : <Pause size={17} />}
          {queue?.paused ? "继续队列" : "暂停队列"}
        </button>
      </section>
      <div className="progress-summary">
        <div>
          <strong>{queue?.items.length || 0}</strong>
          <span>队列任务</span>
        </div>
        <div>
          <strong>{queue?.waiting || 0}</strong>
          <span>等待处理</span>
        </div>
        <div>
          <strong>{queue?.activeProjectId ? 1 : 0}</strong>
          <span>正在生成</span>
        </div>
        <div>
          <strong>1</strong>
          <span>最大并发</span>
        </div>
      </div>
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">GENERATION FLOW</span>
            <h3>正在路上的绘本</h3>
          </div>
          <span className={queue?.paused ? "soft-badge amber-badge" : "soft-badge"}>
            {queue?.paused ? "队列已暂停" : "队列运行中"}
          </span>
        </div>
        {queue?.items.length ? (
          <div className="queue-list">
            {queue.items.map((item) => {
              const project = projects.find((candidate) => candidate.id === item.projectId);
              return (
                <div className="queue-card" key={item.id}>
                  <div className="queue-number">
                    {item.status === "processing" ? <RefreshCw className="spin" size={20} /> : <Clock3 size={20} />}
                  </div>
                  <div className="queue-content">
                    <div className="queue-heading">
                      <strong>{item.topic}</strong>
                      <StatusPill status={item.status} />
                    </div>
                    <p>{item.message}</p>
                    <div className="progress-track">
                      <span style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                  <strong className="progress-number">{item.progress}%</strong>
                  {project ? (
                    <button className="round-action" onClick={() => void onOpen(project)} aria-label="打开项目">
                      <ChevronRight size={18} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Gauge}
            title="队列现在很安静"
            text={active.length ? "状态正在同步，请稍等一下。" : "开始生成后，逐页进度会出现在这里。"}
          />
        )}
      </section>
    </div>
  );
}

function AuditView({
  projects,
  busy,
  onAudit,
  onOpen,
}: {
  projects: Project[];
  busy: string;
  onAudit: (project: Project) => void;
  onOpen: (project: Project) => void;
}) {
  const ready = projects.filter((project) =>
    ["complete", "review_needed"].includes(project.status),
  );
  return (
    <div className="view-stack">
      <section className="page-intro audit-intro">
        <div>
          <span className="section-kicker">QUALITY & SAFETY</span>
          <h2>让好奇心大胆冒险，让内容认真过关。</h2>
          <p>本地审核不产生费用；需要更深入的语义审核时，再由你主动选择 Kimi。</p>
        </div>
        <div className="audit-shield">
          <ShieldCheck size={30} />
          <span>儿童内容守护</span>
        </div>
      </section>
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">REVIEW DESK</span>
            <h3>待审核与审核结果</h3>
          </div>
          <span className="soft-badge">{ready.length} 本可审核</span>
        </div>
        {ready.length ? (
          <div className="audit-list">
            {ready.map((project) => (
              <div className="audit-row" key={project.id}>
                <div className="audit-score">
                  {project.audit ? (
                    <>
                      <strong>{project.audit.score}</strong>
                      <span>分</span>
                    </>
                  ) : (
                    <ShieldCheck size={25} />
                  )}
                </div>
                <div className="audit-main">
                  <strong>{project.topic}</strong>
                  <span>
                    {project.audit
                      ? `${project.audit.issues.length} 个建议 · ${project.audit.mode === "local" ? "本地规则" : "Kimi"}`
                      : "还没有审核记录"}
                  </span>
                </div>
                <StatusPill status={project.status} />
                <button className="small-secondary" onClick={() => void onOpen(project)}>
                  <BookOpen size={15} />
                  查看内容
                </button>
                <button
                  className="small-primary"
                  disabled={busy === `audit-${project.id}`}
                  onClick={() => void onAudit(project)}
                >
                  {busy === `audit-${project.id}` ? (
                    <RefreshCw className="spin" size={15} />
                  ) : (
                    <ShieldCheck size={15} />
                  )}
                  本地审核
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="还没有可以审核的绘本"
            text="生成完成后，绘本会自动来到这张审核桌。"
          />
        )}
      </section>
    </div>
  );
}

function SettingsView({
  settings,
  services,
  onSave,
  onResetPrompts,
  onConfigureKimi,
  onTestKimi,
  onRemoveKimi,
  busy,
}: {
  settings: AppSettings;
  services: ServiceStatus | null;
  onSave: (settings: AppSettings) => void;
  onResetPrompts: () => void;
  onConfigureKimi: (input: {
    apiKey: string;
    region: "cn" | "global";
    model: string;
  }) => Promise<boolean>;
  onTestKimi: () => void;
  onRemoveKimi: () => void;
  busy: string;
}) {
  const [draft, setDraft] = useState(settings);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [promptTab, setPromptTab] = useState<"science" | "story">("science");
  useEffect(() => setDraft(settings), [settings]);
  const savingSettings = busy === "settings";
  const configuringKey = busy === "kimi-key";
  const testingKey = busy === "kimi-test";
  const removingKey = busy === "kimi-remove";
  return (
    <div className="view-stack">
      <section className="page-intro settings-intro">
        <div>
          <span className="section-kicker">CREATION SETTINGS</span>
          <h2>把风格、成本和安全边界，都握在自己手里。</h2>
          <p>密钥只在填写时短暂经过页面，验证后由本机服务端单独保管。</p>
        </div>
        <button
          className="primary-button"
          onClick={() => onSave(draft)}
          disabled={Boolean(busy)}
        >
          {savingSettings ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}
          保存设置
        </button>
      </section>

      <div className="settings-grid">
        <section className="panel-card settings-card">
          <div className="settings-card-title">
            <span className="settings-icon purple-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <h3>Kimi 文本服务</h3>
              <p>仅负责文案、图片提示词和内容审核</p>
            </div>
          </div>
          <div className="kimi-key-panel">
            <label className="field-label">
              Kimi API Key
              <div className="secret-input-wrap">
                <input
                  className="text-input"
                  type={showApiKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    services?.kimi.configured
                      ? `已保存 ${services.kimi.keyHint || "本机密钥"}；输入新 Key 可替换`
                      : "粘贴从 Kimi 开放平台创建的 API Key"
                  }
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button
                  aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                  className="secret-visibility-button"
                  type="button"
                  onClick={() => setShowApiKey((value) => !value)}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="field-label">
              Key 所属平台
              <select
                className="text-input"
                value={draft.kimiRegion}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    kimiRegion: event.target.value as "cn" | "global",
                  })
                }
              >
                <option value="cn">国内站 platform.kimi.com</option>
                <option value="global">国际站 platform.kimi.ai</option>
              </select>
            </label>
            <div className="kimi-key-actions">
              <button
                className="small-primary"
                type="button"
                disabled={!apiKey.trim() || Boolean(busy)}
                onClick={async () => {
                  const saved = await onConfigureKimi({
                    apiKey,
                    region: draft.kimiRegion,
                    model: draft.model,
                  });
                  if (saved) {
                    setApiKey("");
                    setShowApiKey(false);
                  }
                }}
              >
                {configuringKey ? <RefreshCw className="spin" size={15} /> : <ShieldCheck size={15} />}
                验证并保存
              </button>
              {services?.kimi.configured ? (
                <button
                  className="small-secondary"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={onTestKimi}
                >
                  {testingKey ? <RefreshCw className="spin" size={15} /> : <RefreshCw size={15} />}
                  检测连接
                </button>
              ) : null}
              {services?.kimi.keySource === "local-secret-file" ? (
                <button
                  className="small-secondary key-remove-button"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={onRemoveKimi}
                >
                  {removingKey ? <RefreshCw className="spin" size={15} /> : <Trash2 size={15} />}
                  移除 Key
                </button>
              ) : null}
            </div>
            <p className="key-storage-caption">
              验证通过后仅写入本机受限文件，不进入 SQLite、浏览器存储、日志、导出包或 Git。
            </p>
          </div>
          <div className="settings-status-grid">
            <div>
              <span>调用总开关</span>
              <strong className={services?.kimi.enabled ? "text-ready" : "text-off"}>
                {services?.kimi.enabled ? "已启用" : "安全关闭"}
              </strong>
            </div>
            <div>
              <span>密钥状态</span>
              <strong className={services?.kimi.configured ? "text-ready" : "text-off"}>
                {services?.kimi.configured ? "已配置" : "未配置"}
              </strong>
            </div>
            <div>
              <span>今日调用</span>
              <strong>
                {services?.kimi.callsToday || 0}/{services?.kimi.dailyLimit || draft.dailyAiCallLimit}
              </strong>
            </div>
          </div>
          <div className="security-note">
            <KeyRound size={18} />
            <div>
              <strong>密钥只在本机服务端使用</strong>
              <span>保存后页面只能看到末四位提示，完整 Key 不会通过接口返回。</span>
            </div>
          </div>
          <label className="field-label">
            默认模型
            <select
              className="text-input"
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            >
              <option value="kimi-k2.6">kimi-k2.6（推荐，通用与成本平衡）</option>
              <option value="kimi-k3">kimi-k3（旗舰推理，需要充值解锁）</option>
            </select>
          </label>
          <label className="field-label">
            Kimi 调用开关
            <select
              className="text-input"
              value={draft.kimiEnabled ? "enabled" : "disabled"}
              onChange={(event) =>
                setDraft({ ...draft, kimiEnabled: event.target.value === "enabled" })
              }
            >
              <option value="enabled">启用（每次生成仍需确认费用）</option>
              <option value="disabled">关闭（保留 Key，不允许调用）</option>
            </select>
          </label>
          <label className="field-label">
            每日调用上限
            <input
              className="text-input"
              type="number"
              min={1}
              max={200}
              value={draft.dailyAiCallLimit}
              onChange={(event) =>
                setDraft({ ...draft, dailyAiCallLimit: Number(event.target.value) })
              }
            />
          </label>
        </section>

        <section className="panel-card settings-card">
          <div className="settings-card-title">
            <span className="settings-icon coral-icon">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <h3>绘本规格</h3>
              <p>控制两本书的基本篇幅与读者年龄</p>
            </div>
          </div>
          <label className="field-label">
            目标年龄
            <input
              className="text-input"
              value={draft.targetAge}
              onChange={(event) => setDraft({ ...draft, targetAge: event.target.value })}
            />
          </label>
          <div className="two-field-row">
            <label className="field-label">
              科普页数
              <input
                className="text-input"
                type="number"
                min={4}
                max={16}
                value={draft.sciencePageCount}
                onChange={(event) =>
                  setDraft({ ...draft, sciencePageCount: Number(event.target.value) })
                }
              />
            </label>
            <label className="field-label">
              故事页数
              <input
                className="text-input"
                type="number"
                min={4}
                max={20}
                value={draft.storyPageCount}
                onChange={(event) =>
                  setDraft({ ...draft, storyPageCount: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="field-label">
            默认生成方式
            <select
              className="text-input"
              value={draft.generationMode}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  generationMode: event.target.value as "local" | "kimi",
                })
              }
            >
              <option value="local">本地演示模式（零费用）</option>
              <option value="kimi">Kimi 模式（每次仍需确认）</option>
            </select>
          </label>
        </section>

        <section className="panel-card settings-card settings-wide">
          <div className="settings-card-title">
            <span className="settings-icon mint-icon">
              <Palette size={20} />
            </span>
            <div>
              <h3>图片风格与接口状态</h3>
              <p>分别控制科普与故事图片提示词；图片接口仍保持本地安全模式</p>
            </div>
          </div>
          <div className="style-preset-list" aria-label="图片风格预设">
            {draft.imageStylePresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="style-preset-chip"
                onClick={() =>
                  setDraft({
                    ...draft,
                    scienceImageStyle: preset.name,
                    scienceImageStylePrompt: preset.stylePrompt,
                    scienceNegativePrompt: preset.negativePrompt,
                  })
                }
              >
                {preset.name}
                <span>应用到科普</span>
              </button>
            ))}
          </div>
          <div className="prompt-grid image-config-grid">
            <div className="prompt-config-panel science-config-panel">
              <div className="prompt-config-heading">
                <strong>🔬 科普图片</strong>
                <span>{draft.scienceImageStyle}</span>
              </div>
              <label className="field-label">
                正向风格提示词
                <textarea
                  className="text-area"
                  rows={5}
                  value={draft.scienceImageStylePrompt}
                  onChange={(event) =>
                    setDraft({ ...draft, scienceImageStylePrompt: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                负向提示词
                <textarea
                  className="text-area compact-prompt-area"
                  rows={3}
                  value={draft.scienceNegativePrompt}
                  onChange={(event) =>
                    setDraft({ ...draft, scienceNegativePrompt: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="prompt-config-panel story-config-panel">
              <div className="prompt-config-heading">
                <strong>📖 故事图片</strong>
                <span>{draft.storyImageStyle}</span>
              </div>
              <div className="story-style-actions">
                {draft.imageStylePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={draft.storyImageStyle === preset.name ? "is-active" : ""}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        storyImageStyle: preset.name,
                        storyImageStylePrompt: preset.stylePrompt,
                        storyNegativePrompt: preset.negativePrompt,
                      })
                    }
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <label className="field-label">
                正向风格提示词
                <textarea
                  className="text-area"
                  rows={5}
                  value={draft.storyImageStylePrompt}
                  onChange={(event) =>
                    setDraft({ ...draft, storyImageStylePrompt: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                负向提示词
                <textarea
                  className="text-area compact-prompt-area"
                  rows={3}
                  value={draft.storyNegativePrompt}
                  onChange={(event) =>
                    setDraft({ ...draft, storyNegativePrompt: event.target.value })
                  }
                />
              </label>
            </div>
          </div>
          <div className="provider-strip">
            <div>
              <span className="provider-icon provider-image">
                <ImageIcon size={19} />
              </span>
              <div>
                <strong>图片模块</strong>
                <span>本地占位图 + 手动上传替换</span>
              </div>
              <em>零费用</em>
            </div>
            <div>
              <span className="provider-icon provider-audio">
                <AudioLines size={19} />
              </span>
              <div>
                <strong>音频模块</strong>
                <span>标准接口保留，未连接供应商</span>
              </div>
              <em className="disabled-em">已禁用</em>
            </div>
          </div>
        </section>

        <section className="panel-card settings-card settings-wide">
          <div className="settings-card-title">
            <span className="settings-icon yellow-icon">
              <FileText size={20} />
            </span>
            <div>
              <h3>提示词工作台</h3>
              <p>完整恢复原项目的创作规则、图片描述指南与结构化输出</p>
            </div>
            <button
              type="button"
              className="small-secondary settings-title-action"
              disabled={Boolean(busy)}
              onClick={onResetPrompts}
            >
              {busy === "prompt-reset" ? (
                <RefreshCw className="spin" size={14} />
              ) : (
                <RotateCcw size={14} />
              )}
              恢复完整预设
            </button>
          </div>
          <div className="prompt-tab-list" role="tablist" aria-label="提示词类型">
            <button
              type="button"
              role="tab"
              aria-selected={promptTab === "science"}
              className={promptTab === "science" ? "is-active" : ""}
              onClick={() => setPromptTab("science")}
            >
              🔬 科普绘本
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={promptTab === "story"}
              className={promptTab === "story" ? "is-active" : ""}
              onClick={() => setPromptTab("story")}
            >
              📖 故事绘本
            </button>
          </div>
          {promptTab === "science" ? (
            <div className="prompt-workbench-panel" role="tabpanel">
              <div className="two-field-row prompt-count-row">
                <label className="field-label">
                  知识点最少数量
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.scienceKnowledgePointCountMin}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        scienceKnowledgePointCountMin: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  知识点最多数量
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.scienceKnowledgePointCountMax}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        scienceKnowledgePointCountMax: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="field-label">
                科普系统提示词
                <textarea
                  className="text-area prompt-area"
                  value={draft.sciencePrompt}
                  onChange={(event) =>
                    setDraft({ ...draft, sciencePrompt: event.target.value })
                  }
                />
                <span className="field-help">可用变量：{"{age}"}</span>
              </label>
              <label className="field-label">
                科普图片描述生成指南
                <textarea
                  className="text-area prompt-guide-area"
                  value={draft.scienceImagePromptGuide}
                  onChange={(event) =>
                    setDraft({ ...draft, scienceImagePromptGuide: event.target.value })
                  }
                />
              </label>
            </div>
          ) : (
            <div className="prompt-workbench-panel" role="tabpanel">
              <label className="field-label">
                故事系统提示词
                <textarea
                  className="text-area prompt-area"
                  value={draft.storyPrompt}
                  onChange={(event) =>
                    setDraft({ ...draft, storyPrompt: event.target.value })
                  }
                />
                <span className="field-help">可用变量：{"{age}"}</span>
              </label>
              <label className="field-label">
                故事图片描述生成指南
                <textarea
                  className="text-area prompt-guide-area"
                  value={draft.storyImagePromptGuide}
                  onChange={(event) =>
                    setDraft({ ...draft, storyImagePromptGuide: event.target.value })
                  }
                />
              </label>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function GenerateModal({
  project,
  services,
  busy,
  onClose,
  onStart,
}: {
  project: Project;
  services: ServiceStatus | null;
  busy: boolean;
  onClose: () => void;
  onStart: (project: Project, mode: "local" | "kimi", acknowledgeCost: boolean) => void;
}) {
  const [mode, setMode] = useState<"local" | "kimi">("local");
  const [acknowledged, setAcknowledged] = useState(false);
  const kimiAvailable = Boolean(services?.kimi.enabled && services?.kimi.configured);
  return (
    <Modal
      title={`生成《${project.topic}》`}
      subtitle="两种模式都保留完整的科普、故事、审核与导出流程。"
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="mode-options">
          <button
            className={mode === "local" ? "mode-card selected" : "mode-card"}
            onClick={() => {
              setMode("local");
              setAcknowledged(false);
            }}
          >
            <span className="mode-icon local-mode">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>本地演示模式</strong>
              <p>生成完整页面文案与本地占位图，不调用任何外部 API。</p>
            </div>
            <span className="mode-price">¥0</span>
          </button>
          <button
            className={mode === "kimi" ? "mode-card selected" : "mode-card"}
            onClick={() => setMode("kimi")}
            disabled={!kimiAvailable}
          >
            <span className="mode-icon kimi-mode">
              <Sparkles size={22} />
            </span>
            <div>
              <strong>Kimi 创作模式</strong>
              <p>
                Kimi 生成文案与图片提示词；图片仍使用本地占位图，音频保持禁用。
              </p>
              {!kimiAvailable ? <small>需要先在本机启用并配置新 Key</small> : null}
            </div>
            <span className="mode-price paid">按量</span>
          </button>
        </div>
        {mode === "kimi" ? (
          <label className="cost-confirm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span className="cost-check">{acknowledged ? <Check size={14} /> : null}</span>
            <div>
              <strong>我确认本次会调用 Kimi API，并可能产生费用</strong>
              <p>系统不会自动重试；队列并发固定为 1，并受每日调用上限保护。</p>
            </div>
          </label>
        ) : (
          <div className="zero-cost-note">
            <CircleDollarSign size={19} />
            <div>
              <strong>本次不会产生任何 API 费用</strong>
              <span>适合先体验流程、检查版式和编辑功能。</span>
            </div>
          </div>
        )}
        <button
          className="primary-button full-button"
          disabled={busy || (mode === "kimi" && (!kimiAvailable || !acknowledged))}
          onClick={() => onStart(project, mode, acknowledged)}
        >
          {busy ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
          加入生成队列
        </button>
      </div>
    </Modal>
  );
}

function NewSubjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    chineseName: "",
    englishName: "",
    level1: "",
    level2: "",
    level3: "",
    description: "",
    tags: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="添加一个新主题" subtitle="它会只保存在本机的灵感主体库里。" onClose={onClose}>
      <div className="modal-body form-grid">
        <label className="field-label">
          中文名称 *
          <input
            className="text-input"
            value={form.chineseName}
            onChange={(event) => setForm({ ...form, chineseName: event.target.value })}
            placeholder="例如：海獭"
          />
        </label>
        <label className="field-label">
          英文名称
          <input
            className="text-input"
            value={form.englishName}
            onChange={(event) => setForm({ ...form, englishName: event.target.value })}
            placeholder="Sea Otter"
          />
        </label>
        <div className="three-field-row">
          {(["level1", "level2", "level3"] as const).map((field, index) => (
            <label className="field-label" key={field}>
              {["一级分类", "二级分类", "三级分类"][index]}
              <input
                className="text-input"
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <label className="field-label">
          简短描述
          <textarea
            className="text-area"
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <label className="field-label">
          标签
          <input
            className="text-input"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="海洋, 哺乳动物, 工具使用"
          />
        </label>
        <button
          className="primary-button full-button"
          disabled={!form.chineseName.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/subjects", { method: "POST", ...jsonBody(form) });
              onCreated();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <RefreshCw className="spin" size={17} /> : <Plus size={17} />}
          加入灵感库
        </button>
      </div>
    </Modal>
  );
}

function Workbench({
  project,
  tab,
  busy,
  onTab,
  onClose,
  onEdit,
  onGenerate,
  onAudit,
  onRefresh,
}: {
  project: Project;
  tab: "science" | "story";
  busy: string;
  onTab: (tab: "science" | "story") => void;
  onClose: () => void;
  onEdit: (page: BookPage) => void;
  onGenerate: () => void;
  onAudit: () => void;
  onRefresh: () => void;
}) {
  const pages = (project.pages || []).filter((page) => page.contentType === tab);
  const consistency = project.consistencySettings?.[tab] || null;
  return (
    <div className="workbench-shell">
      <header className="workbench-header">
        <button
          aria-label="返回绘本工坊"
          className="back-button"
          title="返回绘本工坊"
          onClick={onClose}
        >
          <ArrowLeft size={19} />
          <span>返回工坊</span>
        </button>
        <div className="workbench-title">
          <span className="workbench-mark">
            <BookOpen size={22} />
          </span>
          <div>
            <span>#{project.labelId}</span>
            <h2>{project.topic}</h2>
          </div>
          <StatusPill status={project.status} />
        </div>
        <div className="workbench-actions">
          <button
            aria-label="刷新项目"
            className="secondary-button"
            title="刷新项目"
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
            <span>刷新</span>
          </button>
          {pages.length ? (
            <>
              <button
                aria-label="执行本地审核"
                className="secondary-button"
                disabled={busy === `audit-${project.id}`}
                title="执行本地审核"
                onClick={onAudit}
              >
                <ShieldCheck size={16} />
                <span>本地审核</span>
              </button>
              <a
                aria-label="导出资源包"
                className="primary-button"
                href={downloadUrl(`/exports/${project.id}/download`)}
                target="_blank"
                rel="noreferrer"
                title="导出资源包"
              >
                <Download size={16} />
                <span>导出资源包</span>
              </a>
            </>
          ) : (
            <button
              aria-label="开始生成"
              className="primary-button"
              title="开始生成"
              onClick={onGenerate}
            >
              <Play size={16} />
              <span>开始生成</span>
            </button>
          )}
        </div>
      </header>
      <div className="workbench-meta">
        <div className="book-tabs">
          <button className={tab === "science" ? "active" : ""} onClick={() => onTab("science")}>
            <span className="tab-icon science-tab">
              <Sparkles size={17} />
            </span>
            科普绘本
            <em>{(project.pages || []).filter((page) => page.contentType === "science").length}</em>
          </button>
          <button className={tab === "story" ? "active" : ""} onClick={() => onTab("story")}>
            <span className="tab-icon story-tab">
              <BookHeart size={17} />
            </span>
            故事绘本
            <em>{(project.pages || []).filter((page) => page.contentType === "story").length}</em>
          </button>
        </div>
        <p>
          {tab === "science"
            ? "把一个主题拆成孩子能看见、能理解、能继续追问的知识。"
            : "让知识走进角色、挑战与温暖结尾，变成可以反复讲的故事。"}
        </p>
      </div>
      {consistency ? (
        <div className="consistency-strip">
          <div>
            <span>统一画风</span>
            <strong>{consistency.artStyle || "已按提示词锁定"}</strong>
          </div>
          <div>
            <span>{tab === "story" ? "故事立意" : "内容类型"}</span>
            <strong>
              {tab === "story"
                ? consistency.storyTheme || "由主题自然生成"
                : consistency.type}
            </strong>
          </div>
          <div>
            <span>核心角色 / 主体</span>
            <strong>
              {consistency.coreSubjects.map((subject) => subject.name).filter(Boolean).join("、") ||
                "无固定角色"}
            </strong>
          </div>
        </div>
      ) : null}
      <div className="workbench-body">
        {pages.length ? (
          <div className="page-grid">
            {pages.map((page) => (
              <article className="page-card" key={page.id}>
                <button className="page-image" onClick={() => onEdit(page)}>
                  {page.imageUrl ? (
                    <img src={page.imageUrl} alt={`${project.topic}第${page.pageIndex + 1}页`} />
                  ) : (
                    <span>
                      <ImageIcon size={30} />
                      等待图片
                    </span>
                  )}
                  <span className="page-number">{String(page.pageIndex + 1).padStart(2, "0")}</span>
                  <span className="edit-hint">点击编辑</span>
                </button>
                <div className="page-copy">
                  <strong>{page.title}</strong>
                  <p>{page.text}</p>
                  {page.emotion || page.charactersInScene.length ? (
                    <div className="page-context-chips">
                      {page.emotion ? <span>情绪 · {page.emotion}</span> : null}
                      {page.charactersInScene.length ? (
                        <span>出场 · {page.charactersInScene.join("、")}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="page-footer">
                  <span className={page.imageUrl ? "asset-ready" : ""}>
                    <ImageIcon size={14} />
                    {page.imageUrl ? "图片已就位" : "等待图片"}
                  </span>
                  <span className="asset-disabled">
                    <AudioLines size={14} />
                    音频接口保留
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel-card workbench-empty">
            <EmptyState
              icon={BookOpen}
              title="这本绘本还没有页面"
              text="选择生成模式后，科普与故事页面会一起准备好。"
              action={
                <button className="primary-button" onClick={onGenerate}>
                  <Play size={17} />
                  开始生成
                </button>
              }
            />
          </div>
        )}
        {project.audit ? (
          <aside className="audit-summary-card">
            <div className="audit-summary-score">
              <strong>{project.audit.score}</strong>
              <span>审核分</span>
            </div>
            <div>
              <strong>{project.audit.mode === "local" ? "本地规则审核" : "Kimi 深度审核"}</strong>
              <p>
                {project.audit.issues.length
                  ? `发现 ${project.audit.issues.length} 个可以继续优化的地方。`
                  : "没有发现明显问题，可以安心进入下一步。"}
              </p>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function PageEditor({
  page,
  onClose,
  onSaved,
  notify,
}: {
  page: BookPage;
  onClose: () => void;
  onSaved: () => void;
  notify: (toast: Toast) => void;
}) {
  const [draft, setDraft] = useState(page);
  const [busy, setBusy] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(page), [page]);

  const upload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    setBusy("upload");
    try {
      await api(`/pages/${page.id}/upload-image`, { method: "POST", body: form });
      await onSaved();
      notify({ type: "success", message: "图片已安全保存到本机" });
    } catch (error) {
      notify({ type: "error", message: error instanceof Error ? error.message : "上传失败" });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="page-editor"
        role="dialog"
        aria-modal="true"
        aria-label="编辑绘本页面"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="editor-header">
          <div>
            <span>{page.contentType === "science" ? "科普绘本" : "故事绘本"} · 第 {page.pageIndex + 1} 页</span>
            <h2>编辑这一页</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭编辑器">
            <X size={20} />
          </button>
        </div>
        <div className="editor-scroll">
          <div className="editor-visual">
            <div className="editor-preview">
              {draft.imageUrl ? (
                <img src={draft.imageUrl} alt={draft.title} />
              ) : (
                <div className="editor-image-empty">
                  <ImageIcon size={30} />
                  等待图片
                </div>
              )}
            </div>
            <div className="editor-image-actions">
              <button className="small-secondary" onClick={() => uploadRef.current?.click()}>
                <Upload size={15} />
                上传替换
              </button>
              <button
                className="small-secondary"
                disabled={busy === "placeholder"}
                onClick={async () => {
                  setBusy("placeholder");
                  try {
                    await api(`/pages/${page.id}/regenerate-image`, { method: "POST" });
                    await onSaved();
                    notify({ type: "success", message: "已重新生成本地占位图" });
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <RotateCcw size={15} />
                重做占位图
              </button>
            </div>
          </div>
          <input
            ref={uploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className="editor-fields">
            <label className="field-label">
              页面标题
              <input
                className="text-input"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label className="field-label">
              页面正文
              <textarea
                className="text-area"
                rows={7}
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              />
            </label>
            <label className="field-label">
              图片提示词
              <textarea
                className="text-area"
                rows={6}
                value={draft.imagePrompt}
                onChange={(event) => setDraft({ ...draft, imagePrompt: event.target.value })}
              />
            </label>
            <div className="audio-reserved-box">
              <span>
                <AudioLines size={20} />
              </span>
              <div>
                <strong>音频接口已保留</strong>
                <p>当前没有连接任何语音供应商，不会发出请求或产生费用。</p>
              </div>
              <em>DISABLED</em>
            </div>
          </div>
        </div>
        <div className="editor-footer">
          <button className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-button"
            disabled={busy === "save"}
            onClick={async () => {
              setBusy("save");
              try {
                await api(`/pages/${page.id}`, {
                  method: "PATCH",
                  ...jsonBody({
                    title: draft.title,
                    text: draft.text,
                    imagePrompt: draft.imagePrompt,
                  }),
                });
                await onSaved();
                notify({ type: "success", message: "这一页已经保存" });
                onClose();
              } catch (error) {
                notify({ type: "error", message: error instanceof Error ? error.message : "保存失败" });
              } finally {
                setBusy("");
              }
            }}
          >
            {busy === "save" ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
            保存页面
          </button>
        </div>
      </aside>
    </div>
  );
}
