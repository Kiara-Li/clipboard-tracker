document.addEventListener("copy", () => {
  const copiedText = window.getSelection().toString().trim();
  if (!copiedText) return;

  const timestamp = new Date().toISOString();

  chrome.storage.local.get({ clipboardLog: [] }, (data) => {
    const updated = [...data.clipboardLog, { text: copiedText, time: timestamp }];
    chrome.storage.local.set({ clipboardLog: updated });
    console.log("Copied:", copiedText);
  });
});