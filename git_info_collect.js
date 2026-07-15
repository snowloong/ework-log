const SCAN_PATH = "/Users/finley/meix";
const SAVE_PATH = "./logs/";
const IGNORE_DIR = [
  "amac_library",
  "linux-ftools",
  "hcache",
  "vmtouch",
  "git_log",
];
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

// 从 Excel 动态读取时间区间
const EXCEL_PATH = "/Users/finley/meix/ework-log/work.xlsx";
const DATE_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2})\s*(星期|周)/;

function getDateRangeFromExcel() {
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });

  const dates = [];
  allRows.forEach(row => {
    if (row[0] && typeof row[0] === 'string') {
      const match = String(row[0]).match(DATE_PATTERN);
      if (match) {
        dates.push(`${match[1]}-${match[2]}-${match[3]}`);
      }
    }
  });

  if (dates.length === 0) {
    console.warn('未从 Excel 解析到有效日期，使用默认区间');
    return { start: "2026-06-01", end: "2026-06-30" };
  }

  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

const { start: START_DATE, end: END_DATE } = getDateRangeFromExcel();
console.log(`从 ${EXCEL_PATH} 读取时间区间: ${START_DATE} ~ ${END_DATE}`);

// git log --since="2025-02-18" --until="2025-02-31" --author="yaoruidong" --pretty=format:"%h - %an, %ad : %s" --date=short > ~/Desktop/meix-marketing-h5.log
const { execSync } = require("child_process");

const run_shell = (dir_name) => {
  const fullPath = path.join(SCAN_PATH, dir_name);
  const logPath = path.resolve(SAVE_PATH, `${dir_name}.log`);
  const cmd = `git log --since=${START_DATE} --until=${END_DATE} --author="yaoruidong" --pretty=format:"%h - %an, %ad : %s" --date=short > "${logPath}"`;

  try {
    console.log(`正在执行: ${dir_name}`);
    execSync(cmd, {
      cwd: fullPath, // 切换到目标目录
      stdio: "inherit", // 显示实时输出
    });
    // 新增空文件检测
    const stats = fs.statSync(logPath);
    if (stats.size === 0) {
      fs.unlinkSync(logPath);
      console.log(`检测到空日志文件，已删除: ${logPath}`);
    } else {
      console.log(`生成有效日志: ${logPath} (${stats.size} bytes)`);
    }
  } catch (err) {
    console.error(`执行失败: ${dir_name}`, err.message);
    // 失败时清理残留文件
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
      console.log(`清理残留文件: ${logPath}`);
    }
  }
};

try {
  const entries = fs.readdirSync(SCAN_PATH, { withFileTypes: true });

  const dirs = entries
    .filter((dirent) => dirent.isDirectory())
    .filter(({ name }) => !IGNORE_DIR.includes(name))
    .filter(({ name }) => !name.startsWith("."))
    // 新增Git仓库检查
    .filter((dirent) => {
      const gitPath = path.join(SCAN_PATH, dirent.name, ".git");
      try {
        return fs.statSync(gitPath).isDirectory();
      } catch {
        return false;
      }
    })
    .map(({ name }) => name);

  console.log(`发现 ${dirs.length} 个Git仓库目录`);
  // 新增进度跟踪
  console.log(`开始处理 ${dirs.length} 个仓库...`);
  let processed = 0;
  const total = dirs.length;

  dirs.forEach((dir, index) => {
    const progress = (((index + 1) / total) * 100).toFixed(1);
    console.log(`[${index + 1}/${total}] ${progress}% 正在处理: ${dir}`);
    run_shell(dir);
    processed++;
  });

  console.log(`处理完成，成功处理 ${processed}/${total} 个仓库`);
  // 新增日志整合功能
  const logFiles = fs.readdirSync(SAVE_PATH).filter((f) => f.endsWith(".log"));
  const allLogs = [];

  logFiles.forEach((file) => {
    const project = path.basename(file, ".log");
    const content = fs.readFileSync(path.join(SAVE_PATH, file), "utf-8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^(\w+).*?(\d{4}-\d{2}-\d{2}).*?:\s(.*)/);
      if (match) {
        // 新增过滤逻辑 - 排队不符合时间区间的信息
        const logDate = match[2].trim();
        if (logDate < START_DATE || logDate > END_DATE) {
          return;
        }
        allLogs.push({
          date: match[2].trim(),
          project: project,
          message: match[3].trim(),
          hash: match[1].trim(),
        });
      }
    });
  });

  // 按日期排序
  allLogs.sort((a, b) => a.date.localeCompare(b.date));

  // 生成分类输出
  const result = {};
  allLogs.forEach(({ date, project, line }) => {
    result[date] = result[date] || {};
    result[date][project] = result[date][project] || [];
    result[date][project].push(line);
  });

  // 生成Markdown表格
  const mdContent = [
    "| 日期 | 项目 | 提交内容 | 提交记录Hash码 |",
    "|------|------|----------|--------------|",
    ...allLogs
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(
        (log) =>
          `| ${log.date} | ${log.project} | ${log.message} | ${log.hash} |`
      ),
  ].join("\n");

  fs.writeFileSync("git.md", mdContent);
  console.log("\n整合GIT仓库信息完成，结果已保存至 git.md");
} catch (err) {
  console.error("扫描目录时出错:", err);
}
