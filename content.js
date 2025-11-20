let copyCount = 0;      // 复制计数
let copyTimer = null;   // 定时器
const TIME_WINDOW = 3000; // 3秒时间窗口
const THRESHOLD = 2;      // 超过5次算快速复制

document.addEventListener("copy", () => {
  const copiedText = window.getSelection().toString().trim();
  if (!copiedText) return;

  // 记录到 storage
  const timestamp = new Date().toISOString();
  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    const updated = [...data.clipboardLog, { text: copiedText, time: timestamp }];
    chrome.storage.local.set({ clipboardLog: updated });
    console.log("Copied:", copiedText);
  });

  // 快速复制逻辑
  copyCount++;

  if (copyTimer) clearTimeout(copyTimer);
  
  copyTimer = setTimeout(() => {
    copyCount = 0; // 超过时间窗口，重置计数
  }, TIME_WINDOW);

  if (copyCount >= THRESHOLD) {
    alert("You have copied text rapidly. Please be cautious!");
    copyCount = 0; // 弹窗后重置计数
    clearTimeout(copyTimer);
    copyTimer = null;
  }
});