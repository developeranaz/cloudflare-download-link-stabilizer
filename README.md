# ⚡ Cloudflare Download Link Stabilizer

Transform slow and unstable download links into high-speed, reliable connections using Cloudflare Workers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/developeranaz/cloudflare-download-link-stabilizer)](https://github.com/developeranaz/cloudflare-download-link-stabilizer/stargazers)

## 🎯 What This Does

Got a slow, unreliable download link? This Cloudflare Worker acts as a smart proxy that:
- ⚡ **Speeds up** slow downloads using Cloudflare's global network
- 🔄 **Retries** failed connections automatically 
- 📁 **Preserves** original filenames
- 🌐 **Supports** multithreaded downloads and download managers

## 🚀 Setup (2 minutes)

### Step 1: Create Cloudflare Account
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up (free)
2. Navigate to **Workers & Pages** → **Create Worker**
3. Give your worker a name (e.g., `download-stabilizer`)

### Step 2: Copy the Code
1. Copy the code from [`src/worker.js`](src/worker.js) in this repository
2. Paste it into the Cloudflare Worker editor
3. Click **Save and Deploy**

That's it! Your stabilizer is now live at `https://your-worker-name.your-subdomain.workers.dev`

## 📖 How to Use

### Method 1: Web Interface
1. Visit your worker URL
2. Paste your slow/unreliable download link
3. Click "Stabilize Download Link" 
4. Use the generated URL for fast, stable downloads

### Method 2: Direct URL
Replace `YOUR_WORKER_URL` with your actual worker URL:
```
https://YOUR_WORKER_URL/https%3A//slow-server.com/file.mp4
```

**Quick conversion:**
- Original: `https://example.com/slow-file.zip`
- Stabilized: `https://YOUR_WORKER_URL/https%3A//example.com/slow-file.zip`

## ✨ Features

- 🚀 **Speed Boost**: Uses Cloudflare's global CDN
- 🔄 **Auto Retry**: Automatically retries failed downloads
- 📁 **Filename Preservation**: Keeps original file names
- 🌐 **Download Manager Support**: Works with IDM, aria2, wget, etc.
- 🎨 **Clean Interface**: Easy-to-use web interface

## 🤝 Contributing

Found a bug or want to improve something? 
1. Fork this repo
2. Make your changes
3. Submit a pull request

## 📝 License

MIT License - feel free to use and modify!

---

⭐ **Star this repo if it helped you!**

Made by [@developeranaz](https://github.com/developeranaz)
