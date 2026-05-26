// Simplified Chinese UI copy (reference shape for all locales).
// Voice: 第二人称、平实、不卖弄（见 DESIGN.md Do's and Don'ts）。
//
// Bilingual equivalence (Two Tongues Rule): zh and ja are two equal tracks,
// NOT "primary + translation". User-uploaded content (seat_label / event_name
// / description) is never translated (R9.5) — those strings come from D1, not
// from these bundles.

/**
 * The message bundle shape, derived from the zh reference but widened so every
 * locale supplies the same keys with arbitrary string values.
 */
export interface Messages {
  meta: { title: string; tagline: string };
  nav: {
    home: string;
    staging: string;
    contribute: string;
    /** Language switcher group/trigger aria-label. */
    language: string;
  };
  theme: { label: string; light: string; dark: string; system: string };
  search: {
    placeholder: string;
    label: string;
    noResults: string;
    clear: string;
  };
  tree: {
    title: string;
    open: string;
    close: string;
    /** Venue-tree `<nav>` aria-label. */
    navLabel: string;
    /** Footer entry into the staging area (cross-brief contract). */
    stagingPrompt: string;
  };
  venue: {
    /** Breadcrumb root, e.g. "日本". */
    country: string;
    /** Breadcrumb `<nav>` aria-label. */
    breadcrumbLabel: string;
    subMapTabsLabel: string;
    notFoundTitle: string;
    notFoundBody: string;
    backHome: string;
  };
  seatmap: {
    /** Empty sub-map: gentle invitation (shape-seatmap §8). */
    emptyBody: string;
    emptyCta: string;
    /** Chart failed to load (R3 error Key State). */
    errorBody: string;
    /** SR-only label while annotation points load. */
    loading: string;
    /** Zoom controls (aria-labels). */
    zoomIn: string;
    zoomOut: string;
    reset: string;
    /** `{label}` → user seat label; `{count}` → aggregate size. Pin/bubble
     *  aria-labels — never machine-translate the embedded seat label (R9.5). */
    pinLabel: string;
    clusterLabel: string;
    /** Seating-chart `<img>` alt. `{label}` → sub-map label. */
    chartAlt: string;
  };
  upload: {
    cta: string;
    /** Rate-limited (10/day reached). */
    disabled: string;
  };
  /** Performance-date picker (upload Sheet step 3 — DateField.tsx). */
  datePicker: {
    /** Weekday column headers, Sun-first (length 7). */
    weekdays: string[];
    /** Month labels for the month grid + day-view header (length 12). */
    months: string[];
    /** Header aria when the day view can drill up to month selection. */
    selectMonth: string;
    /** Header aria when the month view can drill up to year selection. */
    selectYear: string;
    /** Prev/next arrow aria-labels per drill level. */
    prevMonth: string;
    nextMonth: string;
    prevYear: string;
    nextYear: string;
    prev12Years: string;
    next12Years: string;
    /** Day-view header template: `{year}` + `{month}` (a `months` entry). */
    headerMonth: string;
    /** Month/year-view header template: `{year}`. */
    headerYear: string;
  };
  /** Upload Sheet (shape-upload-sheet.md) — 6-step accumulative flow. */
  uploadSheet: {
    title: string;
    /** ✕ close button aria-label. */
    close: string;
    /** Per-step "改" (edit) button. */
    edit: string;
    step1: {
      title: string;
      helper: string;
      /** Annotation marker drag aria-label. */
      markerLabel: string;
      undo: string;
      confirm: string;
      /** ⤢ open-fullscreen button label / title. */
      fullscreen: string;
      /** ✕ exit-fullscreen aria-label. */
      exitFullscreen: string;
      /** Folded summary, `{label}` → sub-map, `{x}`/`{y}` → percent ints. */
      summary: string;
    };
    step2: {
      title: string;
      dropzone: string;
      /** Processing-pipeline one-liner. */
      note: string;
      /** `{percent}` → 0..100. */
      progress: string;
      /** Oversized / unsupported file. */
      failed: string;
      retry: string;
      /** Folded summary, `{size}` → human bytes. */
      summary: string;
    };
    step3: {
      title: string;
      seatLabel: string;
      seatPlaceholder: string;
      /** Required-but-empty validation. */
      seatRequired: string;
      performanceDate: string;
      datePlaceholder: string;
      dateClear: string;
      eventName: string;
      description: string;
      /** `{n}`/`{max}` → current / max chars. */
      descriptionCount: string;
      next: string;
    };
    step4: {
      title: string;
      /** Consent line (CC BY-NC 4.0 license, R11). `{license}` slot for link. */
      consent: string;
      license: string;
    };
    step5: {
      title: string;
      turnstileNote: string;
      limitNote: string;
      submit: string;
      submitting: string;
      /** `{n}`/`{total}` → retry attempt. */
      retrying: string;
      /** Network/all-retries-failed inline error. */
      networkError: string;
      tryAgain: string;
      /** Turnstile failed. */
      turnstileError: string;
      /** 10/day reached. */
      limitDaily: string;
      /** 30s cooldown. */
      limitCooldown: string;
      /** Generic server error. */
      serverError: string;
    };
    /** Inline (NOT modal) unsaved-close confirm bar. */
    confirmClose: {
      body: string;
      discard: string;
      keep: string;
    };
    success: {
      title: string;
      body: string;
      again: string;
      back: string;
    };
  };
  grid: {
    /** Empty sub-map: gentle invitation (DESIGN.md 缝隙时刻). */
    emptyBody: string;
    emptyCta: string;
    /** End-of-feed full stop. */
    end: string;
    imageError: string;
    /** SR-only label while a batch of cards loads. */
    loading: string;
    /** `{label}` → user seat label. Card link aria-label (R9.5: seat label
     *  is user content, never translated). */
    cardLabel: string;
    /** `{label}` → user seat label. Card image alt. */
    imageAlt: string;
  };
  lightbox: {
    /** aria-labels / control titles. */
    close: string;
    prev: string;
    next: string;
    /** Footer strip: tap to open the metadata sheet. */
    openDetails: string;
    /** Long-description fold toggles. */
    expand: string;
    collapse: string;
    /** Metadata sheet field labels. */
    uploadedAt: string;
    /** Image failed to load (gentle, no blame). */
    imageError: string;
    /** `{label}` → user seat label; `{date}` → perf date; `{event}` → event
     *  name. Image alt — embedded seat label/event are user content (R9.5). */
    imageAlt: string;
    /** `{n}` / `{total}` → 1-based position and count (sequence mode). */
    position: string;
  };
  footer: {
    contribute: string;
    about: string;
    privacy: string;
    terms: string;
    copyright: string;
    /** Footer `<nav>` aria-label. */
    navLabel: string;
  };
  /** Standalone legal pages — privacy + terms (issue #6, distinct from home). */
  legal: {
    /** Privacy page <h1> + browser title. */
    privacyTitle: string;
    /** Privacy lead paragraph. */
    privacyIntro: string;
    /** Privacy body sections (heading + paragraph). */
    privacySections: { heading: string; body: string }[];
    /** Terms page <h1> + browser title. */
    termsTitle: string;
    /** Terms lead paragraph. */
    termsIntro: string;
    /** Terms body sections (heading + paragraph). */
    termsSections: { heading: string; body: string }[];
    /** "Last updated" line — `{date}` slot. */
    updated: string;
    /** Feedback line — `{github}` slot rendered as an inline repo link. */
    feedback: string;
    /** Link text for the GitHub repo inside `feedback`. */
    feedbackLink: string;
  };
  /** Home / intro page (shape-home-explainer.md). */
  home: {
    /** Serif Display sub-title under the SeatView wordmark. */
    subtitle: string;
    /** One-line positioning (hero). */
    heroLine: string;
    /** Hero CTA into the atlas (ink outline, NOT vermilion). */
    cta: string;
    /** Section header: how to use (zh side of the bilingual pair). */
    howTitle: string;
    /** Section header: how to use (other-locale side, shown in parallel). */
    howTitleAlt: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    /** Section header: recommended venues. */
    recommendTitle: string;
    recommendTitleAlt: string;
    /** Example venue note lines (display choice, hardcoded). */
    venue1Note: string;
    venue2Note: string;
    /** Section header: about uploading. */
    uploadTitle: string;
    uploadTitleAlt: string;
    rule1: string;
    rule2: string;
    /** `{license}` slot for the CC link. */
    rule3: string;
    license: string;
    /** Rate-limit footnote. */
    limitNote: string;
  };
  /** Staging area page (shape-staging-page.md). */
  staging: {
    /** Page / nav title (outward-facing, differs from the internal "暂存区"). */
    pageTitle: string;
    /** Form prompt (zh side of bilingual pair). */
    promptTitle: string;
    promptTitleAlt: string;
    inputPlaceholder: string;
    /** SR label for the venue-name input. */
    inputLabel: string;
    submit: string;
    submitting: string;
    /** Transparent "why only a name" copy. */
    transparency: string;
    turnstileNote: string;
    /** Always-on daily-limit copy. */
    limitNote: string;
    /** Dedup hint (issue #3): a11y label for the live match-suggestion region. */
    matchRegionLabel: string;
    /** Dedup hint: heading over venues already collected in the atlas. */
    matchCollectedTitle: string;
    /** Dedup hint: CTA link to an already-collected venue (opens in new tab). */
    matchView: string;
    /** Dedup hint: heading over venues already requested in the staging list. */
    matchStagedTitle: string;
    /** List section header (zh side of bilingual pair). */
    listTitle: string;
    listTitleAlt: string;
    /** Processed marker (Sumi ✓, never vermilion). */
    processed: string;
    /** Demand tally, framed as 需求信号 not a 点赞数. `{count}` slot. */
    votes: string;
    /** "+1" (附议) button label. */
    plusOne: string;
    /** Already-seconded state (button disabled, Sumi ✓). */
    plusOneDone: string;
    /** SR/aria label for the +1 button. `{name}` slot → venue name (verbatim). */
    plusOneLabel: string;
    /** Hit the 5-different-venues/day +1 cap (inline, disables further +1). */
    plusOneLimit: string;
    /** Generic +1 failure (inline). */
    plusOneError: string;
    /** Empty list (gentle 缝隙时刻). */
    emptyBody: string;
    /** Inline submit success. */
    success: string;
    /** Empty venue-name attempted submit. */
    emptyName: string;
    /** Generic submit failure (inline). */
    submitError: string;
    /** 5/day reached. */
    limitDaily: string;
    /** Turnstile failed. */
    turnstileError: string;
    /** List load failed. */
    loadError: string;
    /** End-of-list full stop. */
    end: string;
    /** GitHub high-bar contribution channel (R13.2). */
    githubChannel: string;
  };
  /** Error pages + shared inline load-failure (shape-error-pages.md). */
  error: {
    /** 404 title (detected-language first; alt shown as a quiet second line). */
    notFoundTitle: string;
    notFoundBody: string;
    /** 500 / generic. */
    genericTitle: string;
    genericBody: string;
    /** Recovery button → home (ink outline, shared "打开图鉴" copy). */
    backHome: string;
    /** Secondary link → last-visited venue (client-hydrated, localStorage). */
    backLastVenue: string;
  };
  /** Shared inline load-failure (the <LoadFailure> component, error-pages §4). */
  loadFailure: {
    title: string;
    body: string;
    retry: string;
    retrying: string;
  };
  /** Maintainer admin surface (R7, ADR-11). Bilingual like the rest. */
  admin: {
    /** Page / tab title. */
    title: string;
    /** "Signed in as {email}" line. `{email}` slot. */
    signedInAs: string;
    /** Tab: uploaded photos moderation. */
    photosTab: string;
    /** Tab: staging-area triage. */
    stagingTab: string;
    /** Toggle to include already-deleted photos in the list (audit). */
    showDeleted: string;
    /** Empty photo list. */
    photosEmpty: string;
    /** Empty staging list. */
    stagingEmpty: string;
    /** End-of-list full stop. */
    end: string;
    /** Already soft-deleted badge on a photo row. */
    deletedBadge: string;
    /** Delete photo button (+ aria). */
    deletePhoto: string;
    /** Inline confirm bar before a destructive photo delete. */
    confirmDeletePhoto: string;
    /** Confirm / cancel (shared by photo + staging delete confirm bars). */
    confirmYes: string;
    confirmNo: string;
    /** Mark a staging suggestion processed / unprocessed. */
    markProcessed: string;
    markUnprocessed: string;
    /** Delete staging suggestion (+ confirm bar). */
    deleteStaging: string;
    confirmDeleteStaging: string;
    /** Processed marker (mirrors public staging copy). */
    processed: string;
    /** SR alt for a photo thumbnail, `{label}` → seat label. */
    thumbAlt: string;
    /** Per-row action error (inline). */
    actionError: string;
    /** Unauthorized (defense-in-depth; production blocks at edge first). */
    unauthorized: string;
    /** Working… label while a row action is in flight. */
    working: string;
  };
}

const zh: Messages = {
  meta: {
    title: "SeatView · 真实视角图集",
    tagline: "抢票前 30 秒，先看清这个座位真正的视角。",
  },
  nav: {
    home: "首页",
    staging: "想看的场馆",
    contribute: "想贡献新场馆？",
    language: "语言",
  },
  theme: {
    label: "主题",
    light: "亮色",
    dark: "暗色",
    system: "跟随系统",
  },
  search: {
    placeholder: "搜索场馆…",
    label: "搜索场馆",
    noResults: "没找到这个场馆。可以在暂存区提交看看。",
    clear: "清除",
  },
  tree: {
    title: "场馆",
    open: "打开场馆树",
    close: "关闭场馆树",
    navLabel: "场馆树",
    stagingPrompt: "想看的场馆没有？写下来",
  },
  venue: {
    country: "日本",
    breadcrumbLabel: "面包屑",
    subMapTabsLabel: "切换坐席图",
    notFoundTitle: "这个场馆我们还没收录。",
    notFoundBody: "要不去首页看看其他场馆？",
    backHome: "回到首页",
  },
  seatmap: {
    emptyBody: "这个区域还没有粉丝分享视角。",
    emptyCta: "要做第一个吗？",
    errorBody: "坐席图加载失败。检查网络后刷新。",
    loading: "正在加载标注点…",
    zoomIn: "放大",
    zoomOut: "缩小",
    reset: "复位",
    pinLabel: "座位 {label} 的视角",
    clusterLabel: "{count} 个标注点，点击放大查看",
    chartAlt: "坐席图 {label}",
  },
  upload: {
    cta: "上传我的视角",
    disabled: "你今天已经上传 10 张了。明天再来。",
  },
  datePicker: {
    weekdays: ["日", "一", "二", "三", "四", "五", "六"],
    months: [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
    ],
    selectMonth: "选择月份",
    selectYear: "选择年份",
    prevMonth: "上个月",
    nextMonth: "下个月",
    prevYear: "上一年",
    nextYear: "下一年",
    prev12Years: "前 12 年",
    next12Years: "后 12 年",
    headerMonth: "{year}年{month}",
    headerYear: "{year}年",
  },
  uploadSheet: {
    title: "＋ 上传我的视角",
    close: "关闭",
    edit: "改",
    step1: {
      title: "1. 座位位置",
      helper: "点击你坐过的位置",
      markerLabel: "你的座位标注点，拖动可调整",
      undo: "撤销",
      confirm: "确认位置 →",
      fullscreen: "全屏标点",
      exitFullscreen: "退出全屏",
      summary: "{label} · {x}% / {y}%",
    },
    step2: {
      title: "2. 视角照片",
      dropzone: "点击选择或拖入照片",
      note: "长边将压到 1920px，转 WebP，去 EXIF",
      progress: "压缩中... {percent}%",
      failed: "这张图过大了，挑一张小于 10MB 的试试",
      retry: "换一张",
      summary: "photo.webp · {size}",
    },
    step3: {
      title: "3. 元数据",
      seatLabel: "座位号",
      seatPlaceholder: "例: 1F E-23",
      seatRequired: "座位号是必填的。",
      performanceDate: "演出日期 任意",
      datePlaceholder: "YYYY-MM-DD",
      dateClear: "清除",
      eventName: "活动名 任意",
      description: "描述 任意",
      descriptionCount: "{n} / {max}",
      next: "下一步 →",
    },
    step4: {
      title: "4. 版权同意",
      consent:
        "我确认拥有此照片的版权，并同意以 {license} 协议分享给本站及其他用户参考。我已遮蔽他人面部 / 不当个人信息。",
      license: "CC BY-NC 4.0 ↗",
    },
    step5: {
      title: "5. 验证与提交",
      turnstileNote: "为什么要做这个验证？防止机器人滥用上传通道。",
      limitNote: "为什么有上传次数限制？每个 IP 每天 10 张，避免单人刷屏。",
      submit: "＋ 上传",
      submitting: "上传中...",
      retrying: "重试中... ({n}/{total})",
      networkError: "网络似乎不稳，再试一次？",
      tryAgain: "重试",
      turnstileError: "验证没通过，请重试一次。",
      limitDaily: "你今天已经上传 10 张了。明天再来。",
      limitCooldown: "刚上传过一张，等几秒再上传下一张。",
      serverError: "上传出了点问题，稍后再试。",
    },
    confirmClose: {
      body: "关闭会丢失你刚标好的位置和照片。",
      discard: "真的关闭",
      keep: "继续填写",
    },
    success: {
      title: "你的视角已添加到这本图鉴",
      body: "现在它出现在这一层的瀑布流最前面，其他粉丝就能看到。",
      again: "再传一张",
      back: "回到场馆",
    },
  },
  grid: {
    emptyBody: "这一层还没有粉丝分享视角。",
    emptyCta: "要做第一个吗？",
    end: "以上是这一层目前的全部分享。",
    imageError: "图片暂时无法显示",
    loading: "正在加载视角…",
    cardLabel: "查看 {label} 的座位视角",
    imageAlt: "{label} 的座位视角",
  },
  lightbox: {
    close: "关闭预览",
    prev: "上一张",
    next: "下一张",
    openDetails: "展开座位详情",
    expand: "展开全文",
    collapse: "收起",
    uploadedAt: "上传于",
    imageError: "这张照片暂时打不开",
    imageAlt: "{label} {date} {event} 的视角",
    position: "{n} / {total}",
  },
  footer: {
    contribute: "想贡献新场馆？通过 GitHub 提交",
    about: "关于",
    privacy: "隐私政策",
    terms: "服务条款",
    copyright: "© SeatView · 真实视角图集",
    navLabel: "页脚",
  },
  legal: {
    privacyTitle: "隐私政策",
    privacyIntro:
      "SeatView 是一本由粉丝共建的真实座席视角图鉴。我们尽量少收集数据，下面说明我们如何处理你的信息。",
    privacySections: [
      {
        heading: "投稿与图片",
        body: "你上传的座席视角照片会公开展示，并以 CC-BY-NC 4.0 授权他人非商业转载。请勿上传含人脸、票面二维码、身份信息等可识别个人的画面。",
      },
      {
        heading: "我们收集的数据",
        body: "浏览本站无需账号。我们不使用第三方分析或广告追踪，也不构建用户画像。",
      },
      {
        heading: "IP 与防滥用",
        body: "为限流与投票去重，我们会对你的 IP 地址加盐哈希后短期保存，不保存明文 IP，也无法据此还原你的身份。",
      },
      {
        heading: "人机校验",
        body: "投稿与附议时使用 Cloudflare Turnstile 进行人机校验，这一环节受 Cloudflare 隐私政策约束。",
      },
      {
        heading: "本地存储",
        body: "我们仅在你的浏览器本地保存少量偏好（深浅色主题、上次浏览的场馆、目录展开状态）。这些数据只留在你的设备上，不会发送给我们。",
      },
    ],
    termsTitle: "服务条款",
    termsIntro:
      "使用 SeatView 即表示你同意以下条款。我们尽量把规则写得简单直白。",
    termsSections: [
      {
        heading: "内容性质",
        body: "站内座席视角均为投稿者的个人记录，实际视野因座位、设备、场次与身高而异。内容仅供参考，我们不保证其准确、完整或适用于你的观演判断。",
      },
      {
        heading: "投稿规则",
        body: "请只上传你本人拍摄、且有权公开分享的照片，不得包含侵权、违法或侵犯他人隐私的内容。投稿即表示你同意以 CC-BY-NC 4.0（署名·非商业）授权公开。",
      },
      {
        heading: "内容治理",
        body: "我们可在不事先通知的情况下，移除不当、违规或涉及投诉的投稿。",
      },
      {
        heading: "免责声明",
        body: "本服务按「现状」提供，不保证持续可用或无错误。因使用或无法使用本站而产生的任何损失，我们不承担责任。",
      },
    ],
    updated: "最后更新：{date}",
    feedback: "如有疑问或更正请求，欢迎通过 {github} 反馈。",
    feedbackLink: "GitHub 仓库",
  },
  home: {
    subtitle: "真实视角图集",
    heroLine: "抢票前的最后 30 秒，先看一眼那个座位真正能看到的。",
    cta: "打开图鉴",
    howTitle: "怎么用",
    howTitleAlt: "使い方",
    step1Title: "找场馆",
    step1Body: "从左侧场馆树或搜索框挑场馆。",
    step2Title: "看视角",
    step2Body: "点击坐席图上的标注点，看那个座位实拍的现场。",
    step3Title: "上传",
    step3Body: "拍下你自己的座位视角，照同样的方式标在坐席图上分享。",
    recommendTitle: "推荐先看",
    recommendTitleAlt: "おすすめ",
    venue1Note: "多层环绕，4 个 sub-map 共 100+ 张视角",
    venue2Note: "8000 席，最佳观演视角的争议地",
    uploadTitle: "关于上传",
    uploadTitleAlt: "投稿について",
    rule1: "必须是你本人拍摄的照片。",
    rule2: "请遮蔽他人面部和可识别个人信息。",
    rule3: "内容以 {license} 协议分享",
    license: "CC BY-NC 4.0 ↗",
    limitNote: "一天每人最多上传 10 张。这样能让所有人看到的内容质量保持稳定。",
  },
  staging: {
    pageTitle: "想看的场馆",
    promptTitle: "想看的场馆还没有收录？",
    promptTitleAlt: "見たい会場がまだ無い？",
    inputPlaceholder: "输入场馆名，例「さいたまスーパーアリーナ」",
    inputLabel: "场馆名",
    submit: "提交",
    submitting: "提交中…",
    transparency:
      "只要告诉我们场馆名就够了。坐席图和资料由维护者通过 GitHub 整理后加入。",
    turnstileNote: "这一步是为了防止机器人批量提交。",
    limitNote: "每人每天最多提交 5 个，避免重复刷屏。",
    matchRegionLabel: "相似场馆提示",
    matchCollectedTitle: "这些场馆可能已经收录了",
    matchView: "去看看",
    matchStagedTitle: "已经有人想看了",
    listTitle: "大家想看的",
    listTitleAlt: "みんなのリクエスト",
    processed: "已收录",
    votes: "{count} 人想看",
    plusOne: "我也想看",
    plusOneDone: "已附议",
    plusOneLabel: "我也想看「{name}」",
    plusOneLimit: "你今天已经为 5 个场馆 +1 了。明天再来。",
    plusOneError: "+1 没成功，再试一次？",
    emptyBody: "还没有人写下想看的场馆。第一个，由你来。",
    success: "收到了。已经记在名录最前面。",
    emptyName: "写下场馆名再提交。",
    submitError: "没提交成功，再试一次？",
    limitDaily: "你今天已经提交 5 个了。明天再来。",
    turnstileError: "验证没通过，刷新后再试。",
    loadError: "名录暂时加载不出来。",
    end: "以上是目前的全部提交。",
    githubChannel: "能做更多？你也可以自己通过 GitHub 添加坐席图和资料",
  },
  error: {
    notFoundTitle: "这一页找不到了",
    notFoundBody: "链接可能失效了，或者地址打错了。",
    genericTitle: "这一页出了点问题",
    genericBody: "不是你的问题。稍后再打开看看。",
    backHome: "打开图鉴",
    backLastVenue: "回到上次看的场馆",
  },
  loadFailure: {
    title: "现在加载不出来。",
    body: "连接恢复后再试一次。",
    retry: "重试",
    retrying: "重试中…",
  },
  admin: {
    title: "维护后台",
    signedInAs: "已登录：{email}",
    photosTab: "上传图片",
    stagingTab: "暂存区",
    showDeleted: "包含已删除",
    photosEmpty: "还没有上传图片。",
    stagingEmpty: "暂存区还没有提交。",
    end: "已经到底了。",
    deletedBadge: "已删除",
    deletePhoto: "删除",
    confirmDeletePhoto: "删除后图片会从所有页面消失，且无法恢复。",
    confirmYes: "确认删除",
    confirmNo: "取消",
    markProcessed: "标记已收录",
    markUnprocessed: "撤销收录",
    deleteStaging: "删除",
    confirmDeleteStaging: "删除这条提交？无法恢复。",
    processed: "已收录",
    thumbAlt: "{label} 的上传图片",
    actionError: "操作没成功，再试一次。",
    unauthorized: "需要维护者权限。",
    working: "处理中…",
  },
};

export default zh;
