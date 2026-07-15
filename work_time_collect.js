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
  if (val == null || val === '' || val === '--' || val === '-') return null;
  if (typeof val === 'number') {
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

// 读取并解析 Excel 数据
try {
  const workbook = xlsx.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 使用 header:1 获取原始行数组
  const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });

  // 筛选数据行：col[0] 为日期格式 "2026/06/01 星期一"
  const datePattern = /^(\d{4})\/(\d{2})\/(\d{2})\s*(星期|周)/;
  const dataRows = allRows.filter(row => row[0] && typeof row[0] === 'string' && datePattern.test(row[0]));

  console.log(`解析到 ${dataRows.length} 行打卡数据`);

  // 自动收集要查询的年份，并从 Timor API 获取节假日数据
  const years = new Set();
  dataRows.forEach((row) => {
    const match = String(row[0]).match(datePattern);
    if (match) years.add(parseInt(match[1], 10));
  });

  // Fetch holiday maps for all years
  const apiHolidayMap = {};
  const yearArr = Array.from(years.values());
  const fetchPromises = yearArr.map((y) => fetchHolidayYear(y).catch((e) => {
    console.warn(`获取 ${y} 年节假日失败：`, e.message || e);
    return {};
  }));

  // Proceed asynchronously
  (async () => {
    try {
      const maps = await Promise.all(fetchPromises);
      maps.forEach((m) => Object.assign(apiHolidayMap, m));

      const filteredData = dataRows
        .map((row) => {
          // 列索引:
          // col[0]  = 日期 "2026/06/01 星期一"
          // col[5]  = 所属规则 "900-1800"
          // col[6]  = 班次 "09:00-11:30、13:00-18:00" 或 "休息"
          // col[10] = 标准工作时长(小时)
          // col[11] = 实际工作时长(小时)
          // col[12] = 假勤申请/考勤结果

          const rawDate = String(row[0] || '');
          const shift = row[6] != null ? String(row[6]).trim() : '';
          const rawHours = row[11]; // 实际工作时长

          // 解析日期
          const match = rawDate.match(datePattern);
          if (!match) return null;
          const dateOnly = `${match[1]}-${match[2]}-${match[3]}`;

          // 如果班次为"休息"则跳过
          if (shift === '休息') return null;

          // 实际工作时长: parse to decimal hours
          const hoursNumeric = parseDurationToHours(rawHours);
          const displayDur = hoursNumeric == null ? (rawHours == null ? '' : String(rawHours)) : hoursNumeric.toFixed(1);

          // 判断是否应过滤：优先使用 Timor API 返回的 status
          let skip = false;
          const apiStatus = apiHolidayMap[dateOnly];
          if (apiStatus !== undefined) {
            // status 2 (法定节假日) 或 1 (周末) 需过滤；status 3 为补班（不过滤）
            if (apiStatus === 2 || apiStatus === 1) skip = true;
            if (apiStatus === 3) skip = false;
          } else {
            // fallback: 按自然周末过滤
            const dt = new Date(dateOnly + 'T00:00:00');
            const dayOfWeek = dt.getDay();
            skip = dayOfWeek === 0 || dayOfWeek === 6;
          }

          if (skip) return null;

          return {
            时间: dateOnly,
            班次: shift || '正常',
            实际工作时长: displayDur,
            _hoursNumeric: hoursNumeric == null ? 0 : hoursNumeric,
          };
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
