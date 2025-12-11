document.addEventListener("copy", () => {
  const selection = window.getSelection();// 获取用户复制的内容
  const copiedText = selection.toString().trim();
  if (!copiedText) return;

  const timestamp = new Date().getTime();
  const domain = window.location.hostname; // 用于决定树的形状
  const fullUrl = window.location.href;    // 新增：用于“回到土壤”的功能
  
  chrome.storage.local.get({ clipboardLog: [] }, (data) => {//将这条复制记录存进 Chrome Extensions 的本地存储
    const updated = [...data.clipboardLog, { 
        text: copiedText, 
        time: timestamp, 
        domain: domain,
        url: fullUrl // 新增保存字段
    }];
    chrome.storage.local.set({ clipboardLog: updated });
    console.log(`Seed collected from ${domain}`);
  });
});