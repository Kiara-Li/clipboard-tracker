document.addEventListener("DOMContentLoaded", () => {
  // --- DOM 元素 ---
  const container = document.getElementById("canvas-container"); // 新增：滚动容器
  const canvas = document.getElementById("forestCanvas");
  const ctx = canvas.getContext("2d");
  
  const overlay = document.getElementById("detail-overlay");
  const overlayContent = document.getElementById("detail-content");
  const closeBtn = document.getElementById("close-btn");
  
  const btnCode = document.querySelector(".btn-code");
  const btnSocial = document.querySelector(".btn-social");
  const btnKnow = document.querySelector(".btn-know");
  const btnSource = document.getElementById("visit-source-btn");  
  const btnCopy = document.getElementById("copy-text-btn");

  const dateDisplay = document.getElementById("current-date-display");
  const btnPrevDay = document.getElementById("prev-day-btn");
  const btnNextDay = document.getElementById("next-day-btn");

  // --- 全局变量 ---
  let trees = []; 
  let hoveredTree = null; 
  let currentOpenTreeTimeId = -1;
  const GROUND_Y_OFFSET = 0.8; 
  
  // 布局设置
  const TREE_SPACING = 60; // 树间距
  const START_X = 50;      // 左边距

  // --- 数据管理变量 ---
  let groupedLogs = {}; 
  let availableDates = []; 
  let currentViewIndex = 0; 

  // --- 初始化 ---
  // 监听窗口大小变化：只调整高度，宽度由数据决定
  function resizeCanvas() {
    canvas.height = window.innerHeight;
    if(trees.length > 0) drawScene(); 
  }
  window.addEventListener("resize", resizeCanvas);
  canvas.height = window.innerHeight; // 初始高度设置

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

    groupedLogs = {};
    allLogs.forEach(log => {
      let timeVal = new Date(log.time).getTime();
      if (isNaN(timeVal)) timeVal = Date.now();

      const dateObj = new Date(timeVal);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`; 

      if (!groupedLogs[dateKey]) {
        groupedLogs[dateKey] = [];
      }
      groupedLogs[dateKey].push(log);
    });

    availableDates = Object.keys(groupedLogs).sort();
    currentViewIndex = availableDates.length - 1;
    renderCurrentDay();
  }

  function renderCurrentDay() {
    if (availableDates.length === 0) return;

    const dateKey = availableDates[currentViewIndex];
    let logsForDay = groupedLogs[dateKey];

    // --- 排序：旧 -> 新 (a - b) ---
    // 这样最新的树会在最右边
    logsForDay = logsForDay.sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
    });

    updateDateNavigationUI(dateKey);
    generateForestData(logsForDay);
    
    // --- 关键修改：计算动态宽度 ---
    // 宽度 = (树的数量 * 间距) + 起始位置 + 右边留白
    const requiredWidth = (trees.length * TREE_SPACING) + START_X + 100;
    // 确保宽度至少填满屏幕，如果树多则更宽
    canvas.width = Math.max(window.innerWidth, requiredWidth);

    drawScene();

    // --- 关键修改：自动滚动到最右边 ---
    // 使用 setTimeout 确保渲染完后滚动
    setTimeout(() => {
        if(container) {
            container.scrollTo({
                left: canvas.width, // 滚到最右侧
                behavior: 'smooth'  // 平滑滚动
            });
        }
    }, 50);
  }

  function updateDateNavigationUI(dateStr) {
    if(dateDisplay) dateDisplay.textContent = dateStr;
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
    let currentX = START_X; 

    logs.forEach((item) => {
      let h = Math.min(Math.max(item.text.length / 2, 40), 300);
      const type = item.manualType || getDomainType(item.domain);
      const path = createTreePath(currentX, groundY, h, type);
      const safeTimeId = item.time ? item.time : Date.now();

      trees.push({
        path: path,
        x: currentX,
        y: groundY,
        height: h,
        type: type,
        data: item,
        timeId: safeTimeId 
      });

      currentX += TREE_SPACING;
    });
  }

  function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 地平线 (横穿整个动态宽度)
    const groundY = canvas.height * GROUND_Y_OFFSET;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.stroke();

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

      // 显示树龄 (Age)
      if (tree === hoveredTree) {
        ctx.save();
        const ageText = getTreeAge(tree.data.time);
        ctx.fillStyle = "#ffffff"; 
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.fillText(ageText, tree.x, tree.y - tree.height / 2);
        ctx.restore();
      }
    });
  }

  // --- 4. 交互监听 (Canvas) ---

  canvas.addEventListener("mousemove", (e) => {
    // 获取 Canvas 元素相对于视口的位置
    const rect = canvas.getBoundingClientRect();
    // 计算鼠标在 Canvas 内部的坐标 (自动处理了滚动偏差)
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

  canvas.addEventListener("click", () => {
    if (hoveredTree) {
      currentOpenTreeTimeId = hoveredTree.timeId;
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

  function changeTreeType(newType) {
    const targetTree = trees.find(t => t.timeId === currentOpenTreeTimeId);
    if (!targetTree || targetTree.type === newType) return;

    targetTree.type = newType;
    targetTree.path = createTreePath(targetTree.x, targetTree.y, targetTree.height, newType);
    updateTypeButtonsUI(newType);
    drawScene();

    chrome.storage.local.get({ clipboardLog: [] }, (data) => {
      const logs = data.clipboardLog;
      const logIndex = logs.findIndex(l => l.time === currentOpenTreeTimeId);
      
      if (logIndex !== -1) {
        logs[logIndex].manualType = newType;
        chrome.storage.local.set({ clipboardLog: logs });
        
        const dateKey = availableDates[currentViewIndex];
        if(groupedLogs[dateKey]) {
            const logInCache = groupedLogs[dateKey].find(l => l.time === currentOpenTreeTimeId);
            if(logInCache) logInCache.manualType = newType;
        }
      }
    });
  }
  
  if (btnCode) btnCode.onclick = () => changeTreeType("CODE");
  if (btnSocial) btnSocial.onclick = () => changeTreeType("SOCIAL");
  if (btnKnow) btnKnow.onclick = () => changeTreeType("KNOWLEDGE");

  // --- 辅助函数 ---

  function getTreeAge(timestamp) {
    if (!timestamp) return "";
    const birthTime = new Date(timestamp).getTime();
    if(isNaN(birthTime)) return "";
    const now = Date.now();
    const diffMs = now - birthTime;
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (minutes < 1) return "Just planted"; 
    if (minutes < 60) return `${minutes} mins old`;
    if (hours < 24) return `${hours} hrs old`;
    return `${days} days old`;
  }

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
    // 树龄显示不需要 wrapText 了，但保留以防后续使用
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