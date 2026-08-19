---
title: Linux常见的命令操作
date: 2026-08-18 11:49:49
tags:
  - 技术
  - Linux
categories:
  - 相册
  - 生活
description: Linux常见的命令操作
top: true
---

# linux系统,常见命令

## 查看相关命令

```bash
# 查看当前目录下的所有文件
ls -R
# 进入目录,右斜杠,绝对路径,无斜杠,相对路径
cd /root/etc  cd root/etc
# 查看文件内容
cat nginx.conf(文件名)

```

## nginx相关命令

```bash
# 测试nginx的配置是否错误
nginx -t
# 启动nginx ,-c 后接指定配置文件
nginx -c 路径
# 启动nginx,使用默认配置文件
nginx
```

## 软链接相关命令

```bash
# 切换软链接指向路径
ln -sfn csv2x-workspace-v2 csv2x-workspace
# 查看软链接指向
ls -ln csv2x-workspace
```

## 确认运行情况

```bash
# 查看java相关线程(factory)的运行情况
ps aux | grep factory | grep java

```
