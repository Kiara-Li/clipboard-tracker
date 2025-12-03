document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("forestCanvas");
  const ctx = canvas.getContext("2d");

  // 设置画布大小为全屏
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight * 0.8; // 留一点空间给底部

  const GROUND_Y = canvas.height; // 地平线位置

  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    const logs = data.clipboardLog;
    drawForest(logs);
  });

  function drawForest(logs) {
    if (logs.length === 0) return;

    // 1. 确定时间范围 (X轴)
    // 我们取最早的一条记录作为 X=0，当前时间作为 X=max
    // 为了简单演示，我们只画最近的记录，按顺序排列
    
    const spacing = 60; // 树之间的间距
    let currentX = 50;  // 起始 X 坐标

    logs.forEach((item) => {
      // --- 逻辑 A: 树的高度 = 文本长度 ---
      // 限制最小高度20，最大高度300，防止过高
      let treeHeight = Math.min(Math.max(item.text.length / 2, 20), 400); 
      
      // --- 逻辑 B: 树的形状/颜色 = 域名 ---
      const type = getDomainType(item.domain);
      
      ctx.save();
      // 移动画笔到树的根部位置
      ctx.translate(currentX, GROUND_Y); 

      // 绘制逻辑
      if (type === "CODE") {
        drawRectangleTree(ctx, treeHeight);
      } else if (type === "SOCIAL") {
        drawCircleTree(ctx, treeHeight);
      } else {
        drawTriangleTree(ctx, treeHeight);
      }

      ctx.restore();
      
      // 下一棵树的位置
      currentX += spacing;
    });
  }

  // 根据域名判断类型
  function getDomainType(domain) {
    if (!domain) return "KNOWLEDGE";
    if (domain.includes("github") || domain.includes("stack") || domain.includes("mdn")) {
      return "CODE"; // 编程：长方形
    } 
    if (domain.includes("twitter") || domain.includes("reddit") || domain.includes("weibo") || domain.includes("youtube")) {
      return "SOCIAL"; // 社交：圆形
    }
    return "KNOWLEDGE"; // 其他/知识：三角形
  }

  // --- 绘制形状的函数 ---

  // 1. 长方形 (Block) - 代表 Code/Tech
  function drawRectangleTree(ctx, h) {
    const width = 20;
    ctx.fillStyle = "#4dabf7"; // 蓝色
    // 注意：Canvas的Y轴向上是负数
    ctx.fillRect(-width/2, -h, width, h); 
    
    // 加一点发光效果（因为是激活状态）
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#4dabf7";
  }

  // 2. 圆形 (Circle) - 代表 Social/Emotion
  function drawCircleTree(ctx, h) {
    // 高度决定圆心的位置
    const radius = h / 3; 
    // 画一根细茎
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h + radius);
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 画圆
    ctx.beginPath();
    ctx.arc(0, -h + radius, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 107, 107, 0.8)"; // 半透明粉色
    ctx.fill();
  }

  // 3. 三角形 (Triangle) - 代表 Knowledge/Article
  function drawTriangleTree(ctx, h) {
    const baseWidth = 30;
    ctx.beginPath();
    ctx.moveTo(-baseWidth / 2, 0); // 左下
    ctx.lineTo(baseWidth / 2, 0);  // 右下
    ctx.lineTo(0, -h);             // 顶点
    ctx.closePath();
    
    ctx.fillStyle = "#ffe066"; // 黄色
    ctx.fill();
  }
});