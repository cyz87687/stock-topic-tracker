# 题材轮动追踪系统 - 部署说明

## 系统概述

A股市场每日题材轮动追踪与分析工具，帮助投资者快速把握市场热点、识别题材强弱、发现轮动规律。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + ECharts |
| 后端 | Python 3.9+ + FastAPI + SQLAlchemy + SQLite |
| 图表 | ECharts (折线图/柱状图/力导向图/热力图) |
| 状态管理 | Zustand (含 localStorage 持久化) |

## 项目结构

```
stock-topic-tracker/
├── backend/                    # FastAPI 后端
│   ├── main.py                 # 应用入口 (启动服务)
│   ├── database.py             # 数据库连接配置
│   ├── models.py               # SQLAlchemy 数据模型
│   ├── schemas.py              # Pydantic 数据校验
│   ├── data_service.py         # 东方财富实时数据服务
│   ├── requirements.txt        # Python 依赖
│   └── app/routers/            # API 路由
│       ├── topics.py           # 题材排行/详情/收藏/连板榜
│       ├── trends.py           # 趋势数据/百分制强度评分
│       ├── rotation.py         # 轮动分析/关系图/预测(含缓存)
│       └── market.py           # 大盘概览/热力图
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── api/                # API 请求封装
│   │   ├── components/         # 可复用组件
│   │   ├── pages/              # 页面组件
│   │   ├── store/              # Zustand 状态管理
│   │   ├── types/              # TypeScript 类型定义
│   │   └── utils/              # 工具函数
│   └── ...配置文件
├── nginx.conf                  # Nginx 反向代理配置
├── start_lan.bat               # 一键局域网部署（生产模式）
├── start_dev_lan.bat           # 一键局域网部署（开发模式）
├── setup_firewall.bat          # 防火墙端口配置脚本
└── DEPLOY.md                   # 本文档
```

## 快速启动

### 1. 环境要求

- Python 3.9+
- Node.js 18+
- npm

### 2. 启动后端

```bash
cd stock-topic-tracker/backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

后端运行在 http://localhost:8000

### 3. 启动前端

```bash
cd stock-topic-tracker/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端运行在 http://localhost:5173

### 4. 访问应用

浏览器打开前端地址即可使用。

---

## 局域网部署指南

### 方案一：一键部署（推荐）

#### 开发模式
双击 `start_dev_lan.bat`，自动启动前后端服务并显示局域网访问地址。

#### 生产模式
双击 `start_lan.bat`，自动构建前端并启动后端（含前端静态文件托管）。

### 方案二：手动配置

#### 步骤1：配置防火墙

**方法A：使用脚本（推荐）**
右键 `setup_firewall.bat` → 以管理员身份运行，自动放行 8000、5173、80 端口。

**方法B：手动配置**
1. 打开 Windows 防火墙 → 高级设置 → 入站规则 → 新建规则
2. 选择"端口" → TCP → 特定本地端口：`8000, 5173`
3. 允许连接 → 完成

**方法C：命令行（需管理员权限）**
```powershell
netsh advfirewall firewall add rule name="A股题材追踪-8000" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="A股题材追踪-5173" dir=in action=allow protocol=TCP localport=5173
```

#### 步骤2：获取本机局域网IP

```powershell
ipconfig | findstr "IPv4"
```

通常格式为 `192.168.x.x` 或 `10.x.x.x`

#### 步骤3：启动服务

**开发模式（前后端分离）**
```bash
# 终端1：启动后端
cd backend
python main.py

# 终端2：启动前端（局域网模式）
cd frontend
npm run dev:lan
```

**生产模式（一体化部署）**
```bash
# 构建前端
cd frontend
npm run build

# 启动后端（生产模式，自动托管前端静态文件）
cd ../backend
set PRODUCTION=1
python main.py
```

生产模式下，后端同时托管前端静态文件和API，只需开放 8000 端口。

#### 步骤4：局域网访问

| 模式 | 访问地址 |
|------|----------|
| 开发模式-前端 | `http://<局域网IP>:5173` |
| 开发模式-后端 | `http://<局域网IP>:8000` |
| 生产模式 | `http://<局域网IP>:8000` |

### 方案三：Nginx 反向代理部署（高级）

适用于需要更专业部署的场景，Nginx 处理静态文件和负载均衡。

#### 1. 安装 Nginx
- Windows: 下载 http://nginx.org/en/download.html
- Linux: `sudo apt install nginx`

#### 2. 构建前端
```bash
cd frontend
npm run build
```

#### 3. 复制前端文件到 Nginx 目录
```bash
# Windows
xcopy /E /Y frontend\dist\* C:\nginx\html\

# Linux
cp -r frontend/dist/* /usr/share/nginx/html/
```

#### 4. 配置 Nginx

使用项目根目录的 `nginx.conf`：
```bash
# Windows
copy nginx.conf C:\nginx\conf\nginx.conf

# Linux
sudo cp nginx.conf /etc/nginx/sites-available/stock-tracker
sudo ln -s /etc/nginx/sites-available/stock-tracker /etc/nginx/sites-enabled/
```

#### 5. 启动服务
```bash
# 启动后端
cd backend
set PRODUCTION=0
python main.py

# 启动 Nginx
# Windows: C:\nginx\nginx.exe
# Linux: sudo systemctl start nginx
```

#### 6. 访问
```
http://<局域网IP>    (默认80端口)
```

---

## 性能优化措施

### 后端优化

| 优化项 | 配置 | 说明 |
|--------|------|------|
| 数据库连接池 | pool_size=20, max_overflow=10 | 支持10+并发连接 |
| 跨线程访问 | check_same_thread=False | SQLite多线程安全 |
| 连接健康检查 | pool_pre_ping=True | 自动检测断开连接 |
| 连接回收 | pool_recycle=3600 | 1小时回收避免泄漏 |
| 响应时间头 | X-Process-Time | 便于性能监控 |
| 轮动分析缓存 | TTL=4小时 | 缓存命中<1秒 |

### 前端优化

| 优化项 | 配置 | 说明 |
|--------|------|------|
| 代码分割 | echarts/react独立chunk | 按需加载减少首屏时间 |
| Gzip压缩 | nginx gzip on | 减少70%传输体积 |
| 静态资源缓存 | expires 7d | 减少重复请求 |
| API相对路径 | /api | 自动走代理无需硬编码IP |

### 并发性能参考

| 并发用户数 | 预期响应时间 | 说明 |
|-----------|-------------|------|
| 1-3人 | <500ms | 缓存命中时<100ms |
| 4-7人 | <1s | 数据库连接池充足 |
| 8-10人 | <2s | 高峰期可能触发缓存重建 |

---

## 网络安全建议

### 局域网安全

1. **不要将服务暴露到公网** - 仅在可信局域网内使用
2. **定期更换WiFi密码** - 防止未授权设备接入
3. **启用路由器防火墙** - 阻止外网访问内部端口

### 数据传输安全

如需加密传输，可配置 HTTPS：

#### 自签名证书（快速）
```bash
# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem

# 后端启用HTTPS
uvicorn main:app --host 0.0.0.0 --port 443 \
  --ssl-keyfile=key.pem --ssl-certfile=cert.pem
```

#### Nginx HTTPS 配置
在 nginx.conf 的 server 块中添加：
```nginx
listen 443 ssl;
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

---

## 故障排查

### 局域网无法访问

1. **检查防火墙** - 运行 `setup_firewall.bat` 或手动放行端口
2. **检查IP地址** - 确认使用正确的局域网IP（非127.0.0.1）
3. **检查网络发现** - Windows设置 → 网络 → 启用网络发现
4. **ping测试** - 从其他设备 `ping <服务器IP>` 确认网络连通
5. **检查服务状态** - 确认后端/前端服务正在运行

### 端口被占用

```powershell
# 查看端口占用
netstat -ano | findstr :8000
netstat -ano | findstr :5173

# 结束占用进程
taskkill /PID <进程ID> /F
```

### 数据库锁定

SQLite在多并发写入时可能出现锁定，解决方案：
- 读取操作不受影响（连接池已优化）
- 写入操作已有异步锁保护
- 如仍有问题，可考虑升级到 PostgreSQL

---

## API 接口文档

后端启动后访问 http://localhost:8000/docs 查看完整的 Swagger API 文档。

### 核心接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/topics/daily` | GET | 每日题材排行 |
| `/api/topics/limit-board` | GET | 连板榜 |
| `/api/topics/{name}` | GET | 题材详情 |
| `/api/topics/{name}/stocks` | GET | 题材成分股 |
| `/api/trends/{name}` | GET | 题材趋势数据 |
| `/api/trends/{name}/strength` | GET | 题材百分制强度评分 |
| `/api/rotation/analysis` | GET | 轮动分析 |
| `/api/rotation/relation-graph` | GET | 题材关联图谱 |
| `/api/rotation/history-match` | GET | 历史相似行情 |
| `/api/rotation/predict` | GET | 明日热点预测 |
| `/api/rotation/cache-status` | GET | 缓存状态查询 |
| `/api/market/overview` | GET | 大盘概览 |
| `/api/market/heatmap` | GET | 30天热力图 |
| `/api/refresh` | POST | 手动刷新数据（清除缓存） |

## 数据说明

系统使用东方财富实时接口获取数据：
- 概念板块排行（实时涨跌幅、资金流向）
- 上证指数/创业板指（实时行情）
- 30天K线历史数据
- 板块成分股明细
- 连板统计（连续涨停天数）
