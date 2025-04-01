
rm *.md
rm ./logs/*.log
echo '==========================================='
echo 
node git_info_collect.js
echo 
echo '==========================================='
echo 
node work_time_collect.js
echo 
echo '==========================================='
echo 
node generate_work_info.js
echo 
echo '==========================================='