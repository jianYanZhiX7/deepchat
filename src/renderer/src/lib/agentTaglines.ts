const AGENT_TAGLINES: Record<string, readonly string[]> = {
  deepchat: [
    '今天想做点什么？',
    '想到什么，就问什么',
    '把想法变成结果',
    '从一个问题开始',
    '有事尽管问',
    '把日常琐事交给我'
  ],
  'deepchat-code-expert': [
    '先读懂，再动手',
    '改得对，也改得好',
    '让代码经得起推敲',
    '从报错到修复',
    '小步修改，步步验证',
    '把复杂的事做简单'
  ],
  'deepchat-data-analyst': [
    '让数据说话',
    '用证据下结论',
    '从数据到洞察',
    '每个数字都有出处',
    '先看数据，再下判断',
    '口径清楚，结论才可靠'
  ],
  'deepchat-researcher': [
    '把问题查清楚',
    '多源求证，结论可溯',
    '让每个结论都有出处',
    '先有证据，再有观点',
    '查得广，验得准',
    '分清事实与传闻'
  ],
  'deepchat-writing-assistant': [
    '字斟句酌，恰到好处',
    '让表达更有力量',
    '从初稿到定稿',
    '把想法写成好文字',
    '先想清楚，再写明白',
    '保留你的声音'
  ]
}

const DEFAULT_AGENT_TAGLINES: readonly string[] = [
  '开始一段新的对话',
  '讲一讲你的想法',
  '从一句话开始',
  '准备好了，就出发',
  '想聊什么都可以',
  '说说你手头的任务'
]

export const resolveAgentTaglines = (agentId: string | null | undefined): readonly string[] =>
  (agentId ? AGENT_TAGLINES[agentId] : undefined) ?? DEFAULT_AGENT_TAGLINES

export const pickAgentTagline = (
  agentId: string | null | undefined,
  previous?: string | null,
  random: () => number = Math.random
): string => {
  const taglines = resolveAgentTaglines(agentId)
  const candidates =
    previous && taglines.length > 1 ? taglines.filter((tagline) => tagline !== previous) : taglines
  const pool = candidates.length > 0 ? candidates : taglines
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}
