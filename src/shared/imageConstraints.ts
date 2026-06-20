/**
 * 自定义图片尺寸约束常量。
 *
 * 之前同一组数值在 imageApiRequest.ts 与 settingsStore.ts 各定义一份，
 * 调整上限时极易漏改导致校验两端不一致，现统一从此处引用。
 */

/** 自定义尺寸单边（宽/高）的最大像素。 */
export const MAX_CUSTOM_DIMENSION = 3840;
/** 自定义尺寸单边（宽/高）的最小像素。 */
export const MIN_CUSTOM_DIMENSION = 16;
/** 自定义尺寸宽高的步进（必须为该值的倍数）。 */
export const SIZE_STEP = 16;
/** 自定义尺寸总像素下限。 */
export const MIN_CUSTOM_PIXELS = 655360;
/** 自定义尺寸总像素上限。 */
export const MAX_CUSTOM_PIXELS = 8294400;
/** 自定义尺寸长边与短边的最大比例。 */
export const MAX_CUSTOM_ASPECT_RATIO = 3;
