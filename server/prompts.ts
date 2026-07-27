export const DEFAULT_SCIENCE_PROMPT = `你是一位专业的儿童科普绘本作者。请围绕主题创作适合 {age} 儿童的科普绘本。

要求：
1. 每页只讲一个清晰、准确、可验证的知识点。
2. 同时覆盖“是什么、为什么、和孩子有什么关系”三个层次。
3. 用第二人称和自然提问增加互动感，不使用方括号标签。
4. 语言温暖、简短、有画面感，但不能为了趣味牺牲科学准确性。
5. 每页给出一个从正文知识点推导出的英文图片提示词；提示词要描述主体、动作、场景、构图和光线。
6. 最后一页进行总结或留下值得继续探索的问题。`;

export const DEFAULT_STORY_PROMPT = `你是一位儿童故事绘本创作者。请围绕主题创作适合 {age} 儿童的完整故事。

要求：
1. 从主题的真实特点出发，先确定核心情感或价值，再设计故事。
2. 包含明确的开端、变化、挑战、解决与温暖结尾。
3. 每页推动情节，避免重复动作和空泛说教。
4. 角色外观、性格和关系前后一致。
5. 每页给出一个英文图片提示词，明确角色动作、表情、镜头和环境。
6. 文字适合亲子朗读，保留想象空间。`;

export const DEFAULT_IMAGE_STYLE =
  "playful children's editorial illustration, soft clay texture, lively gestures, warm daylight, rounded shapes, rich but gentle colors, vertical 2:3 composition, no text, no border";

export function buildBookPrompt(input: {
  topic: string;
  categories: string[];
  targetAge: string;
  sciencePageCount: number;
  storyPageCount: number;
  sciencePrompt: string;
  storyPrompt: string;
  imageStyle: string;
}) {
  return `请为“${input.topic}”生成一套科普绘本与故事绘本。
分类：${input.categories.join(" > ") || "未分类"}
目标年龄：${input.targetAge}

科普创作规则：
${input.sciencePrompt.replaceAll("{age}", input.targetAge)}

故事创作规则：
${input.storyPrompt.replaceAll("{age}", input.targetAge)}

统一图片风格：
${input.imageStyle}

请严格返回 JSON 对象，不要添加 Markdown。结构如下：
{
  "science": {
    "title": "书名",
    "pages": [
      {"title":"页标题","text":"正文","imagePrompt":"英文图片提示词"}
    ]
  },
  "story": {
    "title": "书名",
    "pages": [
      {"title":"页标题","text":"正文","imagePrompt":"英文图片提示词"}
    ]
  }
}

science.pages 必须恰好 ${input.sciencePageCount} 页，story.pages 必须恰好 ${input.storyPageCount} 页。`;
}

export function buildAuditPrompt(project: {
  topic: string;
  pages: Array<{ contentType: string; pageIndex: number; text: string; imagePrompt: string }>;
}) {
  return `请审核儿童绘本“${project.topic}”。重点检查科学准确性、年龄适配、安全性、故事连续性、图片提示词与正文的一致性。

内容：
${JSON.stringify(project.pages)}

严格返回 JSON：
{
  "score": 0到100的整数,
  "issues": [
    {
      "type": "accuracy|age_fit|continuity|visual|safety",
      "severity": "low|medium|high",
      "pageIndex": 0,
      "message": "问题",
      "suggestion": "修改建议",
      "status": "open"
    }
  ]
}`;
}
