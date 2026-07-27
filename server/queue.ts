import {
  getNextTask,
  getProject,
  getSettings,
  listTasks,
  replacePages,
  updatePage,
  updateProject,
  updateTask,
} from "./db";
import { generateWithKimi } from "./kimi";
import { createPlaceholder } from "./placeholder";

let queuePaused = false;
let processing = false;
let activeProjectId: string | null = null;

function localBook(topic: string, scienceCount: number, storyCount: number) {
  const scienceAngles = [
    ["初次见面", `先来认识${topic}。它最容易被观察到的特征是什么？仔细看一看，你也许会发现一个过去忽略的小细节。`],
    ["住在哪里", `${topic}并不是随处都以同样的方式出现。环境中的温度、水分、光线和空间，会影响它的样子与生活方式。`],
    ["怎么运作", `每个事物都有自己的运行规律。理解${topic}的结构和变化过程，就像拆开一只会动的知识盒子。`],
    ["特别本领", `${topic}最令人惊讶的特点，往往是为了适应环境形成的。你觉得这种本领解决了什么难题？`],
    ["和谁有关", `${topic}从来不是孤零零的。它会和周围的生命、材料、天气或人类活动发生联系。`],
    ["和我有关", `当我们把${topic}和日常生活放在一起比较，抽象的知识就变得可以触摸、可以想象。`],
    ["继续探索", `关于${topic}，还有许多问题等待答案。下一次遇见它时，试着带着“为什么”多观察一分钟。`],
    ["安全与保护", `了解${topic}也意味着学会安全、尊重和保护。一个小小的好习惯，也能带来长久的改变。`],
  ];
  const storyBeats = [
    ["一封奇怪的邀请", `清晨，主角收到一封画着${topic}的邀请函。纸角轻轻发亮，像是在催促一场新的冒险。`],
    ["第一次相遇", `循着线索，主角终于遇见了${topic}。它和想象中不太一样，却让人忍不住想靠近看看。`],
    ["藏起来的线索", `一个不起眼的小细节变成了关键线索。主角停下来观察，发现答案一直藏在眼前。`],
    ["麻烦来了", `忽然，事情偏离了计划。主角有点害怕，但想起一路学到的知识，决定先冷静下来。`],
    ["一起想办法", `大家把不同的想法放在一起，像拼图一样慢慢拼出解决方法。每个人的发现都很重要。`],
    ["勇敢试一次", `主角深吸一口气，按照计划迈出第一步。小小的尝试让局面开始发生变化。`],
    ["原来如此", `谜团终于解开。原来${topic}的独特之处，正是帮助大家走出困境的关键。`],
    ["把故事带回家", `回家的路上，主角把今天的发现写进手册。好奇心没有结束，它只是换了一页继续生长。`],
    ["新的地图", `第二天，窗边又出现了一张新地图。主角笑了，因为这一次，未知不再只是让人紧张。`],
  ];
  const makePages = (
    source: string[][],
    count: number,
    contentType: "science" | "story",
  ) =>
    Array.from({ length: count }, (_, index) => {
      const [title, text] = source[index % source.length];
      return {
        title,
        text,
        imagePrompt: `${topic}, ${title}, ${contentType === "science" ? "educational visual explanation" : "children's story scene"}, expressive composition, playful children's editorial illustration, soft clay texture, no text, vertical 2:3`,
      };
    });
  return {
    science: makePages(scienceAngles, scienceCount, "science"),
    story: makePages(storyBeats, storyCount, "story"),
  };
}

async function processTask() {
  if (queuePaused || processing) return;
  const task = getNextTask();
  if (!task) return;
  processing = true;
  activeProjectId = task.project_id;
  const project = getProject(task.project_id);
  if (!project) {
    updateTask(task.id, "error", 0, "项目不存在");
    processing = false;
    activeProjectId = null;
    return;
  }

  try {
    updateTask(task.id, "processing", 8, "正在规划两本绘本");
    updateProject(project.id, { status: "planning", currentStep: "正在规划科普与故事结构" });
    const settings = getSettings();
    const book =
      task.mode === "kimi"
        ? await generateWithKimi({
            topic: project.topic,
            categories: project.categories,
            acknowledgeCost: task.cost_acknowledged === 1,
          })
        : localBook(project.topic, settings.sciencePageCount, settings.storyPageCount);

    updateTask(task.id, "processing", 35, "文案完成，正在准备页面");
    replacePages(project.id, book);
    updateProject(project.id, { status: "processing", currentStep: "正在生成本地安全占位图" });
    const withPages = getProject(project.id)!;
    const pages = withPages.pages || [];
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const imagePath = await createPlaceholder({
        projectId: project.id,
        contentType: page.contentType,
        pageIndex: page.pageIndex,
        topic: project.topic,
        title: page.title,
      });
      updatePage(page.id, { imagePath, status: "complete" });
      updateTask(
        task.id,
        "processing",
        35 + Math.round(((index + 1) / pages.length) * 60),
        `正在整理第 ${index + 1}/${pages.length} 页`,
      );
    }
    updateTask(task.id, "complete", 100, "生成完成");
    updateProject(project.id, { status: "complete", currentStep: "生成完成，等待审核" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    updateTask(task.id, "error", 0, message);
    updateProject(project.id, { status: "error", currentStep: "生成失败", lastError: message });
  } finally {
    processing = false;
    activeProjectId = null;
  }
}

setInterval(() => {
  void processTask();
}, 800);

export function getQueueState() {
  const items = listTasks();
  return {
    paused: queuePaused,
    activeProjectId,
    waiting: items.filter((item) => item.status === "queued" || item.status === "paused").length,
    completedToday: 0,
    items: items.map((item) => ({
      id: String(item.id),
      projectId: String(item.project_id),
      topic: String(item.topic),
      status: String(item.status),
      progress: Number(item.progress),
      message: String(item.message),
    })),
  };
}

export function setQueuePaused(paused: boolean) {
  queuePaused = paused;
}
