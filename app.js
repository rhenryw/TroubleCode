const codeInput = document.getElementById("codeInput");
const decodeBtn = document.getElementById("decodeBtn");
const clearBtn = document.getElementById("clearBtn");
const decodeMeta = document.getElementById("decodeMeta");
const reportSection = document.getElementById("reportSection");
const reportMeta = document.getElementById("reportMeta");
const report = document.getElementById("report");
const aiSection = document.getElementById("aiSection");
const analyzeBtn = document.getElementById("analyzeBtn");
const aiOutput = document.getElementById("aiOutput");
const troubleshootSection = document.getElementById("troubleshootSection");
const troubleshootInput = document.getElementById("troubleshootInput");
const troubleshootBtn = document.getElementById("troubleshootBtn");
const troubleshootOutput = document.getElementById("troubleshootOutput");

let reportData = null;

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

function renderReport(data) {
  if (!data) {
    report.innerHTML = "";
    return;
  }

  report.innerHTML = "";
  const importantSections = ["userError", "logs", "location"];
  Object.entries(data).forEach(([key, value]) => {
    const group = document.createElement("details");
    group.className = "report__group";
    group.open = importantSections.includes(key);

    const summary = document.createElement("summary");
    summary.textContent = key;
    group.appendChild(summary);

    const list = document.createElement("div");
    list.className = "report__list";
    renderValue(list, value, key);
    group.appendChild(list);
    report.appendChild(group);
  });

  const rawGroup = document.createElement("details");
  rawGroup.className = "report__group report__group--raw";
  rawGroup.open = false;
  const rawSummary = document.createElement("summary");
  rawSummary.textContent = "raw";
  rawGroup.appendChild(rawSummary);

  const rawPre = document.createElement("pre");
  rawPre.className = "report__raw";
  rawPre.textContent = JSON.stringify(data, null, 2);
  rawGroup.appendChild(rawPre);
  report.appendChild(rawGroup);
}

function renderValue(container, value, path, label = "") {
  if (value === null || value === undefined) {
    addItem(container, label || "value", String(value), path);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      addItem(container, label || "list", "(empty)", path);
      return;
    }
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (typeof item === "object" && item !== null) {
        const group = document.createElement("details");
        group.className = "report__group report__group--nested";
        const summary = document.createElement("summary");
        summary.textContent = `${label || "item"} #${index + 1}`;
        group.appendChild(summary);
        const list = document.createElement("div");
        list.className = "report__list";
        renderValue(list, item, itemPath);
        group.appendChild(list);
        container.appendChild(group);
      } else {
        addItem(container, `${label || "item"} #${index + 1}`, String(item), itemPath);
      }
    });
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => {
      const childPath = path ? `${path}.${childKey}` : childKey;
      renderValue(container, childValue, childPath, childKey);
    });
    return;
  }

  addItem(container, label || "value", String(value), path);
}

function addItem(container, label, value, path) {
  const item = document.createElement("div");
  item.className = "report__item";
  if (path) item.dataset.path = path;

  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;

  const valueSpan = document.createElement("span");
  if (typeof value === "string" && value.includes("\n")) {
    const pre = document.createElement("pre");
    pre.className = "report__multiline";
    pre.textContent = value;
    valueSpan.appendChild(pre);
  } else {
    valueSpan.textContent = value;
  }

  item.appendChild(labelSpan);
  item.appendChild(valueSpan);
  container.appendChild(item);
}

function showSection(section, show) {
  section.hidden = !show;
}

function setMeta(text, type = "") {
  decodeMeta.textContent = text;
  decodeMeta.dataset.state = type;
}

function setAiOutput(container, text) {
  container.hidden = false;
  renderAiText(container, text);
}

function parseMarkdown(text) {
  // Process inline markdown while preserving callback tokens
  let processed = text;
  
  // Bold **text**
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic *text*
  processed = processed.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Inline code `text`
  processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Links [text](url)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  return processed;
}

function renderAiText(container, text) {
  container.innerHTML = "";
  
  // Split by double newlines for paragraphs, but also check for code blocks
  const blocks = text.split(/\n\n+/g);
  
  blocks.forEach((block) => {
    // Check if it's a code block
    if (block.startsWith("```")) {
      const codeMatch = block.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        const lang = codeMatch[1] || "";
        const code = codeMatch[2].trim();
        const pre = document.createElement("pre");
        pre.className = "ai-code-block";
        if (lang) pre.dataset.lang = lang;
        const codeEl = document.createElement("code");
        codeEl.textContent = code;
        pre.appendChild(codeEl);
        container.appendChild(pre);
        return;
      }
    }
    
    // Check if it's a header
    const headerMatch = block.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const heading = document.createElement(`h${Math.min(level + 2, 6)}`);
      heading.className = "ai-heading";
      heading.innerHTML = parseMarkdown(headerMatch[2]);
      container.appendChild(heading);
      return;
    }
    
    // Check if it's a list
    const listItems = block.split('\n').filter(line => /^[-*]\s+/.test(line));
    if (listItems.length > 0 && listItems.length === block.split('\n').length) {
      const ul = document.createElement("ul");
      ul.className = "ai-list";
      listItems.forEach((item) => {
        const li = document.createElement("li");
        const content = item.replace(/^[-*]\s+/, '');
        renderInlineContent(li, content);
        ul.appendChild(li);
      });
      container.appendChild(ul);
      return;
    }
    
    // Regular paragraph with markdown and callbacks
    const p = document.createElement("p");
    renderInlineContent(p, block);
    container.appendChild(p);
  });
}

function renderInlineContent(parent, text) {
  // First, apply markdown parsing
  const withMarkdown = parseMarkdown(text);
  
  // Split by callback tokens, preserving them
  const parts = withMarkdown.split(/(\[\[ref:[^\]]+\]\])/g);
  
  parts.forEach((part) => {
    if (part.startsWith("[[ref:") && part.endsWith("]]")) {
      const ref = part.slice(6, -2).trim();
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ref-chip";
      chip.textContent = ref;
      chip.dataset.ref = ref;
      chip.addEventListener("click", () => focusReportPath(ref));
      parent.appendChild(chip);
    } else {
      // Parse the HTML from markdown
      const lines = part.split(/\n/g);
      lines.forEach((line, index) => {
        if (index > 0) parent.appendChild(document.createElement("br"));
        const temp = document.createElement("span");
        temp.innerHTML = line;
        while (temp.firstChild) {
          parent.appendChild(temp.firstChild);
        }
      });
    }
  });
}

function focusReportPath(path) {
  if (!path) return;
  const safePath = window.CSS?.escape ? CSS.escape(path) : path.replace(/"/g, "\\\"");
  const target = report.querySelector(`[data-path="${safePath}"]`);
  if (!target) return;
  
  // Open all parent <details> elements
  let parent = target.parentElement;
  while (parent && parent !== report) {
    if (parent.tagName === "DETAILS" && !parent.open) {
      parent.open = true;
    }
    parent = parent.parentElement;
  }
  
  // Highlight and scroll
  target.classList.add("report__item--highlight");
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => target.classList.remove("report__item--highlight"), 1400);
}

function buildPrompt({ mode, reportJson, issue }) {
  const base =
    "You are a troubleshooting assistant. Analyze the TroubleCode report. " +
    "When referencing specific fields, include a callback token in the form [[ref:path.to.field]].";
  if (mode === "triage") {
    return `${base}\n\nProvide: 1) quick summary, 2) likely issues, 3) next checks.\n\nReport JSON:\n${reportJson}`;
  }
  return `${base}\n\nUser issue description:\n${issue}\n\nProvide: 1) possible reasons, 2) suspected fields with callbacks, 3) suggested next actions.\n\nReport JSON:\n${reportJson}`;
}

async function fetchAiText(prompt) {
  const url = `https://gen.pollinations.ai/text/${encodeURIComponent(prompt)}?model=gemini-fast&key=pk_VeWhotgBEOgmjkmK`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("AI request failed");
  }
  return response.text();
}

async function handleDecode() {
  const code = codeInput.value.trim();
  if (!code) {
    setMeta("Paste a TroubleCode to continue.", "warning");
    return;
  }
  decodeBtn.disabled = true;
  setMeta("Decoding…", "loading");
  try {
    const data = await decodeFromCode(code);
    reportData = data;
    renderReport(data);
    showSection(reportSection, true);
    showSection(aiSection, true);
    showSection(troubleshootSection, true);
    aiOutput.hidden = true;
    troubleshootOutput.hidden = true;
    reportMeta.textContent = `Decoded ${Object.keys(data).length} sections`;
    setMeta("Decoded successfully.", "success");
  } catch (error) {
    reportData = null;
    showSection(reportSection, false);
    showSection(aiSection, false);
    showSection(troubleshootSection, false);
    setMeta("Unable to decode this TroubleCode.", "error");
  } finally {
    decodeBtn.disabled = false;
  }
}

function handleClear() {
  codeInput.value = "";
  setMeta("Waiting for a code…");
  reportData = null;
  showSection(reportSection, false);
  showSection(aiSection, false);
  showSection(troubleshootSection, false);
}

async function handleAnalyze() {
  if (!reportData) return;
  analyzeBtn.disabled = true;
  aiOutput.hidden = true;
  const prompt = buildPrompt({
    mode: "triage",
    reportJson: JSON.stringify(reportData, null, 2),
  });
  try {
    const text = await fetchAiText(prompt);
    setAiOutput(aiOutput, text);
  } catch (error) {
    setAiOutput(aiOutput, "Unable to reach the AI service right now.");
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function handleTroubleshoot() {
  if (!reportData) return;
  const issue = troubleshootInput.value.trim();
  if (!issue) {
    setAiOutput(troubleshootOutput, "Add an issue description first.");
    return;
  }
  troubleshootBtn.disabled = true;
  troubleshootOutput.hidden = true;
  const prompt = buildPrompt({
    mode: "troubleshoot",
    reportJson: JSON.stringify(reportData, null, 2),
    issue,
  });
  try {
    const text = await fetchAiText(prompt);
    setAiOutput(troubleshootOutput, text);
  } catch (error) {
    setAiOutput(troubleshootOutput, "Unable to reach the AI service right now.");
  } finally {
    troubleshootBtn.disabled = false;
  }
}

decodeBtn.addEventListener("click", handleDecode);
clearBtn.addEventListener("click", handleClear);
analyzeBtn.addEventListener("click", handleAnalyze);
troubleshootBtn.addEventListener("click", handleTroubleshoot);
