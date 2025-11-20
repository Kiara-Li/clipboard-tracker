document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("list");

  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    const logs = data.clipboardLog;
    logs.slice().reverse().forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.text;
      list.appendChild(li);
    });
  });
});