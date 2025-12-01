/*
 * @Author: yaoruidong yaord@meix.com
 * @Date: 2025-12-01 09:41:22
 * @LastEditors: yaoruidong yaord@meix.com
 * @LastEditTime: 2025-12-01 10:08:28
 * @FilePath: /ework-log/work_time_collect.js
 * @Description: 
 * 
 */
const xlsx = require("xlsx");
const fs = require('fs');
const https = require('https');
const FILE_PATH = "/Users/finley/meix/ework-log/work.xlsx";

// Helper: convert Excel serial date to JS Date
function excelDateToJSDate(serial) {
  if (serial == null) return null;
  if (serial instanceof Date) return serial;
  if (typeof serial !== 'number') return null;
  const days = Math.floor(serial - 25569);
  const seconds = Math.round((serial - Math.floor(serial)) * 86400);
  return new Date((days * 86400 + seconds) * 1000);
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function formatDateTime(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  // return only date part for consistency
  return `${y}-${m}-${day}`;
}

function formatDateOnly(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

// Parse various duration formats into decimal hours. Returns null if cannot parse.
function parseDurationToHours(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    // Excel can store durations as fraction of day (<=1)
    return val <= 1 ? val * 24 : val;
  }
  const s = String(val).trim();
  // hh:mm or hh:mm:ss
  const parts = s.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (parts) {
    const h = parseInt(parts[1], 10);
    const m = parseInt(parts[2], 10);
    const sec = parts[3] ? parseInt(parts[3], 10) : 0;
    return h + m / 60 + sec / 3600;
  }
  // formats like '8小时', '8h'
  const m2 = s.match(/([\d.]+)\s*(小时|h|hr|hrs)?/i);
  if (m2) return parseFloat(m2[1]);
  // fallback numeric extraction
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (!isNaN(n)) return n;
  return null;
}

// Fetch Timor API for a full year: returns map { 'YYYY-MM-DD': status }
function fetchHolidayYear(year) {
  return new Promise((resolve, reject) => {
    const url = `https://timor.tech/api/holiday/year/${year}`;
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const obj = JSON.parse(raw);
          const map = {};
          // Walk object to find date entries with status
          function walk(o) {
            if (!o || typeof o !== 'object') return;
            for (const k of Object.keys(o)) {
              const v = o[k];
              if (v && typeof v === 'object' && ('date' in v) && ('status' in v)) {
                const dateKey = v.date || k;
                map[dateKey] = v.status;
              } else if (typeof v === 'object') {
                walk(v);
              }
            }
          }
          walk(obj);
          resolve(map);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 新增 Excel 读取逻辑
try {
  const workbook = xlsx.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 将工作表数据转换为 JSON 格式
  const data = xlsx.utils.sheet_to_json(worksheet, { raw: true });

  // 自动收集要查询的年份，并从 Timor API 获取节假日数据
  const years = new Set();
  data.forEach((row) => {
    const rawTime = row['时间'];
    let d = null;
    if (rawTime instanceof Date) d = rawTime;
    else if (typeof rawTime === 'number') d = excelDateToJSDate(rawTime);
    else {
      const parsed = new Date(String(rawTime || ''));
      if (!isNaN(parsed)) d = parsed;
    }
    if (d && !isNaN(d.getTime())) years.add(d.getFullYear());
  });

  // Fetch holiday maps for all years (if any)
  const apiHolidayMap = {}; // date -> status
  const yearArr = Array.from(years.values());
  const fetchPromises = yearArr.map((y) => fetchHolidayYear(y).catch((e) => {
    console.warn(`获取 ${y} 年节假日失败：`, e.message || e);
    return {};
  }));

  // Proceed asynchronously: fetch then process data
  (async () => {
    try {
      const maps = await Promise.all(fetchPromises);
      maps.forEach((m) => Object.assign(apiHolidayMap, m));

      const filteredData = data
        .map((row) => {
          // 时间: handle Date, Excel serial number, or string
          const rawTime = row['时间'];
          let timeText = '';
          let parsedDate = null;
          if (rawTime instanceof Date) {
            parsedDate = rawTime;
            timeText = formatDateTime(rawTime);
          } else if (typeof rawTime === 'number') {
            parsedDate = excelDateToJSDate(rawTime);
            timeText = formatDateTime(parsedDate);
          } else {
            parsedDate = new Date(String(rawTime || ''));
            timeText = parsedDate && !isNaN(parsedDate.getTime()) ? formatDateTime(parsedDate) : (rawTime != null ? String(rawTime) : '');
          }

          const dateOnly = formatDateOnly(parsedDate || new Date(timeText));

          // 实际工作时长: parse to decimal hours where possible
          const rawDur = row['__EMPTY'];
          const hoursNumeric = parseDurationToHours(rawDur);
          const displayDur = hoursNumeric == null ? (rawDur == null ? '' : String(rawDur)) : hoursNumeric.toFixed(1);

          // 判断是否应过滤：优先使用 Timor API 返回的 status（若存在），status: 0 工作日,1 周末,2 节假日,3 调休补班
          let skip = false;
          const apiStatus = apiHolidayMap[dateOnly];
          if (apiStatus !== undefined) {
            // status 2 (法定节假日) 或 1 (周末) 需过滤；status 3 为补班（不过滤）
            if (apiStatus === 2 || apiStatus === 1) skip = true;
            if (apiStatus === 3) skip = false;
          } else {
            // fallback: 按自然周末过滤
            const dt = new Date(dateOnly + 'T00:00:00');
            const dayOfWeek = dt.getDay(); // 0 Sun .. 6 Sat
            skip = dayOfWeek === 0 || dayOfWeek === 6;
          }

          if (skip) return null;

          const target = {
            时间: dateOnly,
            班次: row['__EMPTY_2'] || '',
            实际工作时长: displayDur,
            _hoursNumeric: hoursNumeric == null ? 0 : hoursNumeric,
          };
          return target;
        })
        .filter((i) => i)
        .reverse();

      const totalHours = filteredData.reduce((acc, row) => acc + (row._hoursNumeric || 0), 0);

      const workDays = Math.floor(totalHours / 8);
      const remainHours = totalHours % 8;
      const durationText = `${workDays}天${remainHours.toFixed(1)}小时`;

      const mdHeader = `| 时间 | 班次 | 实际工作时长(h) |\n|------|------|--------------|`;
      const mdContent = filteredData
        .reduce((acc, row) => acc + `\n| ${row.时间} | ${row.班次} | ${row.实际工作时长} |`, mdHeader)
        + `\n| **总计** | | ${totalHours.toFixed(1)}小时（${durationText}） |`;

      fs.writeFileSync("time.md", mdContent);
      console.log("整合工时打卡信息完成，结果已保存至 time.md");
    } catch (e) {
      console.error('处理数据时出错：', e.message || e);
    }
  })();
  
} catch (err) {
  console.error("读取 Excel 文件失败:", err.message);
}
