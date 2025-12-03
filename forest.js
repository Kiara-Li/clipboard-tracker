document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("forestCanvas");
  const ctx = canvas.getContext("2d");
  
  // --- DOM 元素 ---
  const overlay = document.getElementById("detail-overlay");
  const overlayContent = document.getElementById("detail-content");
  const closeBtn = document.getElementById("close-btn");
  
  const btnCode = document.querySelector(".btn-code");
  const btnSocial = document.querySelector(".btn-social");
  const btnKnow = document.querySelector(".btn-know");
  const btnSource = document.getElementById("visit-source-btn");  
  const btnCopy = document.getElementById("copy-text-btn");

  // --- 新增：日期导航元素 ---
  const dateDisplay = document.getElementById("current-date-display");
  const btnPrevDay = document.getElementById("prev-day-btn");
  const btnNextDay = document.getElementById("next-day-btn");

  // --- 全局变量 ---
  let trees = []; 
  let hoveredTree = null; 
  let currentOpenTreeTimeId = -1; // 修改：使用时间戳作为唯一ID，而不是索引
  const GROUND_Y_OFFSET = 0.8; 

  // --- 数据管理变量 (新增) ---
  let groupedLogs = {}; // 存放分组后的数据: { "2023/10/27": [log1, log2], ... }
  let availableDates = []; // 存放所有日期的数组
  let currentViewIndex = 0; // 当前查看的是第几个日期

  // --- 初始化 ---
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawScene(); 
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // 加载数据
  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    processDataByDay(data.clipboardLog);
  });

  // --- 1. 核心逻辑：按天处理数据 ---

  function processDataByDay(allLogs) {
    if (!allLogs || allLogs.length === 0) {
      if(dateDisplay) dateDisplay.textContent = "No Data";
      return;
    }

    // 1. 分组: 按日期字符串作为 Key
    groupedLogs = {};
    allLogs.forEach(log => {
      // 获取本地日期字符串 (例如 "2023/10/27")
      const dateKey = new Date(log.time).toLocaleDateString(); 
      if (!groupedLogs[dateKey]) {
        groupedLogs[dateKey] = [];
      }
      groupedLogs[dateKey].push(log);
    });

    // 2. 获取所有日期并排序 (旧 -> 新)
    availableDates = Object.keys(groupedLogs).sort((a, b) => {
      return new Date(a) - new Date(b);
    });

    // 3. 默认显示最新的一天 (数组最后一个)
    currentViewIndex = availableDates.length - 1;
    
    // 4. 渲染当前日期
    renderCurrentDay();
  }

  function renderCurrentDay() {
    if (availableDates.length === 0) return;

    const dateKey = availableDates[currentViewIndex];
    let logsForDay = groupedLogs[dateKey];

    // --- 关键排序：最新的内容排在最前面 (最左边) ---
    // 按时间戳倒序排列 (大 -> 小)
    logsForDay = logsForDay.sort((a, b) => b.time - a.time);

    // 更新 UI 文字
    updateDateNavigationUI(dateKey);

    // 生成森林数据
    generateForestData(logsForDay);
    
    // 绘制
    drawScene();
  }

  function updateDateNavigationUI(dateStr) {
    if(dateDisplay) dateDisplay.textContent = dateStr;

    // 控制按钮禁用状态
    if(btnPrevDay) btnPrevDay.disabled = (currentViewIndex === 0);
    if(btnNextDay) btnNextDay.disabled = (currentViewIndex === availableDates.length - 1);
  }

  // --- 2. 交互：日期切换 ---

  if (btnPrevDay) {
    btnPrevDay.addEventListener("click", () => {
      if (currentViewIndex > 0) {
        currentViewIndex--;
        renderCurrentDay();
      }
    });
  }

  if (btnNextDay) {
    btnNextDay.addEventListener("click", () => {
      if (currentViewIndex < availableDates.length - 1) {
        currentViewIndex++;
        renderCurrentDay();
      }
    });
  }

  // --- 3. 森林生成与绘制 ---

  function generateForestData(logs) {
    trees = [];
    const groundY = canvas.height * GROUND_Y_OFFSET;
    let currentX = 50; // 起始位置 (左侧)
    const spacing = 60; // 间距

    logs.forEach((item) => {
      let h = Math.min(Math.max(item.text.length / 2, 40), 300);
      const type = item.manualType || getDomainType(item.domain);
      const path = createTreePath(currentX, groundY, h, type);

      trees.push({
        path: path,
        x: currentX,
        y: groundY,
        height: h,
        type: type,
        data: item,
        // 关键：使用 time 作为唯一标识符，因为 index 现在是乱的
        timeId: item.time 
      });

      currentX += spacing;
    });
  }

  function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 地平线
    const groundY = canvas.height * GROUND_Y_OFFSET;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 遍历画树
    trees.forEach(tree => {
      let color;
      if (tree.type === "CODE") color = "#4dabf7";
      else if (tree.type === "SOCIAL") color = "#ff6b6b";
      else color = "#ffe066";

      if (tree === hoveredTree) {
        ctx.fillStyle = lightenColor(color, 40);
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
      } else {
        ctx.fillStyle = color;
        ctx.shadowBlur = 0;
      }

      ctx.fill(tree.path);

      // Hover 文字特效
      if (tree === hoveredTree) {
        ctx.save();
        ctx.clip(tree.path);
        ctx.fillStyle = "#000";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        const snippet = tree.data.text.substring(0, 50);
        wrapText(ctx, snippet, tree.x, tree.y - tree.height + 20, 40, 12);
        ctx.restore();
      }
    });
  }

  // --- 4. 交互监听 (Canvas) ---

  // 鼠标移动
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let found = null;
    for (let i = trees.length - 1; i >= 0; i--) {
      if (ctx.isPointInPath(trees[i].path, mouseX, mouseY)) {
        found = trees[i];
        break;
      }
    }

    if (hoveredTree !== found) {
      hoveredTree = found;
      canvas.style.cursor = found ? "pointer" : "default";
      drawScene();
    }
  });

  // 点击
  canvas.addEventListener("click", () => {
    if (hoveredTree) {
      currentOpenTreeTimeId = hoveredTree.timeId; // 记录时间戳 ID
      showOverlay(hoveredTree);
    }
  });

  // --- 5. 浮层与按钮逻辑 ---
  
  if (closeBtn) closeBtn.addEventListener("click", hideOverlay);

  function showOverlay(tree) {
    overlayContent.textContent = tree.data.text;
    overlay.style.display = "block";
    updateTypeButtonsUI(tree.type);
    if(btnCopy) btnCopy.textContent = "📋 Copy";

    if (tree.data.url && btnSource) {
        btnSource.style.display = "inline-block";
        btnSource.onclick = () => window.open(tree.data.url, '_blank');
    } else if (btnSource) {
        btnSource.style.display = "none";
    }
  }

  function hideOverlay() {
    if(overlay) overlay.style.display = "none";
  }

  // 复制逻辑
  if (btnCopy) {
    btnCopy.onclick = () => {
      const text = overlayContent.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btnCopy.textContent;
        btnCopy.textContent = "✅ Copied!";
        setTimeout(() => { btnCopy.textContent = originalText; }, 2000);
      });
    };
  }

  // 修改类型逻辑 (使用 Time ID 查找)
  function changeTreeType(newType) {
    // 1. 找到当前内存中的树
    const targetTree = trees.find(t => t.timeId === currentOpenTreeTimeId);
    
    if (!targetTree || targetTree.type === newType) return;

    // 更新内存
    targetTree.type = newType;
    targetTree.path = createTreePath(targetTree.x, targetTree.y, targetTree.height, newType);
    updateTypeButtonsUI(newType);
    drawScene();

    // 2. 持久化回写到 Chrome Storage
    chrome.storage.local.get({ clipboardLog: [] }, (data) => {
      const logs = data.clipboardLog;
      // 找到对应时间戳的记录
      const logIndex = logs.findIndex(l => l.time === currentOpenTreeTimeId);
      
      if (logIndex !== -1) {
        logs[logIndex].manualType = newType;
        chrome.storage.local.set({ clipboardLog: logs });
        
        // 同时更新当前缓存 groupedLogs，避免翻页后丢失修改
        // 找到当前显示的日期 key
        const dateKey = availableDates[currentViewIndex];
        const logInCache = groupedLogs[dateKey].find(l => l.time === currentOpenTreeTimeId);
        if(logInCache) logInCache.manualType = newType;
      }
    });
  }
  
  // 绑定类型按钮
  if (btnCode) btnCode.onclick = () => changeTreeType("CODE");
  if (btnSocial) btnSocial.onclick = () => changeTreeType("SOCIAL");
  if (btnKnow) btnKnow.onclick = () => changeTreeType("KNOWLEDGE");

  // --- 通用辅助函数 ---

  function createTreePath(x, y, h, type) {
    const path = new Path2D();
    if (type === "CODE") {
      path.rect(x - 15, y - h, 30, h);
    } else if (type === "SOCIAL") {
      const r = h / 3;
      path.rect(x - 2, y - h + r, 4, h - r); 
      path.arc(x, y - h + r, r, 0, Math.PI * 2); 
    } else {
      path.moveTo(x - 20, y);
      path.lineTo(x + 20, y);
      path.lineTo(x, y - h);
      path.closePath();
    }
    return path;
  }

  function updateTypeButtonsUI(type) {
    if(btnCode) btnCode.classList.remove("active");
    if(btnSocial) btnSocial.classList.remove("active");
    if(btnKnow) btnKnow.classList.remove("active");
    if (type === "CODE" && btnCode) btnCode.classList.add("active");
    if (type === "SOCIAL" && btnSocial) btnSocial.classList.add("active");
    if (type === "KNOWLEDGE" && btnKnow) btnKnow.classList.add("active");
  }

  function getDomainType(domain) {
    if (!domain) return "KNOWLEDGE";
    if (domain.includes("github") || domain.includes("stack") || domain.includes("mdn")) return "CODE"; 
    if (domain.includes("twitter") || domain.includes("reddit") || domain.includes("bilibili")) return "SOCIAL";
    return "KNOWLEDGE";
  }

  function lightenColor(hex, percent) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    const num = parseInt(hex, 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const B = ((num >> 8) & 0x00FF) + amt;
    const G = (num & 0x0000FF) + amt;
    return "#" + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 +
      (G < 255 ? (G < 1 ? 0 : G) : 255)
    ).toString(16).slice(1);
  }

  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        context.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, y);
  }
});