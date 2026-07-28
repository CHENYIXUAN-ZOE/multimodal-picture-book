import type {
  AppSettings,
  DashboardSummary,
  Project,
  ServiceStatus,
  Subject,
} from "@/shared/types";

const STORAGE_KEY = "multimodal-picture-book-public-demo-v1";
const now = "2026-07-28T08:00:00.000Z";

const subjects: Subject[] = [
  {
    id: "subject-ocean",
    labelId: "DEMO-001",
    level1: "自然科学",
    level2: "海洋世界",
    level3: "海洋动物",
    chineseName: "会使用工具的海獭",
    englishName: "Sea Otter",
    description: "认识海獭如何用石头打开贝壳，以及它们对海洋生态的重要作用。",
    tags: "海洋, 哺乳动物, 工具使用",
    generationStatus: "complete",
    projectId: "project-otter",
    createdAt: now,
  },
  {
    id: "subject-firefly",
    labelId: "DEMO-002",
    level1: "自然科学",
    level2: "昆虫世界",
    level3: "发光生物",
    chineseName: "萤火虫为什么会发光",
    englishName: "Firefly",
    description: "探索萤火虫冷光背后的奇妙化学反应。",
    tags: "昆虫, 生物发光, 夏夜",
    generationStatus: "pending",
    createdAt: now,
  },
  {
    id: "subject-moon",
    labelId: "DEMO-003",
    level1: "宇宙探索",
    level2: "太阳系",
    level3: "月球",
    chineseName: "月亮的圆缺变化",
    englishName: "Moon Phases",
    description: "用孩子能理解的方式认识月相变化。",
    tags: "月球, 月相, 天文",
    generationStatus: "pending",
    createdAt: now,
  },
  {
    id: "subject-seed",
    labelId: "DEMO-004",
    level1: "生命科学",
    level2: "植物",
    level3: "生命周期",
    chineseName: "一颗种子的旅行",
    englishName: "A Seed's Journey",
    description: "跟随一颗蒲公英种子经历发芽和成长。",
    tags: "植物, 种子, 成长",
    generationStatus: "pending",
    createdAt: now,
  },
  {
    id: "subject-cloud",
    labelId: "DEMO-005",
    level1: "地球科学",
    level2: "天气",
    level3: "水循环",
    chineseName: "云朵的旅行日记",
    englishName: "Cloud Journey",
    description: "从一滴水出发，理解蒸发、凝结和降雨。",
    tags: "天气, 云, 水循环",
    generationStatus: "pending",
    createdAt: now,
  },
  {
    id: "subject-dinosaur",
    labelId: "DEMO-006",
    level1: "地球科学",
    level2: "远古生命",
    level3: "恐龙",
    chineseName: "小恐龙寻找羽毛",
    englishName: "Feathered Dinosaurs",
    description: "从化石证据认识长着羽毛的恐龙。",
    tags: "恐龙, 化石, 羽毛",
    generationStatus: "pending",
    createdAt: now,
  },
];

const demoProject: Project = {
  id: "project-otter",
  subjectId: "subject-ocean",
  labelId: "DEMO-001",
  topic: "会使用工具的海獭",
  categories: ["自然科学", "海洋世界", "海洋动物"],
  status: "complete",
  currentStep: "演示绘本已完成",
  createdAt: now,
  updatedAt: now,
  consistencySettings: {
    science: {
      type: "character_story",
      coreSubjects: [
        {
          name: "小海獭泡泡",
          headFeatures: "圆圆的脸、浅色鼻尖",
          bodyType: "蓬松的棕色身体",
          otherFeatures: "抱着一块灰色小石头",
          personality: "好奇、耐心",
        },
      ],
      artStyle: "灵动童趣的水彩与彩铅质感",
      colorPalette: "海蓝、珊瑚橙、奶油黄",
    },
    story: null,
  },
  pages: [
    {
      id: "page-otter-1",
      projectId: "project-otter",
      contentType: "science",
      pageIndex: 0,
      title: "海面上的小餐桌",
      text: "海獭泡泡仰面漂在海上，把胸口当作一张小餐桌。它从海底带回贝壳，也带回最喜欢的小石头。",
      imagePrompt: "童趣水彩绘本，圆脸小海獭仰漂在蓝绿色海面，胸前放着贝壳和灰色石头，温暖晨光",
      charactersInScene: ["小海獭泡泡"],
      emotion: "好奇、开心",
      status: "complete",
    },
    {
      id: "page-otter-2",
      projectId: "project-otter",
      contentType: "science",
      pageIndex: 1,
      title: "咔嗒！工具开饭啦",
      text: "泡泡用石头轻轻敲击贝壳。一下、两下、三下——坚硬的外壳打开了！会使用工具，是海獭很了不起的本领。",
      imagePrompt: "童趣水彩绘本，小海獭用石头敲开贝壳，飞溅的小水珠，表情专注又惊喜",
      charactersInScene: ["小海獭泡泡"],
      emotion: "专注、惊喜",
      status: "complete",
    },
    {
      id: "page-otter-3",
      projectId: "project-otter",
      contentType: "science",
      pageIndex: 2,
      title: "守护海藻森林",
      text: "海獭爱吃海胆，能帮助海藻森林健康生长。茂密的海藻又为许多海洋动物提供了家。",
      imagePrompt: "明亮的海藻森林，小海獭与鱼群穿梭其中，层次丰富的蓝绿配色，儿童科普绘本",
      charactersInScene: ["小海獭泡泡"],
      emotion: "自在、温暖",
      status: "complete",
    },
  ],
  audit: {
    id: "audit-otter",
    projectId: "project-otter",
    score: 96,
    issues: [],
    mode: "local",
    createdAt: now,
  },
};

const defaultSettings: AppSettings = {
  targetAge: "6—9 岁",
  sciencePageCount: 7,
  storyPageCount: 8,
  scienceKnowledgePointCountMin: 6,
  scienceKnowledgePointCountMax: 9,
  scienceImageStyle: "皮克斯 3D",
  storyImageStyle: "水彩手绘",
  imageStyle: "灵动童趣、柔和光线、清晰主体、适合儿童阅读",
  scienceImageStylePrompt: "明亮而有层次的儿童科普绘本，主体清晰，造型准确，画面富有探索感。",
  scienceNegativePrompt: "避免文字、水印、恐怖元素、畸形肢体、模糊主体和错误科学结构。",
  scienceImagePromptGuide: "描述主体、动作、环境、构图、光线与色彩，并确保科学特征准确。",
  storyImageStylePrompt: "温暖灵动的水彩手绘儿童绘本，角色表情丰富，画面有连续叙事感。",
  storyNegativePrompt: "避免文字、水印、成人化造型、惊悚内容、角色外观不一致。",
  storyImagePromptGuide: "保持角色造型一致，清楚描述情绪、动作、场景和镜头语言。",
  imageStylePresets: [
    { name: "童趣水彩", stylePrompt: "温暖水彩、柔和纸张纹理、灵动笔触", negativePrompt: "写实摄影、水印、文字" },
    { name: "彩铅手绘", stylePrompt: "细腻彩铅、明快配色、儿童绘本构图", negativePrompt: "阴暗、惊悚、模糊" },
    { name: "黏土 3D", stylePrompt: "圆润黏土质感、柔和棚拍光、可爱比例", negativePrompt: "尖锐、成人化、文字" },
  ],
  model: "kimi-k2.6",
  kimiEnabled: false,
  kimiRegion: "cn",
  generationMode: "local",
  dailyAiCallLimit: 0,
  sciencePrompt: "你是一位儿童科普绘本作者。请围绕 {topic}，为 {age} 儿童创作准确、清晰、有趣的分镜内容。",
  storyPrompt: "你是一位儿童故事绘本作者。请围绕 {topic}，为 {age} 儿童创作温暖、有起伏且适合亲子阅读的故事。",
};

const services: ServiceStatus = {
  localOnly: true,
  database: "ready",
  kimi: {
    configured: false,
    enabled: false,
    keySource: null,
    keyHint: null,
    model: "kimi-k2.6",
    callsToday: 0,
    dailyLimit: 0,
    endpointRegion: "cn",
  },
  image: {
    provider: "local-placeholder",
    generationAvailable: false,
    uploadAvailable: true,
  },
  audio: { provider: "disabled", reserved: true },
};

type DemoState = {
  projects: Project[];
  subjects: Subject[];
  settings: AppSettings;
  paused: boolean;
};

function initialState(): DemoState {
  return {
    projects: [demoProject],
    subjects,
    settings: defaultSettings,
    paused: false,
  };
}

function loadState(): DemoState {
  if (typeof window === "undefined") return initialState();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as DemoState) : initialState();
  } catch {
    return initialState();
  }
}

function saveState(state: DemoState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function bodyOf(options: RequestInit) {
  if (typeof options.body !== "string") return {};
  try {
    return JSON.parse(options.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function queueFor(state: DemoState) {
  return {
    paused: state.paused,
    activeProjectId: null,
    waiting: 0,
    completedToday: state.projects.filter((item) => item.status === "complete").length,
    items: [],
  };
}

function dashboardFor(state: DemoState): DashboardSummary {
  return {
    subjectCount: state.subjects.length,
    projectCount: state.projects.length,
    completedCount: state.projects.filter((item) => item.status === "complete").length,
    reviewCount: state.projects.filter((item) => item.status === "review_needed").length,
    queuedCount: 0,
    generatedPages: state.projects.reduce((total, item) => total + (item.pages?.length || 0), 0),
    recentProjects: state.projects.slice(0, 5),
    queue: queueFor(state),
    services,
  };
}

function projectFromTopic(topic: string, subject?: Subject): Project {
  const id = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    subjectId: subject?.id || null,
    labelId: subject?.labelId || `DEMO-${Date.now().toString().slice(-4)}`,
    topic,
    categories: subject ? [subject.level1, subject.level2, subject.level3].filter(Boolean) : ["自由创作"],
    status: "idle",
    currentStep: "等待开始",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    consistencySettings: { science: null, story: null },
    pages: [],
  };
}

export async function demoApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const state = loadState();
  const method = (options.method || "GET").toUpperCase();
  const [pathname, query = ""] = path.split("?");
  const payload = bodyOf(options);

  if (pathname === "/dashboard") return { success: true, data: dashboardFor(state) } as T;
  if (pathname === "/settings" && method === "GET") {
    return { success: true, data: state.settings, services } as T;
  }
  if (pathname === "/settings" && method === "PATCH") {
    state.settings = { ...state.settings, ...payload, kimiEnabled: false, dailyAiCallLimit: 0 };
    saveState(state);
    return { success: true, data: state.settings, services } as T;
  }
  if (pathname === "/settings/reset-prompts" && method === "POST") {
    state.settings = defaultSettings;
    saveState(state);
    return { success: true, data: state.settings, services } as T;
  }
  if (pathname.startsWith("/settings/") && method !== "GET") {
    throw new Error("公开演示版不会接收或验证 API Key，请在本地完整版中配置 Kimi。");
  }

  if (pathname === "/subjects/categories") {
    const counts = new Map<string, number>();
    state.subjects.forEach((item) => counts.set(item.level1, (counts.get(item.level1) || 0) + 1));
    return {
      success: true,
      data: [...counts].map(([level1, count]) => ({ level1, count })),
    } as T;
  }
  if (pathname === "/subjects" && method === "GET") {
    const params = new URLSearchParams(query);
    const search = (params.get("search") || "").toLowerCase();
    const level1 = params.get("level1") || "";
    const filtered = state.subjects.filter(
      (item) =>
        (!level1 || item.level1 === level1) &&
        (!search ||
          `${item.chineseName} ${item.englishName} ${item.description} ${item.tags}`
            .toLowerCase()
            .includes(search)),
    );
    return { success: true, data: filtered, total: filtered.length } as T;
  }
  if (pathname === "/subjects" && method === "POST") {
    const subject: Subject = {
      id: `subject-${Date.now()}`,
      labelId: `DEMO-${Date.now().toString().slice(-4)}`,
      level1: String(payload.level1 || "自定义"),
      level2: String(payload.level2 || ""),
      level3: String(payload.level3 || ""),
      chineseName: String(payload.chineseName || "未命名主题"),
      englishName: String(payload.englishName || ""),
      description: String(payload.description || ""),
      tags: String(payload.tags || ""),
      generationStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    state.subjects.unshift(subject);
    saveState(state);
    return { success: true, data: subject } as T;
  }
  if (pathname === "/subjects/import") {
    throw new Error("公开演示版不上传文件；Excel 导入功能请在本地完整版使用。");
  }

  if (pathname === "/projects" && method === "GET") {
    return { success: true, data: state.projects } as T;
  }
  if (pathname === "/projects" && method === "POST") {
    const selected = Array.isArray(payload.subjectIds)
      ? state.subjects.filter((item) => (payload.subjectIds as string[]).includes(item.id))
      : [];
    const created = selected.length
      ? selected.map((item) => projectFromTopic(item.chineseName, item))
      : [projectFromTopic(String(payload.topic || "新的绘本"))];
    state.projects.unshift(...created);
    saveState(state);
    return { success: true, data: created } as T;
  }
  const projectMatch = pathname.match(/^\/projects\/([^/]+)(?:\/(generate|audit|export))?$/);
  if (projectMatch) {
    const [, id, action] = projectMatch;
    const index = state.projects.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("没有找到这个演示项目");
    if (method === "DELETE") {
      state.projects.splice(index, 1);
      saveState(state);
      return { success: true } as T;
    }
    if (action === "generate") {
      throw new Error("公开演示版已关闭真实 AI 生成，避免产生费用。请在本地完整版中使用。");
    }
    if (action === "audit") {
      state.projects[index] = {
        ...state.projects[index],
        audit: {
          id: `audit-${Date.now()}`,
          projectId: id,
          score: 95,
          issues: [],
          mode: "local",
          createdAt: new Date().toISOString(),
        },
      };
      saveState(state);
      return { success: true, data: state.projects[index] } as T;
    }
    return { success: true, data: state.projects[index] } as T;
  }

  if (pathname === "/queue/pause" || pathname === "/queue/resume") {
    state.paused = pathname.endsWith("pause");
    saveState(state);
    return { success: true, data: queueFor(state) } as T;
  }

  const pageMatch = pathname.match(/^\/pages\/([^/]+)/);
  if (pageMatch) {
    const page = state.projects.flatMap((item) => item.pages || []).find((item) => item.id === pageMatch[1]);
    if (!page) throw new Error("没有找到这个演示页面");
    if (pathname.endsWith("/upload-image")) {
      throw new Error("公开演示版不上传私人图片；该功能请在本地完整版使用。");
    }
    if (method === "PATCH") Object.assign(page, payload);
    saveState(state);
    return { success: true, data: page } as T;
  }

  throw new Error(`公开演示版暂不提供此操作：${pathname}`);
}
