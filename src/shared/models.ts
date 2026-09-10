import { GPT_IMAGE_MODEL_PATTERN } from "../services/imageCapabilityRegistry";

/**
 * gpt-image 系列（gpt-image-1、gpt-image-2 等）固定返回 b64_json，
 * 不接受也不识别 response_format 参数，传了会报 HTTP 400 Unknown parameter。
 * 只有 dall-e 系列需要通过 response_format 切换 url / b64_json。
 *
 * 判断规则以 imageCapabilityRegistry 为唯一声明处；这里只是语义别名。
 */
export function isGptImageModel(model: string): boolean {
  return GPT_IMAGE_MODEL_PATTERN.test(model.trim());
}
