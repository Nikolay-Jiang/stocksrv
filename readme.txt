 基于NODEJS+TYPESCRIPT 将已有的功能从C/S架构迁移到 B/S架构
基本依赖：
    npm install typescript --save-dev
    npm install prisma --save-dev
    npm install @prisma/client@dev prisma@dev
    tsc --init //初始化项目文件夹
    #npm install mssql

    npx prisma db pull #从MSSQL 中拉取数据模型到本地 schema.prisma
