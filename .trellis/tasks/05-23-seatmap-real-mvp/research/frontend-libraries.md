# SeatMap-Real 前端关键库选型

- **Query**: Frontend library selection for SeatMap-Real (image compression, lightbox, masonry layout, zoom/pan)
- **Scope**: External search (npm, GitHub, comparative analysis)
- **Date**: 2026-05-23

## A. 客户端图片压缩与处理

### 候选库对比

| 库名 | Bundle (gzipped) | WebP支持 | EXIF处理 | 移动端 | 维护活跃度 | Tree-shaking | 备注 |
|---|---|---|---|---|---|---|---|
| **browser-image-compression** | ~40 KB | ✅ (含fallback) | ✅ (remove/preserve) | ✅ | 活跃 (2025+) | 部分 | Web Worker内置,质量二分查找 |
| **compressorjs** | ~12 KB | ✅ | ✅ | ✅ | 中等 (最后更新4年前) | ✅ | 主线程only,较小体积 |
| **pica** | ~13 KB | ✅ | ❌ | ✅ | 低 (最后更新3年前) | 部分 | 高质量resize,WebWorker/WASM自动选择 |
| **magic-webp** | ~795 KB | ✅ (WASM libwebp) | ✅ | ✅ | 活跃 (2026+) | ❌ | 纯WebP转换,WASM性能 |
| **use-squoosh** | ~10-15 KB + CDN加载 | ✅ | ❌ | ✅ | 中等 (2026+) | ✅ | Codecs按需加载CDN,零依赖 |
| **@miconvert/browser-image-compression** | ~50 KB | ✅ | ✅ | ✅ | 活跃 (2026+) | 部分 | 目标文件大小压缩,水印支持 |
| **@fawadhs/image-tools** | 1.7 MB | ✅ | ✅ | ✅ | 活跃 (2026+) | ❌ | 完整编辑组件,仅需压缩则过重 |

### 推荐: **browser-image-compression**

**理由**:
- Web Worker内置,主线程不阻塞
- 精确的文件大小目标 (`maxSizeMB: 0.5`)
- EXIF自动修正 (iPhone照片旋转)
- WebP fallback (使用uzip)
- 活跃维护,Promise API现代
- 已在生产应用验证 (compressimg.pro)
- 动态导入: `import()` 可减小初始包体积

**示例配置**:

```typescript
import imageCompression from 'browser-image-compression';

export async function compressUploadImage(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,              // 目标 500 KB
    maxWidthOrHeight: 1920,      // 长边限制
    useWebWorker: true,          // 后台线程
    fileType: 'image/webp',      // 转WebP
    preserveExif: false,         // 去除EXIF隐私
  });
  return compressed;
}
```

**备用方案**: 若需极简体积,可选 **compressorjs** (~12 KB);若需高质量resize可组合 **pica**。

---

## B. Lightbox 库

### 候选库对比

| 库名 | Bundle (gzipped) | 自定义caption | 移动手势 | 键盘支持 | SSR/Astro | 维护活跃度 | 周下载 |
|---|---|---|---|---|---|---|---|
| **yet-another-react-lightbox** | ~25-30 KB | ✅ (插件) | ✅ 优秀 | ✅ | ✅ | 活跃 (3.32.0 May 2026) | 427K |
| **yet-another-react-lightbox-lite** | ~5 KB | ✅ 基础 | ✅ | ✅ | ✅ | 活跃 (1.12.0 May 2026) | 3.6K |
| **lightgallery** | ~30-40 KB | ✅ 强大 | ✅ | ✅ | 需包装 | 活跃 (2.9.0) | 高 |
| **react-bnb-gallery** | ~50-60 KB | ✅ (caption/subcaption) | ✅ | ✅ | 中等 | 活跃 (2.2.1 Mar 2026) | 低 |
| **react-image-lightbox** | ~80 KB | ✅ | 基础 | ✅ | ❌ | 低 (5年未更新) | 中等 |

### 推荐: **yet-another-react-lightbox** (v3+)

**理由**:
- 现代React架构 (Hooks/函数组件)
- 可选插件系统 (缩减默认体积)
- 响应式图片支持 (`srcset`/`sizes`)
- 虚拟滚动 (大相册性能优秀)
- 键盘导航完整 (ESC关闭,方向键切换)
- Touch手势友好 (pinch缩放可选)
- 强社区 (1.2K+ stars vs 竞品)
- 最新版本积极维护

**示例集成**:

```typescript
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export function SeatImageGallery({ images }) {
  const [open, setOpen] = React.useState(false);
  
  return (
    <>
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={images.map(img => ({
          src: img.url,
          alt: `${img.seatNo} - ${img.eventName}`,
          title: `座位 ${img.seatNo}`,
          description: `${img.date} / ${img.activityName}`,
        }))}
        // 可选插件
        plugins={[Zoom, Download, Slideshow]}
      />
    </>
  );
}
```

**备用 (极简)**: **yet-another-react-lightbox-lite** (~5 KB) 若只需基础图片浏览不需zoom。

---

## C. 砌体布局 (Masonry)

### 候选库对比

| 库名 | Bundle | 虚拟化 | 无限滚动 | SSR/Astro | 性能 | 维护活跃度 | 周下载 |
|---|---|---|---|---|---|---|---|
| **react-photo-album** | ~15-20 KB | ❌ | ❌ | ✅ (SSR支持) | 优秀 (flexbox) | 活跃 (3.6.0 Apr 2026) | 62.5K |
| **masonic** | ~11.6 KB | ✅ | ✅ (hook) | 中等 | 非常优秀 (红黑树) | 中等 (4年前) | 76.1K |
| **react-masonry-css** | ~3 KB | ❌ | ❌ | ✅ | 良好 | 低 (5年未更新) | 1K |
| **dream-masonry** | ~13 KB | ✅ | ✅ (内置) | 中等 | 优秀 (Float64Array) | 新 (2026) | 低 |
| CSS `column-count` | 0 KB | N/A | ❌ | ✅ | 良好 | 原生 | N/A |

### 推荐: **react-photo-album**

**理由**:
- 完美的Astro组件兼容性 (SSR就绪)
- 零外部依赖 (仅React/React-DOM)
- 现代CSS flexbox/calc实现 (无重JS)
- 自动响应式 (rows/columns/masonry三种布局)
- 原生 `srcset`/`sizes` 支持 (Lighthouse友好)
- Lighthouse 80+ 一致性强
- TypeScript完全支持
- 10.8 KB压缩后

**Astro集成 (client:visible)**:

```astro
---
import PhotoAlbum from 'react-photo-album';
import 'react-photo-album/rows.css';

const photos = await fetchVenuePhotos();
---

<PhotoAlbum
  layout="masonry"
  photos={photos}
  responsive={[
    { breakpoint: 768, cols: 1 },
    { breakpoint: 1024, cols: 2 },
    { breakpoint: Infinity, cols: 3 },
  ]}
  client:visible
/>
```

**大列表备选 (10,000+ items)**: **masonic** (虚拟化红黑树算法),但SSR支持不如react-photo-album。

---

## D. 坐中图片缩放/平移 + 标注点堆叠

### 候选库对比

| 库名 | Bundle (gzipped) | API易用性 | 编程触发zoomTo | 移动手势 | 性能 | 维护活跃度 |
|---|---|---|---|---|---|---|
| **react-zoom-pan-pinch** | ~13.2 KB | ⭐⭐⭐⭐ | ✅ (context hook) | ✅ 优秀 | 良好 | 活跃 (4.0.3 Apr 2026) |
| **use-zoom-pinch** | ~5.2 KB | ⭐⭐⭐⭐ | ✅ (zoomTo/panTo) | ✅ | 优秀 | 新 (2026) |
| **@zoompinch/react** | ~4 KB | ⭐⭐⭐ | ✅ | ✅ | 优秀 | 新 (v0.17 Apr 2026) |
| **panzoom** (Vanilla) | ~7 KB | ⭐⭐⭐ | ✅ | ✅ | 优秀 | 中等 |
| **use-zoom-pan** | ~5 KB | ⭐⭐⭐⭐ | ✅ | ✅ | 优秀 | 新 (2026) |
| 自写 + Pointer Events | 0 KB | ⭐⭐ | ✅ | ⚠️ 需调试 | 可靠 | 维护成本高 |

### 推荐: **react-zoom-pan-pinch** (v4.0+)

**理由**:
- 编程API最灵活: `useControls()` hook获取 `zoomTo(x, y, scale)`
- 2-div包装器 (TransformWrapper + TransformComponent)
- 触摸手势完整 (pinch缩放,swipe平移)
- 坐标系统清晰 (屏幕坐标↔图像坐标转换)
- 1.8K+ stars,60+贡献者,活跃维护
- TypeScript支持
- 可编程触发特定座位缩放

**编程实现标注点交互**:

```typescript
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';

function SeatmapViewer({ image, annotations }) {
  const [scale, setScale] = React.useState(1);
  
  return (
    <TransformWrapper onTransformChange={(ref) => setScale(ref.state.scale)}>
      <TransformComponent>
        <img src={image} alt="Seatmap" />
        {/* 标注点 - 位置用百分比存储,随缩放变换 */}
        {annotations.map(ann => (
          <div
            key={ann.id}
            style={{
              position: 'absolute',
              left: `${ann.x}%`,
              top: `${ann.y}%`,
              transform: `translate(-50%, -50%) scale(${1 / scale})`, // 缩放时保持大小
            }}
            onClick={() => handleAnnotationClick(ann)}
          >
            <AnnotationBubble count={ann.seatCount} />
          </div>
        ))}
      </TransformComponent>
      
      <ControlBar />
    </TransformWrapper>
  );
}

function ControlBar() {
  const { zoomIn, zoomOut, resetTransform, zoomTo } = useControls();
  
  // 从聚合点列表点击到指定座位的编程缩放
  const focusOnAnnotation = (ann: Annotation) => {
    // 缩放至中心点 + 2x
    zoomTo(ann.x, ann.y, 2);
  };
  
  return (
    <div className="controls">
      <button onClick={() => zoomIn()}>+</button>
      <button onClick={() => zoomOut()}>−</button>
      <button onClick={() => resetTransform()}>↺</button>
    </div>
  );
}
```

**关键优势**:
- `zoomTo(screenX, screenY, scale)` 可直接触发聚合点平移+放大
- 缩放层级动态调整气泡尺寸 (防止遮挡)
- 支持移动端双指pinch缩放 + 单指drag平移
- Context API开放,便于添加自定义UI

**备选 (极简)**:
- **use-zoom-pinch** (~5.2 KB) 若只需hook而不需component包装
- **自写 + Pointer Events** 若需精确控制标注点交互逻辑,但需测试移动端兼容

---

## 集成风险与建议

### Astro Island Hydration 策略

| 功能 | 推荐策略 | 理由 |
|---|---|---|
| 坐中图片(Task D) | `client:load` | 需即时交互(图片标注点),不能延迟 |
| Lightbox(Task B) | `client:visible` | 点击才打开,可延迟水合 |
| 砌体布局(Task C) | `client:idle` | 仅滚动时加载,可空闲水合 |
| 图片压缩(Task A) | 纯JS模块 | 不需hydration,上传时动态导入 |

### 移动端视口处理

- **坐中图片**: 需禁用原生pinch-zoom,使用库接管
  ```css
  touch-action: none; /* TransformComponent容器 */
  ```
- **砌体布局**: 响应式列数 (移动1列,平板2列,桌面3-4列) via `responsive` prop
- **Lightbox**: 自动竖屏全屏,手势导航

### 触摸手势冲突处理

- **坐中图片 + 图片内标注点**: 手指在气泡上点击触发详情;在空白处拖拽缩放
  - 解决: 为气泡加 `pointer-events: auto`,外围 `touch-action: none`
- **双指缩放 vs 单指拖拽**: react-zoom-pan-pinch自动区分,无需手动

### 性能检查点

- Lighthouse 80+ 保持:
  - Task A: Web Worker防止主线程阻塞
  - Task B: Lightbox插件按需加载
  - Task C: react-photo-album SSR友好(初始渲染无JS)
  - Task D: 标注点数量>100时考虑虚拟化

---

## 最终选型总结

| 功能 | 选择 | 原因 | 体积 |
|---|---|---|---|
| **A. 客户端压缩** | `browser-image-compression` | Web Worker + 质量二分查找 + EXIF处理 | ~40 KB |
| **B. Lightbox** | `yet-another-react-lightbox` (v3+) | 现代,插件化,SSR兼容 | ~25-30 KB |
| **C. 砌体** | `react-photo-album` | 零依赖,SSR,Lighthouse友好 | ~15-20 KB |
| **D. 坐中缩放** | `react-zoom-pan-pinch` (v4+) | 编程API,手势完整,坐标清晰 | ~13.2 KB |
| **总额** | - | 无重叠依赖 | ~93.5 KB |

**Astro hydration 配置建议**:
```astro
<!-- 压缩: 上传时动态import,无hydration -->
<ImageUpload client:load />

<!-- Lightbox: 交互触发 -->
<GalleryLightbox client:visible />

<!-- 砌体: 空闲加载 -->
<MasonryLayout client:idle />

<!-- 坐中: 即时交互 -->
<SeatmapViewer client:load />
```

---

## 不含的选项及原因

- ❌ **compressorjs**: 主线程only,不适合大文件
- ❌ **magic-webp**: 795 KB仅作WebP转换,非必需
- ❌ **lightgallery vanilla**: 需额外包装React,不如官方
- ❌ **masonic**: 缺SSR支持,不适Astro优先
- ❌ **react-masonry-css**: 5年未更新,风险
- ❌ **自写Pointer Events**: 维护成本>收益,坐标转换易出bug
