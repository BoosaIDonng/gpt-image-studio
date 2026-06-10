export type TutorialStep = {
  label: string;
  done: boolean;
};

export type TutorialStepInput = {
  isConnected: boolean;
  hasPrompted: boolean;
  hasCreated: boolean;
};

export function buildTutorialSteps(input: TutorialStepInput): TutorialStep[] {
  return [
    { label: "配置接口", done: input.isConnected },
    { label: "输入提示词", done: input.hasPrompted },
    { label: "生成图片", done: input.hasCreated },
  ];
}
