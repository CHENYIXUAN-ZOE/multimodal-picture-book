export {
  DEFAULT_SCIENCE_PROMPT,
  DEFAULT_STORY_PROMPT,
} from "./prompt-presets";

export function buildBookPrompt(input: {
  topic: string;
  categories: string[];
  targetAge: string;
  sciencePageCount: number;
  storyPageCount: number;
  scienceKnowledgePointCountMin: number;
  scienceKnowledgePointCountMax: number;
  sciencePrompt: string;
  storyPrompt: string;
  scienceImageStylePrompt: string;
  scienceNegativePrompt: string;
  scienceImagePromptGuide: string;
  storyImageStylePrompt: string;
  storyNegativePrompt: string;
  storyImagePromptGuide: string;
}) {
  return `请为“${input.topic}”生成一套相互独立的科普绘本与故事绘本。
分类：${input.categories.join(" > ") || "未分类"}
目标年龄：${input.targetAge}

【科普绘本系统规则】
${input.sciencePrompt.replaceAll("{age}", input.targetAge)}

科普绘本必须生成 ${input.sciencePageCount} 页，并覆盖 ${input.scienceKnowledgePointCountMin} 到 ${input.scienceKnowledgePointCountMax} 个关键知识点。

【科普图片描述指导】
${input.scienceImagePromptGuide}

【科普图片默认风格】
${input.scienceImageStylePrompt}

【科普图片禁止项】
${input.scienceNegativePrompt}

【故事绘本系统规则】
${input.storyPrompt.replaceAll("{age}", input.targetAge)}

故事绘本必须生成 ${input.storyPageCount} 页。

【故事图片描述指导】
${input.storyImagePromptGuide}

【故事图片默认风格】
${input.storyImageStylePrompt}

【故事图片禁止项】
${input.storyNegativePrompt}

【生成前内部规划】
1. 科普部分先判断主题类型：character_story、lifecycle、concept 或 comparison。
2. 科普部分规划知识维度、核心主体外观和统一色彩。
3. 故事部分先确定立意、叙事策略、角色性格和统一视觉设定。
4. 再逐页写正文和英文 imagePrompt。不要把内部推理写到 JSON 之外。

请严格返回 JSON 对象，不要添加 Markdown。结构如下：
{
  "science": {
    "title": "书名",
    "consistencySettings": {
      "type": "character_story|lifecycle|concept|comparison",
      "coreSubjects": [
        {
          "name": "主体名称",
          "headFeatures": "头部、面部或最醒目的识别特征",
          "bodyType": "体型、结构和比例",
          "otherFeatures": "颜色、服装、材质或其他标志性特征"
        }
      ],
      "artStyle": "英文艺术风格",
      "colorPalette": "英文统一色彩方案"
    },
    "pages": [
      {
        "title": "页标题",
        "text": "正文",
        "imagePrompt": "从本页知识点推导出的英文图片提示词",
        "charactersInScene": ["本页实际出现的主体名称"],
        "emotion": "本页氛围"
      }
    ]
  },
  "story": {
    "title": "书名",
    "consistencySettings": {
      "type": "character_story",
      "narrativeReason": "选择该叙事策略的原因",
      "coreSubjects": [
        {
          "name": "角色名称",
          "headFeatures": "稳定的头部和面部特征",
          "bodyType": "稳定的体型与比例",
          "otherFeatures": "稳定的颜色、服装和标志性特征",
          "personality": "角色性格"
        }
      ],
      "artStyle": "英文艺术风格",
      "colorPalette": "英文统一色彩方案",
      "storyTheme": "故事立意或核心情感"
    },
    "pages": [
      {
        "title": "页标题",
        "text": "正文",
        "imagePrompt": "按表情、动作、镜头、场景、光线五要素组织的英文图片提示词",
        "charactersInScene": ["本页实际出现的角色名称"],
        "emotion": "准确的页面情绪"
      }
    ]
  }
}

【JSON 强制要求】
- science.pages 必须恰好 ${input.sciencePageCount} 页
- story.pages 必须恰好 ${input.storyPageCount} 页
- 所有页面必须包含 title、text、imagePrompt、charactersInScene、emotion
- charactersInScene 只填写当前画面真正出现的主体；没有角色时返回空数组
- 相同角色在不同页面的名称必须完全一致
- imagePrompt 必须使用英文，不包含绘图参数语法或 Markdown
- imagePrompt 的场景、动作和情绪必须与本页 text 一致
- 不输出额外字段，不输出 JSON 之外的解释。`;
}

export function buildAuditPrompt(project: {
  topic: string;
  pages: Array<{
    contentType: string;
    pageIndex: number;
    text: string;
    imagePrompt: string;
  }>;
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
