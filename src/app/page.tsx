"use client";

import {
  ArrowDownToLine,
  Copy,
  ImagePlus,
  Loader2,
  Maximize2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

type ModelId = "gpt-image-2" | "nano-banana-pro";

type ReferenceImage = {
  id: string;
  publicUrl: string;
  filename: string;
  mimeType: string;
};

type GeneratedImage = {
  id: string;
  publicUrl: string;
  filename: string;
};

type Generation = {
  id: string;
  model: ModelId;
  prompt: string;
  aspectRatio: string;
  imageSize?: string | null;
  quality?: string | null;
  optimizeChineseText: boolean;
  status: string;
  error?: string | null;
  createdAt: string;
  images: GeneratedImage[];
  references: ReferenceImage[];
};

type GenerationPayload = {
  model: ModelId;
  prompt: string;
  aspectRatio: string;
  quality: string;
  imageSize: string;
  optimizeChineseText: boolean;
  referenceImageIds: string[];
};

type PromptPreset = {
  name: string;
  text: string;
  custom?: boolean;
};

const aspectRatios: Record<ModelId, string[]> = {
  "gpt-image-2": ["1:1", "16:9", "9:16", "1024x1024", "2048x2048", "3840x2160"],
  "nano-banana-pro": ["1:1", "16:9", "9:16", "21:9", "4:3", "3:4", "3:2", "2:3"],
};

const modelCopy: Record<ModelId, { name: string; description: string }> = {
  "gpt-image-2": {
    name: "GPT Image 2",
    description: "适合文生图、精修和高分辨率画面。",
  },
  "nano-banana-pro": {
    name: "Nano Banana Pro",
    description: "适合参考图融合、风格转绘和图生图。",
  },
};

const defaultPromptPresets: PromptPreset[] = [
  { name: "电影感", text: "电影感光影，35mm 摄影，细腻质感，自然景深" },
  { name: "商业产品", text: "高级商业产品摄影，干净布光，清晰细节，杂志级构图" },
  { name: "插画海报", text: "精致插画海报，明确主体，丰富层次，平衡构图" },
  { name: "写实人像", text: "写实人像摄影，自然肤色，柔和光线，高级肖像质感" },
  { name: "复古胶片", text: "复古胶片色彩，颗粒质感，柔和对比，怀旧氛围" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function StudioPage() {
  const [model, setModel] = useState<ModelId>("gpt-image-2");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [quality, setQuality] = useState("auto");
  const [imageSize, setImageSize] = useState("2K");
  const [optimizeChineseText, setOptimizeChineseText] = useState(false);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [history, setHistory] = useState<Generation[]>([]);
  const [current, setCurrent] = useState<Generation | null>(null);
  const [preview, setPreview] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [modelFilter, setModelFilter] = useState<"all" | ModelId>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "succeeded" | "failed">("all");
  const [historySearch, setHistorySearch] = useState("");
  const [customPresetName, setCustomPresetName] = useState("");
  const [customPresetText, setCustomPresetText] = useState("");
  const [customPresets, setCustomPresets] = useState<PromptPreset[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedDraft = window.localStorage.getItem("image-studio-prompt-draft");
      const rawPresets = window.localStorage.getItem("image-studio-custom-presets");

      if (savedDraft) setPrompt(savedDraft);
      if (rawPresets) {
        try {
          const parsed = JSON.parse(rawPresets) as PromptPreset[];
          setCustomPresets(
            Array.isArray(parsed)
              ? parsed.filter((item) => item.name && item.text).map((item) => ({ ...item, custom: true }))
              : [],
          );
        } catch {
          setCustomPresets([]);
        }
      }
      setStorageLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    window.localStorage.setItem("image-studio-prompt-draft", prompt);
  }, [prompt, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    window.localStorage.setItem("image-studio-custom-presets", JSON.stringify(customPresets));
  }, [customPresets, storageLoaded]);

  function updateModel(nextModel: ModelId) {
    setModel(nextModel);
    setAspectRatio("1:1");
  }

  async function fetchHistory() {
    const response = await fetch("/api/generations");
    const data = await response.json();
    setHistory(data.generations ?? []);
    setCurrent((value) => value ?? data.generations?.[0] ?? null);
  }

  async function uploadReferences(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      files.slice(0, 9 - references.length).forEach((file) => formData.append("images", file));
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "上传失败");
      setReferences((items) => [...items, ...(data.images ?? [])].slice(0, 9));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function submitGeneration(payload: GenerationPayload) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "生成失败");
      setCurrent(data.generation);
      setHistory((items) => [data.generation, ...items.filter((item) => item.id !== data.generation.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    await submitGeneration({
      model,
      prompt,
      aspectRatio,
      quality,
      imageSize,
      optimizeChineseText,
      referenceImageIds: references.map((image) => image.id),
    });
  }

  async function repeatGeneration(generation: Generation) {
    setPreview(null);
    setModel(generation.model);
    setPrompt(generation.prompt);
    setAspectRatio(generation.aspectRatio);
    setQuality(generation.quality ?? "auto");
    setImageSize(generation.imageSize ?? "2K");
    setOptimizeChineseText(generation.optimizeChineseText);
    setReferences(generation.references ?? []);

    await submitGeneration({
      model: generation.model,
      prompt: generation.prompt,
      aspectRatio: generation.aspectRatio,
      quality: generation.quality ?? "auto",
      imageSize: generation.imageSize ?? "2K",
      optimizeChineseText: generation.optimizeChineseText,
      referenceImageIds: generation.references.map((image) => image.id),
    });
  }

  function reuseGeneration(generation: Generation) {
    setModel(generation.model);
    setPrompt(generation.prompt);
    setAspectRatio(generation.aspectRatio);
    setQuality(generation.quality ?? "auto");
    setImageSize(generation.imageSize ?? "2K");
    setOptimizeChineseText(generation.optimizeChineseText);
    setReferences(generation.references ?? []);
    setCurrent(generation);
    setPreview(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyPromptPreset(text: string) {
    setPrompt((value) => (value.trim() ? `${value.trim()}，${text}` : text));
  }

  function addCustomPreset() {
    const name = customPresetName.trim();
    const text = customPresetText.trim();
    if (!name || !text) return;
    setCustomPresets((items) => [{ name, text, custom: true }, ...items.filter((item) => item.name !== name)].slice(0, 20));
    setCustomPresetName("");
    setCustomPresetText("");
  }

  function removeCustomPreset(name: string) {
    setCustomPresets((items) => items.filter((item) => item.name !== name));
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
  }

  async function copyGenerationParams(generation: Generation) {
    await copyText(
      JSON.stringify(
        {
          model: generation.model,
          prompt: generation.prompt,
          aspectRatio: generation.aspectRatio,
          quality: generation.quality,
          imageSize: generation.imageSize,
          optimizeChineseText: generation.optimizeChineseText,
          referenceImageIds: generation.references.map((image) => image.id),
        },
        null,
        2,
      ),
    );
  }

  async function deleteGeneration(id: string) {
    const response = await fetch(`/api/generations/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setHistory((items) => items.filter((item) => item.id !== id));
    setCurrent((item) => (item?.id === id ? null : item));
    setPreview((item) => (item?.id === id ? null : item));
  }

  async function clearFailedGenerations() {
    const response = await fetch("/api/generations?status=failed", { method: "DELETE" });
    if (!response.ok) return;
    setHistory((items) => items.filter((item) => item.status !== "failed"));
    setCurrent((item) => (item?.status === "failed" ? null : item));
    setPreview((item) => (item?.status === "failed" ? null : item));
  }

  const currentImage = current?.images?.[0];
  const failedCount = history.filter((item) => item.status === "failed").length;
  const filteredHistory = history.filter((item) => {
    const matchesModel = modelFilter === "all" || item.model === modelFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch = !historySearch.trim() || item.prompt.toLowerCase().includes(historySearch.trim().toLowerCase());
    return matchesModel && matchesStatus && matchesSearch;
  });
  const promptPresets = [...defaultPromptPresets, ...customPresets];

  return (
    <main className="min-h-screen bg-[#10100f] text-stone-100">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-stone-800/80 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <Sparkles size={16} />
              私人图像创作空间
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-stone-50 sm:text-4xl">Image Studio</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(modelCopy) as ModelId[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateModel(item)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  model === item
                    ? "border-amber-300 bg-amber-300 text-stone-950"
                    : "border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500"
                }`}
              >
                {modelCopy[item].name}
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <form onSubmit={generate} className="rounded-lg border border-stone-800 bg-[#171715] p-4 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-50">创作面板</h2>
                <p className="mt-1 text-sm leading-6 text-stone-400">{modelCopy[model].description}</p>
              </div>
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-50 px-4 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                生成
              </button>
            </div>

            <label className="mt-5 block text-sm font-medium text-stone-300" htmlFor="prompt">
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述你想生成或改造的画面..."
              className="mt-2 min-h-40 w-full resize-y rounded-lg border border-stone-700 bg-[#0f0f0d] px-3 py-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-stone-500">
              <span>草稿自动保存在本机浏览器</span>
              {prompt && (
                <button type="button" onClick={() => setPrompt("")} className="text-stone-400 hover:text-amber-100">
                  清空
                </button>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-stone-300">风格预设</div>
              <div className="flex flex-wrap gap-2">
                {promptPresets.map((preset) => (
                  <span key={`${preset.custom ? "custom" : "default"}-${preset.name}`} className="inline-flex overflow-hidden rounded-full border border-stone-700 bg-stone-900 text-xs text-stone-300 transition hover:border-amber-300 hover:text-amber-100">
                    <button type="button" onClick={() => applyPromptPreset(preset.text)} className="px-3 py-1.5">
                      {preset.name}
                    </button>
                    {preset.custom && (
                      <button type="button" onClick={() => removeCustomPreset(preset.name)} className="border-l border-stone-700 px-2 text-stone-500 hover:text-red-200">
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-stone-800 bg-stone-950/40 p-3">
                <div className="mb-2 text-xs font-medium text-stone-400">添加自定义预设</div>
                <div className="grid gap-2">
                  <input
                    value={customPresetName}
                    onChange={(event) => setCustomPresetName(event.target.value)}
                    placeholder="预设名称，例如：赛博产品"
                    className="rounded-md border border-stone-700 bg-[#0f0f0d] px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
                  />
                  <textarea
                    value={customPresetText}
                    onChange={(event) => setCustomPresetText(event.target.value)}
                    placeholder="预设内容，会追加到 prompt 后面"
                    className="min-h-20 resize-y rounded-md border border-stone-700 bg-[#0f0f0d] px-3 py-2 text-sm leading-5 text-stone-100 outline-none focus:border-amber-300"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={addCustomPreset} className="rounded-md bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-200">
                      添加预设
                    </button>
                    <button type="button" onClick={() => setCustomPresetText(prompt)} className="rounded-md border border-stone-700 px-3 py-2 text-sm text-stone-300 hover:border-amber-300 hover:text-amber-100">
                      使用当前 Prompt
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <div className="mb-2 text-sm font-medium text-stone-300">比例 / 尺寸</div>
                <div className="grid grid-cols-3 gap-2">
                  {aspectRatios[model].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setAspectRatio(item)}
                      className={`rounded-md border px-2 py-2 text-sm transition ${
                        aspectRatio === item
                          ? "border-amber-300 bg-amber-300/15 text-amber-100"
                          : "border-stone-700 bg-stone-900 text-stone-400 hover:border-stone-500"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {model === "gpt-image-2" ? (
                <label className="block text-sm font-medium text-stone-300">
                  质量
                  <select
                    value={quality}
                    onChange={(event) => setQuality(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0f0d] px-3 py-2 text-stone-100 outline-none focus:border-amber-300"
                  >
                    <option value="auto">auto</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
              ) : (
                <div className="grid gap-3">
                  <label className="block text-sm font-medium text-stone-300">
                    分辨率线路
                    <select
                      value={imageSize}
                      onChange={(event) => setImageSize(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0f0d] px-3 py-2 text-stone-100 outline-none focus:border-amber-300"
                    >
                      <option value="2K">2K</option>
                      <option value="4K">4K</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-950/40 px-3 py-3 text-sm text-stone-300">
                    AI 增强中文提示词
                    <input
                      type="checkbox"
                      checked={optimizeChineseText}
                      onChange={(event) => setOptimizeChineseText(event.target.checked)}
                      className="h-4 w-4 accent-amber-300"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-stone-300">
                <span>参考图</span>
                <span className="text-xs text-stone-500">{references.length}/9</span>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-stone-700 bg-[#0f0f0d] px-3 py-4 text-sm text-stone-400 transition hover:border-amber-300 hover:text-amber-100">
                {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                上传 PNG / JPG / WebP
                <input multiple accept="image/png,image/jpeg,image/webp" type="file" onChange={uploadReferences} className="hidden" />
              </label>
              <p className="mt-2 text-xs leading-5 text-stone-500">参考图会在服务端自动压缩后提交给模型，用来降低图生图失败率。</p>
              {references.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {references.map((image) => (
                    <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md border border-stone-800 bg-stone-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.publicUrl} alt="参考图" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setReferences((items) => items.filter((item) => item.id !== image.id))}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-stone-100 opacity-0 transition group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          </form>

          <section className="min-h-[560px] overflow-hidden rounded-lg border border-stone-800 bg-[#171715]">
            <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
              <div>
                <h2 className="font-semibold text-stone-50">当前作品</h2>
                <p className="text-xs text-stone-500">{current ? `${modelCopy[current.model].name} · ${current.aspectRatio}` : "等待创作"}</p>
              </div>
              {current && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => copyText(current.prompt)} className="inline-flex items-center gap-2 rounded-full border border-stone-700 px-3 py-2 text-sm text-stone-300 hover:border-amber-300 hover:text-amber-100">
                    <Copy size={15} />
                    Prompt
                  </button>
                  <button type="button" onClick={() => reuseGeneration(current)} className="inline-flex items-center gap-2 rounded-full border border-stone-700 px-3 py-2 text-sm text-stone-300 hover:border-amber-300 hover:text-amber-100">
                    <RefreshCw size={15} />
                    复用
                  </button>
                </div>
              )}
            </div>
            <div className="relative flex min-h-[500px] items-center justify-center bg-[#0d0d0b] p-4">
              {busy ? (
                <div className="flex aspect-[4/3] w-full max-w-3xl flex-col items-center justify-center rounded-lg border border-stone-800 bg-stone-950/60 text-stone-400">
                  <Loader2 className="mb-3 animate-spin text-amber-200" size={30} />
                  生成中
                </div>
              ) : currentImage ? (
                <button type="button" onClick={() => setPreview(current)} className="group relative max-h-[70vh] max-w-full overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentImage.publicUrl} alt={current.prompt} className="max-h-[70vh] max-w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-stone-100 opacity-0 transition group-hover:opacity-100">
                    <Maximize2 size={18} />
                  </span>
                </button>
              ) : (
                <div className="flex flex-col items-center text-center text-stone-500">
                  <ImagePlus size={42} />
                  <p className="mt-3 text-sm">第一张作品会出现在这里</p>
                </div>
              )}
            </div>
          </section>
        </section>

        <section>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-stone-50">历史作品库</h2>
                <p className="mt-1 text-sm text-stone-500">本地保存的生成结果{failedCount > 0 ? ` · ${failedCount} 条失败记录` : ""}</p>
              </div>
              <div className="flex gap-2">
                {failedCount > 0 && (
                  <button type="button" onClick={clearFailedGenerations} className="rounded-full border border-red-400/40 px-3 py-2 text-sm text-red-200 hover:border-red-300">
                    清理失败记录
                  </button>
                )}
                <button type="button" onClick={fetchHistory} className="rounded-full border border-stone-700 px-3 py-2 text-sm text-stone-300 hover:border-stone-500">
                  刷新
                </button>
              </div>
            </div>

          {history.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={modelFilter}
                onChange={(event) => setModelFilter(event.target.value as "all" | ModelId)}
                className="rounded-full border border-stone-700 bg-[#171715] px-3 py-2 text-sm text-stone-300 outline-none focus:border-amber-300"
              >
                <option value="all">全部模型</option>
                <option value="gpt-image-2">GPT Image 2</option>
                <option value="nano-banana-pro">Nano Banana Pro</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "succeeded" | "failed")}
                className="rounded-full border border-stone-700 bg-[#171715] px-3 py-2 text-sm text-stone-300 outline-none focus:border-amber-300"
              >
                <option value="all">全部状态</option>
                <option value="succeeded">成功</option>
                <option value="failed">失败</option>
              </select>
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="搜索 Prompt"
                className="min-w-0 flex-1 rounded-full border border-stone-700 bg-[#171715] px-3 py-2 text-sm text-stone-300 outline-none placeholder:text-stone-600 focus:border-amber-300 sm:min-w-60"
              />
            </div>
          )}

          {history.length === 0 ? (
            <div className="rounded-lg border border-stone-800 bg-[#171715] px-4 py-10 text-center text-sm text-stone-500">还没有历史作品</div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-lg border border-stone-800 bg-[#171715] px-4 py-10 text-center text-sm text-stone-500">当前筛选下没有作品</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredHistory.map((item) => {
                const image = item.images?.[0];
                return (
                  <article key={item.id} className={`overflow-hidden rounded-lg border bg-[#171715] ${item.status === "failed" ? "border-red-400/30" : "border-stone-800"}`}>
                    <button type="button" onClick={() => setPreview(item)} className="aspect-[4/3] w-full bg-stone-950">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image.publicUrl} alt={item.prompt} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center px-4 text-center text-sm text-red-200">
                          <span className="rounded-full border border-red-400/30 px-3 py-1 text-xs uppercase tracking-wide">failed</span>
                          <span className="mt-3 line-clamp-2 text-stone-500">{item.error ?? "生成失败"}</span>
                        </div>
                      )}
                    </button>
                    <div className="space-y-3 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                        <span className={item.status === "failed" ? "text-red-200" : ""}>{modelCopy[item.model].name}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-stone-300">{item.prompt}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => repeatGeneration(item)} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-stone-800 px-3 py-2 text-sm text-stone-200 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
                          <Send size={14} />
                          再生成
                        </button>
                        <button type="button" onClick={() => reuseGeneration(item)} className="rounded-md border border-stone-700 p-2 text-stone-300 hover:border-amber-300 hover:text-amber-100">
                          <RefreshCw size={14} />
                        </button>
                        {image && (
                          <a href={image.publicUrl} download className="rounded-md border border-stone-700 p-2 text-stone-300 hover:border-amber-300 hover:text-amber-100">
                            <ArrowDownToLine size={16} />
                          </a>
                        )}
                        <button type="button" onClick={() => copyText(item.prompt)} className="rounded-md border border-stone-700 p-2 text-stone-300 hover:border-amber-300 hover:text-amber-100">
                          <Copy size={16} />
                        </button>
                        <button type="button" onClick={() => deleteGeneration(item.id)} className="rounded-md border border-stone-700 p-2 text-stone-300 hover:border-red-300 hover:text-red-200">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-lg border border-stone-700 bg-[#171715] lg:grid-cols-[minmax(0,1fr)_340px]" onClick={(event) => event.stopPropagation()}>
            <div className="flex min-h-[320px] items-center justify-center bg-black p-3">
              {preview.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.images[0].publicUrl} alt={preview.prompt} className="max-h-[86vh] max-w-full object-contain" />
              ) : (
                <div className="max-w-md text-center text-sm text-red-200">
                  <div className="mb-3 text-base font-semibold">生成失败</div>
                  <p className="leading-6 text-stone-400">{preview.error ?? "没有返回图片。"}</p>
                </div>
              )}
            </div>
            <aside className="overflow-y-auto border-t border-stone-800 p-4 lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-stone-50">作品详情</h3>
                  <p className="mt-1 text-xs text-stone-500">{formatDate(preview.createdAt)}</p>
                </div>
                <button type="button" onClick={() => setPreview(null)} className="rounded-full border border-stone-700 p-2 text-stone-300 hover:border-stone-500">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <div className="mb-1 text-xs uppercase text-stone-500">Model</div>
                  <div className="text-stone-200">{modelCopy[preview.model].name}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase text-stone-500">Prompt</div>
                  <p className="leading-6 text-stone-300">{preview.prompt}</p>
                </div>
                {preview.error && (
                  <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3">
                    <div className="mb-1 text-xs uppercase text-red-200">Error</div>
                    <p className="break-words leading-6 text-red-100">{preview.error}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-stone-300">
                  <div className="rounded-md border border-stone-800 p-3">{preview.aspectRatio}</div>
                  <div className="rounded-md border border-stone-800 p-3">{preview.imageSize ?? preview.quality ?? "auto"}</div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => repeatGeneration(preview)} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-300 px-3 py-2 text-sm font-semibold text-stone-950 disabled:cursor-not-allowed disabled:opacity-60">
                  <Send size={15} />
                  再生成
                </button>
                <button type="button" onClick={() => reuseGeneration(preview)} className="rounded-md border border-stone-700 p-2 text-stone-300 hover:border-amber-300 hover:text-amber-100">
                  <RefreshCw size={15} />
                </button>
                {preview.images?.[0] && (
                  <a href={preview.images[0].publicUrl} download className="rounded-md border border-stone-700 p-2 text-stone-300 hover:border-amber-300 hover:text-amber-100">
                    <ArrowDownToLine size={18} />
                  </a>
                )}
                <button type="button" onClick={() => copyText(preview.prompt)} className="rounded-md border border-stone-700 p-2 text-stone-300 hover:border-amber-300 hover:text-amber-100">
                  <Copy size={18} />
                </button>
                <button type="button" onClick={() => copyGenerationParams(preview)} className="rounded-md border border-stone-700 px-3 py-2 text-sm text-stone-300 hover:border-amber-300 hover:text-amber-100">
                  参数
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
