const userErrorInput = document.getElementById("userError");
const generateBtn = document.getElementById("generateBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const codeOutput = document.getElementById("codeOutput");
const copyBtn = document.getElementById("copyBtn");
const codeMeta = document.getElementById("codeMeta");
const codeInput = document.getElementById("codeInput");
const decodeBtn = document.getElementById("decodeBtn");
const report = document.getElementById("report");
const sampleBtn = document.getElementById("sampleBtn");

const { collectInfo, compressToCode, decodeFromCode, clearLogs, makeSampleLogs } =
  window.TroubleCodeTech || {};

function renderReport(data) {
  if (!data) {
    report.innerHTML = '<p class="muted">No report yet. Generate or decode a TroubleCode to see details.</p>';
    return;
  }

  report.innerHTML = "";
  Object.entries(data).forEach(([key, value]) => {
    const group = document.createElement("div");
    group.className = "report__group";

    const title = document.createElement("h3");
    title.textContent = key;
    group.appendChild(title);

    const list = document.createElement("div");
    list.className = "report__list";

    renderValue(list, value);
    group.appendChild(list);
    report.appendChild(group);
  });

  const rawGroup = document.createElement("div");
  rawGroup.className = "report__group";

  const rawTitle = document.createElement("h3");
  rawTitle.textContent = "raw";
  rawGroup.appendChild(rawTitle);

  const rawPre = document.createElement("pre");
  rawPre.className = "report__raw";
  rawPre.textContent = JSON.stringify(data, null, 2);
  rawGroup.appendChild(rawPre);

  report.appendChild(rawGroup);
}

function renderValue(container, value, prefix = "") {
  if (value === null || value === undefined) {
    addItem(container, prefix || "value", String(value));
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      addItem(container, prefix || "list", "(empty)");
      return;
    }
    value.forEach((item, index) => {
      if (typeof item === "object" && item !== null) {
        const group = document.createElement("div");
        group.className = "report__group";
        const title = document.createElement("h3");
        title.textContent = `${prefix || "item"} #${index + 1}`;
        group.appendChild(title);
        const list = document.createElement("div");
        list.className = "report__list";
        renderValue(list, item);
        group.appendChild(list);
        container.appendChild(group);
      } else {
        addItem(container, `${prefix || "item"} #${index + 1}`, String(item));
      }
    });
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => {
      renderValue(container, childValue, childKey);
    });
    return;
  }

  addItem(container, prefix || "value", String(value));
}

function addItem(container, label, value) {
  const item = document.createElement("div");
  item.className = "report__item";

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

async function handleGenerate() {
  generateBtn.disabled = true;
  codeMeta.textContent = "Collecting data…";
  try {
    const info = await collectInfo(userErrorInput.value);
    const code = await compressToCode(info);
    codeOutput.value = code;
    codeMeta.textContent = `Generated ${code.length} chars • ${info.logs.length} logs captured`;
    renderReport(info);
  } catch (error) {
    codeMeta.textContent = "Failed to generate code.";
    console.error(error);
  } finally {
    generateBtn.disabled = false;
  }
}

async function handleDecode() {
  const code = codeInput.value.trim();
  if (!code) {
    alert("Paste a TroubleCode first.");
    return;
  }
  decodeBtn.disabled = true;
  try {
    const data = await decodeFromCode(code);
    renderReport(data);
  } catch (error) {
    alert("Unable to decode this TroubleCode.");
  } finally {
    decodeBtn.disabled = false;
  }
}

function handleCopy() {
  if (!codeOutput.value) return;
  navigator.clipboard.writeText(codeOutput.value).then(() => {
    codeMeta.textContent = "Copied to clipboard.";
  });
}

function handleClearLogs() {
  clearLogs();
  codeMeta.textContent = "Captured logs cleared.";
}

function handleSample() {
  makeSampleLogs();
}

generateBtn.addEventListener("click", handleGenerate);
copyBtn.addEventListener("click", handleCopy);
clearLogsBtn.addEventListener("click", handleClearLogs);
decodeBtn.addEventListener("click", handleDecode);
sampleBtn.addEventListener("click", handleSample);

// Auto-generate demo logs on load so the console has sample entries.
handleSample();
