document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("forestCanvas");
  const ctx = canvas.getContext("2d");
  
  // DOM 元素获取
  const overlay = document.getElementById("detail-overlay");
  const overlayContent = document.getElementById("detail-content");
  const closeBtn = document.getElementById("close-btn"); // 这里的 ID 对应 html 里的关闭按钮
  // 获取工具栏按钮
  const btnCode = document.querySelector(".btn-code");
  const btnSocial = document.querySelector(".btn-social");
  const btnKnow = document.querySelector(".btn-know");
  const btnCopy = document.getElementById("copy-text-btn");

  // 全局变量
  let trees = []; // 存储所有树的数据对象
  let hoveredTree = null; // 当前悬停的树
  let currentOpenTreeIndex = -1; // 新增：记录当前打开的是哪棵树（原始索引）
  const GROUND_Y_OFFSET = 0.8; // 地平线高度比例

  // 初始化画布尺寸
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawScene(); 
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // 加载数据
  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    generateForestData(data.clipboardLog);
    drawScene();
  });

  // --- 1. 交互事件监听 (Canvas) ---

  // 鼠标移动 (Hover 检测)
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

  // 鼠标点击 (打开浮层)
  canvas.addEventListener("click", () => {
    if (hoveredTree) {
      // 记录当前操作的是哪棵树
      currentOpenTreeIndex = hoveredTree.originalIndex;
      showOverlay(hoveredTree);
    }
  });

  // --- 2. 交互事件监听 (工具栏/UI) ---

  // 关闭浮层
  // 注意：如果您的 html 里关闭按钮是在 action-buttons 里，这里要确保 id 对应
  if (closeBtn) {
    closeBtn.addEventListener("click", hideOverlay);
  }

  // 复制功能
  if (btnCopy) {
    btnCopy.onclick = () => {
      const text = overlayContent.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btnCopy.textContent;
        btnCopy.textContent = "✅ Copied!";
        setTimeout(() => {
          btnCopy.textContent = originalText;
        }, 2000);
      });
    };
  }

  // 类型切换功能
  if (btnCode) btnCode.onclick = () => changeTreeType("CODE");
  if (btnSocial) btnSocial.onclick = () => changeTreeType("SOCIAL");
  if (btnKnow) btnKnow.onclick = () => changeTreeType("KNOWLEDGE");

  // --- 3. 核心逻辑函数 ---

  function generateForestData(logs) {
    trees = [];
    const groundY = canvas.height * GROUND_Y_OFFSET;
    let currentX = 50;
    const spacing = 60;

    logs.forEach((item, index) => {
      let h = Math.min(Math.max(item.text.length / 2, 40), 300);
      
      // 优先使用手动设置的类型，如果没有则使用自动检测的
      const type = item.manualType || getDomainType(item.domain);
      
      // 调用辅助函数创建路径
      const path = createTreePath(currentX, groundY, h, type);

      trees.push({
        path: path,
        x: currentX,
        y: groundY,
        height: h,
        type: type,
        data: item,
        originalIndex: index // 保存原始索引以便后续查找修改
      });

      currentX += spacing;
    });
  }

  // 辅助：根据参数创建路径 (提取出来方便修改类型时重用)
  function createTreePath(x, y, h, type) {
    const path = new Path2D();
    if (type === "CODE") {
      // 长方形
      path.rect(x - 15, y - h, 30, h);
    } else if (type === "SOCIAL") {
      // 圆形
      const r = h / 3;
      path.rect(x - 2, y - h + r, 4, h - r); // 茎
      path.arc(x, y - h + r, r, 0, Math.PI * 2); // 圆头
    } else {
      // 三角形 (KNOWLEDGE)
      path.moveTo(x - 20, y);
      path.lineTo(x + 20, y);
      path.lineTo(x, y - h);
      path.closePath();
    }
    return path;
  }

  // 修改树的类型 (核心新功能)
  function changeTreeType(newType) {
    if (currentOpenTreeIndex === -1) return;

    // 1. 在内存数组中找到这棵树
    const targetTree = trees.find(t => t.originalIndex === currentOpenTreeIndex);
    if (!targetTree) return;
    if (targetTree.type === newType) return; // 类型一样就不动

    // 2. 更新内存数据
    targetTree.type = newType;
    // 3. 重新计算形状路径 (否则点击检测还是原来的形状)
    targetTree.path = createTreePath(targetTree.x, targetTree.y, targetTree.height, newType);

    // 4. 更新 UI 按钮高亮
    updateTypeButtonsUI(newType);

    // 5. 重绘画布 (即时反馈)
    drawScene();

    // 6. 持久化保存到 Chrome Storage
    chrome.storage.local.get({ clipboardLog: [] }, (data) => {
      const logs = data.clipboardLog;
      if (logs[currentOpenTreeIndex]) {
        logs[currentOpenTreeIndex].manualType = newType; // 写入 manualType 字段
        chrome.storage.local.set({ clipboardLog: logs });
      }
    });
  }

  function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 画地平线
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

      // Hover 高亮处理
      if (tree === hoveredTree) {
        ctx.fillStyle = lightenColor(color, 40); // 真正变亮
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
      } else {
        ctx.fillStyle = color;
        ctx.shadowBlur = 0;
      }

      ctx.fill(tree.path);

      // Hover 文字处理
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

  // --- 4. 辅助 UI 功能 ---

  function showOverlay(tree) {
    overlayContent.textContent = tree.data.text;
    overlay.style.display = "block";
    
    // 初始化按钮状态
    updateTypeButtonsUI(tree.type);
    
    // 重置 Copy 按钮文本
    if(btnCopy) btnCopy.textContent = "📋 Copy";
  }

  function hideOverlay() {
    overlay.style.display = "none";
    currentOpenTreeIndex = -1; // 清空选中状态
  }

  function updateTypeButtonsUI(type) {
    // 移除所有 active
    if(btnCode) btnCode.classList.remove("active");
    if(btnSocial) btnSocial.classList.remove("active");
    if(btnKnow) btnKnow.classList.remove("active");

    // 添加 active
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

  // 真正的颜色提亮算法 (Hex 颜色变亮)
  function lightenColor(hex, percent) {
    // 移除 #
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) {
      hex = hex.replace(/(.)/g, '$1$1');
    }
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

  // Canvas 文字换行
  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
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