/********************************************************************
 *
 * General background initialization
 *
 *******************************************************************/

/* browser action button and fallback */
if (!chrome.browserAction) {
  // Firefox Android < 55: no browserAction
  // Fallback to pageAction.
  // Firefox Android ignores the tabId parameter and
  // shows the pageAction for all tabs
  chrome.pageAction.show(0);
} else if (!chrome.browserAction.getPopup) {
  // Firefox Android >= 55: only browserAction onClick
  // Open the browserAction page
  chrome.browserAction.onClicked.addListener((tab) => {
    const url = chrome.runtime.getURL("core/browserAction.html");
    chrome.tabs.create({url, active: true}, () => {});
  });
}

/* context menus */
if (chrome.contextMenus) {
  initContextMenu();
}

if (chrome.history) {
  chrome.history.onVisited.addListener((result) => {
    // suppress extension pages from generating a history entry
    if (result.url.startsWith(chrome.runtime.getURL(""))) {
      chrome.history.deleteUrl({url: result.url});
    }
  });
}

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
  // Some headers (e.g. "referer") are not allowed to be set via
  // XMLHttpRequest.setRequestHeader directly.  Use a prefix and
  // modify it here to workaround.
  details.requestHeaders.forEach((header) => {
    if (header.name.slice(0, 15) === "X-WebScrapBook-") {
      header.name = header.name.slice(15);
    }
  });
  return {requestHeaders: details.requestHeaders};
}, {urls: ["<all_urls>"], types: ["xmlhttprequest"]}, ["blocking", "requestHeaders"]);

if (chrome.runtime.onConnectExternal) {
  // Available in Firefox >= 54.
  chrome.runtime.onConnectExternal.addListener((port) => {
    port.onMessage.addListener(async (message, port) => {
      try {
        const {cmd, args} = message;
        let result;
        switch (cmd) {
          case "getBaseUrl": {
            result = {
              url: chrome.runtime.getURL(""),
            };
            break;
          }
          case "relayMessage": {
            // Send message to all tabs of this extension, mainly the capturer
            // tabs.  Only messages pass args.settings.missionId verification
            // by the capturer will be executed.
            result = await browser.runtime.sendMessage({
              cmd: args.cmd,
              args: args.args,
            });
            break;
          }
        }

        if (result.error) { throw result.error; }
        port.postMessage({id: message.id, response: result});
      } catch (ex) {
        port.postMessage({id: message.id, error: {message: ex.message}});
      }
    });
  });
}

async function initContextMenu() {
  const urlMatch = await scrapbook.getContentPagePattern();

  try {
    chrome.contextMenus.create({
      title: scrapbook.lang("CaptureTab"),
      contexts: ["tab"],
      documentUrlPatterns: urlMatch,
      onclick: (info, tab) => {
        return capturer.invokeCapture({target: tab.id});
      }
    });
    chrome.contextMenus.create({
      title: scrapbook.lang("CaptureTabSource"),
      contexts: ["tab"],
      documentUrlPatterns: urlMatch,
      onclick: (info, tab) => {
        return capturer.invokeCapture({target: tab.id, mode: "source"});
      }
    });
    chrome.contextMenus.create({
      title: scrapbook.lang("CaptureTabBookmark"),
      contexts: ["tab"],
      documentUrlPatterns: urlMatch,
      onclick: (info, tab) => {
        return capturer.invokeCapture({target: tab.id, mode: "bookmark"});
      }
    });
  } catch (ex) {
    // Available only in Firefox >= 53. Otherwise ignore the error.
  }

  chrome.contextMenus.create({
    title: scrapbook.lang("CapturePage"),
    contexts: ["page"],
    documentUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({target: `${tab.id}:0`, full: true});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CapturePageSource"),
    contexts: ["page"],
    documentUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({url: info.pageUrl, mode: "source"});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CapturePageBookmark"),
    contexts: ["page"],
    documentUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({url: info.pageUrl, mode: "bookmark"});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CaptureFrame"),
    contexts: ["frame"],
    documentUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({target: `${tab.id}:${info.frameId}`, full: true});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CaptureFrameSource"),
    contexts: ["frame"],
    documentUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({url: info.frameUrl, mode: "source"});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CaptureFrameBookmark"),
    contexts: ["frame"],
    documentUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({url: info.frameUrl, mode: "bookmark"});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CaptureSelection"),
    contexts: ["selection"],
    documentUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({target: `${tab.id}:${info.frameId}`, full: false});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CaptureLinkSource"),
    contexts: ["link"],
    targetUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({url: info.linkUrl});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CaptureLinkBookmark"),
    contexts: ["link"],
    targetUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({url: info.linkUrl, mode: "bookmark"});
    }
  });

  chrome.contextMenus.create({
    title: scrapbook.lang("CaptureMedia"),
    contexts: ["image", "audio", "video"],
    targetUrlPatterns: urlMatch,
    onclick: (info, tab) => {
      return capturer.invokeCapture({url: info.srcUrl});
    }
  });
}
