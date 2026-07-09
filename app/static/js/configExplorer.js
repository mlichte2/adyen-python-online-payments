(function () {
  const props = window.CATALOG_PROPS || [];
  const componentName = window.COMPONENT_NAME || "component";
  const merchantProps = props.filter((p) => p.category === "merchant");

  const tbody = document.getElementById("props-body");
  const output = document.getElementById("export-output");
  const copyBtn = document.getElementById("copy-btn");

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function makeControl(p) {
    let el;
    if (p.control === "boolean") {
      el = document.createElement("select");
      ["true", "false"].forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        el.appendChild(o);
      });
      el.value = p.default === true ? "true" : "false";
    } else if (p.control === "enum") {
      el = document.createElement("select");
      (p.enumValues || []).forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        el.appendChild(o);
      });
      if (p.hasDefault) el.value = p.default;
    } else if (p.control === "number") {
      el = document.createElement("input");
      el.type = "number";
      if (p.hasDefault) el.value = p.default;
    } else if (p.control === "array") {
      el = document.createElement("input");
      el.type = "text";
      el.placeholder = "comma, separated, values";
    } else if (p.control === "function") {
      el = document.createElement("input");
      el.type = "text";
      el.placeholder = "(event) => { }";
    } else if (p.control === "object") {
      el = document.createElement("input");
      el.type = "text";
      el.placeholder = "{ }";
      if (p.hasDefault) el.value = typeof p.default === "string" ? p.default : JSON.stringify(p.default);
    } else {
      el = document.createElement("input");
      el.type = "text";
      if (p.hasDefault) el.value = p.default;
    }
    el.className = "value-input form-control form-control-sm";
    el.dataset.name = p.name;
    return el;
  }

  function makeRow(p) {
    const tr = document.createElement("tr");

    const includeTd = document.createElement("td");
    const include = document.createElement("input");
    include.type = "checkbox";
    include.checked = p.hasDefault;
    include.className = "include-cb";
    include.dataset.name = p.name;
    includeTd.appendChild(include);

    const nameTd = document.createElement("td");
    const defaultTag = p.hasDefault ? ` <span style="color:#2a7;">= ${escapeHtml(JSON.stringify(p.default))}</span>` : "";
    nameTd.innerHTML =
      `<code>${escapeHtml(p.name)}</code>${defaultTag}` +
      `<div style="color:#888;font-size:0.8rem;">${escapeHtml(p.type)}</div>` +
      (p.description ? `<div style="color:#666;font-size:0.8rem;">${escapeHtml(p.description)}</div>` : "");

    const valTd = document.createElement("td");
    valTd.appendChild(makeControl(p));

    tr.appendChild(includeTd);
    tr.appendChild(nameTd);
    tr.appendChild(valTd);
    return tr;
  }

  function formatValue(p, raw) {
    switch (p.control) {
      case "boolean":
        return raw === "true" ? "true" : "false";
      case "number":
        return raw === "" ? "0" : String(Number(raw));
      case "enum":
      case "string":
        return JSON.stringify(raw);
      case "array":
        if (!raw.trim()) return "[]";
        return JSON.stringify(raw.split(",").map((s) => s.trim()).filter(Boolean));
      case "function":
        return raw.trim() || "(event) => { console.log(event); }";
      case "object": {
        const v = raw.trim();
        if (!v) return "{}";
        if (v.startsWith("{") || v.startsWith("[")) return v;
        if (/^(true|false|null|-?(0|[1-9]\d*)(\.\d+)?)$/.test(v)) return v;
        return JSON.stringify(v);
      }
      default:
        return JSON.stringify(raw);
    }
  }

  function placeholder(p) {
    switch (p.control) {
      case "boolean":
        return "false";
      case "number":
        return "0";
      case "enum":
        return p.enumValues && p.enumValues.length ? JSON.stringify(p.enumValues[0]) : '""';
      case "string":
        return '""';
      case "array":
        return "[]";
      case "function":
        return "(event) => {}";
      case "object":
        return "{}";
      default:
        return "null";
    }
  }

  function buildConfig() {
    const included = [];
    const commented = [];
    merchantProps.forEach((p) => {
      const cb = tbody.querySelector(`.include-cb[data-name="${p.name}"]`);
      const input = tbody.querySelector(`.value-input[data-name="${p.name}"]`);
      const raw = input ? input.value : "";
      if (cb && cb.checked) {
        included.push(`  ${p.name}: ${formatValue(p, raw)},`);
      } else {
        commented.push(`  // ${p.name}: ${placeholder(p)}, // ${p.type}`);
      }
    });

    const varName = componentName.charAt(0).toLowerCase() + componentName.slice(1) + "Config";
    let lines = included.slice();
    if (commented.length) {
      lines.push("");
      lines.push("  // --- non-default options (uncomment to use) ---");
      lines = lines.concat(commented);
    }
    return `const ${varName} = {\n${lines.join("\n")}\n};`;
  }

  function render() {
    if (!merchantProps.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.style.color = "#666";
      td.textContent = "No component-specific parameters. This component's options are inherited from the base configuration.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    merchantProps.forEach((p) => tbody.appendChild(makeRow(p)));
  }

  function setAll(state) {
    tbody.querySelectorAll(".include-cb").forEach((cb) => {
      cb.checked = state;
    });
  }

  function resetDefaults() {
    tbody.querySelectorAll(".include-cb").forEach((cb) => {
      const p = merchantProps.find((x) => x.name === cb.dataset.name);
      cb.checked = !!(p && p.hasDefault);
    });
  }

  document.getElementById("export-btn").addEventListener("click", () => {
    output.textContent = buildConfig();
    output.style.display = "block";
    copyBtn.style.display = "inline-block";
  });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(output.textContent).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    });
  });

  document.getElementById("select-all").addEventListener("click", () => setAll(true));
  document.getElementById("select-none").addEventListener("click", () => setAll(false));
  document.getElementById("select-defaults").addEventListener("click", resetDefaults);

  render();
})();
