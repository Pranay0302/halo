// Open the side panel when the toolbar icon is clicked. The agent request and
// all page operations run from the side panel, so the worker stays minimal.
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('sidePanel setup failed', err));
}
