document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("openForestBtn");
  
  btn.addEventListener("click", () => {
    // 打开扩展内部的 forest.html 页面
    chrome.tabs.create({ url: 'forest.html' });
  });
});