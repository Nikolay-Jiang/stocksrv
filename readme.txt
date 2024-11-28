 基于NODEJS+TYPESCRIPT 将已有的功能从C/S架构迁移到 B/S架构
基本依赖：
    npm install typescript --save-dev
    npm install prisma --save-dev
    npm install @prisma/client@dev prisma@dev
    tsc --init //初始化项目文件夹
    #npm install mssql
    
    #npm install -g ts-node
    npx prisma db pull #从MSSQL 中拉取数据模型到本地 schema.prisma
    //npx prisma generate #第一次从本地链接数据库 需要运行
    
    curl  http://qt.gtimg.cn/q=sz300627,sz002415,sh600741 #腾讯接口测试,注意到域名的延时

    #编译 ts to js node 23
    npm uninstall tsc
    npm install -D typescript
    npx tsc 