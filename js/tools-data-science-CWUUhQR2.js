import"./modulepreload-polyfill-B5Qt9EMX.js";(()=>{const n=t=>document.getElementById(t);let m=null,x=null,i=null,A=[],f=[],L={},S=0,C=0,y={column:null,direction:"asc"},E=null,Q=null,W=null;const oe=String.raw`
    "use strict";

    let rows = [];
    let columns = [];
    let profiles = [];
    let view = [];
    let chartSample = [];
    let aborted = false;

    const SAMPLE_SIZE = ${1e4};
    const UNIQUE_LIMIT = ${5e4};
    const FREQUENCY_LIMIT = ${2e4};
    const INFERENCE_LIMIT = ${5e3};
    const MAX_LONG_VALUE = ${1e5};

    self.onmessage = event => {
      const m = event.data || {};
      try {
        if (m.type === "parse") parseFile(m.file, m.options || {});
        if (m.type === "cancel") aborted = true;
        if (m.type === "getRows") sendRows(m);
        if (m.type === "query") applyQuery(m);
        if (m.type === "changeType") changeType(m);
        if (m.type === "correlation") correlation(m);
        if (m.type === "dispose") reset();
      } catch (error) {
        postMessage({ type: "error", message: error.message || String(error) });
      }
    };

    function reset() {
      rows = [];
      columns = [];
      profiles = [];
      view = [];
      chartSample = [];
      aborted = false;
    }

    function parseFile(file, options) {
      reset();

      if (!file || !file.size) {
        throw new Error("The selected file is empty.");
      }

      let firstChunk = true;
      let headers = [];
      let malformedRows = 0;
      let duplicateHeaders = [];
      let processedRows = 0;
      let charsRead = 0;
      let parserRef = null;
      const inference = [];
      const aggregators = [];

      postMessage({
        type: "progress",
        phase: "Parsing CSV...",
        percent: 1,
        rows: 0
      });

      Papa.parse(file, {
        header: false,
        skipEmptyLines: "greedy",
        delimiter: options.delimiter || "",
        encoding: options.encoding || "",
        chunkSize: file.size > 100000000 ? 1024 * 1024 * 4 : 1024 * 1024,

        chunk(result, parser) {
          parserRef = parser;

          if (aborted) {
            parser.abort();
            postMessage({ type: "cancelled" });
            return;
          }

          if (result.errors) {
            malformedRows += result.errors.filter(
              e => e.code !== "UndetectableDelimiter"
            ).length;
          }

          const batch = result.data || [];
          if (!batch.length) return;

          if (firstChunk) {
            firstChunk = false;
            const raw = batch.shift() || [];

            if (!raw.length || raw.every(v => isMissing(v))) {
              parser.abort();
              throw new Error("No usable header row was found.");
            }

            const normalized = normalizeHeaders(raw);
            headers = normalized.headers;
            duplicateHeaders = normalized.duplicates;
            columns = headers.map((name, index) => ({
              name,
              index,
              type: "string"
            }));

            headers.forEach(() => {
              inference.push([]);
              aggregators.push(createAggregator());
            });
          }

          for (const sourceRow of batch) {
            if (!Array.isArray(sourceRow)) continue;

            if (sourceRow.length !== headers.length) malformedRows++;

            const row = new Array(headers.length);
            for (let c = 0; c < headers.length; c++) {
              let value = sourceRow[c] == null ? "" : String(sourceRow[c]);

              if (value.length > MAX_LONG_VALUE) {
                value = value.slice(0, MAX_LONG_VALUE);
              }

              row[c] = value;

              if (inference[c].length < INFERENCE_LIMIT && !isMissing(value)) {
                inference[c].push(value);
              }
            }

            rows.push(row);
            processedRows++;
            reservoirAdd(chartSample, row, processedRows, SAMPLE_SIZE);
          }

          charsRead = Math.min(file.size, (result.meta && result.meta.cursor) || charsRead);
          const percent = Math.min(88, Math.max(
            2,
            Math.round((charsRead / Math.max(1, file.size)) * 88)
          ));

          postMessage({
            type: "progress",
            phase: "Parsing CSV...",
            percent,
            rows: processedRows
          });
        },

        complete() {
          if (aborted) return;
          if (!headers.length) {
            throw new Error("The CSV contains no rows or headers.");
          }

          postMessage({
            type: "progress",
            phase: "Analyzing columns...",
            percent: 90,
            rows: processedRows
          });

          for (let c = 0; c < columns.length; c++) {
            columns[c].type = inferType(inference[c]);
          }

          profiles = columns.map((col, c) =>
            profileColumn(c, col.type, aggregators[c])
          );

          postMessage({
            type: "progress",
            phase: "Finding duplicate rows...",
            percent: 96,
            rows: processedRows
          });

          const duplicates = countDuplicates(rows);
          view = rows.map((_, i) => i);

          const warnings = [];
          if (malformedRows) {
            warnings.push(
              malformedRows.toLocaleString() +
              " malformed or inconsistent row event(s) were detected."
            );
          }
          if (duplicateHeaders.length) {
            warnings.push(
              "Duplicate or blank headers were renamed to keep them unique."
            );
          }
          if (file.size > 500 * 1024 * 1024) {
            warnings.push(
              "This is a very large file. Browser memory limits may still apply."
            );
          }

          const suggestions = buildSuggestions(columns);
          const report = buildReport(
            file,
            duplicates,
            malformedRows,
            suggestions
          );

          postMessage({
            type: "complete",
            data: {
              fileName: file.name,
              fileSize: file.size,
              rowCount: rows.length,
              columnCount: columns.length,
              duplicateRows: duplicates,
              malformedRows,
              columns,
              profiles,
              chartSample,
              suggestions,
              warnings,
              report
            }
          });
        },

        error(error) {
          postMessage({
            type: "error",
            message: error.message || "Unable to parse the CSV."
          });
        }
      });
    }

    function normalizeHeaders(raw) {
      const used = new Map();
      const duplicates = [];
      const headers = raw.map((value, index) => {
        let base = String(value == null ? "" : value)
          .replace(/^\\uFEFF/, "")
          .trim();

        if (!base) base = "Column " + (index + 1);

        const count = used.get(base) || 0;
        used.set(base, count + 1);

        if (count) {
          duplicates.push(base);
          return base + " (" + (count + 1) + ")";
        }
        return base;
      });

      return { headers, duplicates };
    }

    function createAggregator() {
      return {};
    }

    function isMissing(value) {
      return value == null || String(value).trim() === "";
    }

    function isInteger(value) {
      return /^[+-]?\\d+$/.test(String(value).trim());
    }

    function isFloat(value) {
      const s = String(value).trim();
      return /^[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?$/.test(s);
    }

    function isBoolean(value) {
      return /^(true|false|yes|no|y|n|0|1)$/i.test(String(value).trim());
    }

    function isDate(value) {
      const s = String(value).trim();
      if (!s || /^\\d+$/.test(s)) return false;

      const datePattern =
        /^\\d{4}[-\\/]\\d{1,2}[-\\/]\\d{1,2}(?:[T\\s].*)?$|`+`^\\d{1,2}[-\\/]\\d{1,2}[-\\/]\\d{2,4}(?:[T\\s].*)?$/;

      return datePattern.test(s) && !Number.isNaN(Date.parse(s));
    }

    function inferType(values) {
      if (!values.length) return "null";

      let integers = 0;
      let floats = 0;
      let booleans = 0;
      let dates = 0;
      const unique = new Set();

      for (const value of values) {
        const s = String(value).trim();
        if (unique.size <= 500) unique.add(s);
        if (isBoolean(s)) booleans++;
        if (isInteger(s)) integers++;
        if (isFloat(s)) floats++;
        if (isDate(s)) dates++;
      }

      const n = values.length;
      const threshold = Math.max(1, Math.floor(n * 0.95));

      if (booleans >= threshold && unique.size <= 8) return "boolean";
      if (integers >= threshold) return "integer";
      if (floats >= threshold) return "float";
      if (dates >= threshold) return "date";

      if (
        unique.size <= 100 ||
        (unique.size / n <= 0.2 && unique.size <= 500)
      ) {
        return "categorical";
      }

      return "string";
    }

    function profileColumn(index, type) {
      let missing = 0;
      let valid = 0;
      let invalid = 0;
      let mean = 0;
      let m2 = 0;
      let min = Infinity;
      let max = -Infinity;
      let minDate = Infinity;
      let maxDate = -Infinity;
      let valuesForQuantiles = [];
      let numericSeen = 0;
      const unique = new Set();
      let uniqueApproximate = false;
      const frequencies = new Map();

      for (const row of rows) {
        const raw = row[index];

        if (isMissing(raw)) {
          missing++;
          continue;
        }

        if (unique.size < UNIQUE_LIMIT) {
          unique.add(raw);
        } else if (!unique.has(raw)) {
          uniqueApproximate = true;
        }

        if (frequencies.size < FREQUENCY_LIMIT || frequencies.has(raw)) {
          frequencies.set(raw, (frequencies.get(raw) || 0) + 1);
        }

        if (type === "integer" || type === "float") {
          const value = Number(raw);
          if (!Number.isFinite(value)) {
            invalid++;
            continue;
          }

          valid++;
          numericSeen++;

          const delta = value - mean;
          mean += delta / numericSeen;
          m2 += delta * (value - mean);
          min = Math.min(min, value);
          max = Math.max(max, value);

          reservoirAdd(
            valuesForQuantiles,
            value,
            numericSeen,
            50000
          );
        } else if (type === "date") {
          const time = Date.parse(raw);
          if (Number.isNaN(time)) {
            invalid++;
          } else {
            valid++;
            minDate = Math.min(minDate, time);
            maxDate = Math.max(maxDate, time);
          }
        } else {
          valid++;
        }
      }

      const sortedFrequencies = [...frequencies.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([value, count]) => ({
          value,
          count,
          percentage: rows.length ? count / rows.length * 100 : 0
        }));

      const profile = {
        name: columns[index].name,
        type,
        count: valid,
        missing,
        invalid,
        unique: unique.size,
        uniqueApproximate,
        topValues: sortedFrequencies
      };

      if (type === "integer" || type === "float") {
        valuesForQuantiles.sort((a, b) => a - b);
        const q1 = quantile(valuesForQuantiles, 0.25);
        const median = quantile(valuesForQuantiles, 0.5);
        const q3 = quantile(valuesForQuantiles, 0.75);

        profile.min = valid ? min : null;
        profile.max = valid ? max : null;
        profile.mean = valid ? mean : null;
        profile.median = median;
        profile.mode = sortedFrequencies[0]?.value ?? null;
        profile.variance = valid > 1 ? m2 / (valid - 1) : 0;
        profile.stdDev = Math.sqrt(profile.variance);
        profile.q1 = q1;
        profile.q3 = q3;
        profile.iqr = q1 != null && q3 != null ? q3 - q1 : null;
        profile.p05 = quantile(valuesForQuantiles, 0.05);
        profile.p10 = quantile(valuesForQuantiles, 0.10);
        profile.p90 = quantile(valuesForQuantiles, 0.90);
        profile.p95 = quantile(valuesForQuantiles, 0.95);

        if (profile.iqr != null) {
          const low = q1 - 1.5 * profile.iqr;
          const high = q3 + 1.5 * profile.iqr;
          let outliers = 0;

          for (const row of rows) {
            const value = Number(row[index]);
            if (Number.isFinite(value) && (value < low || value > high)) {
              outliers++;
            }
          }
          profile.outliers = outliers;
          profile.outlierLow = low;
          profile.outlierHigh = high;
        }
      }

      if (type === "date") {
        profile.minDate = Number.isFinite(minDate)
          ? new Date(minDate).toISOString()
          : null;
        profile.maxDate = Number.isFinite(maxDate)
          ? new Date(maxDate).toISOString()
          : null;
        profile.dateRangeDays =
          Number.isFinite(minDate) && Number.isFinite(maxDate)
            ? (maxDate - minDate) / 86400000
            : null;
      }

      return profile;
    }

    function reservoirAdd(sample, value, seen, limit) {
      if (sample.length < limit) {
        sample.push(value);
        return;
      }

      const index = Math.floor(Math.random() * seen);
      if (index < limit) sample[index] = value;
    }

    function quantile(sorted, probability) {
      if (!sorted.length) return null;
      const position = (sorted.length - 1) * probability;
      const lower = Math.floor(position);
      const upper = Math.ceil(position);
      if (lower === upper) return sorted[lower];
      return sorted[lower] +
        (sorted[upper] - sorted[lower]) * (position - lower);
    }

    function countDuplicates(source) {
      const seen = new Set();
      let duplicates = 0;

      for (const row of source) {
        const key = JSON.stringify(row);
        if (seen.has(key)) duplicates++;
        else seen.add(key);
      }

      return duplicates;
    }

    function buildSuggestions(cols) {
      const numeric = cols.filter(c =>
        c.type === "integer" || c.type === "float"
      );
      const categorical = cols.filter(c =>
        c.type === "categorical" ||
        c.type === "string" ||
        c.type === "boolean"
      );
      const dates = cols.filter(c => c.type === "date");
      const output = [];

      if (numeric.length) {
        output.push({
          label: "Histogram of " + numeric[0].name,
          chart: "histogram",
          x: numeric[0].index,
          y: ""
        });
        output.push({
          label: "Box plot of " + numeric[0].name,
          chart: "box",
          x: numeric[0].index,
          y: ""
        });
      }

      if (numeric.length >= 2) {
        output.push({
          label: numeric[0].name + " vs " + numeric[1].name,
          chart: "scatter",
          x: numeric[0].index,
          y: numeric[1].index
        });
      }

      if (categorical.length && numeric.length) {
        output.push({
          label: numeric[0].name + " by " + categorical[0].name,
          chart: "bar",
          x: categorical[0].index,
          y: numeric[0].index
        });
      }

      if (dates.length && numeric.length) {
        output.push({
          label: numeric[0].name + " over time",
          chart: "line",
          x: dates[0].index,
          y: numeric[0].index
        });
      }

      return output.slice(0, 8);
    }

    function buildReport(file, duplicates, malformed, suggestions) {
      const numeric = profiles.filter(p =>
        p.type === "integer" || p.type === "float"
      );
      const categorical = profiles.filter(p =>
        p.type === "categorical" ||
        p.type === "string" ||
        p.type === "boolean"
      );
      const dates = profiles.filter(p => p.type === "date");
      const missingTotal = profiles.reduce((sum, p) => sum + p.missing, 0);
      const outlierTotal = numeric.reduce(
        (sum, p) => sum + (p.outliers || 0),
        0
      );

      return {
        overview: [
          "File: " + file.name,
          "Rows: " + rows.length.toLocaleString(),
          "Columns: " + columns.length.toLocaleString(),
          "File size: " + file.size.toLocaleString() + " bytes"
        ],
        dataTypes: [
          numeric.length + " numerical column(s)",
          categorical.length + " text/categorical column(s)",
          dates.length + " date/time column(s)",
          profiles.filter(p => p.type === "null").length +
            " empty column(s)"
        ],
        quality: [
          missingTotal.toLocaleString() + " missing cell(s)",
          duplicates.toLocaleString() + " duplicate row(s)",
          malformed.toLocaleString() + " malformed row event(s)"
        ],
        numerical: numeric.slice(0, 15).map(p =>
          p.name + ": mean " + formatNumber(p.mean) +
          ", median " + formatNumber(p.median) +
          ", standard deviation " + formatNumber(p.stdDev)
        ),
        categorical: categorical.slice(0, 15).map(p =>
          p.name + ": " + p.unique.toLocaleString() +
          (p.uniqueApproximate ? "+" : "") + " unique value(s)"
        ),
        outliers: [
          outlierTotal.toLocaleString() +
          " potential IQR outlier occurrence(s) were detected."
        ],
        suggestions: suggestions.map(s => s.label)
      };
    }

    function formatNumber(value) {
      return value == null || !Number.isFinite(Number(value))
        ? "N/A"
        : Number(value).toLocaleString(undefined, {
            maximumFractionDigits: 5
          });
    }

    function sendRows(message) {
      const start = Math.max(0, Number(message.start) || 0);
      const count = Math.max(1, Number(message.count) || 100);
      const indices = view.slice(start, start + count);

      postMessage({
        type: "rows",
        requestId: message.requestId,
        start,
        rows: indices.map(index => ({
          index,
          values: rows[index]
        })),
        total: view.length
      });
    }

    function applyQuery(message) {
      const search = String(message.search || "").trim().toLowerCase();
      const filter = message.filter || null;
      const currentSort = message.sort || null;

      const result = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (search) {
          let found = false;
          for (const value of row) {
            if (String(value).toLowerCase().includes(search)) {
              found = true;
              break;
            }
          }
          if (!found) continue;
        }

        if (filter && !matchesFilter(row, filter)) continue;
        result.push(i);
      }

      if (currentSort && currentSort.column != null) {
        const columnIndex = Number(currentSort.column);
        const direction = currentSort.direction === "desc" ? -1 : 1;
        const type = columns[columnIndex]?.type || "string";

        result.sort((a, b) => {
          const av = comparable(rows[a][columnIndex], type);
          const bv = comparable(rows[b][columnIndex], type);

          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;

          if (typeof av === "number" && typeof bv === "number") {
            return (av - bv) * direction;
          }

          return String(av).localeCompare(
            String(bv),
            undefined,
            { numeric: true, sensitivity: "base" }
          ) * direction;
        });
      }

      view = result;

      postMessage({
        type: "queryComplete",
        token: message.token,
        total: view.length
      });
    }

    function matchesFilter(row, filter) {
      const value = row[Number(filter.column)];
      const type = columns[Number(filter.column)]?.type || "string";
      const wanted = filter.value ?? "";
      const missing = isMissing(value);

      if (filter.operator === "missing") return missing;
      if (filter.operator === "notMissing") return !missing;
      if (missing) return false;

      const a = comparable(value, type);
      const b = comparable(wanted, type);

      switch (filter.operator) {
        case "equals":
          return String(a).toLowerCase() === String(b).toLowerCase();
        case "notEquals":
          return String(a).toLowerCase() !== String(b).toLowerCase();
        case "gt":
          return a > b;
        case "gte":
          return a >= b;
        case "lt":
          return a < b;
        case "lte":
          return a <= b;
        default:
          return String(value).toLowerCase().includes(
            String(wanted).toLowerCase()
          );
      }
    }

    function comparable(value, type) {
      if (isMissing(value)) return null;

      if (type === "integer" || type === "float") {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      }

      if (type === "date") {
        const time = Date.parse(value);
        return Number.isNaN(time) ? null : time;
      }

      if (type === "boolean") {
        return /^(true|yes|y|1)$/i.test(String(value)) ? 1 : 0;
      }

      return String(value);
    }

    function changeType(message) {
      const index = Number(message.column);
      const type = String(message.dataType);

      if (!columns[index]) return;
      columns[index].type = type;

      postMessage({
        type: "progress",
        phase: "Recalculating statistics...",
        percent: 96,
        rows: rows.length
      });

      profiles[index] = profileColumn(index, type);
      const suggestions = buildSuggestions(columns);

      postMessage({
        type: "typeChanged",
        column: index,
        columns,
        profiles,
        suggestions
      });
    }

    function correlation(message) {
      const numeric = columns.filter(c =>
        c.type === "integer" || c.type === "float"
      );

      const limited = numeric.slice(0, 30);
      const matrix = limited.map(a =>
        limited.map(b => pearson(a.index, b.index))
      );

      postMessage({
        type: "correlation",
        requestId: message.requestId,
        names: limited.map(c => c.name),
        matrix,
        truncated: numeric.length > limited.length
      });
    }

    function pearson(aIndex, bIndex) {
      let n = 0;
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;

      for (const row of rows) {
        const a = Number(row[aIndex]);
        const b = Number(row[bIndex]);

        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

        n++;
        sumA += a;
        sumB += b;
        sumAA += a * a;
        sumBB += b * b;
        sumAB += a * b;
      }

      if (n < 2) return null;

      const numerator = n * sumAB - sumA * sumB;
      const denominator = Math.sqrt(
        (n * sumAA - sumA * sumA) *
        (n * sumBB - sumB * sumB)
      );

      return denominator ? numerator / denominator : null;
    }
  `;function ae(){m&&m.terminate(),x&&URL.revokeObjectURL(x);const t=document.querySelector('script[src*="papaparse"]').src,e=`importScripts(${JSON.stringify(t)});
`+oe;x=URL.createObjectURL(new Blob([e],{type:"text/javascript"})),m=new Worker(x),m.onmessage=le,m.onerror=r=>$(r.message||"The analysis worker failed.")}function le(t){const e=t.data||{};if(e.type==="progress"){U(e.phase,e.percent,e.rows);return}if(e.type==="error"){$(e.message);return}if(e.type==="cancelled"){D(),H("Parsing was cancelled.","warning");return}if(e.type==="complete"){i=e.data,D(),ue();return}if(e.type==="rows"){if(e.requestId!==C)return;A=e.rows,S=e.total,pe(e.start);return}if(e.type==="queryComplete"){if(e.token!==C)return;S=e.total,n("viewport").scrollTop=0,J(),T();return}if(e.type==="typeChanged"){i.columns=e.columns,i.profiles=e.profiles,i.suggestions=e.suggestions,D(),G(),X(),F(),K(),ee(),ne(),T();return}e.type==="correlation"&&ve(e)}function j(t){if(re(),!t)return;if(!(/\.csv$/i.test(t.name)||/csv|text|excel/i.test(t.type||""))){$("Please select a CSV or text-delimited file.");return}if(!window.Worker){$("This browser does not support Web Workers.");return}if(!window.Papa){$("Papa Parse could not be loaded.");return}window.Plotly||H("Plotly was not loaded. Parsing will work, but charts may not.","warning"),!(t.size>1024*1024*1024&&!confirm("This file is larger than 1 GB. Browser memory limitations may prevent it from completing. Continue?"))&&(ae(),U("Preparing CSV...",0,0),m.postMessage({type:"parse",file:t,options:{encoding:n("encoding").value,delimiter:n("delimiter").value}}))}function ue(){n("dashboard").classList.remove("hidden"),n("resetBtn").classList.remove("hidden"),n("fileName").textContent=i.fileName,f=i.columns.map(t=>t.index),i.columns.forEach(t=>{L[t.index]=Math.min(320,Math.max(120,t.name.length*9+40))}),S=i.rowCount,y={column:null,direction:"asc"},E=null,ce(),G(),X(),me(),R(),F(),K(),ee(),ne(),J(),T(),i.chartSample.length<i.rowCount?(n("sampleBadge").classList.remove("hidden"),n("sampleBadge").textContent=`Charts use a representative sample of ${d(i.chartSample.length)} rows`):n("sampleBadge").classList.add("hidden"),i.warnings.length&&H(i.warnings.join(`
`),"warning"),document.querySelector("#overview").scrollIntoView({behavior:"smooth",block:"start"})}function ce(){const t=i.profiles.reduce((e,r)=>e+r.missing,0);n("overviewCards").innerHTML=[N("File size",xe(i.fileSize)),N("Rows",d(i.rowCount)),N("Columns",d(i.columnCount)),N("Missing cells",d(t)),N("Duplicate rows",d(i.duplicateRows)),N("Malformed events",d(i.malformedRows))].join("")}function N(t,e){return`
      <div class="metric">
        <span>${c(t)}</span>
        <strong title="${c(String(e))}">
          ${c(String(e))}
        </strong>
      </div>`}function G(){const t=["string","categorical","integer","float","boolean","date","null"],e=i.columns.map((r,o)=>{const a=i.profiles[o];return`
        <tr>
          <td>${o+1}</td>
          <td title="${c(r.name)}">
            ${c(r.name)}
          </td>
          <td>
            <select class="type-select"
                    data-column="${r.index}"
                    aria-label="Type for ${c(r.name)}">
              ${t.map(s=>`
                <option value="${s}"
                        ${r.type===s?"selected":""}>
                  ${s}
                </option>
              `).join("")}
            </select>
          </td>
          <td>${d(a.count)}</td>
          <td>${d(a.missing)}</td>
          <td>
            ${d(a.unique)}
            ${a.uniqueApproximate?"+":""}
          </td>
          <td>${d(a.invalid||0)}</td>
        </tr>
      `}).join("");n("schemaTable").innerHTML=`
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Column</th>
            <th>Detected type</th>
            <th>Valid</th>
            <th>Missing</th>
            <th>Unique</th>
            <th>Invalid for type</th>
          </tr>
        </thead>
        <tbody>${e}</tbody>
      </table>
    `,document.querySelectorAll(".type-select").forEach(r=>{r.addEventListener("change",()=>{U("Recalculating statistics...",95,i.rowCount),m.postMessage({type:"changeType",column:Number(r.dataset.column),dataType:r.value})})})}function X(){const t=i.columns.map(s=>`
      <option value="${s.index}">
        ${c(s.name)}
      </option>
    `).join("");n("filterColumn").innerHTML=t,n("statsColumn").innerHTML=t;const e=`
      <option value="">None</option>
      ${t}
    `;n("xAxis").innerHTML=e,n("yAxis").innerHTML=e,n("colorAxis").innerHTML=e,n("sizeAxis").innerHTML=e;const r=i.columns.filter(w),o=i.columns.find(s=>s.type==="date"),a=i.columns.find(V);o&&r.length?(n("xAxis").value=String(o.index),n("yAxis").value=String(r[0].index)):r.length>=2?(n("xAxis").value=String(r[0].index),n("yAxis").value=String(r[1].index)):r.length?n("xAxis").value=String(r[0].index):a&&(n("xAxis").value=String(a.index)),F()}function me(){n("columnChooser").innerHTML=i.columns.map(t=>`
      <label title="${c(t.name)}">
        <input type="checkbox"
               data-column="${t.index}"
               ${f.includes(t.index)?"checked":""}>
        <span>${c(t.name)}</span>
      </label>
    `).join(""),n("columnChooser").querySelectorAll('input[type="checkbox"]').forEach(t=>{t.addEventListener("change",()=>{const e=Number(t.dataset.column);t.checked?f.includes(e)||(f.push(e),f.sort((r,o)=>r-o)):f=f.filter(r=>r!==e),f.length||(t.checked=!0,f=[e],g("At least one column must remain visible.")),R(),T()})})}function R(){const t=P();n("tableHeader").style.width=`${t}px`,n("tableHeader").innerHTML=f.map(e=>{const r=i.columns[e],a=y.column===e?y.direction==="asc"?" ▲":" ▼":"";return`
        <div class="vhead"
             data-column="${e}"
             style="width:${L[e]}px"
             title="${c(r.name)}">
          ${c(r.name)}${a}
          <span class="resize-handle"
                data-column="${e}"
                aria-hidden="true"></span>
        </div>
      `}).join(""),n("tableHeader").querySelectorAll(".vhead").forEach(e=>{e.addEventListener("click",r=>{if(r.target.classList.contains("resize-handle"))return;const o=Number(e.dataset.column);y.column===o?y.direction=y.direction==="asc"?"desc":"asc":y={column:o,direction:"asc"},n("sortStatus").textContent=`${i.columns[o].name}: ${y.direction}`,R(),k()})}),n("tableHeader").querySelectorAll(".resize-handle").forEach(e=>{e.addEventListener("mousedown",de),e.addEventListener("click",r=>r.stopPropagation())}),n("spacer").style.width=`${t}px`}function de(t){t.preventDefault(),t.stopPropagation();const e=Number(t.currentTarget.dataset.column),r=t.clientX,o=L[e];function a(u){L[e]=Math.max(70,Math.min(600,o+u.clientX-r)),R(),Z()}function s(){document.removeEventListener("mousemove",a),document.removeEventListener("mouseup",s)}document.addEventListener("mousemove",a),document.addEventListener("mouseup",s)}function T(){!m||!i||(clearTimeout(W),W=setTimeout(()=>{const t=n("viewport"),e=Math.ceil(t.clientHeight/38),r=Math.max(0,Math.floor(t.scrollTop/38)-8),o=e+16;C+=1;const a=C;m.postMessage({type:"getRows",start:r,count:o,requestId:a})},15))}function pe(t){const e=n("viewport"),r=P();n("spacer").style.height=`${Math.max(1,S*38)}px`,n("spacer").style.width=`${r}px`,n("virtualRows").style.transform=`translateY(${t*38}px)`,n("virtualRows").style.width=`${r}px`,Z(),Y(e.scrollLeft)}function Z(){const t=P();n("virtualRows").style.width=`${t}px`,n("virtualRows").innerHTML=A.map(e=>`
      <div class="vrow"
           data-source-index="${e.index}"
           style="width:${t}px">
        ${f.map(r=>{const o=e.values[r]??"";return`
            <div class="vcell"
                 data-column="${r}"
                 style="width:${L[r]}px"
                 title="${c(O(o,1e3))}">
              ${c(O(o,500))}
            </div>
          `}).join("")}
      </div>
    `).join(""),n("virtualRows").querySelectorAll(".vcell").forEach(e=>{e.addEventListener("dblclick",async()=>{const r=e.closest(".vrow"),o=Number(r.dataset.sourceIndex),a=A.find(u=>u.index===o),s=(a==null?void 0:a.values[Number(e.dataset.column)])??"";try{await navigator.clipboard.writeText(String(s)),g("Cell value copied.")}catch{we(String(s))}})})}function P(){return f.reduce((t,e)=>t+(L[e]||120),0)}function Y(t){n("tableHeader").scrollLeft=t,n("tableHeader").style.transform=`translateX(${-t}px)`}function k(){if(!m||!i)return;const t=++C;m.postMessage({type:"query",token:t,search:n("searchInput").value,filter:E,sort:y})}function J(){const t=S!==i.rowCount;n("previewStatus").textContent=`${d(S)} ${t?"matching ":""}row(s); ${d(f.length)} visible column(s).`}function F(){if(!i||!i.profiles.length)return;const t=Number(n("statsColumn").value||0),e=i.profiles[t];if(!e)return;const r=[["Type",e.type],["Valid count",d(e.count)],["Missing",d(e.missing)],["Unique values",`${d(e.unique)}${e.uniqueApproximate?"+":""}`],["Invalid for type",d(e.invalid||0)]];let o=[];(e.type==="integer"||e.type==="float")&&(o=[["Minimum",p(e.min)],["Maximum",p(e.max)],["Mean",p(e.mean)],["Median",p(e.median)],["Mode",be(e.mode)],["Standard deviation",p(e.stdDev)],["Variance",p(e.variance)],["5th percentile",p(e.p05)],["10th percentile",p(e.p10)],["Q1",p(e.q1)],["Q3",p(e.q3)],["90th percentile",p(e.p90)],["95th percentile",p(e.p95)],["IQR",p(e.iqr)],["Potential outliers",d(e.outliers||0)]]),e.type==="date"&&(o=[["Minimum date",se(e.minDate)],["Maximum date",se(e.maxDate)],["Date range",e.dateRangeDays==null?"N/A":`${p(e.dateRangeDays)} days`]]);const a=e.topValues||[];n("statsContent").innerHTML=`
      <div class="stats-grid">
        ${[...r,...o].map(([s,u])=>`
          <div class="stat-item">
            <span>${c(s)}</span>
            <strong>${c(String(u))}</strong>
          </div>
        `).join("")}
      </div>

      <h3 style="margin-top:22px">Most frequent values</h3>

      ${a.length?`
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Value</th>
                <th>Frequency</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${a.map(s=>`
                <tr>
                  <td title="${c(String(s.value))}">
                    ${c(O(s.value,300))}
                  </td>
                  <td>${d(s.count)}</td>
                  <td>${p(s.percentage)}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `:'<p class="muted">No non-empty values are available.</p>'}
    `}function K(){const t=i.profiles.map(e=>({name:e.name,missing:e.missing,percentage:i.rowCount?e.missing/i.rowCount*100:0})).sort((e,r)=>r.missing-e.missing);n("missingContent").innerHTML=`
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Column</th>
              <th>Missing</th>
              <th>Percentage</th>
              <th>Completeness</th>
            </tr>
          </thead>
          <tbody>
            ${t.map(e=>`
              <tr>
                <td>${c(e.name)}</td>
                <td>${d(e.missing)}</td>
                <td>${p(e.percentage)}%</td>
                <td>
                  ${p(Math.max(0,100-e.percentage))}%
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `}function ee(){const t=n("suggestions");if(!i.suggestions.length){t.innerHTML=`
        <p class="muted">
          No automatic chart suggestion is available for this schema.
          Select columns manually.
        </p>
      `;return}t.innerHTML=i.suggestions.map((e,r)=>`
        <button class="suggestion"
                data-suggestion="${r}">
          ${c(e.label)}
        </button>
      `).join(""),t.querySelectorAll(".suggestion").forEach(e=>{e.addEventListener("click",()=>{const r=i.suggestions[Number(e.dataset.suggestion)];n("chartType").value=r.chart,n("xAxis").value=String(r.x??""),n("yAxis").value=String(r.y??""),te()})})}function te(){if(!i||!window.Plotly){$("Plotly is unavailable.");return}let t=n("chartType").value,e=B(n("xAxis").value),r=B(n("yAxis").value);const o=B(n("colorAxis").value),a=B(n("sizeAxis").value);if(t==="auto"){const l=fe(e,r);t=l.chartType,e=l.xIndex,r=l.yIndex,n("chartType").value=t,n("xAxis").value=e==null?"":String(e),n("yAxis").value=r==null?"":String(r)}if(e==null&&r==null){g("Select at least one axis.");return}const s=i.chartSample,u=e==null?null:i.columns[e],b=r==null?null:i.columns[r],z=e==null?[]:s.map(l=>ie(l[e],u.type)),Se=r==null?[]:s.map(l=>ie(l[r],b.type)),M={opacity:.78,color:"#5b8cff"};if(o!=null){const l=i.columns[o],h=s.map(v=>v[o]);w(l)?(M.color=h.map(Number),M.colorscale="Viridis",M.showscale=!0):M.color=he(h)}if(a!=null&&w(i.columns[a])){const l=s.map(_=>Number(_[a])),h=l.filter(Number.isFinite),v=Math.max(...h,1);M.size=l.map(_=>Number.isFinite(_)?6+Math.max(0,_)/v*20:6),M.sizemode="diameter"}let q=[],I="Visualization";if(t==="histogram"){const l=e??r,h=i.columns[l];if(!w(h)){g("A histogram requires a numerical column.");return}q=[{type:"histogram",x:s.map(v=>Number(v[l])).filter(Number.isFinite),marker:{color:"#5b8cff"}}],I=`Histogram of ${h.name}`}if(t==="box"){const l=e!=null&&w(i.columns[e])?e:r;if(l==null||!w(i.columns[l])){g("A box plot requires a numerical column.");return}const h=l===r?e:null;h!=null&&V(i.columns[h])?q=[{type:"box",x:s.map(v=>v[h]),y:s.map(v=>Number(v[l])),boxpoints:"outliers",marker:{color:"#875cff"}}]:q=[{type:"box",y:s.map(v=>Number(v[l])).filter(Number.isFinite),name:i.columns[l].name,boxpoints:"outliers",marker:{color:"#875cff"}}],I=`Box plot of ${i.columns[l].name}`}if(t==="scatter"||t==="line"){if(e==null||r==null){g("Scatter and line charts require X and Y axes.");return}q=[{type:"scatter",mode:t==="line"?"lines+markers":"markers",x:z,y:Se,marker:M,line:{color:"#5b8cff",width:2},text:o==null?void 0:s.map(l=>String(l[o]??"")),hovertemplate:`${c(u.name)}: %{x}<br>${c(b.name)}: %{y}<extra></extra>`}],I=`${b.name} by ${u.name}`}if(t==="bar"){if(e==null){g("A bar chart requires an X axis.");return}const l=ge(s,e,r);q=[{type:"bar",x:l.labels,y:l.values,marker:{color:"#5b8cff"}}],I=r==null?`Frequency by ${i.columns[e].name}`:`Average ${i.columns[r].name} by ${i.columns[e].name}`}Plotly.react("chart",q,{title:{text:I},paper_bgcolor:"#ffffff",plot_bgcolor:"#ffffff",margin:{t:60,r:30,b:80,l:70},xaxis:{title:(u==null?void 0:u.name)||"",automargin:!0},yaxis:{title:(b==null?void 0:b.name)||"",automargin:!0},hovermode:"closest"},{responsive:!0,displaylogo:!1})}function fe(t,e){var s;const r=i.columns.filter(w),o=i.columns.filter(u=>u.type==="date"),a=i.columns.filter(V);return t!=null&&e!=null&&w(i.columns[t])&&w(i.columns[e])?{chartType:"scatter",xIndex:t,yIndex:e}:o.length&&r.length?{chartType:"line",xIndex:o[0].index,yIndex:r[0].index}:a.length&&r.length?{chartType:"bar",xIndex:a[0].index,yIndex:r[0].index}:r.length?{chartType:"histogram",xIndex:r[0].index,yIndex:null}:{chartType:"bar",xIndex:((s=i.columns[0])==null?void 0:s.index)??null,yIndex:null}}function ge(t,e,r){const o=new Map;for(const s of t){const u=String(s[e]??"").trim()||"(missing)";o.has(u)||o.set(u,{count:0,sum:0,numericCount:0});const b=o.get(u);if(b.count++,r!=null){const z=Number(s[r]);Number.isFinite(z)&&(b.sum+=z,b.numericCount++)}}const a=[...o.entries()].map(([s,u])=>({label:s,value:r==null?u.count:u.numericCount?u.sum/u.numericCount:0,count:u.count})).sort((s,u)=>u.count-s.count).slice(0,50);return{labels:a.map(s=>s.label),values:a.map(s=>s.value)}}function he(t){const e=["#5b8cff","#875cff","#31c48d","#f6ad55","#f56565","#38bdf8","#e879f9","#a3e635"],r=new Map;return t.map(o=>{const a=String(o);return r.has(a)||r.set(a,e[r.size%e.length]),r.get(a)})}function ve(t){if(window.Plotly){if(!t.names.length){n("correlationChart").innerHTML=`
        <p class="muted">
          At least one numerical column is required.
        </p>
      `;return}Plotly.react("correlationChart",[{type:"heatmap",x:t.names,y:t.names,z:t.matrix,zmin:-1,zmax:1,colorscale:"RdBu",reversescale:!0,colorbar:{title:"r"},hovertemplate:"%{x}<br>%{y}<br>%{z:.3f}<extra></extra>"}],{title:{text:t.truncated?"Correlation matrix — first 30 numerical columns":"Correlation matrix"},paper_bgcolor:"#ffffff",plot_bgcolor:"#ffffff",margin:{t:70,r:30,b:120,l:120},xaxis:{automargin:!0},yaxis:{automargin:!0}},{responsive:!0,displaylogo:!1})}}function ne(){const t=i.report,e=[["Dataset Overview",t.overview],["Data Types",t.dataTypes],["Missing Values and Duplicate Rows",t.quality],["Numerical Statistics",t.numerical],["Categorical Statistics",t.categorical],["Potential Outliers",t.outliers],["Suggested Visualizations",t.suggestions]],r=i.columns.filter(w).length;e.splice(5,0,["Correlations",r>=2?[`${r} numerical columns are available. Generate the correlation matrix to inspect linear relationships.`]:["At least two numerical columns are required for correlation analysis."]]),n("reportContent").innerHTML=e.map(([o,a])=>`
      <article class="report-card">
        <h3>${c(o)}</h3>
        ${a&&a.length?`
          <ul>
            ${a.map(s=>`
              <li>${c(String(s))}</li>
            `).join("")}
          </ul>
        `:'<p class="muted">No applicable results.</p>'}
      </article>
    `).join("")}function ye(){m&&(m.postMessage({type:"dispose"}),m.terminate(),m=null),x&&(URL.revokeObjectURL(x),x=null),i=null,A=[],f=[],S=0,C=0,E=null,y={column:null,direction:"asc"},n("dashboard").classList.add("hidden"),n("resetBtn").classList.add("hidden"),n("progressPanel").classList.add("hidden"),n("fileInput").value="",n("searchInput").value="",n("filterValue").value="",n("chart").innerHTML="",n("correlationChart").innerHTML="",n("sortStatus").textContent="Unsorted",re(),window.scrollTo({top:0,behavior:"smooth"})}function U(t,e,r){n("progressPanel").classList.remove("hidden"),n("progressText").textContent=r?`${t} ${d(r)} rows processed`:t,n("progressPercent").textContent=`${Math.round(e||0)}%`,n("progressBar").style.width=`${Math.max(0,Math.min(100,e))}%`}function D(){n("progressPanel").classList.add("hidden")}function H(t,e){n("message").textContent=t,n("message").className=`message ${e||"warning"}`}function re(){n("message").className="message hidden",n("message").textContent=""}function $(t){D(),H(t||"An unexpected error occurred.","error")}function g(t){n("toast").textContent=t,n("toast").classList.remove("hidden"),clearTimeout(g.timer),g.timer=setTimeout(()=>{n("toast").classList.add("hidden")},2400)}function we(t){const e=document.createElement("textarea");e.value=t,e.style.position="fixed",e.style.opacity="0",document.body.appendChild(e),e.select();try{document.execCommand("copy"),g("Cell value copied.")}catch{g("Copy failed.")}e.remove()}function B(t){return t===""?null:Number(t)}function w(t){return t&&(t.type==="integer"||t.type==="float")}function V(t){return t&&["categorical","string","boolean"].includes(t.type)}function ie(t,e){if(e==="integer"||e==="float"){const r=Number(t);return Number.isFinite(r)?r:null}if(e==="date"){const r=new Date(t);return Number.isNaN(r.getTime())?null:r}return t}function d(t){return Number(t||0).toLocaleString()}function p(t){return t==null||t===""||!Number.isFinite(Number(t))?"N/A":Number(t).toLocaleString(void 0,{maximumFractionDigits:6})}function be(t){return t==null||t===""?"N/A":String(t)}function se(t){if(!t)return"N/A";const e=new Date(t);return Number.isNaN(e.getTime())?"N/A":e.toLocaleString()}function xe(t){if(!t)return"0 B";const e=["B","KB","MB","GB","TB"],r=Math.min(e.length-1,Math.floor(Math.log(t)/Math.log(1024)));return`${(t/Math.pow(1024,r)).toFixed(r?2:0)} ${e[r]}`}function O(t,e){const r=String(t??"");return r.length>e?`${r.slice(0,e)}…`:r}function c(t){return String(t??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}n("chooseBtn").addEventListener("click",t=>{t.stopPropagation(),n("fileInput").click()}),n("dropZone").addEventListener("click",t=>{t.target!==n("chooseBtn")&&n("fileInput").click()}),n("dropZone").addEventListener("keydown",t=>{(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),n("fileInput").click())}),n("fileInput").addEventListener("change",t=>{j(t.target.files[0])}),["dragenter","dragover"].forEach(t=>{n("dropZone").addEventListener(t,e=>{e.preventDefault(),n("dropZone").classList.add("dragging")})}),["dragleave","drop"].forEach(t=>{n("dropZone").addEventListener(t,e=>{e.preventDefault(),n("dropZone").classList.remove("dragging")})}),n("dropZone").addEventListener("drop",t=>{const e=t.dataTransfer.files[0];j(e)}),n("cancelBtn").addEventListener("click",()=>{m&&m.postMessage({type:"cancel"})}),n("resetBtn").addEventListener("click",ye),n("columnBtn").addEventListener("click",()=>{n("columnChooser").classList.toggle("hidden")}),n("statsColumn").addEventListener("change",F),n("viewport").addEventListener("scroll",t=>{Y(t.currentTarget.scrollLeft),T()}),n("searchInput").addEventListener("input",()=>{clearTimeout(Q),Q=setTimeout(k,350)}),n("filterOperator").addEventListener("change",()=>{const t=!["missing","notMissing"].includes(n("filterOperator").value);n("filterValue").disabled=!t}),n("applyFilter").addEventListener("click",()=>{E={column:Number(n("filterColumn").value),operator:n("filterOperator").value,value:n("filterValue").value},k()}),n("clearFilter").addEventListener("click",()=>{E=null,n("filterValue").value="",k()}),n("chartBtn").addEventListener("click",te),n("correlationBtn").addEventListener("click",()=>{m&&(n("correlationChart").innerHTML='<p class="muted">Calculating correlation...</p>',m.postMessage({type:"correlation",requestId:Date.now()}))}),window.addEventListener("beforeunload",()=>{m&&m.terminate(),x&&URL.revokeObjectURL(x)})})();
