import type { ConnectionMode } from "../../types/studio";

export type CreativeTemplate = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  editPrompt: string;
};

export type CreativeCenterInput = {
  connectionMode: ConnectionMode;
  apiKey: string;
  companionPaired: boolean;
  pendingJobCount: number;
  failedMessageCount: number;
  imageCount: number;
  messageCount: number;
};

export type CreativeCenterStatus = {
  connectionLabel: string;
  connectionDetail: string;
  connectionTone: "ok" | "warning";
  activityLabel: string;
  activityDetail: string;
  shouldExpandByDefault: boolean;
};

export const creativeTemplates: CreativeTemplate[] = [
  {
    id: "portrait",
    label: "人物写真",
    description: "身份、情绪、镜头和光线完整起稿",
    prompt:
      "人物写真：主体是一位____，年龄/气质为____，穿着____，场景在____。镜头使用____焦段，半身或近景构图，眼神清晰，人物占画面主体。光线为____，皮肤质感自然，发丝和服装细节真实。整体风格____，背景轻微虚化，避免五官变形、过度磨皮、手部异常和塑料感。",
    editPrompt:
      "基于引用图进行人物写真优化：保留人物身份、脸部特征、姿态和原始构图，只调整____。强化____光线和____氛围，补充发丝、服装纹理和背景层次。整体风格____，避免改变人物长相、年龄、表情方向和关键服饰特征。",
  },
  {
    id: "product",
    label: "产品图",
    description: "主图、质感、卖点和商业留白",
    prompt:
      "产品图：产品是____，核心卖点是____，放置在____背景上，使用____道具衬托比例。镜头为正面或 45 度商业摄影构图，产品边缘清晰，主体居中并保留标题留白。光线为柔和棚拍，突出____材质质感和细节。整体画面干净高级，避免文字乱码、品牌错字、产品变形、反光过曝和杂乱背景。",
    editPrompt:
      "基于引用图优化产品图：保留产品外观、比例、颜色和关键结构，将背景替换为____，加入适量____道具。强化____材质质感，调整为柔和商业布光，构图保留广告留白。避免改变产品轮廓、生成错误文字、增加不存在的接口或按钮。",
  },
  {
    id: "concept",
    label: "场景概念",
    description: "空间关系、时间、天气和故事氛围",
    prompt:
      "场景概念图：地点是____，时代/世界观为____，时间在____，天气和氛围为____。画面包含____作为视觉焦点，前景、中景、远景层次清楚，使用电影感构图和____视角。光线来自____，空间材质、道路、植被或建筑细节丰富。整体风格____，避免透视混乱、重复建筑、人物比例异常和空洞背景。",
    editPrompt:
      "基于引用图扩展场景概念：保留原图主要空间关系、透视方向和核心物体，在____区域加入____氛围。增强____细节，统一光线方向和色调，保持电影感构图。避免破坏原始建筑结构、改变道路走向、重复元素堆叠和明显拼贴感。",
  },
  {
    id: "inpaint",
    label: "局部重绘",
    description: "限定修改区域，保持原图一致性",
    prompt:
      "局部重绘：只修改画面中的____区域，将其变为____。保持其他区域完全不变，包括主体身份、背景结构、光线方向、透视关系和材质纹理。新内容需要贴合原图清晰度、色温和阴影，边缘自然融合。构图不新增无关主体，避免影响未选中区域、产生接缝、重复纹理或比例错误。",
    editPrompt:
      "基于引用图局部重绘：仅调整遮罩内的____区域，替换为____。遮罩外内容必须保持原样，延续原图光线、透视、材质、噪点和清晰度。新区域边缘自然过渡，构图不扩散修改范围。避免改变人物脸部、背景主体、未遮罩物体和整体色调。",
  },
  {
    id: "avatar",
    label: "头像",
    description: "头像识别度、表情、背景和平台感",
    prompt:
      "头像设计：主体是____，身份/角色定位为____，表情____，姿态自然。构图为居中近景头像，头肩比例清晰，脸部识别度高，适合圆形裁切。背景为____，使用____光线，色彩与主体形成区分。整体风格____，细节集中在眼神、发型和轮廓，避免脸部崩坏、过度复杂背景、低清晰度和边缘被裁掉。",
    editPrompt:
      "基于引用图生成头像：保留主体脸部特征、发型、年龄感和核心气质，将背景改为____。调整表情/气质为____，构图适合社交平台圆形头像，脸部清晰、轮廓干净。避免改变身份、过度美化、五官漂移、背景抢主体和头部被裁切。",
  },
  {
    id: "poster",
    label: "海报",
    description: "主题视觉、标题区、层级和宣传感",
    prompt:
      "海报视觉：主题是____，目标场景为____，主视觉为____。构图采用____版式，明确预留标题区、时间信息区和行动按钮区，但不要生成具体文字。配色为____，光影和材质服务于宣传重点。整体风格____，画面具有层级和冲击力，避免文字乱码、信息区拥挤、主体被遮挡和廉价模板感。",
    editPrompt:
      "基于引用图制作海报视觉：保留核心主体、品牌色倾向和主要构图，加入____主题氛围。重新组织画面层级，预留清晰标题区和信息区，不生成具体文字。配色____，强化主视觉冲击力。避免改变核心主体、生成错误文字、让装饰元素遮挡重点和破坏原图识别度。",
  },
];

export function buildCreativeCenterStatus(
  input: CreativeCenterInput,
): CreativeCenterStatus {
  const isConnected =
    input.connectionMode === "localCompanion"
      ? input.companionPaired
      : Boolean(input.apiKey.trim());
  const hasCreated = input.imageCount > 0 || input.messageCount > 0;

  return {
    connectionLabel: connectionLabel(input.connectionMode, isConnected),
    connectionDetail: connectionDetail(input.connectionMode, isConnected),
    connectionTone: isConnected ? "ok" : "warning",
    activityLabel: activityLabel(input.pendingJobCount, input.failedMessageCount),
    activityDetail: activityDetail(input.pendingJobCount, input.failedMessageCount),
    shouldExpandByDefault: !isConnected || !hasCreated,
  };
}

export function promptFromTemplate(template: CreativeTemplate, hasReferences: boolean) {
  return hasReferences ? template.editPrompt : template.prompt;
}

function connectionLabel(connectionMode: ConnectionMode, isConnected: boolean) {
  if (connectionMode === "localCompanion") {
    return isConnected ? "Companion 已连接" : "Companion 未配对";
  }

  return isConnected ? "浏览器直连已配置" : "接口未配置";
}

function connectionDetail(connectionMode: ConnectionMode, isConnected: boolean) {
  if (connectionMode === "localCompanion") {
    return isConnected
      ? "API 凭据保存在本机 Companion 中"
      : "需要在设置中完成本地 Companion 配对";
  }

  return isConnected
    ? "将从浏览器直接请求当前 API"
    : "先在设置中填写 API key 和 Base URL";
}

function activityLabel(pendingJobCount: number, failedMessageCount: number) {
  if (pendingJobCount > 0) return "生成中";
  if (failedMessageCount > 0) return "有失败待处理";
  return "空闲";
}

function activityDetail(pendingJobCount: number, failedMessageCount: number) {
  if (pendingJobCount > 0) {
    return `还有 ${pendingJobCount} 张图片正在生成`;
  }
  if (failedMessageCount > 0) {
    return `${failedMessageCount} 条失败结果可重试或改写`;
  }
  return "可以选择模板或直接输入 prompt";
}
