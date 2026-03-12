import {
  ArrowRight,
  Bot,
  Boxes,
  Cable,
  CalendarClock,
  Check,
  Clock3,
  Cog,
  Command,
  Globe2,
  LayoutDashboard,
  Layers3,
  Mail,
  MessageSquarePlus,
  Plus,
  QrCode,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
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

const navItems = [
  { label: '价值主张', href: '#value' },
  { label: '核心模块', href: '#features' },
  { label: '工作流', href: '#workflow' },
  { label: '界面预览', href: '#screens' },
  { label: 'FAQ', href: '#faq' },
  { label: '联系我', href: '#contact' },
] as const;

const heroStats = [
  { value: '57', label: '技能已启用' },
  { value: '5', label: '频道已连接' },
  { value: '多智能体', label: '支持角色分工与协作编排' },
] as const;

const signalCards = [
  {
    eyebrow: '统一工作台',
    title: '一个桌面控制台，管理 OpenClaw 的关键能力',
    text: 'ClawPlus 将模型、消息频道、技能、定时任务、仪表盘与智能体协作整合到统一界面，帮助团队以更低门槛完成部署、接入与运营。',
  },
  {
    eyebrow: '团队可用',
    title: '从个人试验走向稳定运营与协作',
    text: '清晰的信息架构与状态反馈，让 AI 系统不再依赖零散脚本和命令行，更适合长期维护、多角色协作与业务接入。',
  },
] as const;

const workTags = ['ClawPlus', '模型治理', '消息渠道', '技能中心', '定时任务', '智能体协作'] as const;

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
    description: '集中管理 OpenAI、MiniMax、Moonshot 等提供商，展示默认模型、鉴权方式与 API Key 状态。',
    details: ['Provider 卡片视图', 'Token 使用语义', '更适合团队配置管理'],
  },
  {
    icon: RadioTower,
    title: '消息频道',
    description: '把 Telegram、QQ Bot 等渠道统一接入，并直接展示机器人名称、绑定智能体和在线状态。',
    details: ['多渠道管理', '状态一眼可见', '适合持续运营'],
  },
  {
    icon: Boxes,
    title: '技能中心',
    description: '以统一列表管理已安装、内置与市场技能，支持检索、版本识别和启用控制，方便把 AI 能力沉淀为可复用资产。',
    details: ['搜索与分类', '版本与状态', 'AI 能力市场化表达'],
  },
  {
    icon: CalendarClock,
    title: '定时任务',
    description: '将周期性流程转化为可配置的自动化任务，统一查看状态、执行入口与任务统计，让 AI 从响应式工具走向持续执行。',
    details: ['计划任务总览', '空状态清晰', '创建路径直接'],
  },
  {
    icon: LayoutDashboard,
    title: '仪表盘',
    description: '从网关状态到频道、技能、运行时长与快捷操作，关键运营信息在同一面板集中呈现，便于统一观察与调度。',
    details: ['状态总览', '快捷操作', '连接与启用统计'],
  },
  {
    icon: Bot,
    title: '智能体系统',
    description: '支持多智能体编排、角色分工与创建流程管理，为团队协作、复杂任务拆解和后续能力扩展提供稳定基础。',
    details: ['智能体卡片', '创建流程弹窗', '适合多 Agent 协作叙事'],
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
    title: '模型提供商',
    description: '展示 Provider、默认模型与配置状态，体现统一的模型治理能力。',
    page: 'models',
  },
  {
    title: '消息频道',
    description: '呈现机器人绑定、渠道标签与连接状态，帮助说明 ClawPlus 如何接入业务沟通入口。',
    page: 'channels',
  },
  {
    title: '技能管理',
    description: '通过搜索、分类与启用控制展示技能资产如何被标准化管理。',
    page: 'skills',
  },
  {
    title: '定时任务',
    description: '突出自动化任务的状态总览与创建入口，让持续执行能力更直观。',
    page: 'cron',
  },
  {
    title: '智能体视图',
    description: '展示多智能体协作布局与操作入口，体现角色化组织能力。',
    page: 'agents',
  },
  {
    title: '创建智能体弹窗',
    description: '通过分步表单说明智能体配置流程，强化产品成熟度与可扩展性。',
    page: 'agent-modal',
  },
] as const;

const providers = [
  { name: 'OpenAI', icon: openaiUrl },
  { name: 'Moonshot', icon: moonshotUrl },
  { name: 'MiniMax', icon: minimaxUrl },
] as const;

const channels = [
  { name: 'Telegram', icon: telegramUrl },
  { name: 'DingTalk', icon: dingtalkUrl },
  { name: 'QQ Bot', icon: qqbotUrl },
] as const;

const faqItems = [
  {
    question: 'ClawPlus 是什么？',
    answer: 'ClawPlus 是面向 OpenClaw 的桌面控制台，用统一图形界面管理模型提供商、消息频道、技能、定时任务、仪表盘与智能体协作。',
  },
  {
    question: '适合哪些团队使用？',
    answer: '适合需要把 AI 能力接入日常工作的产品、运营、技术与自动化团队，尤其适用于同时管理多模型、多渠道和长期任务的场景。',
  },
  {
    question: '是否必须熟悉命令行？',
    answer: '不必。ClawPlus 将常见的配置、连接、启停与状态观察集中到桌面界面中，让更多角色都能在统一入口里完成操作。',
  },
  {
    question: '可以管理哪些核心能力？',
    answer: '当前支持模型提供商接入、消息频道连接、技能启用与检索、定时任务配置、运行状态总览，以及多智能体协作管理。',
  },
] as const;

const previewNavItems = [
  { label: '新对话', icon: MessageSquarePlus },
  { label: '模型', icon: Wrench },
  { label: '频道', icon: RadioTower },
  { label: '技能', icon: Boxes },
  { label: '定时任务', icon: CalendarClock },
  { label: '仪表盘', icon: LayoutDashboard },
  { label: '智能体', icon: Bot },
] as const;

type PreviewPage = (typeof previewCards)[number]['page'] | 'dashboard';

export function Landing() {
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
            <a className="landing-primary-button px-5 py-3 text-sm no-underline" href="#features">
              浏览核心能力
            </a>
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

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <a className="landing-primary-button px-7 py-4 no-underline" href="#screens">
                  查看产品界面
                  <ArrowRight className="h-4 w-4" />
                </a>
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
              title="围绕真实产品结构展示 ClawPlus 的关键界面"
              description="覆盖模型、频道、技能、定时任务、仪表盘与智能体等核心页面，让访问者快速理解产品如何被部署、接入与使用。"
            />

            <div className="landing-preview-grid mt-12">
              {previewCards.map((card) => (
                <article className="landing-gallery-card landing-gallery-card--preview rounded-[32px] p-5" key={card.title}>
                  <div className="landing-preview-frame">
                    <ProductPreview page={card.page} />
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
                既能接入主流生态，也能保持清晰的桌面端边界
              </h2>

              <p className="landing-copy mt-5 text-base leading-8">
                ClawPlus 一端连接模型提供商与消息渠道，一端承载桌面端本地能力与统一控制面，适合长期演进与团队使用。
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="landing-mini-panel rounded-[26px] p-5">
                  <div className="landing-card-eyebrow">模型生态</div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {providers.map((provider) => (
                      <div className="landing-logo-chip" key={provider.name}>
                        <img alt={provider.name} className="landing-logo-icon" src={provider.icon} />
                        <span>{provider.name}</span>
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

        <section className="landing-section landing-section--deferred" id="faq">
          <div className="landing-container px-6 lg:px-10">
            <SectionHeading
              kicker="FAQ"
              title="快速了解 ClawPlus 的定位与适用场景"
              description="以下问题聚焦产品定位、适用团队和能力范围，帮助访问者在更短时间内判断 ClawPlus 是否符合当前需求。"
            />

            <div className="mt-12 grid gap-5 md:grid-cols-2">
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
                    <span className="landing-command-chip">多渠道接入</span>
                    <span className="landing-command-chip">自动化任务</span>
                    <span className="landing-command-chip">多智能体协作</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <a className="landing-cta-primary no-underline" href="#screens">
                    查看产品界面
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a className="landing-cta-secondary no-underline" href="#features">
                    浏览核心能力
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
