# Linear Clone

复刻 Linear.app 深色界面风格的 React 演示应用:

- **My issues** — 按状态分组的 issue 列表(优先级图标、标签、负责人头像),右上角可切换 **看板视图**(卡片拖拽换列改状态)
- **Inbox** — 通知列表(未读圆点、事件摘要、Mark all read),点击跳转对应 issue
- **Projects** — 项目表格(进度条、健康状态、负责人、目标日期)
- **Issue 详情** — 标题/描述、Activity 活动时间线、右侧属性面板(状态/优先级/负责人/标签)
- **Diff 审查** — 文件 diff 卡片(行号、红删绿增高亮、语法着色)、Activity/Guide/Diff 标签页、右侧嵌入式 Agent 会话面板
- **AI Agent 面板** — 详情页右下角浮动窗口(可最小化/放大/关闭,输入消息有打字动画回复),diff 页右侧嵌入面板(工作状态折叠、引用提问、实时 Working 状态)

## 运行

```bash
npm install
npm run dev      # 开发模式,默认 http://localhost:5173
npm run build    # 生产构建
```

## 键盘快捷键

- `Cmd/Ctrl + K` — 命令面板(搜索 issue、导航、新建)
- `J` / `K`(或方向键)— 列表中上下移动选择,`Enter` 打开
- `C` — 新建 issue
- `Esc` — 关闭浮层 / 返回列表

其它交互:列表行可拖拽到其他分组改状态、同组内拖拽排序;详情页右侧属性(状态/优先级/负责人/标签)点击即改,全局生效。

## 技术栈

- React 19 + TypeScript + Vite
- 状态集中在 `src/store.ts`(useReducer),issue/通知/主题变更自动持久化到 localStorage(刷新不丢;存储不可用时自动降级为内存模式)。Cmd+K 里有 "Reset demo data" 可还原初始数据
- 深色/亮色双主题:侧边栏顶部日/月按钮或 Cmd+K 切换,选择会记住。全部颜色(含代码语法高亮)走 CSS 变量,亮色覆盖见 `global.css` 底部 `[data-theme='light']`
- 中/英双语 i18n(`src/i18n.tsx`,零依赖):侧边栏"中/EN"按钮或 Cmd+K 切换,选择持久化。词典 key 有 TypeScript 类型约束,漏译会在编译期报错;界面文案全部走 `t()`,mock 业务内容(issue 标题、评论)保持原文。加新语言只需在 `i18n.tsx` 里补一份词典
- 无第三方 UI 依赖:全部图标为内联 SVG,样式在 `src/styles/global.css`(CSS 变量定义了整套 Linear 深色主题 design tokens)
- 路由为零依赖 hash 路由(`src/router.ts`),支持浏览器前进/后退与深链:`#/inbox`、`#/issues`、`#/issues/board`、`#/issue/ENG-2703`、`#/review/ENG-2498`、`#/projects`。如需换成 react-router,只要替换 `useHashRoute` 一处即可

## 结构

```
src/
  App.tsx                 # 组装:store + 路由 + 快捷键
  store.ts                # useReducer store + localStorage 持久化
  router.ts               # 零依赖 hash 路由
  i18n.tsx                # 中/英词典 + useI18n hook
  data/mock.ts            # 全部 mock 数据(issue、活动流、diff 内容)
  styles/global.css       # 主题变量 + 全部样式
  components/
    Sidebar.tsx           # 左侧导航
    IssueList.tsx         # issue 列表页(选中态 + 拖拽 + list/board 切换)
    BoardView.tsx         # 看板视图(卡片拖拽)
    InboxView.tsx         # 通知收件箱
    ProjectsView.tsx      # 项目表格
    IssueDetail.tsx       # issue 详情 + 活动流 + 可编辑属性面板
    DiffView.tsx          # 代码 diff 审查视图
    CommandPalette.tsx    # Cmd+K 命令面板
    NewIssueModal.tsx     # 新建 issue 弹窗
    Dropdown.tsx          # 通用下拉菜单
    AgentPanel.tsx        # AI Agent 面板(浮动 + 嵌入两种形态)
    meta.tsx              # 状态/优先级/标签共享元数据
    Icons.tsx             # 内联 SVG 图标集
    Avatar.tsx            # 用户/机器人头像
```

修改配色只需调整 `global.css` 顶部的 `:root` 变量。
