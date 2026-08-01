// 模型 SVG 图标映射
// 所有模型均有本地 SVG，不再回退 OSS
// 注意：turbopack 将 SVG 默认导出为 { src, width, height, blurWidth, blurHeight }

import sunoSvg from './suno.svg';
import gptSvg from './gpt.svg';
import nanoSvg from './nano.svg';
import grokSvg from './grok.svg';
import qwenSvg from './qwen.svg';
import klingSvg from './kling.svg';
import bytedanceSvg from './bytedance.svg';
import viduSvg from './vidu.svg';
import fluxSvg from './flux.svg';
import midjourneySvg from './midjourney.svg';
import hailuoSvg from './hailuo.svg';

/** 前缀匹配规则：模型 ID 以指定前缀开头时自动匹配对应 SVG */
const PREFIX_RULES: { prefix: string; src: string }[] = [
  { prefix: 'suno', src: sunoSvg.src },
  { prefix: 'gpt', src: gptSvg.src },
  { prefix: 'nano', src: nanoSvg.src },
  { prefix: 'grok', src: grokSvg.src },
  { prefix: 'qwen', src: qwenSvg.src },
  { prefix: 'wan', src: qwenSvg.src },
  { prefix: 'z-image', src: qwenSvg.src },
  { prefix: 'happyhorse', src: qwenSvg.src },
  { prefix: 'kling', src: klingSvg.src },
  { prefix: 'bytedance', src: bytedanceSvg.src },
  { prefix: 'seedance', src: bytedanceSvg.src },
  { prefix: 'seedream', src: bytedanceSvg.src },
  { prefix: 'vidu', src: viduSvg.src },
  { prefix: 'flux', src: fluxSvg.src },
  { prefix: 'midjourney', src: midjourneySvg.src },
  { prefix: 'hailuo', src: hailuoSvg.src },
  { prefix: 'minimax', src: hailuoSvg.src },
];

// 模型 ID 到本地 SVG URL 的精确映射（优先于前缀匹配）
const MODEL_SVG_MAP: Record<string, string> = {
  'suno': sunoSvg.src,
  'suno-v3': sunoSvg.src,
  'suno-v3.0': sunoSvg.src,
  'suno-v3.5': sunoSvg.src,
  'suno-v4': sunoSvg.src,
  'suno-v4.0': sunoSvg.src,
  'suno-v4.5': sunoSvg.src,
  'suno-v5': sunoSvg.src,
  'suno-v5.0': sunoSvg.src,
  'suno-v5.5': sunoSvg.src,
  'gpt': gptSvg.src,
  'gpt-image-2': gptSvg.src,
};

/**
 * 获取模型的本地 SVG URL
 * 通过精确匹配或前缀匹配返回对应的 SVG
 */
export function getModelLogoUrl(modelId: string): string {
  const normalizedId = modelId?.toLowerCase()?.trim();
  if (normalizedId) {
    if (MODEL_SVG_MAP[normalizedId]) return MODEL_SVG_MAP[normalizedId];
    for (const rule of PREFIX_RULES) {
      if (normalizedId.startsWith(rule.prefix)) return rule.src;
    }
  }
  return '';
}

/**
 * 检查模型是否有本地 SVG 图标
 */
export function hasLocalSvg(modelId: string): boolean {
  const normalizedId = modelId?.toLowerCase()?.trim();
  if (!normalizedId) return false;
  if (MODEL_SVG_MAP[normalizedId]) return true;
  return PREFIX_RULES.some((rule) => normalizedId.startsWith(rule.prefix));
}

export { MODEL_SVG_MAP };
