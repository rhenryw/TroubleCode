(() => {
  const logBuffer = [];
  const MAX_LOGS = 80;

  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  function pushLog(level, args) {
    const entry = {
      level,
      message: args.map(stringifySafe).join(" "),
      args: args.map(serializeArg),
      time: new Date().toISOString(),
    };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift();
    }
  }

  function wrapConsoleMethod(level) {
    return (...args) => {
      pushLog(level, args);
      originalConsole[level](...args);
    };
  }

  console.log = wrapConsoleMethod("log");
  console.info = wrapConsoleMethod("info");
  console.warn = wrapConsoleMethod("warn");
  console.error = wrapConsoleMethod("error");

  window.addEventListener("error", (event) => {
    logBuffer.push({
      level: "error",
      message: event.message || "Script error",
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
      time: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logBuffer.push({
      level: "error",
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      time: new Date().toISOString(),
    });
  });

  function stringifySafe(value) {
    if (typeof value === "string") return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  function serializeArg(value) {
    if (value instanceof Error) {
      return {
        __type: "Error",
        name: value.name,
        message: value.message,
        stack: value.stack || null,
      };
    }
    if (typeof value === "function") {
      return { __type: "Function", name: value.name || "(anonymous)" };
    }
    if (typeof value === "bigint") {
      return { __type: "BigInt", value: value.toString() };
    }
    if (value instanceof Map) {
      return { __type: "Map", entries: Array.from(value.entries()) };
    }
    if (value instanceof Set) {
      return { __type: "Set", values: Array.from(value.values()) };
    }
    if (value && typeof value === "object") {
      return safeJsonClone(value);
    }
    return value;
  }

  function safeJsonClone(value) {
    const seen = new WeakSet();
    return JSON.parse(
      JSON.stringify(value, (key, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);
        }
        if (val instanceof Error) {
          return { name: val.name, message: val.message, stack: val.stack || null };
        }
        if (typeof val === "bigint") {
          return val.toString();
        }
        return val;
      })
    );
  }

  function getConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return null;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }

  async function getPublicIp() {
    try {
      const response = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return data.ip || null;
    } catch (error) {
      return null;
    }
  }

  async function resolveHostIp(hostname) {
    if (!hostname) return null;
    try {
      const url = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      const answers = data.Answer || [];
      const ips = answers
        .filter((answer) => answer.type === 1)
        .map((answer) => answer.data);
      return ips.length ? ips : null;
    } catch (error) {
      return null;
    }
  }

  function getPerformanceInfo() {
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (!navEntry) return null;
    return {
      type: navEntry.type,
      startTime: navEntry.startTime,
      domContentLoaded: navEntry.domContentLoadedEventEnd,
      loadEventEnd: navEntry.loadEventEnd,
      transferSize: navEntry.transferSize,
    };
  }

  function getStorageInfo() {
    return {
      localStorageAvailable: storageAvailable("localStorage"),
      sessionStorageAvailable: storageAvailable("sessionStorage"),
      indexedDbAvailable: "indexedDB" in window,
    };
  }

  function storageAvailable(type) {
    try {
      const storage = window[type];
      const key = "__tc_test__";
      storage.setItem(key, key);
      storage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function getPermissionsInfo() {
    if (!navigator.permissions?.query) return null;
    const names = ["geolocation", "notifications", "clipboard-read", "camera", "microphone"];
    const results = {};
    await Promise.all(
      names.map(async (name) => {
        try {
          const status = await navigator.permissions.query({ name });
          results[name] = status.state;
        } catch (error) {
          results[name] = "unsupported";
        }
      })
    );
    return results;
  }

  async function collectInfo(userError = "") {
    const now = new Date();
    const hostname = window.location.hostname;
    const [publicIp, hostIps, permissions] = await Promise.all([
      getPublicIp(),
      resolveHostIp(hostname),
      getPermissionsInfo(),
    ]);

    return {
      version: "1.0",
      timestamp: now.toISOString(),
      localeTime: now.toString(),
      userError: userError.trim() || "(no description provided)",
      location: {
        href: window.location.href,
        origin: window.location.origin,
        hostname,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        referrer: document.referrer || null,
        historyLength: history.length,
      },
      hostIp: hostIps,
      publicIp,
      navigator: {
        userAgent: navigator.userAgent,
        vendor: navigator.vendor || null,
        platform: navigator.platform || null,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        deviceMemory: navigator.deviceMemory || null,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        maxTouchPoints: navigator.maxTouchPoints,
        onLine: navigator.onLine,
        pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
        connection: getConnectionInfo(),
        permissions,
      },
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        devicePixelRatio: window.devicePixelRatio,
        orientation: screen.orientation?.type || null,
      },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      storage: getStorageInfo(),
      performance: getPerformanceInfo(),
      logs: logBuffer.slice(),
    };
  }

  function uint8ToBase64Url(uint8) {
    let binary = "";
    uint8.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function base64UrlToUint8(base64Url) {
    const pad = base64Url.length % 4 === 0 ? "" : "=".repeat(4 - (base64Url.length % 4));
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function compressToCode(data) {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);

    if ("CompressionStream" in window) {
      const cs = new CompressionStream("gzip");
      const compressedStream = new Blob([bytes]).stream().pipeThrough(cs);
      const compressedBuffer = await new Response(compressedStream).arrayBuffer();
      return uint8ToBase64Url(new Uint8Array(compressedBuffer));
    }

    return uint8ToBase64Url(bytes);
  }

  async function decodeFromCode(code) {
    const bytes = base64UrlToUint8(code.trim());

    if ("DecompressionStream" in window) {
      try {
        const ds = new DecompressionStream("gzip");
        const decompressedStream = new Blob([bytes]).stream().pipeThrough(ds);
        const buffer = await new Response(decompressedStream).arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        return JSON.parse(text);
      } catch (error) {
        // fall through to raw decode
      }
    }

    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  }

  function clearLogs() {
    logBuffer.length = 0;
  }

  function makeSampleLogs() {
    console.warn("Sample warning created for TroubleCode demo.");
    console.info("Sample info log created for TroubleCode demo.");
    console.error(new Error("Sample error created for TroubleCode demo."));
  }

  window.TroubleCodeTech = {
    collectInfo,
    compressToCode,
    decodeFromCode,
    clearLogs,
    makeSampleLogs,
  };
})();
