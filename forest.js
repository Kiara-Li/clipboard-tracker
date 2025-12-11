document.addEventListener("DOMContentLoaded", () => {
  // --- DOM 元素获取 ---
  const container = document.getElementById("canvas-container");
  const canvas = document.getElementById("forestCanvas");
  const ctx = canvas.getContext("2d");
  
  // 浮层元素
  const overlay = document.getElementById("detail-overlay");
  const overlayContent = document.getElementById("detail-content");
  const closeBtn = document.getElementById("close-btn");
  
  // 工具栏按钮
  const btnCode = document.querySelector(".btn-code");
  const btnSocial = document.querySelector(".btn-social");
  const btnKnow = document.querySelector(".btn-know");
  const btnSource = document.getElementById("visit-source-btn");  
  const btnCopy = document.getElementById("copy-text-btn");
  const btnDelete = document.getElementById("delete-tree-btn"); // 新增：删除按钮

  // 顶部与导航元素
  const btnExport = document.getElementById("export-btn"); // 新增：导出按钮
  const dateDisplay = document.getElementById("current-date-display");
  const btnPrevDay = document.getElementById("prev-day-btn");
  const btnNextDay = document.getElementById("next-day-btn");

  // 帮助面板元素
  const helpTrigger = document.getElementById("help-trigger");
  const helpPanel = document.getElementById("help-panel");
  const arrowIcon = document.getElementById("arrow-icon");
  const closeHelpBtn = document.getElementById("close-help-btn");

  // --- 全局变量 ---
  let trees = []; 
  let hoveredTree = null; 
  let currentOpenTreeTimeId = -1;
  const GROUND_Y_OFFSET = 0.8; 
  const TREE_SPACING = 60; 
  const START_X = 50; 

  // --- 数据管理变量 ---
  let groupedLogs = {}; 
  let availableDates = []; 
  let currentViewIndex = 0; 

  // --- 0. 帮助面板逻辑 (新增的Onboarding) ---
  
  function toggleHelpPanel(forceState = null) {
    const isOpen = forceState !== null ? forceState : !helpPanel.classList.contains("open");
    
    if (isOpen) {
        helpPanel.classList.add("open");
        if(arrowIcon) {
            arrowIcon.textContent = "▲"; 
            arrowIcon.style.color = "#4dabf7";
        }
    } else {
        helpPanel.classList.remove("open");
        if(arrowIcon) {
            arrowIcon.textContent = "▼";
            arrowIcon.style.color = "";
        }
    }
  }

  // 绑定帮助按钮事件
  if(helpTrigger) helpTrigger.onclick = () => toggleHelpPanel();
  if(closeHelpBtn) closeHelpBtn.onclick = () => toggleHelpPanel(false);

  // 检查首次访问
  function checkOnboarding() {
    const hasSeenIntro = localStorage.getItem('forestIntroSeen');
    if (!hasSeenIntro) {
        toggleHelpPanel(true); // 首次访问自动展开
        localStorage.setItem('forestIntroSeen', 'true');
    }
  }

  // --- 初始化 ---
  function resizeCanvas() {
    canvas.height = window.innerHeight;
    if(trees.length > 0) drawScene(); 
  }
  window.addEventListener("resize", resizeCanvas);
  canvas.height = window.innerHeight;

  // 加载数据
  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    processDataByDay(data.clipboardLog);
    checkOnboarding(); // 数据加载后检查引导
  });

  // --- 更新的navi核心逻辑：让用户按天处理数据 ---

  function processDataByDay(allLogs) {
    if (!allLogs || allLogs.length === 0) {
      if(dateDisplay) dateDisplay.textContent = "No Data";
      // 清空画布
      trees = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    // 索引修正：防止删除最后一条数据后索引越界
    if (currentViewIndex >= availableDates.length) {
        currentViewIndex = availableDates.length - 1;
    }
    // 如果是初始化（索引为0但我想看最新的），设为最后一天
    // 总是跳到最新，但为了支持“删除后停留在当前天”，让它只在初始化时跳到最新
    if (trees.length === 0 && currentViewIndex === 0) {
         currentViewIndex = availableDates.length - 1;
    }

    renderCurrentDay();
  }

  function renderCurrentDay() {//根据当前选中的日期，把那一天的“树”渲染到画布上
    if (availableDates.length === 0) {
        trees = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if(dateDisplay) dateDisplay.textContent = "Empty Forest";
        return;
    }

    const dateKey = availableDates[currentViewIndex];
    let logsForDay = groupedLogs[dateKey];

    // 排序：旧 -> 新 (a - b)
    logsForDay = logsForDay.sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
    });

    updateDateNavigationUI(dateKey);
    generateForestData(logsForDay);
    
    // 动态宽度
    const requiredWidth = (trees.length * TREE_SPACING) + START_X + 100;
    canvas.width = Math.max(window.innerWidth, requiredWidth);

    drawScene();

    // 自动滚动 (仅在初始化或切换日期时，为了简单，这里每次渲染都滚到最右，除非用户正在交互)
    setTimeout(() => {
        if(container && container.scrollLeft < canvas.width - window.innerWidth) {
            container.scrollTo({
                left: canvas.width, 
                behavior: 'smooth'
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

    // [新增] 绘制背景渐变 (为了导出图片时有背景)
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, "#1a1a1a");
    gradient.addColorStop(1, "#252525");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

      // 显示树龄
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

  canvas.addEventListener("click", () => {
    if (hoveredTree) {
      currentOpenTreeTimeId = hoveredTree.timeId;
      showOverlay(hoveredTree);
    }
  });

  // --- 5. 功能逻辑 (浮层/删除/导出) ---
  
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

  // 复制功能
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

  // [新增] 删除功能
  if (btnDelete) {
    btnDelete.onclick = () => {
        if (currentOpenTreeTimeId === -1) return;
        
        // 1. 获取数据
        chrome.storage.local.get({ clipboardLog: [] }, (data) => {
            let logs = data.clipboardLog;
            // 2. 过滤掉当前树 (ID不匹配的保留)
            const newLogs = logs.filter(l => l.time !== currentOpenTreeTimeId);
            
            // 3. 存回并刷新
            chrome.storage.local.set({ clipboardLog: newLogs }, () => {
                hideOverlay();
                // 重新分组并渲染，实现无刷新删除
                processDataByDay(newLogs);
            });
        });
    };
  }

  // [新增] 导出图片功能
  if (btnExport) {
    btnExport.onclick = () => {
        const link = document.createElement('a');
        const dateStr = availableDates[currentViewIndex] || "MyForest";
        link.download = `Forest-${dateStr}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };
  }

  // 修改类型逻辑
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
        // 简单处理：不更新 groupedLogs 缓存，因为一般不会频繁改了又翻页
      }
    });
  }
  
  if (btnCode) btnCode.onclick = () => changeTreeType("CODE");
  if (btnSocial) btnSocial.onclick = () => changeTreeType("SOCIAL");
  if (btnKnow) btnKnow.onclick = () => changeTreeType("KNOWLEDGE");

  // --- 辅助函数 ---

  function getTreeAge(timestamp) {//把树的时间戳转换成“树龄”字符串
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

  function getDomainType(domain) {//核心功能之一，用domain来自动分类树的类型，之后考虑添加更多规则
    if (!domain) return "KNOWLEDGE";
    if (domain.includes("github") || domain.includes("stack") || domain.includes("mdn")) return "CODE"; 
    if (domain.includes("twitter") || domain.includes("reddit") || domain.includes("bilibili")) return "SOCIAL";
    return "KNOWLEDGE";
  }

  function lightenColor(hex, percent) {//hover时用来变亮颜色的辅助函数
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
});