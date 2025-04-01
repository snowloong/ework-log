# 工作日志自动化生成工具

该工具用于自动整理Git提交记录和工作时间记录，生成合并后的工作信息报表。

主要功能说明：
1. `run.sh` 脚本通过清理旧文件 -> 收集Git日志 -> 收集工时 -> 生成合并报表的流程自动化整个处理过程
2. `generate_work_info.js` 实现了核心的表格合并逻辑，将分散的Git提交记录按日期+项目分组聚合
3. 最终生成的报表同时保留了原始Hash码和可读的工作内容描述（merged_git_work.md）

##### 汇总的Git信息表
| 日期 | 项目 | 提交内容 | 提交记录Hash码 |
|------|------|----------|--------------|
| 2025-03-03 | test-mgr | fix🐛: 添加两种任务类型，支持搜索 资方发消息催代办； 资方发消息催信披 | 6eb17b3 |
| 2025-03-04 | test-web | feat✨: 取消 机构授权页 | 97d8e6734 |
| 2025-03-04 | test-web | feat✨:  准入机构管理 授权/停止授权修改 | fefb68bbc |
| 2025-03-04 | test-web | Merge branch 'dev-twoside' into sit-saas | ce0e3d349 |


##### 汇总的工时信息表
| 时间 | 班次 | 实际工作时长(h) |
|------|------|--------------|
| 2025-03-03 | 正常 | 8.6 |
| 2025-03-04 | 正常 | 10.2 |
| 2025-03-05 | 正常 | 11.1 |
| **总计** | | ～小时（～天～小时） |


##### 最后聚合的类似的工作信息表
| 日期 | 工作内容 |
|------|----------|
| 2025-03-03 | **test-mgr**<br>fix🐛: 添加两种任务类型，支持搜索 资方发消息催代办； 资方发消息催信披 |
| 2025-03-04 | **test-web**<br>feat✨: 取消 机构授权页<br>feat✨:  准入机构管理 授权/停止授权修改<br>Merge branch 'dev-twoside' into sit-saas<br>feat✨: 取消 机构授权页<br>feat✨:  准入机构管理 授权/停止授权修改 |
| 2025-03-05 | **test-web**<br>feat✨: 根据消息ID 查询已邀请的产品信息 自动填充<br>fix🐛: fix<br>feat✨: 机构授权 颗粒度改造<br>Merge branch 'dev-twoside' into sit-saas<br>feat✨: 根据消息ID 查询已邀请的产品信息 自动填充<br>Merge branch 'dev-twoside' into sit-saas<br>fix🐛: fix<br>Merge branch 'dev-twoside' into sit-saas<br>feat✨: 机构授权 颗粒度改造 |
