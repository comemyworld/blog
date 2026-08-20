---
title: V2X的数据流转
date: 2026-08-20 14:36:33
tags:
categories:
  - 技术文档
  - 十城十车
description: blade-v2x 原项目的数据流转
---

# V2X数据流转

## 概述

​ 在我们的云控基础平台的原始项目当中--SpringBlade,他们使用的框架是SpringBlade这个框架,关于这个所有微服务当中的blade-v2x服务主要的作用是平台和设备之间的通信.

​ OBU车端设备,RSU路端设备,他们采集数据,然后将所有的二进制数据全部推送到我们的HBase数据库当.

## 数据流转

### 上行历史消息查询

{% mermaid %}
flowchart LR
RSU[RSU 设备] -->|上行消息| CCP[CCP 采集平台<br/>外部系统]
CCP -->|写入| HB[(HBase<br/>hbasebsm/hbasersm/<br/>hbasersi/hbasespat)]
UI[前端历史查询] -->|GET /v2x/getBsmListPage 等| VC[V2xController]
VC --> VS[V2xServiceImpl]
VS -->|Scan + Filter| HB
VS -.->|vid 换车牌号| SQL[(MySQL<br/>dm_vid_vehicle)]
VS -->|返回分页结果| UI
{% endmermaid %}

### 下行消息下发

{% mermaid %}
flowchart LR
A[前端/第三方系统] -->|POST /v2x/json/emit| B[V2xMessageController]
B --> C{v2xType 分发}
C -->|0 BSM| D[BsmConvert.jsonToBsm]
C -->|1 MAP| E[MapConvert.jsonToMap]
C -->|2 RSM| F[RsmConvert.jsonToRsm]
C -->|3 SPAT| G[SpatConvert.jsonToSpat]
C -->|4 RSI| H[RsiConvert.jsonToRsi]
D & E & F & G & H --> I[per_encode 编码为 ASN.1 字节流]
I --> J[SimpleMqttClient.publish]
J -->|topic: V2X.RSU.TYPE.rsuId.DOWN| K[EMQX Broker]
K --> L[RSU 路侧设备]
L -->|PC5/C-V2X 广播| M[OBU 车载单元]
{% endmermaid %}

### CCP采集系统

```mermaid
flowchart TB
subgraph L1["① RSU / OBU 采集层"]
direction LR
RSU["RSU 路侧设备"]
OBU["OBU 车载单元"]
RSU <-->|PC5 LTE-V2X| OBU
L1_note["采集：BSM / RSI / RSM / SPAT / MAP"]:::note
end

L1 -->|"MQTT 上行"| L2

subgraph L2["② EMQ X MQTT Broker"]
direction TB
L2_topic["主题格式：V2X.RSU.BSM|RSM|RSI|SPAT|MAP.rsuId.UP"]:::note
L2_auth["认证：SASL_PLAINTEXT + SCRAM-SHA-512"]:::note
subgraph L2_down["平台下行通道（双向）"]
DOWN["主题：V2X.RSU.type.rsuId.DOWN<br/>blade-v2x → V2xMessageController<br/>平台下发消息 → RSU"]
end
end

L2 -->|"原始 V2X 数据"| L3

subgraph L3["③ 海信 CCP hiCCP 处理层"]
direction TB
CCP1["接收 RSU 上报 MQTT 消息"]
CCP2["ASN.1 PER 编解码（协议转换）"]
CCP3["数据清洗 / 格式规整"]
CCP4["生产消息到 Kafka"]
CCP1 --> CCP2 --> CCP3 --> CCP4
end

L3 -->|"Kafka 主题 CCP.VEHICLEID.*"| L4

subgraph L4["④ Kafka 数据总线"]
direction TB
K1["CCP.VEHICLEID.BSM — 基础安全消息"]
K2["CCP.VEHICLEID.RSI — 路侧信息"]
K3["CCP.VEHICLEID.RSM — 路侧安全消息"]
K4["CCP.VEHICLEID.SPAT — 信号灯状态"]
K5["CCP.VEHICLEID.MAP — 地图消息"]
K6["CCP.VEHICLEID.BASEINFO — RSU 基本信息"]
K7["CCP.VEHICLEID.RUNNINGINFO — RSU 运行信息"]
K8["CCP.LAMP.STATE.INFO — 灯态信息"]
end

L4 --> L5A
L4 --> L5B
L4 --> L5C

subgraph L5A["⑤ blade-country · 上报国家大数据中心"]
direction TB
CA1["消费 Kafka 构建 CountryMap 缓存"]
CA2["每 10 秒定时上报 CountryMapAsync"]
CA3["CountryRsuBaseinfo 封装"]
CA4["POST /report/rsu/baseinfo rsiinfo spatinfo mapinfo runninginfo"]
CA1 --> CA2 --> CA3 --> CA4
end

subgraph L5B["⑥ blade-v2x · 实时 SPAT 灯态缓存"]
direction TB
VB1["LampSync 消费 CCP.VEHICLEID.SPAT_*"]
VB2["写入 Redis（只保留最新一条）"]
VB3["SpatServiceImpl 直接查 Redis 返回前端"]
VB1 --> VB2 --> VB3
end

subgraph L5C["⑦ HBase 持久化层 · 全量历史"]
direction TB
HB_T["表：hbasersm / hbasersi / hbasebsm / hbasespat / hbaseevent"]:::note
HB_A["集群：MN001 MN002 MN003:24002"]:::note
HB_S["V2xServiceImpl：分页查询 + 详情查询"]:::note
HB_C["V2xController → REST API 给前端"]:::note
HB_T --> HB_A --> HB_S --> HB_C
end

classDef note fill:#eef5ff,stroke:#9fd2fb,stroke-width:1px,color:#243b53
```

### Redis在当中的作用

​ 在我们的SPAT的数据(也就是我们的路灯数据)当中,我们要实时显示的时候,不可能依旧从我们的hbase当中读取,因为hbase读取的数据效率降低,所以,我们在传的时候,直接把最新的给我们的redis,就是只保存了最新数据.我们的hbase依旧保存所有相关的数据.
