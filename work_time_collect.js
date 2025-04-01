/*** 
 * @Author: yaoruidong yaord@meix.com
 * @Date: 2025-04-01 10:51:59
 * @LastEditors: yaoruidong yaord@meix.com
 * @LastEditTime: 2025-04-01 11:56:11
 * @FilePath: /git_log/work_time_collect.js
 * @Description: 
 * @
 */
const xlsx = require("xlsx");
const fs = require('fs');
const FILE_PATH = "/Users/finleyyao/meix/git_log/work.xlsx";

// 新增 Excel 读取逻辑
try {
  const workbook = xlsx.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 将工作表数据转换为 JSON 格式
  const data = xlsx.utils.sheet_to_json(worksheet);
  // console.log("Excel 文件内容（原始）：", data);
  // 修改为保留指定三列
  const filteredData = data
    .map((row, index) => {
      if(index< 5){
        // console.log(row)
        console.log(`${row["概况统计与打卡明细"]}`.substring(0, "2025/03/10".length).replaceAll("/", "-"))
      }
      const fmt_str = "2025/03/10"
      const target = {
        时间: `${row["概况统计与打卡明细"]}`.substring(0, fmt_str.length).replaceAll("/", "-"),
        班次: row["__EMPTY_5"] != "休息" ? "正常" : null,
        实际工作时长: Number(`${row["__EMPTY_10"]}`.replaceAll("小时",'') || 0),
      };
      if ( target["班次"] != null && `${target['时间']}`.length == fmt_str.length && target["实际工作时长"] > '0') {
        return target;
      }
    })
    .filter((i) => i)
    .reverse();

    const totalHours = filteredData.reduce((acc, row) => 
  acc + parseFloat(row.实际工作时长 || 0), 0);

// 新增天数计算
const workDays = Math.floor(totalHours / 8);
const remainHours = totalHours % 8;
const durationText = `${workDays}天${remainHours.toFixed(1)}小时`;

  // 替换原有的控制台输出
  const mdHeader = `| 时间 | 班次 | 实际工作时长(h) |\n|------|------|--------------|`;
  const mdContent = filteredData
  .reduce((acc, row) => acc + `\n| ${row.时间} | ${row.班次} | ${row.实际工作时长} |`, mdHeader)
  + `\n| **总计** | | ${totalHours.toFixed(1)}小时（${durationText}） |`;

  fs.writeFileSync("time.md", mdContent);
  console.log("整合工时打卡信息完成，结果已保存至 time.md");
} catch (err) {
  console.error("读取 Excel 文件失败:", err.message);
}
