document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("forestCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("detail-overlay");
  const overlayContent = document.getElementById("detail-content");
  const closeBtn = document.getElementById("close-btn");

  // 全局变量
  let trees = []; // 存储所有树的数据对象 { path, x, y, data, type, height }
  let hoveredTree = null; // 当前悬停的树
  const GROUND_Y_OFFSET = 0.8; // 地平线高度比例

  // 初始化画布尺寸
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawScene(); // 调整大小时重绘
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // 加载数据
  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    // 处理数据，生成树的对象结构，但不立刻画
    generateForestData(data.clipboardLog);
    // 开始绘制循环
    drawScene();
  });

  // --- 交互事件监听 ---

  // 1. 鼠标移动 (Hover 检测)
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let found = null;
    // 倒序遍历（如果树重叠，优先选中前面的）
    for (let i = trees.length - 1; i >= 0; i--) {
      // 关键 API: 判断鼠标点是否在当前树的路径内
      if (ctx.isPointInPath(trees[i].path, mouseX, mouseY)) {
        found = trees[i];
        break;
      }
    }

    // 如果悬停状态改变了，才重绘（节省性能）
    if (hoveredTree !== found) {
      hoveredTree = found;
      canvas.style.cursor = found ? "pointer" : "default";
      drawScene();
    }
  });

  // 2. 鼠标点击 (显示浮层)
  canvas.addEventListener("click", () => {
    if (hoveredTree) {
      showOverlay(hoveredTree.data.text);
    }
  });

  // 3. 关闭浮层
  closeBtn.addEventListener("click", hideOverlay);
  // 点击浮层外部也可以关闭（可选）
  
  // --- 核心逻辑函数 ---

  function generateForestData(logs) {
    trees = [];
    const groundY = canvas.height * GROUND_Y_OFFSET;
    let currentX = 50;
    const spacing = 60;

    logs.forEach((item) => {
      let h = Math.min(Math.max(item.text.length / 2, 40), 300); // 高度限制
      const type = getDomainType(item.domain);
      
      // 创建 Path2D 路径对象 (这是 Canvas 识别形状的关键)
      const path = new Path2D();
      
      // 根据类型定义形状路径
      if (type === "CODE") {
        // 长方形: 从 (currentX - 10) 往上画
        path.rect(currentX - 15, groundY - h, 30, h);
      } else if (type === "SOCIAL") {
        // 圆形 (带茎)
        const r = h / 3;
        // 茎
        path.rect(currentX - 2, groundY - h + r, 4, h - r);
        // 圆头 (作为一个整体路径)
        path.arc(currentX, groundY - h + r, r, 0, Math.PI * 2);
      } else {
        // 三角形
        path.moveTo(currentX - 20, groundY);
        path.lineTo(currentX + 20, groundY);
        path.lineTo(currentX, groundY - h);
        path.closePath();
      }

      trees.push({
        path: path,
        x: currentX,
        y: groundY, // 根部坐标
        height: h,
        type: type,
        data: item // 原始数据
      });

      currentX += spacing;
    });
  }

  function drawScene() {
    // 1. 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. 画地平线
    const groundY = canvas.height * GROUND_Y_OFFSET;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. 遍历画所有的树
    trees.forEach(tree => {
      // 决定颜色
      let color;
      if (tree.type === "CODE") color = "#4dabf7";
      else if (tree.type === "SOCIAL") color = "#ff6b6b";
      else color = "#ffe066";

      // 如果是被悬停的树，颜色加亮
      if (tree === hoveredTree) {
        ctx.fillStyle = lightenColor(color, 40); // 自定义提亮函数
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
      } else {
        ctx.fillStyle = color;
        ctx.shadowBlur = 0;
      }

      // 填充路径
      ctx.fill(tree.path);

      // --- Hover 特效：在树内部显示文字 ---
      if (tree === hoveredTree) {
        ctx.save();
        // 剪切区域：只在树的形状内部绘制文字
        ctx.clip(tree.path); 
        
        ctx.fillStyle = "#000"; // 文字颜色（深色以对比亮色背景）
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        
        // 简单的文字换行逻辑
        const snippet = tree.data.text.substring(0, 50); // 取前50个字
        wrapText(ctx, snippet, tree.x, tree.y - tree.height + 20, 40, 12);
        
        ctx.restore();
      }
    });
  }

  // --- 辅助功能 ---

  function showOverlay(fullText) {
    overlayContent.textContent = fullText;
    overlay.style.display = "block";
  }

  function hideOverlay() {
    overlay.style.display = "none";
  }

  function getDomainType(domain) {
    if (!domain) return "KNOWLEDGE";
    if (domain.includes("github") || domain.includes("stack") || domain.includes("mdn")) return "CODE"; 
    if (domain.includes("twitter") || domain.includes("reddit") || domain.includes("bilibili")) return "SOCIAL";
    return "KNOWLEDGE";
  }

  // 简单的颜色提亮算法 (Hex -> New Hex)
  function lightenColor(color, amount) {
    return color; // 简化版，实际可以使用 Chroma.js 或手动 RGB 计算。
    // 为了演示效果，这里简单返回高亮色，或者你可以写死：
    // if(color === "#4dabf7") return "#a6d5fa"; 
    // etc.
  }

  // Canvas 文字自动换行
  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(''); // 按字符分割（中文友好）
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