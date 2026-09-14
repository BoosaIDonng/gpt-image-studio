/**
 * Chinese → English mapping for image-generation vocabulary.
 *
 * The RAG corpus mixes Chinese queries with English documents (historical
 * successful prompts, favorites, wordbank terms are usually English). Bigram
 * tokenization cannot bridge languages, so queries are expanded with the
 * English terms of matched Chinese tokens before scoring.
 *
 * Keys must be lowercase; lookups run against tokenizer output which is
 * already lowercased. Chinese keys are matched as whole tokens (they survive
 * tokenization only when the tokenizer emits whole runs or as part of bigrams),
 * so short two-character keys work best.
 */
const BILINGUAL_TERMS: Record<string, string[]> = {
  // 光影
  电影感: ["cinematic", "cinematic lighting"],
  逆光: ["backlight", "backlit"],
  侧光: ["side lighting"],
  顶光: ["top lighting"],
  轮廓光: ["rim light"],
  剪影: ["silhouette"],
  黄昏: ["golden hour", "dusk"],
  日落: ["sunset"],
  日出: ["sunrise"],
  清晨: ["early morning", "morning light"],
  正午: ["midday", "harsh sunlight"],
  阴天: ["overcast", "cloudy"],
  霓虹: ["neon", "neon lights"],
  柔光: ["soft light", "soft lighting"],
  硬光: ["hard light", "harsh lighting"],
  自然光: ["natural light"],
  窗光: ["window light"],
  阴影: ["shadow"],
  光晕: ["halation", "glow"],
  星空: ["starry sky", "starry night"],
  // 构图/镜头
  特写: ["close-up", "close up shot"],
  微距: ["macro"],
  全身: ["full body shot"],
  半身: ["upper body shot"],
  大头: ["headshot"],
  航拍: ["aerial view", "drone shot"],
  俯拍: ["top-down view", "high angle"],
  仰拍: ["low angle"],
  广角: ["wide angle"],
  长曝光: ["long exposure"],
  浅景深: ["shallow depth of field", "bokeh"],
  背景虚化: ["bokeh", "blurred background"],
  对称构图: ["symmetrical composition"],
  留白: ["negative space"],
  三分法: ["rule of thirds"],
  全景: ["panorama", "wide shot"],
  俯视: ["bird's eye view"],
  侧面: ["profile view", "side view"],
  正面: ["front view"],
  回眸: ["looking back", "glancing over shoulder"],
  // 风格/媒介
  胶片: ["film grain", "analog film"],
  写实: ["photorealistic", "realistic"],
  水彩: ["watercolor"],
  油画: ["oil painting"],
  素描: ["sketch", "pencil drawing"],
  版画: ["woodblock print", "printmaking"],
  像素: ["pixel art"],
  蒸汽波: ["vaporwave"],
  极简: ["minimalist", "minimalism"],
  复古: ["retro", "vintage"],
  赛博朋克: ["cyberpunk"],
  蒸汽朋克: ["steampunk"],
  废土: ["post-apocalyptic", "wasteland"],
  仙侠: ["xianxia", "fantasy immortal"],
  国风: ["chinese style", "guofeng"],
  汉服: ["hanfu", "traditional chinese dress"],
  和风: ["japanese style", "kimono aesthetic"],
  二次元: ["anime style", "anime"],
  三维: ["3d render", "cgi"],
  手绘: ["hand drawn"],
  概念艺术: ["concept art"],
  插画: ["illustration"],
  海报: ["poster design"],
  壁纸: ["wallpaper"],
  头像: ["avatar", "portrait icon"],
  // 情绪/氛围
  温馨: ["cozy", "warm atmosphere"],
  孤独: ["solitude", "lonely mood"],
  忧郁: ["melancholic", "melancholy"],
  治愈: ["healing", "soothing"],
  唯美: ["ethereal", "aesthetic"],
  震撼: ["epic", "dramatic"],
  梦幻: ["dreamy", "dreamlike"],
  神秘: ["mysterious", "mystical"],
  安静: ["serene", "quiet mood"],
  热闹: ["bustling", "lively"],
  荒凉: ["desolate", "bleak"],
  诡异: ["eerie", "uncanny"],
  优雅: ["elegant"],
  性感: ["sensual"],
  清纯: ["innocent look"],
  冷酷: ["stoic", "cold expression"],
  // 主体/场景
  少女: ["young girl", "maiden"],
  女孩: ["girl"],
  男孩: ["boy"],
  街拍: ["street snapshot", "street photography"],
  街头: ["street"],
  海边: ["seaside", "by the sea"],
  海滩: ["beach"],
  雪山: ["snowy mountain"],
  森林: ["forest", "woods"],
  花海: ["flower field"],
  雨天: ["rainy day", "rain"],
  雪景: ["snowy scene", "snow"],
  都市: ["urban", "cityscape"],
  咖啡馆: ["cafe", "coffee shop"],
  卧室: ["bedroom"],
  教室: ["classroom"],
  天台: ["rooftop"],
  隧道: ["tunnel"],
  天空: ["sky"],
  云海: ["sea of clouds"],
  樱花: ["cherry blossoms", "sakura"],
  烟花: ["fireworks"],
  白裙: ["white dress"],
  校服: ["school uniform"],
  婚纱: ["wedding dress", "bridal"],
  战甲: ["armor", "battle suit"],
  机甲: ["mecha"],
  龙舟: ["dragon boat"],
  灯笼: ["lantern"],
  // 画质/技术
  高清: ["high resolution", "sharp focus"],
  超清: ["ultra detailed"],
  细节: ["intricate details"],
  磨皮: ["smooth skin"],
  肤质: ["skin texture"],
  虚化: ["blurred", "depth of field"],
  噪点: ["film grain", "noise"],
  暗调: ["low key"],
  高调: ["high key"],
  黑白: ["black and white", "monochrome"],
  高饱和: ["vivid colors", "saturated"],
  低饱和: ["muted colors", "desaturated"],
  莫兰迪: ["morandi tones", "muted palette"],
};

/** English expansions for a Chinese token (empty array when unmapped). */
export function bilingualExpansions(token: string): string[] {
  return BILINGUAL_TERMS[token] ?? [];
}

/** All mapped Chinese keys, used by tests and diagnostics. */
export function bilingualTermKeys(): string[] {
  return Object.keys(BILINGUAL_TERMS);
}
