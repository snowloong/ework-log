console.log('生成完整的工作信息')

const GIT_INFO ='./git.md'
const WORK_INFO ='./time.md'
const fs = require('fs');

// 解析Markdown表格为数组
function parseMDTable(filePath) {
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(line => line.startsWith('|') && !line.startsWith('|--'))
    .slice(1) // 跳过表头
    .map(line => line.split('|').slice(1, -1).map(c => c.trim()));
}

// 读取文件数据
const workData = parseMDTable(WORK_INFO);
const gitData = parseMDTable(GIT_INFO);

// 按日期+项目分组
const gitMap = workData.reduce((acc, [workDate]) => {
  const entries = gitData.filter(([gitDate]) => gitDate === workDate);
  acc[workDate] = entries.reduce((projs, [_, project, commit]) => {
    projs[project] = (projs[project] || []).concat(commit);
    return projs;
  }, {});
  return acc;
}, {});

// 生成两列表格
const mdHeader = `| 日期 | 工作内容 |\n|------|----------|`;
const mdRows = workData.map(([workDate]) => {
  const projects = gitMap[workDate];
  const content = Object.entries(projects).length > 0 
    ? Object.entries(projects).map(([proj, commits]) => 
        `**${proj}**\n${commits.join('\n')}`
      ).join('\n\n')
    : '无提交记录';

  return `| ${workDate} | ${content.replace(/\n/g, '<br>')} |`;
});


fs.writeFileSync('merged_git_work.md', [mdHeader, ...mdRows].join('\n'));
console.log('合并表格已生成至 merged_git_work.md');