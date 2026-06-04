# Image Studio Demo

一个本地运行的 AI 图像创作空间 Demo，支持 Visionary 中转站的 `gpt-image-2` 和 `nano-banana-pro`。

## 功能

- 文生图和参考图图生图
- 最多上传 9 张参考图
- 生成结果自动下载到本地
- SQLite 历史作品库
- 作品预览、下载、删除、复用参数
- API Key 只在服务端读取

## 启动

先创建本地环境变量文件：

```bash
copy .env.local.example .env.local
```

然后在 `.env.local` 里填入：

```env
VISIONARY_API_BASE_URL="https://visionary.beer"
VISIONARY_API_KEY="你的 API Key"
```

安装依赖并初始化数据库：

```bash
npm install
npx prisma db push
```

启动开发服务器：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:3000
```

## 本地文件

- 生成图：`public/generated/YYYY/MM/DD/`
- 参考图：`public/references/YYYY/MM/DD/`
- 数据库：`prisma/dev.db`

## 便携运行

项目可以直接复制到移动硬盘。双击运行：

```text
start-portable.bat
```

停止本地服务：

```text
stop-portable.bat
```

如果移动硬盘换盘符后需要修正旧数据路径，可以运行：

```bash
node scripts/migrate-portable-paths.mjs
```

## 验证

```bash
npm run lint
npm run build
```
