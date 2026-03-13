import {
  ArrowRight,
  Bot,
  Boxes,
  Cable,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cog,
  Command,
  Download,
  Globe2,
  LayoutDashboard,
  Layers3,
  Monitor,
  Lightbulb,
  Mail,
  MessageSquarePlus,
  MinusCircle,
  Play,
  Plus,
  QrCode,
  RadioTower,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wand2,
  Workflow,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import logoUrl from './assets/logo.png';
import dingtalkUrl from './assets/channels/dingtalk.svg';
import qqbotUrl from './assets/channels/qqbot.svg';
import telegramUrl from './assets/channels/telegram.svg';
import minimaxUrl from './assets/providers/minimax.svg';
import moonshotUrl from './assets/providers/moonshot.svg';
import openaiUrl from './assets/providers/openai.svg';
import { cn } from './lib/utils';
import './styles/landing.css';

const enterpriseWeChatServiceUrl = 'https://work.weixin.qq.com/kfid/kfcf8bd6e2b6e3758b8';
const enterpriseWeChatServiceQrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(enterpriseWeChatServiceUrl)}&size=640&margin=0`;

const DOWNLOAD_BASE = 'http://cdn.zgonline.top/release';

/* fallback when alpha.yml fetch fails (e.g. CORS) */
const FALLBACK_VERSION = '0.1.24-alpha.16';
const FALLBACK_RELEASE: ReleaseInfo = {
  version: FALLBACK_VERSION,
  releaseDate: '2026-03-13T18:11:23.000Z',
  files: [
    { url: `ClawPlus-${FALLBACK_VERSION}-win-x64.exe`, size: 200_282_102 },
    { url: `ClawPlus-${FALLBACK_VERSION}-win-arm64.exe`, size: 171_295_247 },
    { url: `ClawPlus-${FALLBACK_VERSION}-win.exe`, size: 370_534_213 },
  ],
};

interface ReleaseFile {
  url: string;
  size: number;
}

interface ReleaseInfo {
  version: string;
  releaseDate: string;
  files: ReleaseFile[];
}

function parseYaml(text: string): ReleaseInfo {
  const version = text.match(/^version:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const releaseDate = text.match(/^releaseDate:\s*'?(.+?)'?$/m)?.[1]?.trim() ?? '';
  const files: ReleaseFile[] = [];
  const fileBlocks = text.matchAll(/- url:\s*(.+)\n\s+sha512:\s*.+\n\s+size:\s*(\d+)/g);
  for (const m of fileBlocks) {
    files.push({ url: m[1].trim(), size: Number(m[2]) });
  }
  return { version, releaseDate, files };
}

function detectArch(): 'x64' | 'arm64' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'arm64';
  return 'x64';
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '';
  }
}

const navItems = [
  { label: '快速上手', href: '#quickstart' },
  { label: '方案对比', href: '#compare' },
  { label: '核心模块', href: '#features' },
  { label: '界面预览', href: '#screens' },
  { label: 'FAQ', href: '#faq' },
  { label: '联系我', href: '#contact' },
] as const;

const heroStats = [
  { value: '11+', label: '模型供应商已支持' },
  { value: '57+', label: '技能已内置' },
  { value: 'AI 生成', label: '智能体 · 模板导入 · 组织架构图' },
] as const;

const signalCards = [
  {
    eyebrow: '统一工作台',
    title: '一个桌面控制台，管理 OpenClaw 的全部能力',
    text: 'ClawPlus 将 11+ 模型供应商、消息频道、57+ 技能、定时任务、仪表盘、智能体编排与 AI 生成整合到统一界面，零配置即可上手。',
  },
  {
    eyebrow: '开箱即用',
    title: '设置向导引导，AI 生成智能体，模板一键导入',
    text: '首次启动即有引导式设置向导，支持用自然语言 AI 生成智能体、从内置模板或 JSON 文件导入配置，从个人试验快速走向稳定运营。',
  },
] as const;

const workTags = ['ClawPlus', '模型治理', '消息渠道', '技能中心', '定时任务', 'AI 生成智能体', '模板导入', '组织架构图', '设置向导'] as const;

const proofItems = [
  { label: '产品定位', value: '面向 OpenClaw 的桌面级 AI 控制台' },
  { label: '接入能力', value: '统一连接模型提供商与消息渠道' },
  { label: '运营方式', value: '在同一界面完成配置、观察与协作' },
] as const;

const valueItems = [
  {
    title: '降低团队接入 AI 的操作门槛',
    text: '把模型配置、频道接入、技能启用、任务调度和运行状态收进统一桌面入口，让更多角色都能参与 AI 系统的管理与运营。',
  },
  {
    title: '围绕真实业务路径组织产品能力',
    text: '从模型治理到业务渠道接入，再到自动化任务和多智能体协作，ClawPlus 用清晰信息架构承载 AI 系统的完整工作闭环。',
  },
  {
    title: '兼顾产品表达与浏览流畅度',
    text: '通过更轻量的展示方式和更克制的动效设计，让关键信息更快抵达访问者，同时为后续内容扩展保留更高的灵活性。',
  },
] as const;

const featureCards = [
  {
    icon: Wrench,
    title: '模型提供商',
    description: '集中管理 Anthropic、OpenAI、Google、Moonshot、MiniMax 等 11+ 供应商，支持 OAuth 鉴权、默认模型配置与 API Key 状态监控。',
    details: ['11+ Provider 支持', 'OAuth 一键鉴权', 'Token 用量追踪'],
  },
  {
    icon: Sparkles,
    title: 'AI 生成智能体',
    description: '用自然语言描述需求，一键 AI 生成完整智能体配置，包括角色定义、技能分配和 SOUL 个性设定，大幅降低创建门槛。',
    details: ['自然语言描述', '一键生成配置', 'SOUL 个性定义'],
  },
  {
    icon: Bot,
    title: '智能体管理',
    description: '创建、编辑和管理多个 AI 智能体，支持组织架构图可视化、角色层级编排、模板导入和 JSON 文件导入。',
    details: ['组织架构图', '模板导入', '多层级角色编排'],
  },
  {
    icon: RadioTower,
    title: '消息频道',
    description: '统一接入 Telegram、QQ Bot、DingTalk 等多渠道，直接展示机器人名称、绑定智能体和在线状态。',
    details: ['多渠道管理', '状态一眼可见', '智能体绑定'],
  },
  {
    icon: Boxes,
    title: '技能中心',
    description: '以统一列表管理 57+ 内置技能，支持检索、分类与启用控制，方便把 AI 能力沉淀为可复用资产。',
    details: ['57+ 内置技能', '搜索与分类', '一键启停控制'],
  },
  {
    icon: CalendarClock,
    title: '定时任务',
    description: '调度 AI 任务自动执行，支持 Cron 表达式、绑定指定智能体、执行状态监控，让 AI 从响应式工具走向持续执行。',
    details: ['Cron 表达式', '智能体绑定', '状态监控'],
  },
  {
    icon: LayoutDashboard,
    title: '仪表盘',
    description: '网关状态、频道连接、技能统计、Token 用量历史与快捷操作集中呈现，提供统一运营面板。',
    details: ['Token 用量历史', '快捷操作', '网关状态监控'],
  },
  {
    icon: Wand2,
    title: '设置向导',
    description: '首次启动的引导式设置流程，包含环境检查、供应商配置、技能选择与连接验证，零配置即可上手。',
    details: ['引导式流程', '环境自动检测', '零配置上手'],
  },
] as const;

const workflowSteps = [
  {
    step: '01',
    title: '先配置模型与运行能力',
    text: '从模型页面开始，为团队准备可用 Provider，并建立清晰的账号、默认模型和 API 配置基础。',
  },
  {
    step: '02',
    title: '再把能力接入真实入口',
    text: '通过消息频道把 AI 接到 Telegram、QQ Bot 等工作入口，再用技能页补充可执行能力。',
  },
  {
    step: '03',
    title: '把重复任务自动化',
    text: '定时任务页负责把周期性工作变成自动流程，让产品价值从“会聊天”升级为“会持续工作”。',
  },
  {
    step: '04',
    title: '最后回到仪表盘和智能体页持续运营',
    text: '仪表盘提供统一总览，智能体页负责协作组织和角色扩展，整个工作流闭环比纯命令行更直观。',
  },
] as const;

const previewCards = [
  {
    title: '智能体管理',
    description: '创建、配置和管理多个 AI 智能体，每个智能体拥有独立的模型、技能和角色定义。',
    image: 'agents.png',
  },
  {
    title: '一键创建智能体',
    description: '用自然语言描述需求，一键 AI 生成完整的智能体配置，包括角色、技能和 SOUL 定义。',
    image: 'create-agent.png',
  },
  {
    title: '智能体技能',
    description: '为每个智能体独立配置技能组合，按需启用搜索、代码执行、文件处理等能力。',
    image: 'agent-skills.png',
  },
  {
    title: '模板导入',
    description: '从内置模板库或 JSON 文件导入完整智能体配置，快速复制最佳实践方案。',
    image: 'import-agent.png',
  },
  {
    title: 'Agent 市场',
    description: '浏览和发现社区共享的智能体模板，一键安装即可投入使用。',
    image: 'agent-market.png',
  },
  {
    title: '市场分类',
    description: '按场景分类浏览 Agent 市场，快速找到研究助手、写作工具、数据分析等专用智能体。',
    image: 'agent-market-category.png',
  },
  {
    title: '模型提供商',
    description: '集中管理 11+ AI 模型供应商，支持 OAuth 鉴权、默认模型配置与 API Key 状态监控。',
    image: 'models.png',
  },
  {
    title: '消息频道',
    description: '同时配置和监控多个 AI 频道，支持 Telegram、QQ Bot、DingTalk 等多渠道接入。',
    image: 'channels.png',
  },
  {
    title: '技能管理',
    description: '浏览和管理 57+ 内置 AI 技能，支持搜索、分类与一键启停控制。',
    image: 'skills.png',
  },
  {
    title: '仪表盘',
    description: '网关状态、频道连接、技能统计、Token 用量历史与快捷操作的统一运营面板。',
    image: 'dashboard.png',
  },
  {
    title: '数据迁移',
    description: '一键迁移历史数据与配置，无缝切换或升级环境，零数据丢失。',
    image: 'data-migration.png',
  },
  {
    title: '自定义背景',
    description: '支持自定义聊天背景与界面主题，打造个性化的 AI 工作空间。',
    image: 'custom-bg.png',
  },
] as const;

const providers = [
  { name: 'OpenAI', icon: openaiUrl },
  { name: 'Moonshot', icon: moonshotUrl },
  { name: 'MiniMax', icon: minimaxUrl },
] as const;

const providerTextList = [
  'Anthropic (Claude)', 'Google (Gemini)', 'OpenRouter',
  'ByteDance Ark (Doubao)', 'SiliconFlow', 'Qwen (通义千问)',
  'Ollama (本地)', '自定义 API',
] as const;

const channels = [
  { name: 'Telegram', icon: telegramUrl },
  { name: 'DingTalk', icon: dingtalkUrl },
  { name: 'QQ Bot', icon: qqbotUrl },
] as const;

const faqItems = [
  {
    question: 'ClawPlus 是什么？',
    answer: 'ClawPlus 是面向 OpenClaw 的跨平台桌面控制台，用统一图形界面管理 11+ 模型供应商、多消息频道、57+ 技能、定时任务、智能体编排与 AI 生成能力，支持 Windows、macOS 和 Linux。',
  },
  {
    question: '支持哪些 AI 模型供应商？',
    answer: '支持 Anthropic (Claude)、OpenAI (GPT)、Google (Gemini)、OpenRouter、ByteDance Ark (Doubao)、Moonshot/Kimi、SiliconFlow、MiniMax、Qwen (通义千问)、Ollama (本地部署) 以及自定义 API 接入。',
  },
  {
    question: '如何快速创建智能体？',
    answer: '支持三种方式：手动分步创建（填写基本信息、角色层级、模型配置）、AI 生成（用自然语言描述需求一键生成）、模板导入（从内置模板或 JSON 文件导入完整配置）。',
  },
  {
    question: '是否必须熟悉命令行？',
    answer: '完全不需要。首次启动有引导式设置向导（环境检查、供应商配置、技能选择），后续所有操作都在图形界面中完成，零命令行上手。',
  },
  {
    question: '可以管理哪些核心能力？',
    answer: '包括多模型供应商接入与 Token 用量追踪、多消息频道连接、57+ 技能管理、Cron 定时任务调度、多智能体组织架构编排（含组织架构图可视化）、仪表盘运营统览，以及代理/网络/语言等系统设置。',
  },
  {
    question: '支持哪些消息频道？',
    answer: '当前支持 Telegram、QQ Bot、飞书和 DingTalk 频道接入，每个频道可绑定指定智能体并独立配置。更多频道（如微信）将持续扩展。',
  },
] as const;

const quickStartSteps = [
  {
    icon: Download,
    step: '01',
    title: '下载安装',
    text: '暂时只支持 Windows，正加急处理中，双击安装，跟随引导向导。',
  },
  {
    icon: Settings2,
    step: '02',
    title: '配置你的 AI',
    text: '选择 AI Provider，填入 API Key。图形化界面，无需命令行。强烈推荐 Claude、Gemini、OpenAI 旗舰模型。',
  },
  {
    icon: Play,
    step: '03',
    title: '开始工作',
    text: '对话下达指令，或设定定时任务让 AI 自动执行。',
  },
] as const;

type CompareLevel = 'good' | 'partial' | 'bad';

interface CompareRow {
  dimension: string;
  clawplus: { level: CompareLevel; text: string };
  clawx: { level: CompareLevel; text: string };
  openclaw: { level: CompareLevel; text: string };
  saas: { level: CompareLevel; text: string };
  agent: { level: CompareLevel; text: string };
}

const compareRows: CompareRow[] = [
  {
    dimension: '实时数据获取',
    clawplus: { level: 'good', text: '实时采集，AI 主动浏览' },
    clawx: { level: 'partial', text: '支持，需手动配置' },
    openclaw: { level: 'partial', text: '支持，需自建' },
    saas: { level: 'partial', text: '实时对接，价格昂贵' },
    agent: { level: 'bad', text: '仅基于本地知识' },
  },
  {
    dimension: '7×24 运行',
    clawplus: { level: 'good', text: '你的电脑，持续在线' },
    clawx: { level: 'partial', text: '需手动启动服务' },
    openclaw: { level: 'partial', text: '兼容所有环境' },
    saas: { level: 'bad', text: '依赖 SaaS 在线' },
    agent: { level: 'bad', text: '云端易掉线' },
  },
  {
    dimension: '多源聚合',
    clawplus: { level: 'good', text: '57+ 技能，一体融合' },
    clawx: { level: 'partial', text: '插件式集成' },
    openclaw: { level: 'partial', text: '需逐步集成' },
    saas: { level: 'bad', text: '绑定特定数据商' },
    agent: { level: 'bad', text: '单一平台受限' },
  },
  {
    dimension: '上下文记忆',
    clawplus: { level: 'good', text: '长时对话 & 自动记忆' },
    clawx: { level: 'partial', text: '支持，存储有限' },
    openclaw: { level: 'partial', text: '支持，需配置' },
    saas: { level: 'bad', text: '有限，按窗口切换' },
    agent: { level: 'bad', text: '简单历史' },
  },
  {
    dimension: '智能分析',
    clawplus: { level: 'good', text: '自动采集 + 分析 + 推送' },
    clawx: { level: 'partial', text: '基础分析功能' },
    openclaw: { level: 'partial', text: '自定义集成' },
    saas: { level: 'bad', text: '预设分析，灵活性有限' },
    agent: { level: 'bad', text: '不能主动采集' },
  },
  {
    dimension: '消息推送',
    clawplus: { level: 'good', text: '多通道，图形化配置' },
    clawx: { level: 'partial', text: '支持部分通道' },
    openclaw: { level: 'partial', text: '支持消息推送' },
    saas: { level: 'partial', text: '第三方为主' },
    agent: { level: 'bad', text: '基本无' },
  },
  {
    dimension: '数据安全',
    clawplus: { level: 'good', text: '全本地存储，开源可审计' },
    clawx: { level: 'good', text: '本地部署' },
    openclaw: { level: 'partial', text: '取决于部署' },
    saas: { level: 'bad', text: '数据在第三方' },
    agent: { level: 'bad', text: '主要存于云端' },
  },
  {
    dimension: '上手门槛',
    clawplus: { level: 'good', text: '图形化界面，无需代码' },
    clawx: { level: 'partial', text: '需基础配置知识' },
    openclaw: { level: 'bad', text: '需要开发者基础' },
    saas: { level: 'good', text: '注册即用' },
    agent: { level: 'good', text: '低但功能局限' },
  },
  {
    dimension: '成本',
    clawplus: { level: 'good', text: '免费开源，灵活可控' },
    clawx: { level: 'partial', text: '免费，功能较少' },
    openclaw: { level: 'partial', text: '免费，需维护' },
    saas: { level: 'partial', text: '按需订阅' },
    agent: { level: 'bad', text: '月订阅 $20+' },
  },
  {
    dimension: 'AI 生成智能体',
    clawplus: { level: 'good', text: '自然语言一键生成' },
    clawx: { level: 'bad', text: '不支持' },
    openclaw: { level: 'bad', text: '不支持' },
    saas: { level: 'partial', text: '部分平台支持' },
    agent: { level: 'bad', text: '不支持' },
  },
  {
    dimension: '组织架构可视化',
    clawplus: { level: 'good', text: '交互式组织架构图' },
    clawx: { level: 'bad', text: '不支持' },
    openclaw: { level: 'bad', text: '不支持' },
    saas: { level: 'bad', text: '不支持' },
    agent: { level: 'bad', text: '不支持' },
  },
];

const previewNavItems = [
  { label: '新对话', icon: MessageSquarePlus },
  { label: '模型', icon: Wrench },
  { label: '频道', icon: RadioTower },
  { label: '技能', icon: Boxes },
  { label: '定时任务', icon: CalendarClock },
  { label: '仪表盘', icon: LayoutDashboard },
  { label: '智能体', icon: Bot },
] as const;

type PreviewPage = 'dashboard' | 'models' | 'channels' | 'skills' | 'cron' | 'agents' | 'agent-modal';

export function Landing() {
  const [showDl, setShowDl] = useState(false);
  const [release, setRelease] = useState<ReleaseInfo>(FALLBACK_RELEASE);
  const [showOther, setShowOther] = useState(false);
  const [dlProgress, setDlProgress] = useState<{ file: string; loaded: number; total: number; pct: number; done: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* try fetching latest version; on failure keep fallback */
  useEffect(() => {
    fetch(`${DOWNLOAD_BASE}/alpha.yml`, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const parsed = parseYaml(text);
        if (parsed.version && parsed.files.length > 0) setRelease(parsed);
      })
      .catch(() => { /* keep FALLBACK_RELEASE */ });
  }, []);

  const arch = detectArch();
  const primaryFile = release.files.find((f) => f.url.includes(`win-${arch}`));
  const otherFiles = release.files.filter((f) => f !== primaryFile);

  const triggerDownload = useCallback((file: ReleaseFile) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDlProgress({ file: file.url, loaded: 0, total: file.size, pct: 0, done: false });

    fetch(`${DOWNLOAD_BASE}/${file.url}`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok || !res.body) throw new Error('download failed');
        const total = file.size || Number(res.headers.get('content-length')) || 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              const blob = new Blob(chunks as BlobPart[]);
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = file.url;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);
              setDlProgress((p) => (p ? { ...p, pct: 100, done: true } : null));
              return;
            }
            chunks.push(value);
            loaded += value.length;
            const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
            setDlProgress((p) => (p ? { ...p, loaded, pct } : null));
            return pump();
          });
        }
        return pump();
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setDlProgress(null);
        }
      });
  }, []);

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setDlProgress(null);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('.landing-section--deferred').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="landing-container flex items-center justify-between gap-5 px-6 py-4 lg:px-10">
          <a className="flex items-center gap-3 no-underline" href="#hero">
            <img alt="ClawPlus" className="h-11 w-11 rounded-[18px]" src={logoUrl} />
            <div>
              <div className="landing-brand-title">ClawPlus</div>
              <div className="landing-brand-subtitle">Desktop AI control room</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[color:var(--landing-ink-soft)] lg:flex">
            {navItems.map((item) => (
              <a className="landing-nav-link" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <a className="landing-secondary-button px-5 py-3 text-sm no-underline" href="#screens">
              查看产品界面
            </a>
            <button className="landing-primary-button px-5 py-3 text-sm" type="button" onClick={() => setShowDl(true)}>
              <Download className="h-3.5 w-3.5" />
              下载
            </button>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <div className="landing-grid" />
        <div className="landing-orb landing-orb--rose" />
        <div className="landing-orb landing-orb--amber" />
        <div className="landing-orb landing-orb--violet" />

        <section className="relative" id="hero">
          <div className="landing-container grid gap-14 px-6 pb-12 pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 lg:pb-20 lg:pt-20">
            <div className="relative z-10">
              <div className="landing-kicker">
                <Sparkles className="h-4 w-4" />
                OpenClaw desktop control room
              </div>

              <h1 className="landing-display mt-8 max-w-5xl text-5xl font-semibold leading-[0.93] tracking-[-0.05em] sm:text-6xl xl:text-[5.2rem]">
                把 OpenClaw 带入团队工作流的
                <span className="landing-text-gradient"> ClawPlus 桌面控制台</span>
              </h1>

              <p className="landing-copy mt-6 max-w-2xl text-lg leading-8 md:text-xl">
                ClawPlus 以统一桌面界面整合模型、消息频道、技能、定时任务、仪表盘与智能体协作，
                让部署、接入、自动化和运营都能在一个工作台中完成。
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-start">
                <button className="landing-primary-button px-7 py-4" type="button" onClick={() => setShowDl(true)}>
                  <Download className="h-4 w-4" />
                  免费下载 ClawPlus
                </button>
                <a className="landing-ghost-button px-7 py-4 no-underline" href="#features">
                  浏览核心能力
                </a>
              </div>

              <div className="mt-12 grid gap-4 md:grid-cols-2">
                {signalCards.map((card) => (
                  <article className="landing-glass-card landing-signal-card rounded-[28px] p-6" key={card.title}>
                    <div className="landing-card-eyebrow">{card.eyebrow}</div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--landing-ink)]">
                      {card.title}
                    </h2>
                    <p className="landing-copy mt-3 text-sm leading-7">{card.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <div className="landing-showcase">
                <div className="landing-showcase-topbar">
                  <div className="landing-window-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="landing-chip landing-chip--subtle">ClawPlus workspace</div>
                </div>

                <div className="landing-showcase-frame">
                  <ProductPreview page="dashboard" hero />
                </div>

                <div className="landing-floating-card landing-floating-card--top">
                  <div className="landing-floating-title">统一管理模型、频道与技能</div>
                  <p>从接入到运营，关键状态都收敛在同一工作台，减少切换成本与信息分散。</p>
                </div>

                <div className="landing-floating-card landing-floating-card--bottom">
                  <div className="landing-card-eyebrow">Agent orchestration</div>
                  <p>通过智能体、频道与定时任务，把 AI 能力接入真实业务流程与长期协作场景。</p>
                </div>

                <div className="landing-showcase-summary">
                  <div className="landing-summary-pill landing-summary-pill--brand">57 skills enabled</div>
                  <div className="landing-summary-pill landing-summary-pill--success">5 channels connected</div>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-container px-6 pb-8 lg:px-10">
            <div className="landing-proof-panel rounded-[34px] p-5 md:p-6">
              <div className="flex flex-wrap gap-2">
                {workTags.map((tag) => (
                  <span className="landing-tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {heroStats.map((stat) => (
                    <article className="landing-proof-card rounded-[24px] p-5" key={stat.label}>
                      <div className="landing-proof-value">{stat.value}</div>
                      <p className="landing-muted mt-2 text-sm leading-6">{stat.label}</p>
                    </article>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {proofItems.map((item) => (
                    <article className="landing-proof-card rounded-[24px] p-5" key={item.label}>
                      <div className="landing-card-eyebrow">{item.label}</div>
                      <p className="mt-3 text-base font-semibold leading-7 text-[color:var(--landing-ink)]">
                        {item.value}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--deferred" id="value">
          <div className="landing-container px-6 lg:px-10">
            <SectionHeading
              kicker="价值主张"
              title="为 OpenClaw 提供团队可用、可运营的桌面控制台"
              description="ClawPlus 将配置、接入、自动化和协作整合到统一界面，帮助团队以更清晰的方式管理 AI 系统的全生命周期。"
            />

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {valueItems.map((item, index) => (
                <article className="landing-glass-card landing-lift-card rounded-[28px] p-7" key={item.title}>
                  <div className="landing-card-index">0{index + 1}</div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[color:var(--landing-ink)]">
                    {item.title}
                  </h3>
                  <p className="landing-copy mt-4 text-base leading-8">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--deferred" id="features">
          <div className="landing-container px-6 lg:px-10">
            <SectionHeading
              kicker="核心模块"
              title="围绕真实业务流程组织 AI 系统的关键能力"
              description="从模型治理到消息接入，再到自动化任务和智能体协作，ClawPlus 用清晰信息架构承载长期运营所需的核心环节。"
            />

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article className="landing-glass-card landing-lift-card rounded-[30px] p-7" key={card.title}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="landing-icon-wrap">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="landing-chip landing-chip--subtle">Module</span>
                    </div>

                    <h3 className="mt-6 text-2xl font-semibold tracking-tight text-[color:var(--landing-ink)]">
                      {card.title}
                    </h3>
                    <p className="landing-copy mt-4 text-base leading-8">{card.description}</p>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {card.details.map((detail) => (
                        <span className="landing-outline-tag" key={detail}>
                          {detail}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--deferred" id="workflow">
          <div className="landing-container grid gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
            <div className="landing-side-panel rounded-[34px] p-8">
              <div className="landing-kicker landing-kicker--quiet">
                <Workflow className="h-4 w-4" />
                团队工作流
              </div>

              <h2 className="landing-display mt-6 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                从接入、执行到运营，形成完整的 AI 工作闭环
              </h2>

              <p className="landing-copy mt-5 text-base leading-8">
                ClawPlus 按照真实使用路径组织能力: 先配置模型和基础运行能力，再接入业务渠道与技能，
                随后沉淀自动化流程，并通过仪表盘和智能体持续运营。
              </p>

              <div className="mt-8 space-y-4">
                <div className="landing-inline-point">
                  <Command className="h-5 w-5" />
                  模型与设置页建立 AI 运行基础
                </div>
                <div className="landing-inline-point">
                  <Cable className="h-5 w-5" />
                  频道、技能与定时任务连接真实业务场景
                </div>
                <div className="landing-inline-point">
                  <ShieldCheck className="h-5 w-5" />
                  仪表盘与智能体页支撑持续运营与协作扩展
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {workflowSteps.map((step) => (
                <article className="landing-glass-card landing-lift-card rounded-[30px] p-6 md:p-7" key={step.step}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="landing-step-badge">{step.step}</div>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-[color:var(--landing-ink)]">
                        {step.title}
                      </h3>
                      <p className="landing-copy mt-3 text-base leading-8">{step.text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--deferred" id="screens">
          <div className="landing-container px-6 lg:px-10">
            <SectionHeading
              kicker="界面预览"
              title="从聊天到智能体编排，每一个界面都为实际场景设计"
              description="覆盖智能聊天、智能体管理、AI 生成、组织架构图、消息频道、技能中心、定时任务、仪表盘与系统设置等 12 个核心界面。"
            />

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {previewCards.map((card) => (
                <article className="landing-gallery-card landing-gallery-card--preview rounded-[32px] p-5" key={card.title}>
                  <div className="landing-preview-frame">
                    <img src={`/screenshots/${card.image}`} alt={card.title} className="landing-gallery-image w-full h-full object-cover object-top" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[color:var(--landing-ink)]">
                    {card.title}
                  </h3>
                  <p className="landing-copy mt-3 text-sm leading-7">{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--deferred" id="ecosystem">
          <div className="landing-container grid gap-5 px-6 lg:grid-cols-[1.06fr_0.94fr] lg:px-10">
            <article className="landing-side-panel rounded-[34px] p-8">
              <div className="landing-kicker landing-kicker--quiet">
                <Globe2 className="h-4 w-4" />
                生态与架构
              </div>

              <h2 className="landing-display mt-6 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                接入 11+ 主流模型供应商，连接多消息渠道
              </h2>

              <p className="landing-copy mt-5 text-base leading-8">
                ClawPlus 一端连接 Anthropic、OpenAI、Google、Moonshot 等 11+ 模型供应商与多消息渠道，一端承载桌面端本地能力与统一控制面，适合长期演进与团队使用。
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="landing-mini-panel rounded-[26px] p-5">
                  <div className="landing-card-eyebrow">模型生态 (11+ 供应商)</div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {providers.map((provider) => (
                      <div className="landing-logo-chip" key={provider.name}>
                        <img alt={provider.name} className="landing-logo-icon" src={provider.icon} />
                        <span>{provider.name}</span>
                      </div>
                    ))}
                    {providerTextList.map((name) => (
                      <div className="landing-logo-chip" key={name}>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="landing-mini-panel rounded-[26px] p-5">
                  <div className="landing-card-eyebrow">渠道生态</div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {channels.map((channel) => (
                      <div className="landing-logo-chip" key={channel.name}>
                        <img alt={channel.name} className="landing-logo-icon" src={channel.icon} />
                        <span>{channel.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="landing-glass-card rounded-[34px] p-8">
              <div className="landing-card-eyebrow">工程可信度</div>

              <div className="mt-5 space-y-4">
                <div className="landing-arch-card">
                  <div className="landing-icon-wrap">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3>清晰的桌面端系统边界</h3>
                    <p>Renderer 负责界面表达，Main 负责系统能力与本地集成，适合在稳定桌面体验上持续扩展。</p>
                  </div>
                </div>

                <div className="landing-arch-card">
                  <div className="landing-icon-wrap">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3>统一入口管理关键运营状态</h3>
                    <p>模型、频道、技能、任务与智能体状态集中可见，便于团队协作、排查问题与日常运营。</p>
                  </div>
                </div>

                <div className="landing-arch-card">
                  <div className="landing-icon-wrap">
                    <Wand2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3>模块化产品结构，便于持续演进</h3>
                    <p>从模型治理到智能体协作，各模块职责清晰，可随产品迭代逐步扩展而不破坏整体体验。</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ── Quick-start ── */}
        <section className="landing-section landing-section--deferred" id="quickstart">
          <div className="landing-container px-6 lg:px-10">
            <SectionHeading
              kicker="3 分钟上手"
              title="无需编程基础，图形化界面一键配置"
              description="从下载到开始使用，只需三步。跟随向导完成初始化，即刻拥有你的 AI 工作站。"
            />

            <div className="qs-timeline mt-14">
              {quickStartSteps.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div className="qs-step" key={item.step} style={{ '--qs-delay': `${idx * 180}ms` } as React.CSSProperties}>
                    <div className="qs-icon-ring">
                      <div className="qs-icon-bg">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="qs-step-num">{item.step}</span>
                    </div>
                    {idx < quickStartSteps.length - 1 && <div className="qs-connector" />}
                    <h3 className="qs-title">{item.title}</h3>
                    <p className="qs-desc">{item.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="qs-protip mt-12">
              <div className="qs-protip-icon">
                <Lightbulb className="h-5 w-5" />
              </div>
              <div>
                <h4 className="qs-protip-title">Pro tip</h4>
                <p className="qs-protip-text">
                  找一台闲置的旧电脑安装 ClawX，给它足够的权限，它就是你 7×24 不下线的私人研究员。权限越多，能力越大。只要不断电，AI 就不停。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section className="landing-section landing-section--deferred" id="compare">
          <div className="landing-container px-6 lg:px-10">
            <SectionHeading
              kicker="方案对比"
              title="不同方案能力全景"
              description="对比主流方案，了解 ClawPlus 的独特优势"
            />

            <div className="cmp-table-wrap mt-12">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th className="cmp-th cmp-th--dim">对比维度</th>
                    <th className="cmp-th cmp-th--brand">
                      <span className="cmp-brand-badge">ClawPlus <span className="cmp-rec">推荐</span></span>
                    </th>
                    <th className="cmp-th">ClawX</th>
                    <th className="cmp-th">OpenClaw</th>
                    <th className="cmp-th">数据终端 SaaS</th>
                    <th className="cmp-th">通用 Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row, rIdx) => (
                    <tr className="cmp-row" key={row.dimension} style={{ '--cmp-delay': `${rIdx * 60}ms` } as React.CSSProperties}>
                      <td className="cmp-dim">{row.dimension}</td>
                      {(['clawplus', 'clawx', 'openclaw', 'saas', 'agent'] as const).map((col) => {
                        const cell = row[col];
                        const LvlIcon = cell.level === 'good' ? CheckCircle2 : cell.level === 'partial' ? MinusCircle : XCircle;
                        return (
                          <td className={`cmp-cell cmp-cell--${cell.level}`} key={col}>
                            <LvlIcon className="cmp-level-icon" />
                            <span>{cell.text}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cmp-legend mt-6">
              <span className="cmp-legend-item cmp-legend-item--good"><CheckCircle2 className="h-4 w-4" /> 优秀支持</span>
              <span className="cmp-legend-item cmp-legend-item--partial"><MinusCircle className="h-4 w-4" /> 部分支持</span>
              <span className="cmp-legend-item cmp-legend-item--bad"><XCircle className="h-4 w-4" /> 不支持/有限</span>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--deferred" id="faq">
          <div className="landing-container px-6 lg:px-10">
            <SectionHeading
              kicker="FAQ"
              title="关于 ClawPlus 的常见问题"
              description="产品定位、支持的供应商与频道、智能体创建方式、核心能力范围等常见疑问解答。"
            />

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {faqItems.map((faq) => (
                <article className="landing-glass-card landing-lift-card rounded-[30px] p-7" key={faq.question}>
                  <h3 className="text-2xl font-semibold tracking-tight text-[color:var(--landing-ink)]">
                    {faq.question}
                  </h3>
                  <p className="landing-copy mt-4 text-base leading-8">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--cta landing-section--deferred" id="cta">
          <div className="landing-container px-6 pb-16 lg:px-10 lg:pb-24">
            <div className="landing-cta-panel rounded-[38px] p-8 md:p-10 lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="max-w-3xl">
                  <div className="landing-kicker landing-kicker--dark">准备开始使用 ClawPlus</div>
                  <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-[color:var(--landing-ink-strong)] md:text-5xl">
                    把 OpenClaw 带入团队日常工作的统一控制面
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-[color:var(--landing-ink-deep-soft)] md:text-lg">
                    无论是连接模型与消息渠道、沉淀技能与任务，还是组织多智能体协作，ClawPlus 都提供清晰、稳定、适合长期运营的桌面入口。
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <span className="landing-command-chip">统一模型治理</span>
                    <span className="landing-command-chip">AI 生成智能体</span>
                    <span className="landing-command-chip">多渠道接入</span>
                    <span className="landing-command-chip">自动化任务</span>
                    <span className="landing-command-chip">组织架构图</span>
                    <span className="landing-command-chip">模板导入</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <button className="landing-cta-primary" type="button" onClick={() => setShowDl(true)}>
                    <Download className="h-4 w-4" />
                    免费下载
                  </button>
                  <a className="landing-cta-secondary no-underline" href="#screens">
                    查看产品界面
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--contact landing-section--deferred" id="contact">
          <div className="landing-container px-6 pb-20 lg:px-10 lg:pb-28">
            <SectionHeading
              kicker="联系我"
              title="欢迎联系 ClawPlus"
              description="如果你希望进一步了解产品能力、场景落地、演示合作或界面定制，可以通过企业微信客服或邮件直接联系。"
            />

            <div className="landing-contact-grid mt-12">
              <article className="landing-side-panel landing-contact-panel rounded-[34px] p-8">
                <div className="landing-kicker landing-kicker--quiet">
                  <Mail className="h-4 w-4" />
                  Direct contact
                </div>

                <h2 className="landing-display mt-6 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                  用更直接的方式沟通合作、演示与咨询
                </h2>

                <p className="landing-copy mt-5 text-base leading-8">
                  ClawPlus 适合产品、运营、自动化与多智能体协作场景。如果你想交流落地方案、界面定制或产品合作，
                  欢迎通过以下方式联系。
                </p>

                <div className="mt-8 space-y-4">
                  <div className="landing-contact-item">
                    <div className="landing-contact-meta">
                      <div className="landing-card-eyebrow">Email</div>
                      <div className="landing-contact-value">clawplus@163.com</div>
                      <p>适合演示预约、合作沟通与需求交流。</p>
                    </div>
                    <a className="landing-secondary-button landing-contact-action no-underline" href="mailto:clawplus@163.com">
                      发送邮件
                    </a>
                  </div>

                  <div className="landing-contact-item">
                    <div className="landing-contact-meta">
                      <div className="landing-card-eyebrow">合作方向</div>
                      <div className="landing-contact-value">产品咨询 · 方案交流 · 定制合作</div>
                      <p>邮件或企业微信沟通时可备注来源与需求，便于更快识别与响应。</p>
                    </div>
                  </div>
                </div>
              </article>

              <article className="landing-glass-card landing-contact-service rounded-[34px] p-8">
                <div className="landing-contact-service-head">
                  <div className="landing-kicker">
                    <QrCode className="h-4 w-4" />
                    WeCom Service
                  </div>
                  <span className="landing-chip landing-chip--subtle">扫码或点击直达</span>
                </div>

                <div className="landing-contact-service-body">
                  <div className="landing-contact-qr-copy">
                    <h3 className="text-3xl font-semibold tracking-tight text-[color:var(--landing-ink)]">企业微信客服入口</h3>
                    <p className="landing-copy mt-4 text-base leading-8">
                      支持扫码进入，也支持直接点击跳转到企业微信客服链接。适合快速咨询产品能力、演示安排、
                      场景落地和合作方式。
                    </p>
                  </div>

                  <a
                    className="landing-contact-qr-link"
                    href={enterpriseWeChatServiceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="landing-contact-qr-frame">
                      <img alt="ClawPlus 企业微信客服二维码" className="landing-contact-qr-image" src={enterpriseWeChatServiceQrUrl} />
                    </div>
                  </a>

                  <div className="landing-contact-service-actions">
                    <a
                      className="landing-primary-button landing-contact-service-button no-underline"
                      href={enterpriseWeChatServiceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      打开企业微信客服
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <div className="landing-contact-service-note">扫码进入客服 · 点击跳转 · 即时沟通</div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <span className="landing-command-chip">产品咨询</span>
                    <span className="landing-command-chip">演示预约</span>
                    <span className="landing-command-chip">合作沟通</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>

      {/* ── Download Modal ── */}
      {showDl && (
        <div className="dl-modal-backdrop" onClick={() => { if (!dlProgress || dlProgress.done) { cancelDownload(); setShowDl(false); } }}>
          <div className="dl-modal" onClick={(e) => e.stopPropagation()}>
            {/* header */}
            <div className="dl-modal-header">
              <div className="dl-modal-title-row">
                <h2 className="dl-modal-title">下载 ClawPlus</h2>
                <span className="dl-modal-version">v{release.version}</span>
              </div>
              <button
                className="dl-modal-close"
                type="button"
                onClick={() => { cancelDownload(); setShowDl(false); }}
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="dl-modal-date">发布于 {formatDate(release.releaseDate)}</p>

            {/* detected OS */}
            <div className="dl-modal-detect">
              <Monitor className="h-4 w-4" />
              <span>检测到的系统：<strong>Windows ({arch === 'x64' ? 'x64 / Intel' : 'ARM64'})</strong></span>
            </div>

            {/* primary download card */}
            {primaryFile && (
              <div className="dl-card">
                <div className="dl-card-left">
                  <Monitor className="dl-card-icon" />
                  <div>
                    <div className="dl-card-label">Windows ({arch === 'x64' ? 'x64' : 'ARM64'})</div>
                    <div className="dl-card-meta">{primaryFile.url} · {formatSize(primaryFile.size)}</div>
                  </div>
                </div>
                {dlProgress?.file === primaryFile.url ? (
                  <div className="dl-card-progress-wrap">
                    <div className="dl-progress-bar">
                      <div className="dl-progress-fill" style={{ width: `${dlProgress.pct}%` }} />
                    </div>
                    <span className="dl-progress-text">
                      {dlProgress.done ? '✓' : `${dlProgress.pct}%`}
                    </span>
                    {!dlProgress.done && (
                      <button className="dl-progress-cancel" type="button" onClick={cancelDownload} title="取消下载">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button className="dl-card-btn" type="button" onClick={() => triggerDownload(primaryFile)}>
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* smartscreen hint */}
            <div className="dl-modal-hint">
              <Lightbulb className="h-4 w-4 shrink-0" />
              <span>如果 Windows SmartScreen 阻止了应用，请点击<strong>「更多信息」→「仍要运行」</strong></span>
            </div>

            {/* other platforms */}
            {otherFiles.length > 0 && (
              <div className="dl-other">
                <button className="dl-other-toggle" type="button" onClick={() => setShowOther(!showOther)}>
                  <ChevronDown className={`h-4 w-4 transition-transform${showOther ? ' rotate-180' : ''}`} />
                  <span>其他版本</span>
                </button>
                {showOther && (
                  <div className="dl-other-list">
                    {otherFiles.map((f) => {
                      const label = f.url.includes('arm64')
                        ? 'Windows ARM64'
                        : f.url.includes('x64')
                          ? 'Windows x64'
                          : 'Windows (通用)';
                      return (
                        <div className="dl-card dl-card--sm" key={f.url}>
                          <div className="dl-card-left">
                            <Monitor className="dl-card-icon dl-card-icon--sm" />
                            <div>
                              <div className="dl-card-label">{label}</div>
                              <div className="dl-card-meta">{f.url} · {formatSize(f.size)}</div>
                            </div>
                          </div>
                          {dlProgress?.file === f.url ? (
                            <div className="dl-card-progress-wrap">
                              <div className="dl-progress-bar">
                                <div className="dl-progress-fill" style={{ width: `${dlProgress.pct}%` }} />
                              </div>
                              <span className="dl-progress-text">
                                {dlProgress.done ? '✓' : `${dlProgress.pct}%`}
                              </span>
                              {!dlProgress.done && (
                                <button className="dl-progress-cancel" type="button" onClick={cancelDownload} title="取消">
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button className="dl-card-btn dl-card-btn--sm" type="button" onClick={() => triggerDownload(f)}>
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* GitHub link */}
            <a
              className="dl-modal-github no-underline"
              href="https://github.com/iimere/clawplus/releases"
              rel="noreferrer"
              target="_blank"
            >
              在 GitHub 上查看所有版本 →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionHeadingProps {
  kicker: string;
  title: string;
  description: string;
}

function SectionHeading({ kicker, title, description }: SectionHeadingProps) {
  return (
    <div className="max-w-3xl">
      <div className="landing-section-kicker">{kicker}</div>
      <h2 className="landing-display mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{title}</h2>
      <p className="landing-copy mt-5 text-base leading-8 md:text-lg">{description}</p>
    </div>
  );
}

interface ProductPreviewProps {
  page: PreviewPage;
  hero?: boolean;
}

function ProductPreview({ page, hero = false }: ProductPreviewProps) {
  if (page === 'agent-modal') {
    return <AgentModalPreview />;
  }

  const activeNav =
    page === 'dashboard'
      ? '仪表盘'
      : page === 'models'
        ? '模型'
        : page === 'channels'
          ? '频道'
          : page === 'skills'
            ? '技能'
            : page === 'cron'
              ? '定时任务'
              : '智能体';

  return (
    <div className={cn('cp-preview-shell', hero && 'cp-preview-shell--hero')}>
      <aside className="cp-preview-sidebar">
        <div className="cp-preview-brand">
          <img alt="ClawPlus" src={logoUrl} />
          <span>clawPlus</span>
        </div>

        <div className="cp-preview-new-chat">
          <Plus className="h-3.5 w-3.5" />
          新对话
        </div>

        <div className="cp-preview-nav">
          {previewNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <div className={cn('cp-preview-nav-item', item.label === activeNav && 'is-active')} key={item.label}>
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="cp-preview-side-note">work</div>
      </aside>

      <div className="cp-preview-main">
        {page === 'dashboard' && <DashboardPreview hero={hero} />}
        {page === 'models' && <ModelsPreview />}
        {page === 'channels' && <ChannelsPreview />}
        {page === 'skills' && <SkillsPreview />}
        {page === 'cron' && <CronPreview />}
        {page === 'agents' && <AgentsPreview />}
      </div>
    </div>
  );
}

function DashboardPreview({ hero = false }: { hero?: boolean }) {
  return (
    <div className="cp-page-surface">
      <div className="cp-page-header">
        <div>
          <div className="cp-page-title">仪表盘</div>
          <div className="cp-page-subtitle">统一查看网关、频道、技能与快捷操作</div>
        </div>
      </div>

      <div className={cn('cp-stat-grid', hero && 'cp-stat-grid--hero')}>
        <StatCard label="网关" value="Running" meta="端口 18789 | PID 41320" tone="green" />
        <StatCard label="频道" value="5" meta="5 / 5 已连接" />
        <StatCard label="技能" value="57" meta="57 / 57 已启用" />
        <StatCard label="运行时间" value="4m" meta="自上次重启" />
      </div>

      <div className="cp-panel">
        <div className="cp-panel-title">快捷操作</div>
        <div className="cp-action-grid">
          {['添加模型提供商', '添加频道', '创建定时任务', '安装技能', '打开聊天', '设置'].map((action) => (
            <div className="cp-action-button" key={action}>
              {action}
            </div>
          ))}
        </div>
      </div>

      {hero ? (
        <div className="cp-split-grid">
          <div className="cp-panel">
            <div className="cp-panel-title">已连接频道</div>
            <div className="cp-list-stack">
              {['代码助手', '总裁', '小点-qq董事长'].map((item) => (
                <div className="cp-line-card" key={item}>
                  <div>
                    <strong>{item}</strong>
                    <span>Connected</span>
                  </div>
                  <div className="cp-status-badge">在线</div>
                </div>
              ))}
            </div>
          </div>

          <div className="cp-panel">
            <div className="cp-panel-title">已启用技能</div>
            <div className="cp-chip-cloud">
              {['qqbot-cron', 'apple-notes', 'bear-notes', 'coding-agent', 'clawhub', '1password', '+45 更多'].map((item) => (
                <span className="cp-cloud-chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModelsPreview() {
  return (
    <div className="cp-page-surface">
      <div className="cp-page-header cp-page-header--with-action">
        <div>
          <div className="cp-page-title">模型</div>
          <div className="cp-page-subtitle">管理 AI 提供商和监控 Token 使用情况</div>
        </div>
        <div className="cp-header-pill">
          <Plus className="h-3.5 w-3.5" />
          添加提供商
        </div>
      </div>

      <div className="cp-list-stack">
        <ProviderRow name="OpenAI" meta="OAuth 浏览器登录 · gpt-5.4" status="Default" selected />
        <ProviderRow name="MiniMax (Global)" meta="OAuth 设备登录 · MiniMax-M2.5" />
        <ProviderRow name="Moonshot (CN)" meta="API 密钥 · 已配置" online />
      </div>

      <div className="cp-panel cp-panel--shallow">
        <div className="cp-panel-title">最近 Token 消耗</div>
        <div className="cp-tab-row">
          <span className="is-active">按模型</span>
          <span>按时间</span>
          <span>7 天</span>
          <span>30 天</span>
        </div>
      </div>
    </div>
  );
}

function ChannelsPreview() {
  return (
    <div className="cp-page-surface">
      <div className="cp-page-header cp-page-header--with-action">
        <div>
          <div className="cp-page-title">消息频道</div>
          <div className="cp-page-subtitle">管理您的消息频道和连接</div>
        </div>
        <div className="cp-header-pill">
          <Command className="h-3.5 w-3.5" />
          刷新
        </div>
      </div>

      <div className="cp-channel-grid">
        <ChannelRow title="代码助手" sub="使用 @BotFather 提供的机器人令牌连接 Telegram" tags={['codeingbot', 'Agent: coding']} />
        <ChannelRow title="总裁" sub="使用 @BotFather 提供的机器人令牌连接 Telegram" tags={['workmainbot', 'Agent: work']} />
        <ChannelRow title="小点-qq董事长" sub="通过 OpenClaw 渠道插件连接 QQ 机器人" tags={['插件', 'qqMain', 'Agent: work']} />
        <ChannelRow title="小红书操盘助手" sub="通过 OpenClaw 渠道插件连接 QQ 机器人" tags={['插件', 'xhs-qqbot', 'Agent: director']} />
      </div>
    </div>
  );
}

function SkillsPreview() {
  return (
    <div className="cp-page-surface">
      <div className="cp-page-header cp-page-header--with-action">
        <div>
          <div className="cp-page-title">技能</div>
          <div className="cp-page-subtitle">浏览和管理 AI 能力</div>
        </div>
        <div className="cp-header-pill">
          <FolderOpenIcon />
          打开技能文件夹
        </div>
      </div>

      <div className="cp-toolbar">
        <div className="cp-search">
          <Search className="h-3.5 w-3.5" />
          搜索技能...
        </div>
        <div className="cp-tab-row cp-tab-row--compact">
          <span className="is-active">全部技能 57</span>
          <span>内置 51</span>
          <span>市场 6</span>
        </div>
      </div>

      <div className="cp-skill-stack">
        {['1password', 'apple-notes', 'apple-reminders', 'bear-notes', 'blogwatcher'].map((skill) => (
          <div className="cp-skill-row" key={skill}>
            <div className="cp-skill-meta">
              <div className="cp-skill-icon">{skill.slice(0, 1)}</div>
              <div>
                <strong>{skill}</strong>
                <span>v1.0.0 · enabled</span>
              </div>
            </div>
            <div className="cp-toggle is-on">
              <span />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CronPreview() {
  return (
    <div className="cp-page-surface">
      <div className="cp-page-header cp-page-header--with-action">
        <div>
          <div className="cp-page-title">定时任务</div>
          <div className="cp-page-subtitle">通过定时任务自动化 AI 工作流</div>
        </div>
        <div className="cp-header-actions">
          <div className="cp-header-pill">
            <Command className="h-3.5 w-3.5" />
            刷新
          </div>
          <div className="cp-header-pill cp-header-pill--primary">
            <Plus className="h-3.5 w-3.5" />
            新建任务
          </div>
        </div>
      </div>

      <div className="cp-stat-grid cp-stat-grid--compact">
        <StatCard label="任务总数" value="0" tone="green" />
        <StatCard label="运行中" value="0" />
        <StatCard label="已暂停" value="0" tone="amber" />
        <StatCard label="失败" value="0" tone="red" />
      </div>

      <div className="cp-empty-panel">
        <Clock3 className="h-7 w-7" />
        <strong>暂无定时任务</strong>
        <p>创建定时任务以自动化 AI 工作流。任务可以在指定时间发送消息、运行查询或执行操作。</p>
        <div className="cp-header-pill cp-header-pill--primary">
          <Plus className="h-3.5 w-3.5" />
          创建第一个任务
        </div>
      </div>
    </div>
  );
}

function AgentsPreview() {
  return (
    <div className="cp-page-surface">
      <div className="cp-page-header cp-page-header--with-action">
        <div>
          <div className="cp-page-title">智能体</div>
          <div className="cp-page-subtitle">管理多个 AI 智能体并进行协作</div>
        </div>
        <div className="cp-header-actions">
          <div className="cp-header-pill">
            <LayoutDashboard className="h-3.5 w-3.5" />
            切换视图
          </div>
          <div className="cp-header-pill cp-header-pill--primary">
            <Plus className="h-3.5 w-3.5" />
            新建智能体
          </div>
        </div>
      </div>

      <div className="cp-agent-grid">
        <AgentCard name="work" badge="活跃" primary />
        <AgentCard name="coding" />
        <AgentCard name="director" />
      </div>
    </div>
  );
}

function AgentModalPreview() {
  return (
    <div className="cp-modal-stage">
      <div className="cp-modal-backdrop">
        <div className="cp-modal-shell">
          <div className="cp-modal-header">
            <div className="cp-modal-title">
              <div className="cp-modal-icon">
                <Bot className="h-4 w-4" />
              </div>
              创建新智能体
            </div>
            <X className="h-4 w-4" />
          </div>

          <div className="cp-step-tabs">
            {['基本信息', '角色层级', '模型配置', '角色定义'].map((step, index) => (
              <div className={cn('cp-step-tab', index === 0 && 'is-active')} key={step}>
                {step}
              </div>
            ))}
          </div>

          <div className="cp-form-stack">
            <FormField label="智能体 ID *" placeholder="例如 work、research、coding" active />
            <FormField label="显示名称" placeholder="例如 工作助手" />
            <FormField label="描述" placeholder="这个智能体是做什么的?" tall />
            <FormField label="Emoji 图标" placeholder="例如 🧠 📊 💡 💻" />
          </div>

          <div className="cp-modal-footer">
            <div className="cp-header-pill">取消</div>
            <div className="cp-header-pill cp-header-pill--primary">
              下一步
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  meta,
  tone,
  selected,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: 'green' | 'amber' | 'red';
  selected?: boolean;
}) {
  return (
    <div className={cn('cp-stat-card', tone && `is-${tone}`, selected && 'is-selected')}>
      <span>{label}</span>
      <strong>{value}</strong>
      {meta ? <small>{meta}</small> : null}
    </div>
  );
}

function ProviderRow({
  name,
  meta,
  status,
  selected = false,
  online = false,
}: {
  name: string;
  meta: string;
  status?: string;
  selected?: boolean;
  online?: boolean;
}) {
  return (
    <div className={cn('cp-provider-row', selected && 'is-selected')}>
      <div className="cp-provider-main">
        <div className="cp-provider-icon">{name.slice(0, 1)}</div>
        <div>
          <div className="cp-provider-name">
            {name}
            {status ? <span className="cp-soft-tag">{status}</span> : null}
          </div>
          <div className="cp-provider-sub">
            {meta}
            {online ? (
              <span className="cp-status-inline">
                <span />
                已配置
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelRow({ title, sub, tags }: { title: string; sub: string; tags: string[] }) {
  return (
    <div className="cp-channel-row">
      <div className="cp-channel-avatar">{title.slice(0, 1)}</div>
      <div className="cp-channel-copy">
        <div className="cp-channel-title">
          {title}
          {tags.map((tag) => (
            <span className="cp-soft-tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="cp-channel-sub">{sub}</div>
      </div>
      <div className="cp-online-dot" />
    </div>
  );
}

function AgentCard({ name, badge, primary = false }: { name: string; badge?: string; primary?: boolean }) {
  return (
    <div className={cn('cp-agent-card', primary && 'is-primary')}>
      <div className="cp-agent-head">
        <div className="cp-agent-icon">
          <Bot className="h-4 w-4" />
        </div>
        <div className="cp-agent-name">
          {name}
          {badge ? <span>{badge}</span> : null}
        </div>
      </div>
      <div className={cn('cp-agent-button', primary && 'is-primary')}>{primary ? '继续对话' : '对话'}</div>
      <div className="cp-agent-tools">
        <Check className="h-3.5 w-3.5" />
        <Layers3 className="h-3.5 w-3.5" />
        <Cog className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

function FormField({
  label,
  placeholder,
  tall = false,
  active = false,
}: {
  label: string;
  placeholder: string;
  tall?: boolean;
  active?: boolean;
}) {
  return (
    <div className="cp-form-field">
      <label>{label}</label>
      <div className={cn('cp-form-input', tall && 'is-tall', active && 'is-active')}>{placeholder}</div>
    </div>
  );
}

function FolderOpenIcon() {
  return <Wand2 className="h-3.5 w-3.5" />;
}
